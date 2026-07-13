- When a remote-control command carries a password, the whole JSON command is
  encrypted before it leaves the client; only the ciphertext, the initialization
  vector, the authentication tag, and the sender's public key travel in the clear.

- The symmetric key is derived by elliptic-curve Diffie–Hellman over Curve25519 and a
  single SHA-256 hash of the shared secret; the command is sealed with AES-256-GCM
  authenticated encryption.

- The receiving instance publishes its public key to child processes through an
  environment variable (`KITTY_PUBLIC_KEY`) that also carries the encryption protocol
  version.

- Every encrypted command includes a timestamp, and one whose timestamp is more than
  five minutes from the receiver's clock is discarded.

- An async-cancellation request is accepted even when unencrypted and
  unauthenticated.

## Facts

- 2022-08-03 (fd6bc55d) rationale: public-key crypto was built directly on OpenSSL
  rather than taking on a new dependency, as Python — already a kitty dependency —
  itself links OpenSSL (sourced).

- 2022-08-09 (2aee746d) statement: encryption is applied only when a password is in
  use; a command sent without a password travels as clear JSON (code).

- 2022-08-09 (2aee746d) rationale: a five-minute timestamp acceptance window serves as
  a nonce to minimise replay attacks, at the cost of requiring the two machines'
  clocks to roughly agree (sourced).

- 2022-09-01 (73259210) rationale: async-cancellation is exempt from authentication as
  it is emitted automatically on error or timeout and must never trigger a user
  permission prompt; a forged cancel can at most deny another request its result
  (sourced).
