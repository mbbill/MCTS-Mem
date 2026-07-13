#!/bin/bash
set -uo pipefail
WS=/Users/bytedance/Dev/MCTS-Mem/paper/evaluations/swe_atlas_qna
export CONFIG="$WS/configs/mswea_qa_config.yaml"
export EFFORT="${EFFORT:-high}"
export NCONC="${NCONC:-2}"
for COND in "$@"; do
  echo "===== RUN $COND $(date) ====="
  DATASET="$WS/conditions/$COND" JOBNAME="kitty_${COND}${SUFFIX:-}" bash "$WS/scripts/run_qna.sh"
  echo "===== SCORE $COND ====="
  python3 "$WS/scripts/parse_results.py" "$WS/results/kitty_${COND}${SUFFIX:-}" --label "${COND}${SUFFIX:-}" 2>&1 | tail -18
done
echo "ALL CONDITIONS DONE: $* $(date)"
