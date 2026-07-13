- The remote bootstrap reads its whole setup payload — the gzip tar archive of terminfo,
  shell integration, copied files and env — as base64 lines arriving over the TTY.

- kitty hands that payload back only to a requester presenting a one-time password that
  matches a copy the kitten left in process-owned, mode-0600 POSIX shared memory
  (`kitty/shm.py`), along with the per-window request id `KITTY_PID-KITTY_WINDOW_ID`; the
  shared-memory object is owner-checked and unlinked on first read.

- When ssh can be kept from touching the terminal before the connection is up, the kitten
  pushes the data request itself with no wait; otherwise the remote script emits the
  request and one extra round-trip is paid.

- A live shared master ([[connection-sharing]]) likewise lets the kitten push the request
  without waiting.

## Facts

- 2022-03-10 (20962d98) statement: the payload and one-time password moved from an on-disk
  tmpfile in the cache dir to POSIX shared memory, unlinked immediately after it is
  written (code).

- 2022-03-10 (20962d98) rationale: no commit or doc records why shared memory was chosen
  over the tmpfile; the likeliest motive is keeping the sensitive env and credential blob
  off disk, but that reading is a guess (uncertain).

- 2022-03-13 (2b06ca5e) rationale: pushing the data request from the local side instead of
  waiting for the remote to ask removes one round-trip from connection setup (sourced).

- 2022-03-15 (5099dd6a) rationale: the push is taken only when ssh will not use the
  terminal before the connection — via kitty's own askpass or an OpenSSH new enough for
  SSH_ASKPASS_REQUIRE — otherwise the remote must request the data and pay the round-trip
  (sourced).

- 2022-03-13 (74f0057e) pitfall: the archive is streamed back in lines of at most 254
  bytes, fitting under the 255-byte TTY input-queue cap macOS enforces in canonical mode
  (code).
