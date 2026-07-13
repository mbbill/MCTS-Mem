- `mcts-mem serve` opens a local browser viewer for the tree; the browser and terminal commands share the CLI's filesystem model and describe the same nodes.

- The viewer renders the current tree as a left-to-right collapsible SVG: children expand to the right, alternatives expand below in the same column, and alt nodes are visually distinguished with a shallow grey fill and warm dashed border.

- The initial tree API is structural-only (`/api/tree`) for fast load; node Items, Facts, Moves, fact-file names, provenance, and fact/move counts are fetched lazily from `/api/node?path=...` when a node is selected.

- The details pane is a movable and resizable floating window; closing it hides the pane without resetting its last session position and size.

- Move targets in the details pane are clickable: selecting a `[[target]]` auto-opens the child/alt ancestors needed to make the target visible, selects it, and pans only enough to reveal it.

## Facts

- 2026-06-23 rationale: keeping `/api/tree` structural-only cut the Silverfir tree payload from roughly 967 KB to roughly 62 KB and changed initial tree fetch time from about half a second to about 60 ms, while clicked-node details stay small and lazy (code).

- 2026-06-23 rationale: expansion navigation should reveal only the clicked node and what it opened, not refit the whole graph, because automatic full-graph zoom-out destroys the user's current zoom context (code).

- 2026-06-23 pitfall: the first details-pane implementation rendered Facts and Moves as `[object Object]` because `/api/node` returns structured entry objects; the renderer now formats structured facts and moves by date/hash/kind or verb/target/text/provenance (code).

- 2026-06-23 pitfall: the old logical-path rule turned `compiler.alt/fast-interpreter/...` into `compiler/fast-interpreter/...`, making an alternative look like a child of the live node; logical paths now omit `.alt/` folders so the alternative occupies the replaced node's slot (code).
