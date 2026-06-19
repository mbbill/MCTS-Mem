- Committed Facts and Moves entries are never edited or deleted; a correction is a new dated
  entry that supersedes the old one.

- The append-only invariant is checked against git HEAD: version control is the consistency
  oracle.

## Facts

- 2026-06-19 rationale: history can be wrong — an early bad measurement can drive a decision
  reasonable on the data of the day; appending the correction openly rather than rewriting the
  past keeps the record auditable and lets the decision be re-found (sourced).

- 2026-06-19 rationale: append-only text has no source-of-truth problem because a fact is
  history and history does not change, so a superseded entry stays verbatim beside its
  correction (sourced).

## Moves

- 2026-06-19 replaced [[mutable-records]]: editing a record in place loses the history of what
  was believed and later proven wrong, which is exactly the re-decision evidence the memory
  exists to keep (sourced).
