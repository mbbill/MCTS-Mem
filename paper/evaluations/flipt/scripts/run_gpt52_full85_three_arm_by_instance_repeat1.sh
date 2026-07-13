#!/usr/bin/env bash
set -u

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

OUTROOT="paper/evaluations/flipt/results/full85_three_arm_gpt52_codex_cutoffgit_repeat1"
PY="paper/evaluations/flipt/.venv-mcts-eval/bin/python"
MODEL="openai/claude-gpt-5.2-codex"
CONFIG="paper/evaluations/flipt/configs/mild_swebench_gpt52_git.yaml"
RUNNER="paper/evaluations/flipt/scripts/run_condition.py"
TASKS="paper/evaluations/flipt/tasks/flipt_swebench_pro_tasks.jsonl"

export OPENAI_API_KEY="${OPENAI_API_KEY:-sk-local-proxy-dummy}"
export OPENAI_API_BASE="${OPENAI_API_BASE:-http://127.0.0.1:8789}"
export MSWEA_AFTER_DIFF_WARN_ACTIONS="${MSWEA_AFTER_DIFF_WARN_ACTIONS:-2}"
export MSWEA_AFTER_DIFF_REJECT_ACTIONS="${MSWEA_AFTER_DIFF_REJECT_ACTIONS:-3}"
export MSWEA_MODEL_RETRY_STOP_AFTER_ATTEMPT="${MSWEA_MODEL_RETRY_STOP_AFTER_ATTEMPT:-3}"
export MCTS_MEM_SANITIZE_GIT_HISTORY="${MCTS_MEM_SANITIZE_GIT_HISTORY:-1}"

CONDITIONS=(C0 C1_git_history C4_git_history_mcts_mem)
mkdir -p "$OUTROOT/ids" "$OUTROOT/supervisor_logs" "$OUTROOT/bundles"

if [[ ! -x "$PY" ]]; then
  echo "Missing eval Python: $PY" >&2
  exit 2
fi

git_mode_for_condition() {
  case "$1" in
    C0) echo snapshot ;;
    C1_git_history|C4_git_history_mcts_mem) echo cutoff ;;
    *) echo snapshot ;;
  esac
}

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
  local mode
  mode="$(git_mode_for_condition "$cond")"
  local out="$OUTROOT/$cond"
  mkdir -p "$out"
  "$PY" "$RUNNER" \
    --condition "$cond" \
    --model "$MODEL" \
    --model-class litellm_response \
    --output "$out" \
    --workers 1 \
    --ids-file "$ids_file" \
    --redo-existing \
    --config "$CONFIG" \
    --config agent.max_consecutive_format_errors=4 \
    --config agent.step_limit=24 \
    --config agent.wall_time_limit_seconds=600 \
    --config model.model_kwargs.timeout=180 \
    --config model.model_kwargs.max_output_tokens=2048 \
    --config model.model_kwargs.drop_params=true \
    --config model.model_kwargs.temperature=1.0 \
    --config model.model_kwargs.reasoning.effort=high \
    --include-test-context \
    --git-history-mode "$mode" \
    --bundle-dir "$OUTROOT/bundles" \
    > "$out/${short}.runner.log" 2>&1
}

progress() {
  "$PY" paper/evaluations/flipt/scripts/summarize_predictions.py "$OUTROOT"
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
  pull_ok=0
  : > "$OUTROOT/supervisor_logs/${short}.docker_pull.log"
  for attempt in 1 2 3; do
    echo "pull attempt $attempt/3" >> "$OUTROOT/supervisor_logs/${short}.docker_pull.log"
    if docker pull --platform linux/amd64 "$image" >> "$OUTROOT/supervisor_logs/${short}.docker_pull.log" 2>&1; then
      pull_ok=1
      break
    fi
    sleep 5
  done
  if [[ "$pull_ok" != "1" ]]; then
    if docker image inspect "$image" >/dev/null 2>&1; then
      echo "docker pull failed for $image, using existing local image; see $OUTROOT/supervisor_logs/${short}.docker_pull.log" >&2
    else
      echo "docker pull failed for $image; see $OUTROOT/supervisor_logs/${short}.docker_pull.log" >&2
      exit 1
    fi
  fi

  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$index/$total] run $short"
  pids=()
  names=()
  for cond in "${CONDITIONS[@]}"; do
    if [[ "${FORCE_REDO:-0}" != "1" ]] && [[ "$(condition_done "$cond" "$iid")" == "yes" ]]; then
      echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$index/$total] skip $cond $short"
      continue
    fi
    run_cond "$cond" "$iid" "$ids_file" "$short" &
    pids+=("$!")
    names+=("$cond")
  done

  failed=0
  for i in "${!pids[@]}"; do
    wait "${pids[$i]}"
    code="$?"
    if [[ "$code" != "0" ]]; then
      echo "condition failed for $iid: ${names[$i]}=$code" >&2
      failed=1
    fi
  done
  if [[ "$failed" != "0" ]]; then
    exit 1
  fi

  if ! all_done "$iid"; then
    echo "missing trajectory/prediction after run for $iid" >&2
    progress
    exit 1
  fi

  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$index/$total] done $short"
  progress
  find "$OUTROOT/bundles" -type f -name '*.bundle' -delete 2>/dev/null || true
  if [[ "${KEEP_IMAGES:-0}" != "1" ]]; then
    for attempt in 1 2 3; do
      docker rmi "$image" >/dev/null 2>&1 && break
      sleep 5
    done
  fi
done < "$OUTROOT/task_order.tsv"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] final progress"
progress
