- Each combining mark is stored as its raw codepoint in a 2-byte cell field, limiting stored marks to the basic multilingual plane.

## Moves

- 2018-01-18 (80301d46) replaced by [[combining-mark-storage]]: storing the mark codepoint directly in two bytes could not represent marks above the basic plane, so marks are now held as indices into a table that can intern any codepoint (sourced).
