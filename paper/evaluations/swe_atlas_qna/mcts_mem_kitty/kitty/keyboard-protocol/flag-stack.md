- The progressive-enhancement flags are not a single value but a stack: an application pushes a new flag set (CSI > flags u) and later pops back to the previous set (CSI < number u), in addition to outright setting (CSI = flags ; mode u) and querying (CSI ? u) the current set.

- The main screen and the alternate screen each keep their own independent flag stack; switching screen buffer switches which stack is current. Flags an application sets on the alternate screen neither affect the main screen nor survive its return to the main screen (`screen_push_key_encoding_flags`).

- The current flags are the top entry of the active stack; the stack has a fixed maximum depth, pushing onto a full stack evicts its oldest entry, and a pop that empties the stack resets all flags.

- Resetting the terminal clears both stacks.

## Facts

- 2021-01-16 (a30ea2b7) rationale: terminals must keep separate flag stacks for the main and alternate screens so that a full-screen application which enables flags on entering the alternate screen has them automatically restored when it exits, without having to track and undo them itself — per docs/keyboard-protocol.rst (sourced).

- 2021-01-16 (a30ea2b7) rationale: the stack depth is bounded and the oldest entry evicted when full specifically to prevent a denial-of-service from an application that pushes without ever popping — per docs/keyboard-protocol.rst (sourced).

- 2021-01-16 (a30ea2b7) statement: each stack holds 8 entries; a slot stores the 7-bit flag value plus a high "occupied" bit, and the current flags are read from the highest occupied slot (code).
