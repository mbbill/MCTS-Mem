- A secondary ring buffer (`pagerhist`) retains the raw text of lines after they are evicted from the full main buffer, extending what the scrollback pager can show beyond the main buffer's line count.

- Each retained line is stored as its SGR/ANSI-formatted text, UTF-8 encoded, prefixed with an attribute-reset sequence and terminated by a carriage return, plus a line feed unless the line was wrapped.

- The backing store is bounded by a configured maximum size; it starts at up to 1 MB and grows in steps of at least 1 MB until that maximum, after which it overwrites its oldest bytes.

- The buffer is retained across a window resize, and its contents are rewrapped to the new width when the column count changes.

- It is emptied and shrunk back to its initial size whenever the main scrollback is cleared.

## Facts

- 2020-09-21 (b5007ba2) rationale: text is stored UTF-8 encoded rather than as 4-byte UCS-4 code points, cutting the storage requirement about 4x at the cost of encoding CPU (sourced).
