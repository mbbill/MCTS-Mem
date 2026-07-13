- A child's output is first decoded from bytes into a UTF-32 codepoint stream, which the parser then dispatches one codepoint at a time through mode-based handlers (normal / escape / CSI / OSC) (`dispatch_normal_mode_char`).

- CSI and OSC sequences are accumulated as buffers of decoded codepoints (uint32_t) and converted to integer parameters per sequence.

## Moves

- 2024-02-25 (b083ad90) replaced by [[input-event-loop]]: parsing the raw byte stream with SIMD vector instructions processes data in parallel for roughly a 2x throughput speedup over dispatching pre-decoded codepoints one at a time (sourced).
