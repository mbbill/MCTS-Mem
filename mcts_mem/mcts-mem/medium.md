- The tree is stored as prose-first Markdown files in a git repository, one file per node; the
  graph is a derived in-memory view built by a small loader, not the storage.

## Facts

- 2026-06-19 rationale: git gives the tree free versioning, diffs, merges, and pull-request
  review — operations a graph database does not supply for free — at the scale of hundreds to
  low thousands of nodes a single project reaches (sourced).

## Moves

- 2026-06-19 replaced [[graph-db]]: a graph database cannot diff, merge, or review in a pull
  request, and is overkill at the hundreds to low thousands of nodes a single project reaches,
  losing the versioning git already provides (sourced).
