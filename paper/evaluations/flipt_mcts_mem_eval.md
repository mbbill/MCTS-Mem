# Flipt MCTS-Mem Evaluation Status

Date: 2026-06-28. Updated with repeat-1 audit notes on 2026-06-29 and final relaxed-run recovery on 2026-07-01.

## Target

- Repository: `flipt-io/flipt`.
- SWE-bench Pro rows: 85.
- Local repo clone: `paper/repos/flipt`.
- Evaluation workspace: `paper/evaluations/flipt`.

## Conditions

| condition | context | rows |
| --- | --- | --- |
| `C0` | no memory, snapshot `.git` only | 85 |
| `C1_git_history` | cutoff-limited `.git` history available for agent exploration | 85 |
| `C4_git_history_mcts_mem` | `C1_git_history` plus injected MCTS-Mem task context | 85 |

`C4` is `C1 + MCTS-Mem`, not `C0 + MCTS-Mem`. A later memory-only ablation, if needed, should be named `C5_mcts_mem_only`.

`C1_git_history` and `C4_git_history_mcts_mem` install a cutoff-limited `.git` bundle per task using only commits in `git rev-list <base_commit>`. Cutoff metadata lives in `paper/evaluations/flipt/cutoffs/`.

## Methodology Note

The first full generation attempt exposed live git history in the benchmark container. It was stopped after 49 completed instances per arm and moved to:

```text
paper/evaluations/flipt/results/full85_three_arm_gpt55_mt2048_repeat1_unguarded_exploratory_stopped49
```

Those outputs are exploratory only and must not be overwritten. The current GPT-5.2 runner uses `snapshot` mode for C0 and cutoff `.git` mode for C1/C4. Details are in `paper/evaluations/flipt/docs/git_history_cutoff_guard.md` and `paper/evaluations/flipt/docs/gpt52_cutoffgit_run.md`.

## Current GPT-5.2 Run

Smoke baseline:

```text
paper/evaluations/flipt/results/gpt52_codex_smoke10_c0_snapshot_responses
```

Result: 6/6 nonempty C0 predictions, local targeted grade 1/6 resolved.

Full repeat 1:

```text
paper/evaluations/flipt/results/full85_three_arm_gpt52_codex_cutoffgit_repeat1
```

Generation command:

```bash
paper/evaluations/flipt/scripts/run_gpt52_full85_three_arm_by_instance_repeat1.sh
```

Generation is complete for all 85 tasks in each arm:

| condition | predictions | nonempty patches | trajectories |
| --- | ---: | ---: | ---: |
| `C0` | 85 | 82 | 85 |
| `C1_git_history` | 85 | 81 | 85 |
| `C4_git_history_mcts_mem` | 85 | 81 | 85 |

Local grading was run with:

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

The local grader mounted a persistent Go build cache under `local_grade_reports/_go_build_cache`. Final local targeted grading from `local_grade_reports/summary.json`:

| condition | total | nonempty | resolved | status counts |
| --- | ---: | ---: | ---: | --- |
| `C0` | 85 | 82 | 8 | `empty_patch=3`, `resolved=8`, `timeout=13`, `unresolved=61` |
| `C1_git_history` | 85 | 81 | 7 | `empty_patch=4`, `resolved=7`, `timeout=14`, `unresolved=60` |
| `C4_git_history_mcts_mem` | 85 | 81 | 4 | `empty_patch=4`, `patch_apply_failed=1`, `resolved=4`, `timeout=11`, `unresolved=65` |

Paired result: C4 vs C1 is 0 wins / 3 losses / 4 both / 78 neither, and C4 vs C0 is 1 win / 5 losses / 3 both / 76 neither. This full-corpus repeat is a strict-harness diagnostic, not a clean Flipt-wide MCTS-Mem measurement. The current audit at `paper/evaluations/flipt/docs/gpt52_repeat1_audit.md` found complete artifacts, valid cutoff-history guards, sane patch extraction, and an 85/85 resolved reference-patch oracle, but also a likely score-depressing generation setup: `step_limit=24`, 600s wall time, 2048 output tokens, and aggressive wrapper read-only rejections.

Do not run the planned full-corpus repeats on this strict harness. The relaxed C0 smoke at `paper/evaluations/flipt/results/gpt52_codex_relaxed_smoke10_c0_snapshot` produced 10/10 submitted nonempty patches and 3/10 locally resolved tasks; on the same first 10 tasks, strict repeat-1 C0 resolved 2/10.

## Final Relaxed GPT-5.2 Full Run

The relaxed full three-arm rerun is complete:

```text
paper/evaluations/flipt/results/full85_three_arm_gpt52_codex_relaxed_cutoffgit_repeat1
```

Full documentation:

```text
paper/evaluations/flipt/docs/gpt52_relaxed_full_run.md
paper/evaluations/flipt/docs/gpt52_relaxed_paired_analysis.md
paper/evaluations/flipt/docs/session_recovery_2026-07-01.md
```

Final local targeted grades from `local_grade_reports/summary.json`:

| condition | total | nonempty | resolved | status counts |
| --- | ---: | ---: | ---: | --- |
| `C0` | 85 | 84 | 7 | `empty_patch=1`, `resolved=7`, `unresolved=77` |
| `C1_git_history` | 85 | 85 | 8 | `resolved=8`, `unresolved=77` |
| `C4_git_history_mcts_mem` | 85 | 85 | 8 | `resolved=8`, `unresolved=77` |

Paired outcomes:

| comparison | C4 wins | C4 losses | both resolved | neither resolved |
| --- | ---: | ---: | ---: | ---: |
| `C4_git_history_mcts_mem` vs `C1_git_history` | 2 | 2 | 6 | 75 |
| `C4_git_history_mcts_mem` vs `C0` | 3 | 2 | 5 | 75 |

Interpretation: the relaxed run is operationally cleaner than the strict diagnostic, but it still does **not** establish a full-corpus patch-generation win for MCTS-Mem. C4 ties raw cutoff git at `8/85` and only edges no-memory C0 by one task. Treat Flipt as complete diagnostic/stratification evidence, not as headline positive evidence. The next useful step is memory-relevance stratification over the 85 Flipt tasks, seeded by the paired-delta cases in `gpt52_relaxed_paired_analysis.md`.
