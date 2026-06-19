- Every `## Facts` and `## Moves` entry ends with one provenance tag — `(code)`, `(sourced)`,
  or `(uncertain)` — chosen by what could prove the claim wrong.

- `(code)` marks a claim whose truth-condition is in the code; `(sourced)` one resting on a
  human record such as a commit, doc, paper, chat log, or the author; `(uncertain)` the
  agent's own reading of intent, backed by nothing.

- An inference is tagged no higher than `(uncertain)`. A why recorded by a human is
  `(sourced)` even when the behaviour it explains is also visible in the code.

## Facts

- 2026-06-19 statement: the linter requires one of the three tags on every Facts or Moves
  entry (code).

- 2026-06-19 statement: kind and provenance are independent axes — kind (measurement,
  pitfall, rationale, statement) names the type of claim, the tag names how well-backed it is
  (sourced).

- 2026-06-19 pitfall: the one inference-tagged entry that proved wrong read a deleted design
  doc as abandonment when the proposal had in fact been realised in code the next day — the
  case that fixes why an intent guess stays `(uncertain)` (sourced).

- 2026-06-19 pitfall: agents briefed with a paraphrase of the rules rather than the rule text
  defaulted doc-sourced whys to `(code)`, causing 38 misclassifications corrected on re-audit
  (sourced).

## Moves

- 2026-06-19 replaced [[why-provenance-tags]]: the `(diff)` tag hid whether a claim was read
  off the code or an attributed motive, and `(inferred → Qn)` assumed an author still
  available to interview (sourced).
