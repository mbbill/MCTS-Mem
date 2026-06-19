- MCTS-Mem is a project's record of how it was decided: the choices that still hold, the
  alternatives that lost, and the dated evidence behind each, kept beside the code.

- The filesystem is the tree. Each node is one decision, and a sibling `.alt/` folder holds
  that decision's rejected alternatives. With every `.alt/` ignored, the remaining nodes are
  the current design.

- The record is read by walking the tree to the decision in question, not by searching it.

- A command-line linter (`mcts-mem`) checks the record's structure and internal consistency.

## Facts

- 2026-06-19 rationale: the model is a Monte Carlo Tree Search over the space of possible
  designs, but a rollout here is building and measuring real software and is far costlier than
  a classic MCTS rollout, so the engine is value estimation from an accumulated fact-base
  rather than search volume (sourced).

- 2026-06-19 rationale: design-rationale capture was attempted in the 1980s-90s (IBIS, QOC,
  DRL) and abandoned over capture cost that paid off only for someone else later; an
  always-available LLM acting as the facilitator those systems relied on is the change that
  makes the idea viable now (sourced).

- 2026-06-19 pitfall: a tree that has drifted out of sync with the code misleads every later
  reader, a state worse than having no tree at all (sourced).
