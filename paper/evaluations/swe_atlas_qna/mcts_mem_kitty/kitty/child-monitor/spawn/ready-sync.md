- After setting up its fds, the forked child blocks until kitty signals that the window's `Screen` object exists; no child output is produced before kitty can parse it.

- Readiness is signalled over a dedicated pipe — the child waits on the read end and the parent closes the write end once the screen is set up (`wait_for_terminal_ready`).

## Moves

- 2018-08-04 (eb2ec183) replaced [[sigwinch-ready]]: a pipe is simpler and more robust since there is no longer a race between the installation of the signal handler and the dispatch of the signal (sourced).
