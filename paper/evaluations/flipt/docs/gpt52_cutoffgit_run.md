# GPT-5.2 Codex Cutoff-Git Run

Date: 2026-06-28. Updated with local grading and audit notes on 2026-06-29.

## Purpose

Restart the Flipt SWE-bench Pro evaluation with GPT-5.2 Codex through the local Responses API proxy, without modifying or overwriting the earlier GPT-5.5 exploratory outputs.

The GPT-5.5 runs remain preserved as exploratory only:

- `results/full85_three_arm_gpt55_mt2048_repeat1_unguarded_exploratory_stopped49`
- `results/full85_three_arm_gpt55_mt2048_repeat1_gitguard`

## Model

- Proxy: `OPENAI_API_BASE=http://127.0.0.1:8789`
- API shape: Responses API at `/responses`, not `/v1/chat/completions`
- Model: `openai/claude-gpt-5.2-codex`
- mini-SWE-agent model class: `litellm_response`
- Generation parameters: `max_output_tokens=2048`, `reasoning.effort=high`, `temperature=1.0`
- Retry guard: `MSWEA_MODEL_RETRY_STOP_AFTER_ATTEMPT=3`, so repeated proxy timeouts propagate to the runner and can use the existing nonempty-diff rescue path instead of stalling for many retry cycles.

## Arms

| arm | meaning | git mode |
| --- | --- | --- |
| `C0` | no memory baseline | one synthetic snapshot commit only |
| `C1_git_history` | no injected memory, but a cutoff-limited `.git` history is available for agent exploration | ancestor-only `.git` bundle at task `base_commit` |
| `C4_git_history_mcts_mem` | `C1_git_history` plus injected MCTS-Mem task context | ancestor-only `.git` bundle at task `base_commit` |

Important naming correction: `C4` is `C1 + MCTS-Mem`, not `C0 + MCTS-Mem`. If needed later, `C5_mcts_mem_only` should mean `C0 + MCTS-Mem` without git history.

## Smoke Result

Smoke run directory:

```text
paper/evaluations/flipt/results/gpt52_codex_smoke10_c0_snapshot_responses
```

The smoke script was intentionally stopped after six completed C0 tasks.

Generation summary:

- Predictions: 6
- Nonempty patches: 6
- Trajectories: 6
- Exit statuses: `LimitsExceeded=5`, `Submitted=1`

Local targeted grading summary:

- Total graded: 6
- Nonempty/applicable predictions: 6
- Resolved: 1/6
- Status counts: `resolved=1`, `unresolved=5`
- Resolved id: `instance_flipt-io__flipt-15b76cada1ef29cfa56b0fba36754be36243dded`

This smoke result proved the GPT-5.2 runner and grader paths execute, but in hindsight it was too weak to validate baseline quality. The later full run showed the same strict harness likely depresses GPT-5.2 performance.

## Full Repeat 1

Full run directory:

```text
paper/evaluations/flipt/results/full85_three_arm_gpt52_codex_cutoffgit_repeat1
```

Run command:

```bash
paper/evaluations/flipt/scripts/run_gpt52_full85_three_arm_by_instance_repeat1.sh
```

The script runs all three arms for each instance in parallel, then advances to the next task. On resume, it skips any already completed condition for the current instance and reruns only missing arms unless `FORCE_REDO=1` is set. It writes per-condition predictions and trajectories under the full run directory and removes temporary git bundles after each instance.

Generation completed for all 85 Flipt tasks in all three arms. Summary from `scripts/summarize_predictions.py`:

| arm | predictions | nonempty patches | trajectories | exit statuses |
| --- | ---: | ---: | ---: | --- |
| `C0` | 85 | 82 | 85 | `Submitted=35`, `TimeExceeded=5`, `LimitsExceeded=43`, `Timeout=2` |
| `C1_git_history` | 85 | 81 | 85 | `Submitted=35`, `LimitsExceeded=45`, `Timeout=2`, `TimeExceeded=3` |
| `C4_git_history_mcts_mem` | 85 | 81 | 85 | `Submitted=45`, `LimitsExceeded=37`, `TimeExceeded=1`, `Timeout=2` |

Initial cutoff verification on the first task passed for both history arms:

```text
base=85bb23a3571794c7ba01e61904bac6913c3d9729 visible_commits=3464 future_commits=0
```

## Grading Command

Local grading was run with by-instance fanout across the three conditions:

```bash
python3 paper/evaluations/flipt/scripts/grade_predictions_local.py \
  --results-dir paper/evaluations/flipt/results/full85_three_arm_gpt52_codex_cutoffgit_repeat1 \
  --conditions C0 C1_git_history C4_git_history_mcts_mem \
  --workers 3 \
  --timeout-seconds 3600 \
  --timeout-per-chunk 1200 \
  --chunk-size 12 \
  --by-instance \
  --remove-images-after-instance
```

`grade_predictions_local.py` normalizes task rows with `dockerhub_tag` into `jefzda/sweap-images:<tag>` before grading, reuses existing `result.json` files on resume, pre-pulls each task image once before by-instance condition fanout, and mounts a persistent Go build cache at:

```text
paper/evaluations/flipt/results/full85_three_arm_gpt52_codex_cutoffgit_repeat1/local_grade_reports/_go_build_cache
```

Grading caveat: Flipt local grading is slow on Apple/Rosetta/Colima because each targeted chunk is still `go test ./... -run <selectors>`. Several legitimate chunks take many minutes to compile or time out at the 1200s per-chunk guard.

Final local targeted grading summary from `local_grade_reports/summary.json`:

| arm | total | nonempty | resolved | statuses |
| --- | ---: | ---: | ---: | --- |
| `C0` | 85 | 82 | 8 | `empty_patch=3`, `resolved=8`, `timeout=13`, `unresolved=61` |
| `C1_git_history` | 85 | 81 | 7 | `empty_patch=4`, `resolved=7`, `timeout=14`, `unresolved=60` |
| `C4_git_history_mcts_mem` | 85 | 81 | 4 | `empty_patch=4`, `patch_apply_failed=1`, `resolved=4`, `timeout=11`, `unresolved=65` |

Paired resolved counts:

| comparison | first-only wins | second-only wins | both resolved | neither resolved |
| --- | ---: | ---: | ---: | ---: |
| `C4_git_history_mcts_mem` vs `C1_git_history` | 0 | 3 | 4 | 78 |
| `C4_git_history_mcts_mem` vs `C0` | 1 | 5 | 3 | 76 |
| `C1_git_history` vs `C0` | 2 | 3 | 5 | 75 |

Short resolved ids:

| arm | resolved short ids |
| --- | --- |
| `C0` | `15b76cad`, `21a935ad`, `7161f7b8`, `b2170346`, `b4bb5e13`, `c12967bc`, `db1c3b10`, `f1bc91a1` |
| `C1_git_history` | `21a935ad`, `7161f7b8`, `b2170346`, `c12967bc`, `cf06f4eb`, `d9665592`, `db1c3b10` |
| `C4_git_history_mcts_mem` | `21a935ad`, `c12967bc`, `cf06f4eb`, `db1c3b10` |

Audit interpretation: this full-corpus repeat should not be used as a clean GPT-5.2 capability measurement or as a paper-negative result against cutoff git history/MCTS-Mem. `docs/gpt52_repeat1_audit.md` found complete artifacts, valid cutoff-history guards, and sane patch extraction, but also a generation harness that was too restrictive: `agent.step_limit=24`, 600s wall time, `max_output_tokens=2048`, and aggressive read-only command rejection after inspection or after a source diff existed. Most trajectories hit wrapper guidance/rejections, API calls saturated near the step limit, and many patches were rescued after non-submit exits.

The reference-patch oracle under `results/oracle_reference_patch_local` resolves 85/85 tasks. A temporary oracle failure on the `self-signed.badssl.com` task was fixed by adding a BadSSL host mapping to the local grader, and two transient Rosetta compiler crashes resolved on force regrade. Treat C0=8/85, C1=7/85, and C4=4/85 as a strict-harness diagnostic. Do not spend repeat2/repeat3 on this exact harness; run `scripts/run_gpt52_relaxed_smoke10_c0_snapshot.sh` first.
