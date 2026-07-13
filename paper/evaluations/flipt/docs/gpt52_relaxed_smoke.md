# GPT-5.2 Relaxed C0 Smoke

Date: 2026-06-30.

## Purpose

The strict GPT-5.2 repeat-1 run was artifact-complete but saturated the generation harness: 24-step cap, 600s wall time, 2048 output tokens, and aggressive read-only rejections. This smoke checks whether GPT-5.2 Codex behaves normally when the harness is relaxed before spending a full three-arm rerun.

## Run

Result directory:

```text
paper/evaluations/flipt/results/gpt52_codex_relaxed_smoke10_c0_snapshot
```

Command:

```bash
paper/evaluations/flipt/scripts/run_gpt52_relaxed_smoke10_c0_snapshot.sh
```

Model/proxy:

- `OPENAI_API_BASE=http://127.0.0.1:8789`
- `openai/claude-gpt-5.2-codex`
- mini-SWE-agent `litellm_response`

Relaxed settings:

- `agent.step_limit=60`
- `agent.wall_time_limit_seconds=1800`
- `model.model_kwargs.max_output_tokens=4096`
- `model.model_kwargs.timeout=300`
- `MSWEA_NO_DIFF_WARN_ACTIONS=18`, `MSWEA_NO_DIFF_REJECT_ACTIONS=30`
- `MSWEA_AFTER_DIFF_WARN_ACTIONS=8`, `MSWEA_AFTER_DIFF_REJECT_ACTIONS=16`

## Generation Result

| condition | predictions | nonempty patches | trajectories | exit statuses |
| --- | ---: | ---: | ---: | --- |
| `C0` | 10 | 10 | 10 | `Submitted=10` |

This is a clear generation-harness improvement over the strict repeat-1 behavior: no smoke task needed non-submit diff rescue, and no task exited by step/wall-time limit.

## Local Grade Result

Local grading command:

```bash
python3 paper/evaluations/flipt/scripts/grade_predictions_local.py \
  --results-dir paper/evaluations/flipt/results/gpt52_codex_relaxed_smoke10_c0_snapshot \
  --conditions C0 \
  --workers 1 \
  --timeout-seconds 3600 \
  --timeout-per-chunk 1200 \
  --chunk-size 12 \
  --by-instance \
  --remove-images-after-instance
```

| condition | total | nonempty | resolved | statuses |
| --- | ---: | ---: | ---: | --- |
| `C0` | 10 | 10 | 3 | `resolved=3`, `unresolved=7` |

Resolved smoke ids:

- `15b76cada1ef`
- `1dceb5edf3fa`
- `21a935ad7886`

On the same first 10 task ids, strict repeat-1 C0 resolved 2/10 (`15b76cada1ef`, `21a935ad7886`) and had four local grading timeouts. The relaxed smoke keeps those two wins and adds `1dceb5edf3fa`.

## Interpretation

The relaxed smoke does not prove full-corpus quality, but it does show the generation harness no longer forces the GPT-5.2 agent into widespread non-submit exits. A full relaxed three-arm rerun is justified as the next benchmark step, with the strict repeat-1 results retained only as diagnostic evidence.

Next script:

```bash
paper/evaluations/flipt/scripts/run_gpt52_relaxed_full85_three_arm_by_instance_repeat1.sh
```

The relaxed full run writes to:

```text
paper/evaluations/flipt/results/full85_three_arm_gpt52_codex_relaxed_cutoffgit_repeat1
```
