# Lynx QA Bench — Code/Git-Fair Variant

This directory is a code/git-history-fair variant of the Lynx QA benchmark.

The original benchmark at `../lynx_qa_bench/` allows MCTS-aware answers to use all MCTS-Mem facts, including facts distilled from design docs/RFCs/author notes. That is useful for testing the full value of MCTS-Mem, but it can be unfair to a code-only baseline if the canonical answer requires facts that are not recoverable from code, comments, tests, or git history.

This variant keeps the same 50 questions, but canonical answers and rubrics should avoid requiring doc-only/source-only facts. MCTS-aware answers may still read `mcts_mem/`, but grading should focus on decision context that a diligent code+git-history agent could in principle recover from raw repository history.

## Current status

- The case files are initially copied from `../lynx_qa_bench/`.
- `doc_only_audit.md` lists phrases/rubric items to remove or weaken before using this as the primary fair benchmark.
- Until those edits are applied, treat this directory as **draft**.

## Protocol

- **Code-only condition:** run in an isolated checkout/worktree where `mcts_mem/` is hidden or removed before any search. Allow code, tests, comments, and git history.
- **MCTS-aware condition:** require structural reading of `mcts_mem/` first, then code verification.
- **Fairness rule:** do not require exact design-doc/RFC/author-note facts in canonical answers unless the same fact is also recoverable from code comments, tests, or git commit messages.

## Case set

- [`lynx_mcts_mem_benchmark_50/README.md`](lynx_mcts_mem_benchmark_50/README.md)
- [`lynx_mcts_mem_benchmark_50/cases_01_10.md`](lynx_mcts_mem_benchmark_50/cases_01_10.md)
- [`lynx_mcts_mem_benchmark_50/cases_11_20.md`](lynx_mcts_mem_benchmark_50/cases_11_20.md)
- [`lynx_mcts_mem_benchmark_50/cases_21_30.md`](lynx_mcts_mem_benchmark_50/cases_21_30.md)
- [`lynx_mcts_mem_benchmark_50/cases_31_40.md`](lynx_mcts_mem_benchmark_50/cases_31_40.md)
- [`lynx_mcts_mem_benchmark_50/cases_41_50.md`](lynx_mcts_mem_benchmark_50/cases_41_50.md)
