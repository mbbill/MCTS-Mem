- Whether a row continues onto the next is stored as one per-line attribute bit, set when the row soft-wraps and cleared at a hard break.

- Reflow reads this per-line bit to decide logical-line membership.

## Moves

- 2022-12-26 (68cf9f75) replaced by [[continuation-tracking]]: tracking wrap on the line's last cell lets a newline leave the line's wrap status unchanged, matching other terminal emulators and as required by the fish shell (sourced).
