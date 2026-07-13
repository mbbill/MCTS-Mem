- A decision's rejected rivals and superseded forms live in a sibling `<name>.alt/` folder;
  with every `.alt/` ignored, the main tree is the current design.

- Selection is encoded by position: a file in the main tree is live, a file inside an `.alt/`
  is superseded or a rival. There is no `selected:` marker field.

- A node's `.alt/` is a flat set of rejected rivals for one decision: an alternative member does
  not get its own `.alt/`. Supersession order is recorded by the paired `replaced` / `replaced by`
  Moves, not by nesting one rejected form under another.

- Logical paths omit `.alt/` folders entirely: an alternative occupies the replaced node's slot;
  `compiler.alt/fast-interpreter/neutral-ir.md` is logically `fast-interpreter/neutral-ir`, not
  `compiler/fast-interpreter/neutral-ir`.

## Moves

- 2026-06-19 replaced [[or-grouping-markers]]: in a current-design-major layout the live
  winner itself anchors the fork, dissolving the need for a question node, a `.one`/`.all`
  container, or a `selected:` marker (sourced).

- 2026-06-23 dropped: nested `.alt/` generation chains — rejected rivals are flattened as
  siblings, because the paired Moves already record which form replaced which form and folder
  nesting made an alternative look like the child of the live node it lost to (code).
