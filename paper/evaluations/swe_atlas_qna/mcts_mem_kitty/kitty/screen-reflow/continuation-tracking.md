- Whether a displayed row continues onto the next row is recorded on the row's last cell, as a per-cell flag set when that cell is the soft-wrap point (`next_char_was_wrapped`).

- Reflow reads this last-cell flag to decide whether a source row continues the current logical line or starts a new one; the per-line continued attribute is derived from the previous row's last-cell flag on demand.

## Moves

- 2022-12-26 (68cf9f75) replaced [[per-line-continued-attr]]: tracking wrap on the line's last cell lets a newline leave the line's wrap status unchanged, matching other terminal emulators and as required by the fish shell (sourced).
