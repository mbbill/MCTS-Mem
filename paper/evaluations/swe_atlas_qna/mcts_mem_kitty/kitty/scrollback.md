- The scrollback is a fixed-capacity ring of history lines indexed in reverse, where line 0 is the most recently scrolled-off line and the highest index is the oldest line still retained (`HistoryBuf`).

- Lines are stored in fixed-size segments of 2048 lines; a segment is allocated only when a line falling in it is first written, and the number of segments is capped at the configured line total. Under sustained output the buffer carves new segments until it is full, then reuses the slots as a ring.

- Each segment is a single allocation holding that segment's CPU cells, GPU cells, and per-line attributes one after another.

- When the buffer is full, pushing a new line first serializes the oldest line into the [[pager-history]] ring, then overwrites that slot and advances the ring's start.

- Clearing the scrollback frees every segment except the first, returning the high-water-mark memory rather than retaining it.

- Changing the configured number of lines is done by allocating a fresh buffer and rewrapping the retained lines into it, not by resizing the existing storage in place.

## Facts

- 2021-04-10 (63e5be6f) rationale: segment memory is taken from libc `malloc`/`calloc` rather than the Python object allocator, which is not optimized for allocations this large (sourced).

## Moves

- 2018-05-03 (3f316c39) replaced [[preallocated-history-buffer]]: pre-allocating the whole configured buffer at startup consumed too much memory at very large scrollback sizes (sourced).
