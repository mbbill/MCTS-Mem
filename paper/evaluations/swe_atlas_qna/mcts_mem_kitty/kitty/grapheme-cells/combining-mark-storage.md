- Combining marks are stored as 2-byte indices into a process-wide table that interns each distinct mark codepoint; a mark of any codepoint value occupies two bytes in the cell and is recovered through the table when read (`mark_for_codepoint`).

## Facts

- 2018-01-18 (32632264) statement: the intern table maps each mark codepoint to a 2-byte id and back, which is what lets a mark be held in two bytes regardless of its codepoint value (code).

## Moves

- 2018-01-18 (80301d46) replaced [[direct-codepoint-cc]]: storing the mark codepoint directly in two bytes could not represent marks above the basic plane, so marks are now held as indices into a table that can intern any codepoint (sourced).
