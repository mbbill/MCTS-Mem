- The ssh kitten is a thin wrapper around the system ssh program (`kitten ssh`): it
  forwards ssh's own arguments and hostname syntax, then sets the remote session up
  to mirror the local shell.

- It has ssh run a generated bootstrap script on the remote — POSIX sh by default,
  optionally Python — wrapped as `interpreter -c unwrap-script escaped-script` to
  survive whatever login shell the remote account uses.

- The bootstrap installs, from one gzip-compressed tar archive delivered over the TTY,
  kitty's terminfo, the shell-integration tree, any configured copied files and
  environment, and on demand the kitten binary, then execs the login shell with shell
  integration enabled.

- Per-host setup is driven by `ssh.conf` and `--kitten` overrides matched on
  hostname/username, with each hostname block reset to defaults rather than inheriting
  from an earlier match.

- How the archive and its credentials reach the remote is [[data-passing]]; connection
  setup is shared across sessions to one host via [[connection-sharing]].

- It can forward kitty's remote-control socket to a host, off by default and meant only
  for hosts the user explicitly trusts.

## Facts

- 2022-03-04 (fe27ee2d) rationale: the remote interpreter defaults to POSIX sh but can be
  set to Python; Python is recommended for BSD hosts whose default shells are too
  crippled to run the sh bootstrap reliably (sourced).

- 2023-08-04 (1f9852d7) statement: remote-control forwarding tunnels the socket named by
  KITTY_LISTEN_ON through an ssh ControlMaster, requires [[connection-sharing]], and
  refuses abstract UNIX sockets because OpenSSH cannot forward them (code).

- 2023-08-04 (1f9852d7) rationale: forwarding is opt-in per host and documented as
  dangerous, granting any software on the remote full access to the local computer
  (sourced).

## Moves

- 2022-02-23 (ddb87535) replaced [[inline-terminfo-script]]: a script baked into the ssh
  command line can carry only the terminfo, while remote shell integration, arbitrary
  copied files and an on-demand kitten binary need an out-of-band channel, met by a
  bootstrap script that pulls a tar archive over the TTY (sourced).
