- The linter mechanically checks the tree's structure and internal consistency: every
  `[[link]]` resolves, a re-decision's two sides carry a verbatim-identical reason, committed
  Facts and Moves are never edited, every entry carries a provenance tag, and no node is a
  bare module-map entry.

- It ships in two implementations: the Node CLI (`mcts-mem`, with `lint`/`view`/`show`/
  `uncertain`) and a richer `lint.py` that also validates the one-time build's scratch files.

- The README is the specification; each rule is cited by its ID rather than restated in a
  separate grammar document.

- A clean lint proves consistency, not truth: it cannot tell whether a recorded fact is right.

## Facts

- 2026-06-19 rationale: an invariant counts only if it names a check that can fail; one backed
  by an argument rather than a check is the confirmation bias Leveson warns of in safety cases
  (sourced).

- 2026-06-19 rationale: the linter is Python stdlib-only — its job is regex-grade parsing of
  text files, and zero toolchain dependency lets a build agent run it mid-batch as a compile
  loop (sourced).

- 2026-06-19 pitfall: the R-tail check is lexical, not semantic — it flags an item carrying
  any causal connective even in innocent descriptive use, forcing a rephrase (sourced).

- 2026-06-19 rationale: once the linter is a real command, the skills no longer restate the
  grammar, and structural correctness becomes a property of the artifact rather than a writing
  virtue (sourced).

- 2026-06-19 pitfall: an adversarial test fan-out found four real CLI bugs — CRLF endings
  swallowing the `## Facts` and `## Moves` headings, R-append silently disabled under a
  symlinked root, R-pair over-matching on a commit hash, and `show` calling a unique match
  ambiguous (sourced).

## Moves

- 2026-06-19 replaced [[prose-rules]]: prompt-tuning alone could not collapse agent variance
  on structural violations, while encoding them as mechanical checks made the violations
  impossible or visible (sourced).
