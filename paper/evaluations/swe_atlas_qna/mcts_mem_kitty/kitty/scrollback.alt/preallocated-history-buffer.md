- The scrollback lines are held in one contiguous buffer sized for the full configured line count at construction time, with a parallel array of per-line attributes.

- The configured number of lines is changed in place by allocating a new buffer of the requested size and copying the retained lines across (`change_num_of_lines`).

## Moves

- 2018-05-03 (3f316c39) replaced by [[scrollback]]: pre-allocating the whole configured buffer at startup consumed too much memory at very large scrollback sizes (sourced).
