# Lynx QA Bench

A 50-case QA benchmark for testing whether MCTS-Mem improves Lynx architecture answers compared with code-only reading.

## Benchmark protocol

- **Code-only condition:** run in an isolated checkout/worktree where `mcts_mem/` is hidden or removed before any search. Allow code, tests, comments, and git history.
- **MCTS-aware condition:** require structural reading of `mcts_mem/` first, then code verification.
- **Scoring:** use each case rubric. Award semantic credit; exact wording is not required.
- **Benchmark target:** code-only answers often describe implementation mechanics; MCTS-aware answers should recover the decision, rejected alternatives, historical constraints, measured facts, or design direction.

## Case set

The benchmark cases are stored under:

```text
lynx_mcts_mem_benchmark_50/
```

Start with:

- [`lynx_mcts_mem_benchmark_50/README.md`](lynx_mcts_mem_benchmark_50/README.md)

Case files:

- [`lynx_mcts_mem_benchmark_50/cases_01_10.md`](lynx_mcts_mem_benchmark_50/cases_01_10.md)
- [`lynx_mcts_mem_benchmark_50/cases_11_20.md`](lynx_mcts_mem_benchmark_50/cases_11_20.md)
- [`lynx_mcts_mem_benchmark_50/cases_21_30.md`](lynx_mcts_mem_benchmark_50/cases_21_30.md)
- [`lynx_mcts_mem_benchmark_50/cases_31_40.md`](lynx_mcts_mem_benchmark_50/cases_31_40.md)
- [`lynx_mcts_mem_benchmark_50/cases_41_50.md`](lynx_mcts_mem_benchmark_50/cases_41_50.md)

## Benchmark run results

- [`benchmark_runs/2026-06-28_run_50/summary.md`](benchmark_runs/2026-06-28_run_50/summary.md)
- [`benchmark_runs/2026-06-28_run_50/combined_results.json`](benchmark_runs/2026-06-28_run_50/combined_results.json)
- [`benchmark_runs/2026-06-28_run_50/raw_workflow_output.json`](benchmark_runs/2026-06-28_run_50/raw_workflow_output.json)

## Archive

Early 10-case draft/provenance files are archived under:

- [`archive/2026-06-initial-10-case-draft/`](archive/2026-06-initial-10-case-draft/)
