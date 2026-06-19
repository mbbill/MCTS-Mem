- One agent walks the whole history in fixed commit batches, each batch building incrementally
  on the tree the previous batch produced, serializing every commit through a single walker.

## Moves

- 2026-06-19 replaced by [[build-method]]: main-versus-`.alt` placement is fixed by the
  HEAD state, so each element's full history can be mined in parallel into disjoint subtrees
  rather than serializing every commit through one walker (sourced).
