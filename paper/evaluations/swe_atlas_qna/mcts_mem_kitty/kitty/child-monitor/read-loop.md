- The I/O thread reads a ready child's PTY output directly into a fixed, pre-allocated buffer shared with that child's VT parser; no buffer is allocated per read (`read_bytes`).

- A child's fd is polled for input only while its parser buffer has free space; a fast producer is thereby throttled by parsing and render progress rather than by unbounded memory growth.

- A read of zero bytes, or a hard error other than EINTR/EAGAIN, marks the child dead.

## Facts

- 2024-02-25 (6205fb32) rationale: the shared read buffer was moved out of `Screen` into the VT parser during a parser rewrite for speed, so `read_bytes` now requests its write region from the parser and commits the byte count back instead of touching a `Screen` field (sourced).

- 2024-02-25 (6205fb32) statement: buffered child output is held unparsed until input_delay has elapsed since it arrived, the parser buffer is within ~16 KB of its 1 MB limit, or a flush is forced — so a lone keystroke echo is coalesced for a few ms while bulk output such as `yes` is drained the moment the buffer fills (code).

- 2024-02-25 (34164dc3) pitfall: a `read()` error must still commit a zero-length write to the parser, otherwise the write region handed out by the parser is left dangling and the next read aborts (code).

- 2024-02-25 (fd7d0f87) pitfall: the main loop re-arms its input_delay timer only when input was read or input is still pending; the earlier unconditional arm made the event loop wake every input_delay seconds even when completely idle (code).
