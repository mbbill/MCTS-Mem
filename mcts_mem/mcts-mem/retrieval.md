- The memory is read by following the tree's structure or by grepping the files; there is no
  retrieval index over the facts.

## Facts

- 2026-06-19 rationale: a richer retrieval layer was studied but not built — cheap storage of
  raw observations, expansion of a query into the mechanisms it involves before retrieving,
  generous recall filtered by an LLM judge at read time, and a periodic reflection pass that
  consolidates many instances into one class memory (sourced).

- 2026-06-19 statement: an on-disk fact-base with HyDE-style read-time retrieval and a judge
  (the `.evidence/` annex model) was drafted and shelved; the shipped tree keeps facts inline
  and in `.fact/` files instead (sourced).

- 2026-06-19 rationale: facts carry no hard-authored scope predicate, since the option space is
  generative and a fact can bear on options that do not yet exist, so applicability is better
  decided at read time than frozen at capture (sourced).

## Moves

- 2026-06-19 replaced [[graph-rag]]: full graph-RAG indexing and temporal knowledge-graph
  infrastructure were judged overkill at the scale a single project's memory reaches (sourced).
