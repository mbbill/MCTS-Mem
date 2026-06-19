- A decision's independent sub-problems are its child nodes, all in force at once; its rival
  alternatives are frozen in its sibling `.alt/` folder, and the main-tree node is the single
  live option.

- Nodes nest to real depth: a finer decision within a parent is a child of it, not a sibling.

- The tree is a full tree, not a shared graph: the same nominal option reached by two
  different paths is a distinct node.

## Facts

- 2026-06-19 rationale: the full tree is justified by path dependence — the options available
  at a node depend on the whole path to it, not only the immediate parent, so two paths to the
  same nominal option reach genuinely different nodes (sourced).

## Moves

- 2026-06-19 replaced [[linear-path]]: a set of independent sub-decisions has many equivalent
  orderings, and forcing them into a sequence misrepresents choices that are actually
  unordered (sourced).
