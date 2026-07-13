# GPT-5.2 Relaxed Full Three-Arm Run

Date: 2026-06-30. Final local grading updated 2026-07-01.

## Purpose

Run the full 85-task Flipt SWE-bench Pro corpus with the relaxed GPT-5.2 Codex harness after the strict repeat-1 audit showed the original generation settings were too restrictive. This run is intended to replace the strict repeat-1 generation as the clean GPT-5.2 comparison for:

- `C0`: snapshot `.git`, no memory.
- `C1_git_history`: cutoff-limited `.git`, no injected memory.
- `C4_git_history_mcts_mem`: `C1_git_history` plus MCTS-Mem context.

`C4` is deliberately `C1 + MCTS-Mem`, not `C0 + MCTS-Mem`.

## Runner

Script:

```bash
paper/evaluations/flipt/scripts/run_gpt52_relaxed_full85_three_arm_by_instance_repeat1.sh
```

Result directory:

```text
paper/evaluations/flipt/results/full85_three_arm_gpt52_codex_relaxed_cutoffgit_repeat1
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

The runner advances by instance and runs the three arms in parallel for that instance. It removes each Flipt Docker image after the instance completes to reduce disk pressure.

## Operational Notes

- Old GPT-5.5 exploratory outputs and the strict GPT-5.2 repeat-1 outputs are preserved and must not be overwritten.
- A failed earlier attempt at instance `65581fef4aa8` lost Docker containers mid-run and produced empty C0/C4 predictions. Those interrupted artifacts were preserved under:

```text
paper/evaluations/flipt/results/full85_three_arm_gpt52_codex_relaxed_cutoffgit_repeat1/supervisor_logs/interrupted_65581fef4aa8_20260630T073044
```

- The active `preds.json` files were pruned only for that interrupted instance so it could be regenerated cleanly. The rerun completed instance `65581fef4aa8` with nonempty patches in all three arms.
- The relaxed full runner was patched so `condition_done` requires a trajectory and prediction, and rejects empty patches only when the runner log shows Docker container loss (`No such container`). This prevents resumes from treating empty container-loss artifacts as complete while still preserving legitimate empty-patch failures as benchmark outcomes.
- A transient Docker Hub connection refusal stopped the run before instance `86906cbfc3a5`; resuming the same script pulled the image successfully and continued from the checkpoint.
- Disk cleanup has been conservative: removed stopped SWE-Atlas containers and old Go build caches, but no active containers or preserved benchmark result directories were deleted.

## Generation Result

Generation completed all 85 instances on 2026-06-30. Final generation counts:

| arm | predictions | nonempty patches | trajectories | exit statuses |
| --- | ---: | ---: | ---: | --- |
| `C0` | 85 | 84 | 85 | `Submitted=78`, `LimitsExceeded=7` |
| `C1_git_history` | 85 | 85 | 85 | `Submitted=77`, `LimitsExceeded=8` |
| `C4_git_history_mcts_mem` | 85 | 85 | 85 | `Submitted=80`, `LimitsExceeded=5` |

`C0` has one legitimate empty patch retained as a benchmark outcome; the runner's resume logic accepts empty patches only when there is no Docker container-loss evidence in the runner log.

## Local Grading

Disk-conservative local grading completed with:

```bash
python3 paper/evaluations/flipt/scripts/grade_predictions_local.py \
  --results-dir paper/evaluations/flipt/results/full85_three_arm_gpt52_codex_relaxed_cutoffgit_repeat1 \
  --conditions C0 C1_git_history C4_git_history_mcts_mem \
  --workers 1 \
  --timeout-seconds 3600 \
  --timeout-per-chunk 1200 \
  --chunk-size 12 \
  --by-instance \
  --remove-images-after-instance
```

Initial grading had Docker image-pull failures on four instances: `56a620b8fc9e`, `7161f7b87677`, `72d06db14d58`, and `cd2f3b0a9d4d`. These were force-regraded with `--instance-id` after manual Docker pulls where needed. The final summary was rebuilt from all 255 existing per-condition `result.json` files.

Final local targeted grading from:

```text
paper/evaluations/flipt/results/full85_three_arm_gpt52_codex_relaxed_cutoffgit_repeat1/local_grade_reports/summary.json
```

| arm | total | nonempty | resolved | status counts |
| --- | ---: | ---: | ---: | --- |
| `C0` | 85 | 84 | 7 | `empty_patch=1`, `resolved=7`, `unresolved=77` |
| `C1_git_history` | 85 | 85 | 8 | `resolved=8`, `unresolved=77` |
| `C4_git_history_mcts_mem` | 85 | 85 | 8 | `resolved=8`, `unresolved=77` |

Resolved short ids:

| arm | resolved short ids |
| --- | --- |
| `C0` | `15b76cad`, `21a935ad`, `b2170346`, `c12967bc`, `cf06f4eb`, `db1c3b10`, `e88e9399` |
| `C1_git_history` | `15b76cad`, `1dceb5ed`, `21a935ad`, `7161f7b8`, `b2170346`, `c12967bc`, `cf06f4eb`, `db1c3b10` |
| `C4_git_history_mcts_mem` | `15b76cad`, `1dceb5ed`, `21a935ad`, `c12967bc`, `cf06f4eb`, `db1c3b10`, `dbe26396`, `f1bc91a1` |

Paired outcomes:

| comparison | first-only wins | second-only wins | both resolved | neither resolved | first-only ids | second-only ids |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| `C4_git_history_mcts_mem` vs `C1_git_history` | 2 | 2 | 6 | 75 | `dbe26396`, `f1bc91a1` | `7161f7b8`, `b2170346` |
| `C4_git_history_mcts_mem` vs `C0` | 3 | 2 | 5 | 75 | `1dceb5ed`, `dbe26396`, `f1bc91a1` | `b2170346`, `e88e9399` |
| `C1_git_history` vs `C0` | 2 | 1 | 6 | 76 | `1dceb5ed`, `7161f7b8` | `e88e9399` |

Interpretation:

- The relaxed harness fixed the strict run's non-submit saturation at generation time, but full-corpus resolved rates remain low.
- C4 ties raw cutoff git on total resolved count (`8/85` vs `8/85`) and has no net paired advantage over C1 (`2` wins / `2` losses).
- C4 is only slightly above no-memory C0 (`8/85` vs `7/85`, paired net `+1`). This is too small for a strong full-corpus claim.
- The local grader is a paper-side sanity grader; official harness results remain the authority. The useful next analysis is qualitative/stratified: inspect the C4-only wins and C4 losses to see whether they align with history/design-memory relevance.
