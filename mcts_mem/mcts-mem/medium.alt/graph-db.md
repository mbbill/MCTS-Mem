- The tree is stored in a graph database such as Neo4j as the source of truth, queried through
  the database's graph API.

## Moves

- 2026-06-19 replaced by [[medium]]: a graph database cannot diff, merge, or review in a pull
  request, and is overkill at the hundreds to low thousands of nodes a single project reaches,
  losing the versioning git already provides (sourced).
