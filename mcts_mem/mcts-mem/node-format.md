- A node file is items first — a flat list of statements that hold true of the current code,
  with no section heading — then an optional `## Facts` section, then an optional `## Moves`
  section, in that order.

- The filename is the node's name; the file carries no title heading.

- `## Moves` records only events that cross the `.alt/` boundary or drop a capability with no
  successor; a node that never moved has no `## Moves` section.

## Facts

- 2026-06-19 rationale: items are a flat list of holds-true statements rather than Must and
  Must-not constraints, since a true mechanism property such as "control flow is O(1)" is not
  an actionable prohibition (sourced).

## Moves

- 2026-06-19 replaced [[trajectory-format]]: a `## Trajectory` log of every event — births,
  edits, progress milestones — buried the few real boundary moves under noise that merely
  duplicated git history (sourced).
