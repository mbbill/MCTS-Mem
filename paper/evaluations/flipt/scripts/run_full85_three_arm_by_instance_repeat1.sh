#!/usr/bin/env bash
set -u

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

OUTROOT="paper/evaluations/flipt/results/full85_three_arm_gpt55_mt2048_repeat1_gitguard"
PY="paper/evaluations/flipt/.venv-mcts-eval/bin/python"
MODEL="anthropic/claude-gpt-5.5"
CONFIG="paper/evaluations/flipt/configs/mild_swebench.yaml"
RUNNER="paper/evaluations/flipt/scripts/run_condition.py"
TASKS="paper/evaluations/flipt/tasks/flipt_swebench_pro_tasks.jsonl"

export ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-local}"
export ANTHROPIC_API_BASE="${ANTHROPIC_API_BASE:-http://127.0.0.1:8787}"
export MSWEA_AFTER_DIFF_WARN_ACTIONS="${MSWEA_AFTER_DIFF_WARN_ACTIONS:-2}"
export MSWEA_AFTER_DIFF_REJECT_ACTIONS="${MSWEA_AFTER_DIFF_REJECT_ACTIONS:-3}"
export MCTS_MEM_SANITIZE_GIT_HISTORY="${MCTS_MEM_SANITIZE_GIT_HISTORY:-1}"

CONDITIONS=(C0 C1_raw_git C4_mcts_mem_top8w900)
mkdir -p "$OUTROOT/ids" "$OUTROOT/supervisor_logs"

if [[ ! -x "$PY" ]]; then
  echo "Missing eval Python: $PY" >&2
  exit 2
fi

condition_done() {
  local cond="$1"
  local iid="$2"
  "$PY" - <<'PY' "$OUTROOT" "$cond" "$iid"
import json, pathlib, sys
root = pathlib.Path(sys.argv[1])
cond = sys.argv[2]
iid = sys.argv[3]
preds = root / cond / "preds.json"
traj = root / cond / iid / f"{iid}.traj.json"
if not preds.exists() or not traj.exists():
    print("no")
    raise SystemExit(0)
try:
    data = json.loads(preds.read_text())
except Exception:
    print("no")
else:
    print("yes" if iid in data else "no")
PY
}

all_done() {
  local iid="$1"
  local cond
  for cond in "${CONDITIONS[@]}"; do
    [[ "$(condition_done "$cond" "$iid")" == "yes" ]] || return 1
  done
  return 0
}

run_cond() {
  local cond="$1"
  local iid="$2"
  local ids_file="$3"
  local short="$4"
  local out="$OUTROOT/$cond"
  mkdir -p "$out"
  "$PY" "$RUNNER" \
    --condition "$cond" \
    --model "$MODEL" \
    --output "$out" \
    --workers 1 \
    --ids-file "$ids_file" \
    --redo-existing \
    --config "$CONFIG" \
    --config agent.max_consecutive_format_errors=4 \
    --config agent.step_limit=24 \
    --config agent.wall_time_limit_seconds=600 \
    --config model.model_kwargs.timeout=180 \
    --config model.model_kwargs.max_tokens=2048 \
    --include-test-context \
    > "$out/${short}.runner.log" 2>&1
}

progress() {
  "$PY" - <<'PY' "$OUTROOT"
import json, pathlib, sys
root = pathlib.Path(sys.argv[1])
for cond in ["C0", "C1_raw_git", "C4_mcts_mem_top8w900"]:
    out = root / cond
    preds_path = out / "preds.json"
    preds = {}
    if preds_path.exists():
        try:
            preds = json.loads(preds_path.read_text())
        except Exception:
            preds = {}
    nonempty = sum(1 for value in preds.values() if isinstance(value, dict) and (value.get("model_patch") or "").strip())
    traj = len(list(out.glob("*/*.traj.json"))) if out.exists() else 0
    print(f"  {cond}: preds={len(preds)}/85 nonempty={nonempty} traj={traj}")
PY
}

"$PY" - <<'PY' "$TASKS" > "$OUTROOT/task_order.tsv"
import json, sys
from pathlib import Path
for line in Path(sys.argv[1]).read_text().splitlines():
    if not line.strip():
        continue
    row = json.loads(line)
    image = f"jefzda/sweap-images:{row['dockerhub_tag']}"
    print(f"{row['instance_id']}\t{image}")
PY

total="$(wc -l < "$OUTROOT/task_order.tsv" | tr -d ' ')"
index=0
while IFS=$'\t' read -r iid image; do
  index=$((index + 1))
  short="${iid#instance_flipt-io__flipt-}"
  short="${short%%-*}"
  short="${short:0:12}"
  ids_file="$OUTROOT/ids/${short}.txt"
  printf '%s\n' "$iid" > "$ids_file"

  if [[ "${FORCE_REDO:-0}" != "1" ]] && all_done "$iid"; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$index/$total] skip done $short"
    continue
  fi

  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$index/$total] pull $short $image"
  docker pull --platform linux/amd64 "$image" > "$OUTROOT/supervisor_logs/${short}.docker_pull.log" 2>&1
  if [[ "$?" != "0" ]]; then
    echo "docker pull failed for $image; see $OUTROOT/supervisor_logs/${short}.docker_pull.log" >&2
    exit 1
  fi

  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$index/$total] run $short"
  run_cond C0 "$iid" "$ids_file" "$short" & pid_c0=$!
  run_cond C1_raw_git "$iid" "$ids_file" "$short" & pid_c1=$!
  run_cond C4_mcts_mem_top8w900 "$iid" "$ids_file" "$short" & pid_c4=$!
  wait "$pid_c0"; code_c0=$?
  wait "$pid_c1"; code_c1=$?
  wait "$pid_c4"; code_c4=$?
  if [[ "$code_c0" != "0" || "$code_c1" != "0" || "$code_c4" != "0" ]]; then
    echo "condition failed for $iid: C0=$code_c0 C1=$code_c1 C4=$code_c4" >&2
    exit 1
  fi

  if ! all_done "$iid"; then
    echo "missing trajectory/prediction after run for $iid" >&2
    progress
    exit 1
  fi

  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$index/$total] done $short"
  progress
  if [[ "${KEEP_IMAGES:-0}" != "1" ]]; then
    for attempt in 1 2 3; do
      docker rmi "$image" >/dev/null 2>&1 && break
      sleep 5
    done
  fi
done < "$OUTROOT/task_order.tsv"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] final progress"
progress
