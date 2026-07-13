#!/usr/bin/env bash
set -u

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

OUTROOT="paper/evaluations/flipt/results/gpt52_codex_smoke10_c0_snapshot_responses"
PY="paper/evaluations/flipt/.venv-mcts-eval/bin/python"
MODEL="openai/claude-gpt-5.2-codex"
CONFIG="paper/evaluations/flipt/configs/mild_swebench_gpt52_git.yaml"
RUNNER="paper/evaluations/flipt/scripts/run_condition.py"
TASKS="paper/evaluations/flipt/tasks/flipt_swebench_pro_tasks.jsonl"
SMOKE_N="${SMOKE_N:-10}"

export OPENAI_API_KEY="${OPENAI_API_KEY:-sk-local-proxy-dummy}"
export OPENAI_API_BASE="${OPENAI_API_BASE:-http://127.0.0.1:8789}"
export MSWEA_AFTER_DIFF_WARN_ACTIONS="${MSWEA_AFTER_DIFF_WARN_ACTIONS:-2}"
export MSWEA_AFTER_DIFF_REJECT_ACTIONS="${MSWEA_AFTER_DIFF_REJECT_ACTIONS:-3}"
export MSWEA_MODEL_RETRY_STOP_AFTER_ATTEMPT="${MSWEA_MODEL_RETRY_STOP_AFTER_ATTEMPT:-3}"
export MCTS_MEM_SANITIZE_GIT_HISTORY="${MCTS_MEM_SANITIZE_GIT_HISTORY:-1}"

mkdir -p "$OUTROOT/ids" "$OUTROOT/supervisor_logs"

if [[ ! -x "$PY" ]]; then
  echo "Missing eval Python: $PY" >&2
  exit 2
fi

"$PY" - <<'PY' "$TASKS" "$SMOKE_N" > "$OUTROOT/task_order.tsv"
import json, sys
from pathlib import Path
limit = int(sys.argv[2])
count = 0
for line in Path(sys.argv[1]).read_text().splitlines():
    if not line.strip() or count >= limit:
        continue
    row = json.loads(line)
    image = f"jefzda/sweap-images:{row['dockerhub_tag']}"
    print(f"{row['instance_id']}\t{image}")
    count += 1
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

  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$index/$total] pull $short $image"
  docker pull --platform linux/amd64 "$image" > "$OUTROOT/supervisor_logs/${short}.docker_pull.log" 2>&1
  if [[ "$?" != "0" ]]; then
    if docker image inspect "$image" >/dev/null 2>&1; then
      echo "docker pull failed for $image, using existing local image; see $OUTROOT/supervisor_logs/${short}.docker_pull.log" >&2
    else
      echo "docker pull failed for $image; see $OUTROOT/supervisor_logs/${short}.docker_pull.log" >&2
      exit 1
    fi
  fi

  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$index/$total] run C0 $short"
  out="$OUTROOT/C0"
  mkdir -p "$out"
  "$PY" "$RUNNER" \
    --condition C0 \
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
    --git-history-mode snapshot \
    > "$out/${short}.runner.log" 2>&1
  code="$?"
  if [[ "$code" != "0" ]]; then
    echo "C0 smoke failed for $iid: code=$code" >&2
    exit 1
  fi

  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$index/$total] done $short"
  "$PY" paper/evaluations/flipt/scripts/summarize_predictions.py "$OUTROOT"
  if [[ "${KEEP_IMAGES:-0}" != "1" ]]; then
    for attempt in 1 2 3; do
      docker rmi "$image" >/dev/null 2>&1 && break
      sleep 5
    done
  fi
done < "$OUTROOT/task_order.tsv"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] final progress"
"$PY" paper/evaluations/flipt/scripts/summarize_predictions.py "$OUTROOT"
