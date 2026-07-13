# Flipt MCTS-Mem Evaluation Workspace

This directory is the paper-side workspace for the Flipt SWE-bench Pro evaluation. It is self-contained under `paper/`: the Flipt repository clone is at `paper/repos/flipt`, and all task snapshots, generated contexts, cutoffs, scripts, MCTS-Mem artifacts, logs, and results for this target live under `paper/evaluations/flipt`.

## Current State

- Repo: `paper/repos/flipt` at `acda1ab153efd8dc29aa6adb011a997b14a48b87`.
- Task snapshot: 85 `flipt-io/flipt` rows in `tasks/flipt_swebench_pro_tasks.jsonl`.
- Conditions generated: legacy `C0`, `C1_raw_git`, and `C4_mcts_mem_top8w900`, plus the current GPT-5.2 datasets `C1_git_history` and `C4_git_history_mcts_mem`, 85 rows each under `datasets/`.
- Per-task ancestor cutoffs: `cutoffs/<instance_id>.json`.
- MCTS-Mem records: `extraction/all-records.jsonl`, 1,224 records.
- MCTS-Mem tree: `mcts_mem/`.
- History window manifest: `extraction/history_windows.json`, 340 windows over 5,099 commits at 15 commits per window.
- Current benchmark status: GPT-5.2 Codex generation is complete for full repeat 1. A six-task C0 smoke baseline produced 6/6 nonempty patches and 1/6 locally resolved tasks at `results/gpt52_codex_smoke10_c0_snapshot_responses`.
- Full repeat-1 target: `results/full85_three_arm_gpt52_codex_cutoffgit_repeat1`, using C0 snapshot mode, C1 cutoff `.git` history, and C4 cutoff `.git` history plus MCTS-Mem. Generation produced 85 trajectories per arm and nonempty patch counts of 82/85 for C0, 81/85 for C1, and 81/85 for C4. Local targeted grading resolved C0=8/85, C1=7/85, and C4=4/85 after force-regrading a transient Rosetta compiler crash. This should be treated as a diagnostic/invalid capability measurement: the audit found complete artifacts, valid cutoff-history guards, and an 85/85 resolved reference-patch oracle, but also an over-restrictive generation harness (`step_limit=24`, 600s wall time, 2048 output tokens, and aggressive read-only rejections). See `docs/gpt52_repeat1_audit.md`, `docs/gpt52_cutoffgit_run.md`, and `docs/git_history_cutoff_guard.md`.
- Relaxed GPT-5.2 C0 smoke: `results/gpt52_codex_relaxed_smoke10_c0_snapshot` produced 10/10 submitted nonempty patches and 3/10 locally resolved tasks. This justifies the relaxed full three-arm rerun; see `docs/gpt52_relaxed_smoke.md`.
- Relaxed GPT-5.2 full three-arm rerun: `results/full85_three_arm_gpt52_codex_relaxed_cutoffgit_repeat1` is in progress. As of 2026-06-30 10:30 local time, generation was complete for 41/85 instances in all three arms, with 41/41 nonempty patches per arm. Runtime notes, the interrupted-instance quarantine, and the nonempty-patch resume guard are documented in `docs/gpt52_relaxed_full_run.md`.
- Preserved GPT-5.5 exploratory outputs must not be overwritten: `results/full85_three_arm_gpt55_mt2048_repeat1_unguarded_exploratory_stopped49` and `results/full85_three_arm_gpt55_mt2048_repeat1_gitguard`.

## Layout

| path | purpose |
| --- | --- |
| `tasks/` | immutable SWE-bench Pro Flipt task snapshot and task index |
| `conditions/` | rendered per-instance context markdown for each condition |
| `datasets/` | JSONL datasets consumed by mini-SWE-agent |
| `cutoffs/` | ancestor cutoff metadata keyed by instance id |
| `mcts_mem/` | Flipt MCTS-Mem tree artifact; currently Stage-1 skeleton only |
| `extraction/` | history sweep window manifest, records, ledgers, audits, placements |
| `selection/` | reviewer-scored memory-relevance rankings |
| `results/` | generation and grading outputs |
| `logs/` | long-running command logs |
| `configs/` | benchmark agent configs |
| `scripts/` | reproducible preparation, generation, running, and grading scripts |
| `docs/` | preflight notes and staged plan |

## Repro Commands

```bash
python3 paper/evaluations/flipt/scripts/prepare_tasks.py
python3 paper/evaluations/flipt/scripts/plan_history_windows.py
python3 paper/evaluations/flipt/scripts/generate_condition_datasets.py
node bin/mcts-mem.js lint paper/evaluations/flipt/mcts_mem --skeleton
```

For generation runs, create the paper-local mini-SWE-agent environment once:

```bash
paper/evaluations/flipt/scripts/setup_eval_env.sh
```

Regenerate all condition datasets with MCTS-Mem included:

```bash
python3 paper/evaluations/flipt/scripts/generate_condition_datasets.py --include-mcts
```

The strict GPT-5.2 full-corpus generation script writes to `results/full85_three_arm_gpt52_codex_cutoffgit_repeat1`:

```bash
paper/evaluations/flipt/scripts/run_gpt52_full85_three_arm_by_instance_repeat1.sh
```

The next clean GPT-5.2 sanity check is the relaxed C0 smoke runner. It writes to `results/gpt52_codex_relaxed_smoke10_c0_snapshot` and raises the step/wall/output-token limits while loosening wrapper rejections:

```bash
paper/evaluations/flipt/scripts/run_gpt52_relaxed_smoke10_c0_snapshot.sh
```

The relaxed full three-arm rerun writes to `results/full85_three_arm_gpt52_codex_relaxed_cutoffgit_repeat1`:

```bash
paper/evaluations/flipt/scripts/run_gpt52_relaxed_full85_three_arm_by_instance_repeat1.sh
```

The mini-SWE-agent runner and local grader can also be invoked directly:

```bash
paper/evaluations/flipt/.venv-mcts-eval/bin/python paper/evaluations/flipt/scripts/run_condition.py \
  --condition C0 \
  --model openai/claude-gpt-5.2-codex \
  --model-class litellm_response \
  --config paper/evaluations/flipt/configs/mild_swebench_gpt52_git.yaml \
  --output paper/evaluations/flipt/results/<run_name>/C0 \
  --include-test-context \
  --git-history-mode snapshot

python3 paper/evaluations/flipt/scripts/grade_predictions_local.py \
  --results-dir paper/evaluations/flipt/results/<run_name> \
  --conditions C0 C1_git_history C4_git_history_mcts_mem \
  --workers 3 \
  --timeout-seconds 3600 \
  --timeout-per-chunk 1200 \
  --chunk-size 12 \
  --by-instance \
  --remove-images-after-instance
```

The local grader is Go-oriented: it applies the model patch inside the task Docker image and runs targeted `go test ./... -run` chunks from the row's `fail_to_pass` names. For this Flipt snapshot, `pass_to_pass` is empty for all 85 rows. The completed GPT-5.2 grading run mounted a persistent Go build cache under `results/full85_three_arm_gpt52_codex_cutoffgit_repeat1/local_grade_reports/_go_build_cache`; resumed by-instance runs pre-pull each task image once before launching the three condition graders.

Audit status: `docs/gpt52_repeat1_audit.md` is the source of truth for the suspicious low strict GPT-5.2 scores. The reference-patch oracle under `results/oracle_reference_patch_local` resolves 85/85 reference patches after adding a BadSSL host mapping to the local grader and force-regrading transient Rosetta compiler crashes. Do not run repeat2/repeat3 of the strict harness. The relaxed C0 smoke at `docs/gpt52_relaxed_smoke.md` is complete; the relaxed full three-arm rerun is the active run and is tracked in `docs/gpt52_relaxed_full_run.md`.
