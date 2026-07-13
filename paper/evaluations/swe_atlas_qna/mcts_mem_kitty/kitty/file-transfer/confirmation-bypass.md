- Every transfer session must be approved interactively in the receiving terminal before
  any data moves.

- The prompt is skipped when the start command carries a `bypass` field holding a
  pre-shared password the terminal can independently reconstruct (`check_bypass`).

- Two bypass wire-forms are accepted: `sha256:` carrying a hash of `request_id;password`,
  and `kitty-1:` carrying the password encrypted to the terminal's public key; kitty's own
  kittens send the encrypted form.

- The encrypted form reuses kitty's public-key scheme ([[encryption]]) and embeds a
  timestamp, leaving the password neither exposed on the wire nor replayable outside a
  five-minute window.

## Facts

- 2021-09-13 (38a5e38f) statement: the original bypass transmits a SHA-256 hash of
  `request_id;password` in the bypass field rather than the password itself (code).

- 2021-09-13 (38a5e38f) rationale: the spec warns this hash does not actually hide the
  password and that a slower hash function would only add session-start latency,
  restricting plain hashing to trusted contexts (sourced).

- 2023-06-30 (aa86b98e) rationale: the `kitty-1` encrypted bypass was added alongside the
  hash precisely because the hash leaks the password and can be replayed; encrypting to the
  terminal's key with a timestamp closes both gaps (sourced).
