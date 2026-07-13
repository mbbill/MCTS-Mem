- Everything a child writes is interpreted by a single per-window state-machine parser that turns the raw byte stream into an ordered sequence of screen operations: runs of printable text, C0/C1 control codes, and escape / CSI / OSC / DCS / APC sequences (`parse_worker`).

- The parser consumes raw bytes directly rather than a pre-decoded codepoint stream; UTF-8 decoding and scanning for runs of printable text happen inside the parse loop and are accelerated with SIMD vector instructions.

- A child's output is parsed in arrival order on a single thread; screen mutations are applied in the exact order the child emitted them. This parser is the point at which a child's raw bursts of bytes become the single ordered stream the rest of the terminal reacts to.

- An in-progress escape, CSI, OSC or DCS sequence is accumulated in a bounded buffer; a sequence that grows past the cap is rejected rather than buffered without limit.

## Facts

- 2024-03-12 measurement: per the 0.33.0 changelog, the rewritten byte/SIMD parser is about 2x faster in benchmarks and 10-50% faster on real workloads than the previous parser and lowers CPU energy use; a `kitten __benchmark__` was added to measure terminal throughput (sourced).

- 2024-02-25 (4caf8a6b) pitfall: the byte-parser rewrite initially dropped support for the legacy alternate (G0/G1) character-set designation escape codes, which had to be restored the same day (code).

## Moves

- 2024-02-25 (5f809bf2) replaced [[codepoint-parser]]: parsing the raw byte stream with SIMD vector instructions processes data in parallel for roughly a 2x throughput speedup over dispatching pre-decoded codepoints one at a time (sourced).
