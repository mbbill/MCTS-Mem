# SWE-Atlas Codebase QnA evaluation workspace

Self-contained workspace for testing whether MCTS-Mem lifts a coding agent on a
**design-targeted** benchmark, rather than on issue-resolution (where the qutebrowser signal
washed out: C4 31 vs C1 30 on the full corpus).

**Why this benchmark.** Issue-resolution is a low-power test of design-rationale memory — bug
fixing is dominated by code-localization skill. SWE-Atlas **Codebase QnA** asks the agent to
*explain how/why the system works*, which is exactly what an MCTS-Mem tree encodes. That gives
more statistical power and a cleaner C1-vs-C4 attribution (same source history; does
*distilling+structuring* it beat dumping raw commits at matched tokens?). Cost: grading is an
LLM judge, not deterministic — accepted as instrumental to the goal (prove MCTS-Mem effective),
mitigated by a fixed external rubric + judge-swap + item-level reporting. See the goal-first
reframing in chat / memory.

## Benchmark facts (verified from the released dataset)

- 124 QnA tasks, 11 repos, every task `base_commit`-anchored. See `docs/repo_distribution.md`.
- Grading: rubric LLM judge (`claude-opus-4-5`); pass = all must-have items pass. Itemized
  rubrics → we additionally report **must-have item recall** (finer-grained, higher power).
- Run env: per-task Docker image `ghcr.io/scaleapi/swe-atlas:...`, repo mounted at `/app`,
  agent writes `/logs/agent/answer.txt`. Harness Apache-2.0, fully public.

## Plan

1. **Pilot on kitty (26 tasks, 1 MCTS-Mem build).** Highest design-density (85%) and best
   single-build amortization → sharpest go/no-go test of the method on its most favorable task.
2. **Conditions** (same scaffold/backbone/step budget/temp, matched injected-token budget;
   vary only the memory slot; all obey §7 ancestor cutoff per task):
   - **C0** empty — floor.
   - **C1** raw pre-cutoff git log (top-k commits+diffs, tuned chunk×k) — same source, no distillation.
   - **C4** MCTS-Mem rendered nodes (Items/Facts/Moves/`.alt`/provenance) — the method.
3. **Metrics:** binary task pass (judge) **and** must-have rubric-item recall; report both,
   paired, with matched tokens. Robustness: re-grade a sample with a second judge model;
   agent backbone ≠ judge family.
4. **Leakage (§7):** build C1/C4 memory only from `git rev-list <base_commit>` (strict
   ancestors). Red-team each context for gold-answer / post-base material before trusting a score.
5. **Scale if the pilot lifts:** add paperless-ngx, scapy, simple-login, grafana toward N≈70.

## Status

| step | status |
|---|---|
| QnA task inventory (124 tasks, 11 repos) | done — `tasks/qna_tasks.jsonl`, `docs/repo_distribution.md` |
| pilot repo chosen | kitty (26 tasks, one shared base_commit `815df1e2`, cutoff 2024-06-24) |
| harness stood up (harbor + proxy + compose + resource/network wiring) | done — see `docs/runbook.md`; verified harbor runs, judge/agent proxy reachable |
| **blocker: Colima needs Rosetta restart** | pending — VM is `rosetta:false` + 2CPU/2GB; restart waits for the other agent's Flipt run to finish (author decision) |
| kitty C0 smoke (1 task end-to-end) | blocked on Rosetta restart |
| kitty C0 baseline (26 tasks) | blocked on smoke |
| kitty MCTS-Mem build (cut at `815df1e2`) + C1/C4 | after baseline |

## Layout

```
swe_atlas_qna/
  README.md                     this file
  scripts/extract_qna_tasks.py  regenerate the task inventory from scaleapi/SWE-Atlas
  tasks/qna_tasks.jsonl         124 QnA tasks (repo, base_commit, category, language, image)
  docs/repo_distribution.md     human-readable inventory + build-cost + pick rationale
  docs/repo_distribution.json   machine-readable aggregates
```
