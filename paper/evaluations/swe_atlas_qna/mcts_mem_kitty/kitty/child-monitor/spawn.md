- Each child is started by `fork()` into a freshly opened PTY; the parent keeps the master fd while the slave becomes the child's stdin, stdout, and stderr (`spawn`).

- In the forked child, before exec, kitty restores inherited signal handlers and the signal mask to defaults, calls `setsid()`, and makes the slave PTY its controlling terminal.

- On exec failure the child execs kitty's hold kitten rather than exiting; the user is shown the failure message instead of a window that silently vanishes.

- The PTY master is opened in blocking mode and switched to non-blocking in the parent after the fork.

## Facts

- 2023-09-24 (68b861b1) rationale: on macOS the default shell is launched through `/usr/bin/login` so that `getlogin()` returns the correct user (sourced).

- 2024-06-24 statement: the child establishes the controlling terminal with an explicit ioctl after opening the slave by name, because on BSD a plain open() does not make it the controlling terminal (code).
