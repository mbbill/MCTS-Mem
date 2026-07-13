- Within one kitty instance, every session to a given server rides one shared ssh
  connection set up with `ControlMaster=auto`; only the first session pays connection and
  authentication latency.

- The kitten starts or reuses the master with a ControlPath under the runtime dir,
  ControlPersist, and keep-alive pings, and kitty tears every master down when it exits.

- A `close_shared_ssh_connections` action drops all active shared connections on demand.

## Facts

- 2022-03-09 (577de9f7) rationale: connections are shared to cut startup latency for later
  sessions and to require the password only once, using ssh ControlMasters that kitty
  cleans up on quit (sourced).

- 2022-03-10 (31d9db7e) rationale: the control sockets are kept under XDG_RUNTIME_DIR,
  which the OS auto-cleans on reboot (sourced).

- 2022-03-10 (f2d6ba87) pitfall: a long runtime-dir path is swapped for a short
  `/tmp/kssh-rdir-<uid>` symlink, keeping the ControlPath socket under the ~104-byte path
  limit OpenSSH and macOS impose on UNIX sockets (code).
