- After the buffer is re-wrapped, the cursor is repositioned by heuristic from its old coordinates rather than followed through the wrap.

## Moves

- 2018-02-02 (2ee9844c) replaced by [[cursor-tracking]]: positioning the cursor by heuristic after a resize misplaced it, so the position is now followed during reflow and read off directly (sourced).
