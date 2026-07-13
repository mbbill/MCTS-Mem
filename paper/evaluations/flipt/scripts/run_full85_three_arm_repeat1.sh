#!/usr/bin/env bash
set -u

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

OUTROOT="paper/evaluations/flipt/results/full85_three_arm_gpt55_mt2048_repeat1"
PY="paper/evaluations/flipt/.venv-mcts-eval/bin/python"
MODEL="anthropic/claude-gpt-5.5"
CONFIG="paper/evaluations/flipt/configs/mild_swebench.yaml"
RUNNER="paper/evaluations/flipt/scripts/run_condition.py"

export ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-local}"
export ANTHROPIC_API_BASE="${ANTHROPIC_API_BASE:-http://127.0.0.1:8787}"
export MSWEA_AFTER_DIFF_WARN_ACTIONS="${MSWEA_AFTER_DIFF_WARN_ACTIONS:-2}"
export MSWEA_AFTER_DIFF_REJECT_ACTIONS="${MSWEA_AFTER_DIFF_REJECT_ACTIONS:-3}"

if [[ ! -x "$PY" ]]; then
  echo "Missing eval Python: $PY" >&2
  exit 2
fi

mkdir -p "$OUTROOT"

run_cond() {
  local cond="$1"
  local out="$OUTROOT/$cond"
  mkdir -p "$out"
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] starting $cond -> $out"
  "$PY" "$RUNNER" \
    --condition "$cond" \
    --model "$MODEL" \
    --output "$out" \
    --workers 1 \
    --config "$CONFIG" \
    --config agent.max_consecutive_format_errors=4 \
    --config agent.step_limit=24 \
    --config agent.wall_time_limit_seconds=600 \
    --config model.model_kwargs.timeout=180 \
    --config model.model_kwargs.max_tokens=2048 \
    --include-test-context \
    > "$out/runner.stdout.log" 2>&1
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
    status_files = sorted(out.glob("exit_statuses_*.yaml")) if out.exists() else []
    latest_status = status_files[-1].name if status_files else "none"
    print(f"  {cond}: preds={len(preds)}/85 nonempty={nonempty} traj={traj} latest_status={latest_status}")
PY
}

run_cond C0 & pid_c0=$!
run_cond C1_raw_git & pid_c1=$!
run_cond C4_mcts_mem_top8w900 & pid_c4=$!

while :; do
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] progress"
  progress
  running="$(jobs -pr | wc -l | tr -d ' ')"
  [[ "$running" == "0" ]] && break
  sleep 60
done

wait "$pid_c0"; code_c0=$?
wait "$pid_c1"; code_c1=$?
wait "$pid_c4"; code_c4=$?

echo "[$(date '+%Y-%m-%d %H:%M:%S')] final progress"
progress

failed=0
if [[ "$code_c0" != "0" ]]; then echo "C0 failed with exit code $code_c0" >&2; failed=1; fi
if [[ "$code_c1" != "0" ]]; then echo "C1_raw_git failed with exit code $code_c1" >&2; failed=1; fi
if [[ "$code_c4" != "0" ]]; then echo "C4_mcts_mem_top8w900 failed with exit code $code_c4" >&2; failed=1; fi
exit "$failed"
