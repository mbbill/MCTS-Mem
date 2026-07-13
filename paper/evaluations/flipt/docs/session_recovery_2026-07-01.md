# Session Recovery Report

Date: 2026-07-01.

Recovered Codex session:

```text
019f0756-71d1-7e31-b73d-bd11b5bf4ba3
```

Transcript path:

```text
/Users/bytedance/.codex/sessions/2026/06/26/rollout-2026-06-26T21-28-53-019f0756-71d1-7e31-b73d-bd11b5bf4ba3.jsonl
```

## Recovered State

The active goal was to continue the Flipt evaluation until it had the same kind of benchmark data as the qutebrowser run. The recovered transcript tail showed the relaxed GPT-5.2 Flipt local grader had been running on:

```text
paper/evaluations/flipt/results/full85_three_arm_gpt52_codex_relaxed_cutoffgit_repeat1
```

The old session had reached roughly instance 53/85 in visible output, but the current filesystem showed the grader later produced all 255 per-condition result files. The initial aggregate summary still contained Docker infrastructure failures, so the run was not yet cleanly interpretable.

## Actions Taken

1. Verified no old Flipt grader process was still running.
2. Confirmed the relaxed full run had 85 predictions and 85 trajectories for each arm.
3. Confirmed `local_grade_reports` had 255 `result.json` files.
4. Identified four Docker infrastructure-failed instances:
   - `56a620b8fc9e`
   - `7161f7b87677`
   - `72d06db14d58`
   - `cd2f3b0a9d4d`
5. Force-regraded only those failed instances with `--instance-id`, preserving all existing generation outputs and unrelated grade results.
6. Manually retried Docker pulls for `7161f7b87677` and `72d06db14d58` after Docker Hub short-read / connection-refused failures.
7. Rebuilt the full local grade summary from existing result files, without rerunning the full benchmark.
8. Updated the paper-facing docs so no stale “grading in progress” state remains.

## Final Relaxed Full-Run Result

Final summary artifact:

```text
paper/evaluations/flipt/results/full85_three_arm_gpt52_codex_relaxed_cutoffgit_repeat1/local_grade_reports/summary.json
```

Final local targeted grades:

| arm | total | nonempty | resolved | status counts |
| --- | ---: | ---: | ---: | --- |
| `C0` | 85 | 84 | 7 | `empty_patch=1`, `resolved=7`, `unresolved=77` |
| `C1_git_history` | 85 | 85 | 8 | `resolved=8`, `unresolved=77` |
| `C4_git_history_mcts_mem` | 85 | 85 | 8 | `resolved=8`, `unresolved=77` |

Verification:

- `255` per-condition `result.json` files are present.
- `0` rows have status `docker_failed_no_result`.
- No benchmark Docker containers were left running after completion.

## Paired Outcomes

| comparison | C4 wins | C4 losses | both resolved | neither resolved |
| --- | ---: | ---: | ---: | ---: |
| `C4_git_history_mcts_mem` vs `C1_git_history` | 2 | 2 | 6 | 75 |
| `C4_git_history_mcts_mem` vs `C0` | 3 | 2 | 5 | 75 |

C4-only wins over C1:

```text
dbe26396
f1bc91a1
```

C4 losses to C1:

```text
7161f7b8
b2170346
```

## Interpretation

The relaxed Flipt full run is complete and operationally cleaner than the strict repeat-1 diagnostic. It does not establish a strong full-corpus patch-generation win for MCTS-Mem: C4 ties raw cutoff git at `8/85` and only edges no-memory C0 by one task.

The paired analysis found plausible memory-aligned C4-only wins on interface/lifecycle/refactor tasks, but also losses where directly relevant memory was available and did not prevent a bad patch. Treat this as complete benchmark data that needs stratified analysis, not as headline positive evidence.

## Updated Documents

The recovery and final results were written into:

```text
paper/evaluations/flipt/docs/gpt52_relaxed_full_run.md
paper/evaluations/flipt/docs/gpt52_relaxed_paired_analysis.md
paper/evaluations/flipt/docs/plan.md
paper/MASTER.md
paper/PAPER_OUTLINE.md
```

## Next Step

Create a Flipt memory-relevance stratum using reviewer scoring or an automated task ranker. Use the paired-delta instances as seeds, then decide whether selected-slice runs or repeat2/repeat3 are worth the spend.
