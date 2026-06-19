- A decision's rejected rivals and superseded forms live in a sibling `<name>.alt/` folder;
  with every `.alt/` ignored, the main tree is the current design.

- Selection is encoded by position: a file in the main tree is live, a file inside an `.alt/`
  is superseded or a rival. There is no `selected:` marker field.

## Moves

- 2026-06-19 replaced [[or-grouping-markers]]: in a current-design-major layout the live
  winner itself anchors the fork, dissolving the need for a question node, a `.one`/`.all`
  container, or a `selected:` marker (sourced).
