- The codebase is split across three languages with fixed roles: C for the
  performance-critical terminal core (screen model, escape parsing, PTY, GPU
  rendering), Python for high-level control, configuration, and UI
  orchestration, and Go for the standalone command-line tools.

- The C core is built into Python C-extension modules that the interpreter
  loads at runtime, not a free-standing C program (`fast_data_types`).

- The Go tools build into a single statically-linked `kitten` executable that
  runs on its own, with no Python interpreter in the process.

- One declarative option/config definition is the single source of truth from
  which the Python, the C, and the Go config parsers are all generated.

## Facts

- 2024-06-24 statement: the project states it is written in a mix of C for
  performance-sensitive parts, Python for extensibility and UI flexibility, and
  Go for the command-line kittens, depending on no large UI toolkit and using
  only OpenGL for rendering — `docs/overview.rst` (sourced).

- 2024-06-24 rationale: child-program interaction runs in a separate thread from
  rendering and the byte stream is parsed with vector CPU instructions, the
  workloads that put the terminal core in C — `docs/performance.rst` (sourced).

- 2017-09-15 (d4991424) statement: kitty runs a single Python thread and sets the
  interpreter thread-switch interval effectively to infinity, so Python is the
  serial control layer while the C core owns the concurrency (code).

## Moves

- 2022-11-14 (bbf75043) replaced [[python-cli-tools]]: the command-line tools and the `kitty @` remote-control client ran as Python, paying ~50-70ms of interpreter startup per invocation, while a single statically compiled Go binary runs the same commands in ~5ms and ships to any UNIX-like server as one standalone file (sourced).
