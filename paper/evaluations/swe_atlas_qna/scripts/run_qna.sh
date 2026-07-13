#!/bin/bash
# Run SWE-Atlas Codebase QnA tasks through harbor (local Docker) against the
# local proxy (gpt-5.2-codex). Agent = mini-swe-agent on the host (127.0.0.1);
# judge = evaluate_answer.py inside the container (host.docker.internal).
#
# Usage:
#   CONFIG=.../mswea_qa_config.yaml JOBNAME=kitty_c0 EFFORT=high NCONC=2 \
#     run_qna.sh <task-name> [<task-name> ...]
# With no task args, runs the whole data/qa dataset.
set -euo pipefail

ATLAS=/Users/bytedance/Dev/SWE-Atlas
WS=/Users/bytedance/Dev/MCTS-Mem/paper/evaluations/swe_atlas_qna

# Agent + judge both run IN-CONTAINER and reach the host litellm proxy (8790),
# which exposes OpenAI chat+responses and translates to the Anthropic proxy (8789).
PROXY_CONTAINER="http://host.docker.internal:8790/v1"
MODEL="${MODEL:-openai/claude-gpt-5.2-codex}"     # agent model (override for frontier runs)
JUDGE_MODEL="${JUDGE_MODEL:-claude-gpt-5.2-codex}" # judge held fixed across model runs

CONFIG="${CONFIG:-$WS/configs/mswea_qa_config.yaml}"
DATASET="${DATASET:-$ATLAS/data/qa}"
JOBNAME="${JOBNAME:-kitty_qna}"
OUT="${OUT:-$WS/results/$JOBNAME}"
EFFORT="${EFFORT-high}"   # default only when UNSET; EFFORT="" stays empty (omits the flag)
NCONC="${NCONC:-1}"

INCLUDE_ARGS=()
for t in "$@"; do INCLUDE_ARGS+=( -i "$t" ); done

# Passing reasoning_effort makes harbor's adapter force model_class=litellm_response
# (Responses API + native tool calls) for openai/ models. That path collapses on
# gpt-5.5 at large context (empty tool-call args). Set EFFORT="" to omit it, which
# lets the config's own model_class (e.g. litellm_textbased on chat/completions) win.
EFFORT_ARGS=()
if [ -n "$EFFORT" ]; then EFFORT_ARGS=( --ak reasoning_effort="$EFFORT" ); fi

set -x
harbor run \
  -p "$DATASET" \
  ${INCLUDE_ARGS[@]+"${INCLUDE_ARGS[@]}"} \
  -a mini-swe-agent \
  -m "$MODEL" \
  -e docker \
  --cpus ignore \
  --memory ignore \
  --max-retries "${MAX_RETRIES:-0}" \
  -k 1 -n "$NCONC" \
  --env-file "$ATLAS/.env" \
  --ak config_file="$CONFIG" \
  ${EFFORT_ARGS[@]+"${EFFORT_ARGS[@]}"} \
  --ae OPENAI_API_BASE="$PROXY_CONTAINER" \
  --ae OPENAI_API_KEY=sk-local-proxy-dummy \
  --ve EVAL_BASE_URL="$PROXY_CONTAINER" \
  --ve EVAL_API_KEY=sk-local-proxy-dummy \
  --ve EVAL_MODEL="$JUDGE_MODEL" \
  -o "$OUT" \
  --job-name "$JOBNAME" \
  --yes
