- The I/O thread does not wake the main render thread on every chunk of child output; it wakes it at most once per input_delay, coalescing a burst of small reads into a single render tick.

- While a wakeup is being held back, the I/O thread shortens its next poll timeout to the remaining input_delay, keeping the deferred wakeup bounded.

## Moves

- 2018-10-23 (40b355e5) replaced [[wakeup-per-chunk]]: processing wakeup events is very expensive on platforms such as Cocoa, so debounce main-loop wakeups by input_delay instead of waking on every chunk of child output (sourced).
