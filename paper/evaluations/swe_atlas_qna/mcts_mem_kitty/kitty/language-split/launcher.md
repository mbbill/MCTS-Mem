- The `kitty` program is a compiled C binary that embeds the CPython interpreter
  in-process and runs kitty's Python entry point from inside itself — it is not a
  `python kitty/main.py` invocation (kitty/launcher/main.c).

- The launcher pins interpreter pre-initialization before any Python runs: UTF-8
  mode, C-locale coercion, isolated mode, and a fixed bytecode optimization
  level, and sets the interpreter's executable to the kitty binary rather than
  python.

- Before initializing Python, the launcher inspects argv and, for remote-control
  (`@`) and wrapped-kitten invocations, directly execs the Go `kitten` binary
  rather than entering Python.

- A few common quick commands are parsed and answered in C with no interpreter
  started at all: version reporting, single-instance message passing, and the
  macOS `+open` path.

- The same launcher supports a frozen build that embeds a bundled Python home
  and pre-built extension modules.

## Facts

- 2024-06-24 statement: the embedded interpreter is driven through the CPython
  C-API rather than spawning a child python process, which lets the launcher own
  locale, isolation, argv, and the on-PATH name of the executable (code).

- 2024-06-23 (b5cf999d) measurement: answering `kitty --single-instance` in C —
  "No longer pay the overhead of starting the Python interpreter just to write a
  message to the single instance socket" — cut second-instance startup from 70ms
  to 3ms, ~25x (sourced).

- 2024-06-22 (581db0ab) measurement: answering `kitty --version` in C returns in
  ~3ms, reported as 1.23x faster than alacritty's (sourced).

- 2023-01-31 measurement: delegating to the Go `kitten` binary made `kitty @`
  remote-control commands ~10x faster, ~50ms down to ~5ms versus the prior
  Python client — `docs/changelog.rst` 0.27.0 (sourced).
