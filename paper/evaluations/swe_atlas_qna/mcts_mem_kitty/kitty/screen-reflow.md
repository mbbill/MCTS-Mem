- On a window resize the on-screen text is re-wrapped to the new width by a single pass that copies cells from the old buffer into a fresh buffer of the new size, starting a new destination row only when the row fills or a hard line break is reached (`rewrap_inner`).

- The reflow unit is the logical line — a run of cells spanning the soft-wrap boundaries the old width imposed — and only a hard line break ends one; blank cells trailing a hard break are dropped.

- The visible buffer and the scrollback history are re-wrapped by the same code; rows that overflow the top of the visible buffer during reflow spill into scrollback, and growing the window can pull rows back from scrollback to refill the freed rows.

- The cursor and saved-cursor positions are carried through the pass itself rather than reconstructed afterward.

- The current shell prompt is exempted from reflow.

## Facts

- 2016-11-20 (5dccb919) statement: the rewrap pass is one macro template instantiated for both the visible LineBuf and the scrollback HistoryBuf, and the visible buffer's overflowing rows are appended to history as the pass produces them (code).
