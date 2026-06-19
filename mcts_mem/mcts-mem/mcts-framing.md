- MCTS-Mem frames building software as a search: an option is a choice, a fact is
  value-function evidence, the current design is the chosen traversal, and the tree is the
  accumulated prior for the next search.

- "Search" names only the past exploration the tree records, not how the tree is read.

## Facts

- 2026-06-19 rationale: a rollout here is build-and-measure, far costlier than a board-game
  MCTS rollout, so the engine estimates value from an accumulated fact-base rather than
  brute-forcing the search — the AlphaGo to AlphaZero move (sourced).

- 2026-06-19 statement: the value-function machinery — backpropagation, rollout scheduling,
  fact-base retrieval — is a north-star vision that does no mechanical work in the shipped
  system; what shipped is a git-native, lint-checked, append-only decision log with
  first-class rejected alternatives (sourced).

- 2026-06-19 rationale: the disruption the framing points at is the value function ceasing to
  live inside individuals and becoming a shared, queryable asset (sourced).
