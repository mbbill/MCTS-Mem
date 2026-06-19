- A tree is built once by mining a project's history — git diffs, design docs, and author
  input — with fan-out LLM agents, rather than by hand-entering rationale as the work happens.

- Construction is map/reduce: each source window is mapped to placement-free records by a
  parallel agent, then a single reduce folds those records into a skeleton taken from HEAD.

- Every built tree is checked by an independent adversarial auditor reading diffs, and by a
  mechanical whole-tree closure check, before it is accepted.

## Facts

- 2026-06-19 measurement: a parallel run over 50 commits used 19 agents and about 2.3M tokens
  in roughly 88 minutes, auditing clean after one fix round per window (sourced).

- 2026-06-19 rationale: the whole-tree closure check is the load-bearing safety net — a
  sampled adversarial audit caught 3 of 22 dropped re-decisions, while the mechanical check
  caught all 22 (sourced).

- 2026-06-19 pitfall: commit messages are frequently misleading — a "fix typo" commit hid a
  seven-validator predicate refactor — so an extractor classifies from the diff, never the
  message (sourced).

- 2026-06-19 pitfall: an automated judge twice certified a model its own evidence falsified by
  trusting a summary statistic over the per-episode gaps — the human synthesis step is
  load-bearing, not a courtesy (sourced).

- 2026-06-19 rationale: an extractor plus an independent auditor beats solo prompt-tuning,
  since extractor quality is a distribution that tuning narrows but cannot collapse to a point
  (sourced).

## Moves

- 2026-06-19 replaced [[hand-entered-rationale]]: hand-entering rationale as work happens is
  the capture tax that killed the 1980s-90s rationale systems, while mining it once from
  history with LLM agents moves that cost off the author (sourced).

- 2026-06-19 replaced [[sequential-extraction]]: main-versus-`.alt` placement is fixed by the
  HEAD state, so each element's full history can be mined in parallel into disjoint subtrees
  rather than serializing every commit through one walker (sourced).
