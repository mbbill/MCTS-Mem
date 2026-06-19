- A re-decision moves the superseded form into `.alt/` with a paired Move; settling edits the
  node in place and leaves no `.alt/`.

- A form counts as settling only while it never executed against real input — an unfilled stub
  or a representation no binary or test ever ran; once a form has been consumed, replacing it
  is a re-decision.

## Facts

- 2026-06-19 rationale: a type-level wall — the old form's signature cannot hold the new
  capability at all — is always a re-decision, whether or not the form ever ran (sourced).

- 2026-06-19 rationale: when the repo cannot show whether a form was ever exercised, default
  to re-decision, since a dropped transition is unrecoverable while an over-recorded `.alt/`
  is reviewable (sourced).

- 2026-06-19 statement: filling a `todo!` stub is settling, not a re-decision; mis-classifying
  it creates a false `.alt/` fork (sourced).

- 2026-06-19 rationale: adopting or dropping an external dependency is always a re-decision,
  while build and test-harness tooling is project paperwork kept out of the tree (sourced).
