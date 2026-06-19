- The linter ships as a `lint.py` file vendored into each project's tree and run as
  `python3 lint.py` against a hardcoded sibling path.

## Moves

- 2026-06-19 replaced by [[cli]]: a Python script hardcoded to a sibling path could
  not run once the tool moved out on its own, while a published Node CLI is what the skills
  reference and what `npx` installs anywhere (sourced).
