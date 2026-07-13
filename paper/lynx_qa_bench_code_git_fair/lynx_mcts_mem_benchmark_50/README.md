# Lynx MCTS-Mem Benchmark — 50 Cases

This directory contains the 50-case benchmark-ready Lynx MCTS-Mem evaluation set.

Each case contains:

- **Question** — prompt to ask an evaluated agent.
- **Canonical correct answer** — target answer content.
- **Rubric** — task-specific scoring.
- **Example A** — a code-only-style partial answer with score and grade note.
- **Example B** — an MCTS-aware ideal answer with score and grade note.
- **Evidence** — MCTS-Mem and code paths useful for adjudication.
- **Common misses** — frequent failure patterns.

## Protocol

- **Code-only condition:** run in an isolated checkout/worktree where `mcts_mem/` is hidden or removed before any search. Allow code, tests, comments, and git history.
- **MCTS-aware condition:** require structural reading of `mcts_mem/` first, then code verification.
- **Scoring:** use each case rubric. Award semantic credit; exact wording is not required.
- **Benchmark target:** code-only answers often describe implementation mechanics; MCTS-aware answers should recover the decision, rejected alternatives, historical constraints, or design direction recoverable from code/git history.

## Files

- [`cases_01_10.md`](cases_01_10.md) — original/revisited core cases.
- [`cases_11_20.md`](cases_11_20.md) — platform/services, DevTool, shared-data, runtime communication.
- [`cases_21_30.md`](cases_21_30.md) — animation and Krypton canvas/WebGL/media/resource/audio.
- [`cases_31_40.md`](cases_31_40.md) — Krypton backend and Clay/RenderKit.
- [`cases_41_50.md`](cases_41_50.md) — event/list/renderer and Starlight layout.
