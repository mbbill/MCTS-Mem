- The tool is a zero-dependency Node CLI (`mcts-mem`) with five subcommands — `lint`, `view`,
  `show`, `uncertain`, and `serve` — all built on one shared tree parser/model.

- `lint` is the load-bearing command; `view` and `show` render for people, `serve` opens a local
  browser viewer, and an agent reads a tree straight from the filesystem.

## Facts

- 2026-06-19 rationale: the command is declared through package.json's `bin` field, the
  idiomatic mechanism behind `npx mcts-mem`, while `scripts` is reserved for project tasks
  such as `test` (sourced).

- 2026-06-19 rationale: an agent reads a tree filesystem-first, because `view` and `show`
  render and summarise and hide the raw node fidelity an agent needs — `lint` is the one CLI
  step worth running before finalising a change (sourced).

- 2026-06-19 rationale: the most common operation, reading a tree, must never require
  `npx mcts-mem`, which would reintroduce a dependency into the zero-install path the skills
  promise (sourced).

- 2026-06-23 statement: `serve` binds a local HTTP viewer on 127.0.0.1 and keeps the process
  alive instead of returning an exit code, while every non-server command still exits normally
  (code).

- 2026-06-23 pitfall: the CLI version string was hardcoded after the 0.2.0 release, so
  `mcts-mem --version` printed 0.1.0 even though npm had installed the newer package; the CLI now
  reads package.json at runtime and the dispatch test asserts equality with the package version
  (code).

## Moves

- 2026-06-19 replaced [[vendored-lint-py]]: a Python script hardcoded to a sibling path could
  not run once the tool moved out on its own, while a published Node CLI is what the skills
  reference and what `npx` installs anywhere (sourced).
