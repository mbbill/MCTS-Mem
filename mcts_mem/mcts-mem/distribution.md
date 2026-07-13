- MCTS-Mem ships as a standalone, project-agnostic npm package — the `mcts-mem` CLI plus the
  two skills — independent of any host project.

- The skills are installed by pointing an agent at the repository; the CLI is fetched on
  demand through `npx mcts-mem` and needs no install.

## Facts

- 2026-06-19 rationale: the product is the skills, a shareable methodology for any project, so
  the package carries no host-project coupling such as a seeded CLAUDE.md (sourced).

- 2026-06-19 rationale: only the two SKILL.md files need installing, and because they use the
  open Agent Skills format, any compatible agent places them in its own skills directory
  (sourced).

- 2026-06-23 statement: npm version 0.2.0 shipped the browser viewer (`serve`) and the flat-alt
  linter rule (`R-altnest`), and npm version 0.2.1 fixed `--version` so the published CLI reports
  the package version from package.json (code).

## Moves

- 2026-06-19 replaced [[host-subdirectory]]: the product is a shareable methodology for any
  project, so it ships as its own package rather than living inside the repository it was
  developed in (sourced).
