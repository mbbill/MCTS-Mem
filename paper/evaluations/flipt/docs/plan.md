# Flipt Evaluation Plan

Date: 2026-06-28. Updated with relaxed repeat-1 final grading on 2026-07-01.

## Decision

Proceed with `flipt-io/flipt` as the next SWE-bench Pro target. Drop the qutebrowser-first full-repeat plan for now: qutebrowser remains useful evidence, but its full79 result was diluted against raw git. Flipt has a stronger concentration of configuration, schema, API, storage, and compatibility tasks.

## Arms

Use the GPT-5.2 Codex three-arm comparison with cutoff-controlled git history. The dropped C2a formatting ablation remains out of scope.

| arm | meaning | status |
| --- | --- | --- |
| `C0` | no memory, snapshot `.git` only | strict diagnostic complete; relaxed full run complete; relaxed local grade 7/85 resolved |
| `C1_git_history` | cutoff-limited `.git` history available for agent exploration | strict diagnostic complete; relaxed full run complete; relaxed local grade 8/85 resolved |
| `C4_git_history_mcts_mem` | `C1_git_history` plus injected MCTS-Mem context | strict diagnostic complete; relaxed full run complete; relaxed local grade 8/85 resolved |

`C4` means `C1 + MCTS-Mem`. It is not `C0 + MCTS-Mem`. If a memory-only ablation is later needed, name it `C5_mcts_mem_only`.

## Methodology Correction

The generated C1/C4 contexts were cutoff-correct, but the initial full-corpus run exposed live repository history inside the benchmark container. That run is stopped and preserved only as exploratory: `results/full85_three_arm_gpt55_mt2048_repeat1_unguarded_exploratory_stopped49`.

The current GPT-5.2 run uses `scripts/run_condition.py` with explicit git history modes:

- `snapshot` for `C0`: each container is reset to one synthetic commit at the task snapshot, and history-inspection commands remain blocked.
- `cutoff` for `C1_git_history` and `C4_git_history_mcts_mem`: the runner builds a host git bundle from `paper/repos/flipt`, installs only ancestors of the task `base_commit`, and verifies `future_commits=0` before the agent starts. History commands are allowed only in this cutoff mode.

Details are in `docs/git_history_cutoff_guard.md` and `docs/gpt52_cutoffgit_run.md`.

## Build Steps

1. Keep all Flipt artifacts under `paper/`.
2. Use `paper/repos/flipt` as the mining checkout; do not depend on any external Flipt checkout.
3. Treat `paper/evaluations/flipt/mcts_mem` as the generated MCTS-Mem tree location.
4. Mine history in 15-commit windows from `extraction/history_windows.json`. Done; consolidated records are in `extraction/all-records.jsonl`.
5. Regenerate `C4_mcts_mem_top8w900` with `generate_condition_datasets.py --include-mcts`. Done.
6. Run GPT-5.2 C0 smoke baseline on six tasks. Done: 6/6 nonempty patches, local grade 1/6 resolved.
7. Run the GPT-5.2 clean full 85-task corpus with C0, C1 cutoff `.git`, and C4 cutoff `.git` plus MCTS-Mem. Done at `results/full85_three_arm_gpt52_codex_cutoffgit_repeat1`; each arm has 85 predictions/trajectories.
8. Grade the clean run locally. Done with `--workers 3 --by-instance --timeout-per-chunk 1200` and a persistent Go build cache. Final local targeted grading after force-regrading a transient Rosetta compiler crash: C0=8/85, C1=7/85, C4=4/85.
9. Audit the suspiciously low GPT-5.2 scores. Done at `docs/gpt52_repeat1_audit.md`: artifacts are complete, cutoff guards pass, patch extraction is sane, and the reference-patch oracle resolves 85/85 tasks after a BadSSL DNS/host-mapping fix and transient compiler-crash regrades. The main bug-risk for the low score is the strict generation harness.
10. Run relaxed C0 smoke with higher step/wall/output-token limits and looser read-only rejection behavior. Done at `results/gpt52_codex_relaxed_smoke10_c0_snapshot`: 10/10 submitted nonempty patches, 3/10 locally resolved. See `docs/gpt52_relaxed_smoke.md`.
11. Run the relaxed full three-arm rerun at `results/full85_three_arm_gpt52_codex_relaxed_cutoffgit_repeat1` with `scripts/run_gpt52_relaxed_full85_three_arm_by_instance_repeat1.sh`. Done: 85 predictions and trajectories per arm.
12. Grade the relaxed full run locally. Done: initial Docker pull failures were force-regraded after manual image pulls; final grade has no `docker_failed_no_result` rows. See `docs/gpt52_relaxed_full_run.md`.

## Repeat 1 Result

Final local targeted grading from `results/full85_three_arm_gpt52_codex_cutoffgit_repeat1/local_grade_reports/summary.json`:

| arm | total | nonempty | resolved | status counts |
| --- | ---: | ---: | ---: | --- |
| `C0` | 85 | 82 | 8 | `empty_patch=3`, `resolved=8`, `timeout=13`, `unresolved=61` |
| `C1_git_history` | 85 | 81 | 7 | `empty_patch=4`, `resolved=7`, `timeout=14`, `unresolved=60` |
| `C4_git_history_mcts_mem` | 85 | 81 | 4 | `empty_patch=4`, `patch_apply_failed=1`, `resolved=4`, `timeout=11`, `unresolved=65` |

Paired outcomes: C4 vs C1 is 0 wins / 3 losses / 4 both / 78 neither; C4 vs C0 is 1 win / 5 losses / 3 both / 76 neither. This is a strict-harness diagnostic result, not a trustworthy full-corpus measurement of GPT-5.2 or MCTS-Mem. The audit found `step_limit=24`, 600s wall time, 2048 output tokens, and wrapper read-only rejections as likely score-depressing factors.

## Relaxed Repeat 1 Result

Final local targeted grading from `results/full85_three_arm_gpt52_codex_relaxed_cutoffgit_repeat1/local_grade_reports/summary.json`:

| arm | total | nonempty | resolved | status counts |
| --- | ---: | ---: | ---: | --- |
| `C0` | 85 | 84 | 7 | `empty_patch=1`, `resolved=7`, `unresolved=77` |
| `C1_git_history` | 85 | 85 | 8 | `resolved=8`, `unresolved=77` |
| `C4_git_history_mcts_mem` | 85 | 85 | 8 | `resolved=8`, `unresolved=77` |

Paired outcomes: C4 vs C1 is 2 wins / 2 losses / 6 both / 75 neither; C4 vs C0 is 3 wins / 2 losses / 5 both / 75 neither. The relaxed harness fixed generation saturation, but the full-corpus result is still weak for MCTS-Mem: C4 ties raw cutoff git and is only +1 over C0. Treat this as complete benchmark data requiring qualitative/stratified analysis, not as a strong positive full-corpus result. Initial paired analysis is in `docs/gpt52_relaxed_paired_analysis.md`.

## Parallelization

The MCTS-Mem mining stage is the best place to fan out. Each window can be mapped independently because commit-local classification does not require global placement. The reduce and closure checks are serial/global.

Local Docker grading is now using by-instance fanout with `--workers 3`: for a single SWE-bench instance, C0, C1, and C4 are graded concurrently against the same task image, then the image is removed before advancing. This keeps comparison ordering clean while using the available machine better. Flipt grading is still slow because targeted chunks are broad `go test ./... -run <selectors>` runs under linux/amd64.

## Current Commands

```bash
python3 paper/evaluations/flipt/scripts/prepare_tasks.py
python3 paper/evaluations/flipt/scripts/plan_history_windows.py
python3 paper/evaluations/flipt/scripts/generate_condition_datasets.py
node bin/mcts-mem.js lint paper/evaluations/flipt/mcts_mem --skeleton
```

After MCTS records exist:

```bash
python3 paper/evaluations/flipt/scripts/generate_condition_datasets.py --include-mcts
python3 paper/evaluations/flipt/scripts/select_memory_relevant_tasks.py --resume
```

Current GPT-5.2 smoke and strict full repeat 1:

```bash
paper/evaluations/flipt/scripts/run_gpt52_smoke10_c0_snapshot.sh
paper/evaluations/flipt/scripts/run_gpt52_full85_three_arm_by_instance_repeat1.sh
```

Next relaxed GPT-5.2 smoke before any full rerun:

```bash
paper/evaluations/flipt/scripts/run_gpt52_relaxed_smoke10_c0_snapshot.sh
```

Relaxed full three-arm rerun, now complete:

```bash
paper/evaluations/flipt/scripts/run_gpt52_relaxed_full85_three_arm_by_instance_repeat1.sh
```

Model environment for current generation runs:

```bash
export OPENAI_API_KEY=sk-local-proxy-dummy
export OPENAI_API_BASE=http://127.0.0.1:8789
```

## Success Criteria

- Primary: C4 beats C1 on reviewer-selected high-memory-relevance Flipt tasks.
- Secondary: C4 beats C0 on selected tasks and on the full corpus.
- Robustness: three full-corpus repeats once the selected-slice result justifies the spend.
- Reporting discipline: if C4 only beats C0 but not C1, frame the claim as memory helps over no context but not over raw history for that target.

The strict repeat-1 outcome missed both criteria under an invalidly restrictive harness. The relaxed full repeat is cleaner operationally but still misses the primary full-corpus criterion against raw git: C4 ties C1 at 8/85 with 2 paired wins and 2 paired losses. It barely meets the secondary C4-vs-C0 count criterion by one task. The initial paired analysis finds plausible memory-aligned C4-only wins but also relevant-memory losses. Next work should create a reviewer-scored or automated memory-relevance stratum before spending on repeat2/repeat3 or selected-slice runs.
