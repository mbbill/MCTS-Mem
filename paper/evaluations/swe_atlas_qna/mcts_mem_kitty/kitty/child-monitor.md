- One dedicated I/O thread is the sole reader and writer of every child's PTY master fd; terminal-output parsing and rendering run on a separate main thread (`io_loop`).

- A single `poll()` call watches all child fds together with one wakeup fd and one signal-delivery fd; that one call is how the thread multiplexes every child.

- The I/O thread and the main thread share state only through per-`Screen` input and output buffers guarded by locks; neither thread touches fds owned by the other.

- The live child array is mutated only on the I/O thread, which drains add and remove queues populated by the main thread.

- A child's death is reaped on the I/O thread with non-blocking `waitpid`; the main thread then flushes the child's last buffered output and, by default, closes the window.

## Facts

- 2022-06-13 (5f13946b) statement: the six handled signals (SIGINT, SIGHUP, SIGTERM, SIGCHLD, SIGUSR1, SIGUSR2) are masked process-wide and delivered to the I/O thread as readable events on a dedicated fd its `poll()` watches, so signal handling needs no async-signal-safe shared state (code).

- 2022-06-13 (5f13946b) rationale: kitty uses its own signal-to-fd implementation rather than Python's signalfd because Python's returns only signal numbers, not the full siginfo struct (sourced).

- 2024-05-14 (6be75ce1) pitfall: reaped pids are copied into a local array and the children lock is released before the Python death callback runs, because that callback can re-enter code that takes the same lock and deadlock (sourced).

- 2024-02-25 (6205fb32) statement: to parse without holding the children lock, the main thread snapshots the child list and bumps each `Screen`'s refcount under the lock, then parses each child with the lock released (code).
