- Cursor positions are followed through the reflow as the copy proceeds: each tracked position is updated to its destination coordinates at the moment its source cell is copied.

- The pass tracks an arbitrary set of positions at once; the active cursor and the saved cursor are both followed in a single reflow (`TrackCursor`).

- A tracked position past the trimmed end of its source line is clamped to the last real cell of that line before copying.

## Facts

- 2021-06-03 (c60a941d) statement: tracking was generalized from a single position to a null-terminated array of positions so the saved-cursor position is carried through reflow alongside the active cursor (code).

- 2022-10-31 (16b32261) pitfall: the destination column is advanced by one only when the source column is greater than zero, so a cursor resting at column 0 is not pushed to column 1 by reflow (code).

## Moves

- 2018-02-02 (2ee9844c) replaced [[heuristic-cursor-positioning]]: positioning the cursor by heuristic after a resize misplaced it, so the position is now followed during reflow and read off directly (sourced).
