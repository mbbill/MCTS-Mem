- File transfer runs as bi-directional "sessions" carried over the terminal escape-code
  channel: a stream of `key=value` commands wrapped in one OSC code (`FILE_TRANSFER_CODE`,
  5113), with binary fields base64-encoded and key names abbreviated to two or three
  letters.

- A session is either a send (peer to terminal) or a receive (terminal to peer); it
  transmits file metadata first — recursing into directories and preserving symlinks,
  hardlinks, permissions and mtimes — then the file data in chunks of at most 4096 bytes,
  then a finish that commits.

- Each regular file is transferred either whole ("simple") or as an rsync-style binary
  delta ("rsync"), and may additionally be zlib-compressed.

- For an rsync transfer the side that already holds the file sends a block signature and
  the other side returns only the changed blocks.

- No data touches the filesystem until the user approves the session in the receiving
  terminal, unless a pre-shared password authorizes it without a prompt
  ([[confirmation-bypass]]).

- When applying an rsync delta the patched output is built in a temporary file in the
  destination directory and atomically renamed over the original; a simple whole-file write
  goes straight to the destination, truncating it.

## Facts

- 2021-08-19 (37735b96) rationale: the protocol exists for situations where the TTY is the
  only convenient pipe between two machines, such as nested SSH sessions or a serial line
  (sourced).

- 2021-08-19 (37735b96) statement: because every byte is base64-encoded over the TTY, the
  protocol is documented as never competitive with direct file-transfer mechanisms
  (sourced).

- 2021-10-01 (cfeeec95) rationale: rsync delta transfer was added to make repeated
  transfers of large, slightly-changed files fast, identifying blocks by an XXH3 strong
  hash plus the rsync rolling weak hash with block size near the square root of the file
  size (sourced).
