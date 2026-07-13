- The forked child waits for kitty's screen-ready notification by installing a SIGWINCH handler and `sigsuspend()`-ing until the signal is delivered.

## Moves

- 2018-08-04 (eb2ec183) replaced by [[ready-sync]]: a pipe is simpler and more robust since there is no longer a race between the installation of the signal handler and the dispatch of the signal (sourced).
