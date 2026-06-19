- MCTS-Mem ships two skills: `mcts-mem-build` (one-time recovery of a tree from a project's
  history) and `mcts-mem-use` (consult the tree before a change, and update it on a
  re-decision).

- Each skill is a single self-contained `SKILL.md` that inlines the full grammar and method,
  with no dependency on sibling files.

## Facts

- 2026-06-19 rationale: the two skills are kept separate, not merged, because they fire on
  opposite moments — build rarely and explicitly, use constantly and implicitly before any
  planned change — and merging would blur triggering and load irrelevant content each time
  (sourced).

- 2026-06-19 rationale: the worked example (a fictional "acorn" store) lives in the build
  skill, not the use skill, because when using an existing tree the live nodes are the example
  (sourced).

## Moves

- 2026-06-19 replaced [[external-reference-skills]]: a skill that points at sibling grammar
  and method files breaks the moment it is installed where those files do not sit beside it,
  while a single self-contained file carries its own knowledge anywhere (sourced).

- 2026-06-19 replaced [[procedure-only-skills]]: a cold reader of procedure-only rules cannot
  tell why a rule exists and follows it rigidly without judgment, while rules that carry their
  reason let the agent reason (sourced).
