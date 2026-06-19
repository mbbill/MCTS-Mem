- The tree has a single node kind: a decision — an option that was taken. One special-cased
  root anchors it; there are no goal, question, or invariant node types.

- The current design is the traversal of taken nodes; a node's child folder holds the
  independent sub-decisions that all hold at once.

- A decision's rejected rivals and superseded forms are frozen in its sibling `.alt/` folder;
  position alone encodes what is live.

## Facts

- 2026-06-19 pitfall: a 48-episode falsification run of an earlier typed model returned zero
  confirmed misfits with all 48 cases "rescued" by a challenger — the signature of an
  unfalsifiable scheme, not a validated one (sourced).

- 2026-06-19 pitfall: the goal/decision/invariant model could not express about 27% of real
  episodes, in which invariants were discovered from bugs rather than produced by a decision
  (sourced).

- 2026-06-19 rationale: with one node kind, everything needed for a decision is visible at its
  node, making the read accurate, deterministic, and verifiable (sourced).

## Moves

- 2026-06-19 replaced [[typed-ontology]]: a typed ontology of goal, question, option, and
  invariant nodes added capture cost and write-only node types that earned no mechanical
  enforcement, while one decision node plus dated facts holds the same information (sourced).
