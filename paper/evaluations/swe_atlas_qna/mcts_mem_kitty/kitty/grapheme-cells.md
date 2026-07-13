- A cell holds one base codepoint plus up to three combining marks; the marks are stored as 2-byte table indices, not as codepoints, and are expanded back to codepoints when the cell's text is read (`cc_idx`).

- A multi-codepoint grapheme — a base with combining marks, an emoji with a variation selector, or a ZWJ emoji sequence — settles into a single base cell carrying its marks, and a state query rebuilds the grapheme by emitting the base codepoint followed by each stored mark in order.

- Display width — zero, one, or two — lives in the cell's GPU attributes and is computed from the base codepoint when it is placed; a width-two character occupies two cells, the second a null placeholder with no base codepoint.

- A combining mark directed at the null trailing cell of a wide character is redirected onto that character's base cell, and a mark may not attach to an otherwise empty cell.

- A variation selector settles a base's width: an emoji-presentation selector on a default-text emoji widens its cell to two and relocates the character when it sits at the right margin, while a text-presentation selector narrows an emoji to width one.

## Facts

- 2018-05-27 (8dea5b3e) measurement: splitting the cell into a CPU half (base codepoint, combining marks, hyperlink) and a GPU half (colors, sprite, attributes) cut the data uploaded to the GPU per draw by about 30% and left room for CPU-only grapheme data such as more combining marks (sourced).

- 2022-04-28 (2b3be147) rationale: the per-cell combining-mark slots were raised from two to three to use padding already present in the CPU cell, at no extra memory cost (sourced).

- 2018-02-06 (9c874f66) statement: an emoji-presentation variation selector arriving after its base mutates the already-placed cell's width from one to two, so a cell's width can change after its base codepoint is stored (code).
