- The I/O thread wakes the main render thread once per loop iteration whenever any child output was read, with no rate limiting.

## Moves

- 2018-10-23 (40b355e5) replaced by [[wakeup-coalescing]]: processing wakeup events is very expensive on platforms such as Cocoa, so debounce main-loop wakeups by input_delay instead of waking on every chunk of child output (sourced).
