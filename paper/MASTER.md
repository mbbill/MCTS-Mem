# MCTS-Mem — Research, Reasoning & Plan (consolidated)

**Purpose.** Single source of truth for the paper effort: the method, the goal, the competitive
landscape (verified from PDFs), the evaluation decision and *why*, the chosen testbed, the experiment
design, and the open questions. Written for an external reviewing agent. Primary-source PDFs and
per-paper data sheets live in `paper/sources/`.

**Provenance discipline (read first).** Treat every external number as *web-surfaced and unverified*
unless this doc marks it **[verified]** — read from the paper PDF directly or queried from the dataset
by us this session. One published result does not make a law; a failed approach by others does not doom
a similar one. Skepticism is the default.

Date of last update: 2026-06-28. Incorporates an external technical review (five blocking issues fixed:
temporal leakage, verification-claim scope, baseline-ladder attribution, ablation-scope framing, and the
ReasoningBank temporal mismatch), plus the first qutebrowser SWE-bench Pro selected-subset pilot.

---

## 1. The method under study (MCTS-Mem)

MCTS-Mem is a **distillation over a repository's own git history** into a structured, machine-verified
memory of the project's **design decisions**, read by an LLM coding agent before it edits code. The
artifact is a filesystem tree of Markdown nodes (one node per real *decision*, never per module):

- **Items** — concept-level statements true of the current design.
- **`## Facts`** — dated, append-only evidence, each tagged by what could falsify it:
  `(code)` checkable against code, `(sourced)` a human record, `(uncertain)` an unbacked reading.
- **`## Moves`** — re-decisions: what replaced/dropped what, with the reason copied **verbatim** on
  winner and loser.
- **`.alt/`** — rejected alternatives and superseded forms, frozen with the reason each lost; reclaimable
  when the reason they died lapses.
- A deterministic **linter** (`src/lint.js`, `lint.py`) enforces **structural / provenance / append-only**
  consistency: links resolve, re-decision pairs agree verbatim, history is append-only vs git HEAD, every
  claim is tagged, `.alt/` members stay frozen, no node is a bare module-map entry. **Scope (honest):** it
  checks the *form and integrity* of the record; it does **not** semantically verify that a `(code)` fact
  is true of the code. "Consistency is a property of the artifact, like a passing compile."

Built once by mining git history + design docs; kept current incrementally. Reference artifact: a
lint-clean tree for the Silverfir-nano Wasm engine (`../Silverfir-nano/mcts_mem`, 370 nodes —
**[verified]** lints clean).

**The MCTS framing (kept — author's decision).** The tree *is* the search tree over the design space:
decisions = nodes; the `(code/sourced/uncertain)` **provenance tag is the per-decision value estimate**
(deliberately coarse / 3-valued — certainty could be graded finer but is not, by choice); `.alt/` =
explored-then-pruned-but-retained branches; a "rollout" = building-and-measuring (the expensive Monte-
Carlo sample). The framing is the conceptual model and the paper's title; the empirical claim stands on
its own without it.

---

## 2. Paper goal & locked decisions

**Goal.** Publish MCTS-Mem at an **AI/agents venue (NeurIPS / ICLR / COLM)**, as a **focused proof on
1–2 repositories**.

**Contribution (one sentence).** Retroactively distill a repository's existing git history into a
decision-granular memory whose *structural* consistency is machine-checked, and give the first
deterministic, judge-free evidence that such structured git-derived memory helps a coding agent.

**Decisions locked (with the author):**
1. **Keep the MCTS-Mem name/framing**, justified by provenance-tag-as-value (§1). Do not let a reviewer
   call the framing load-bearing-but-unbuilt; the empirical claim does not depend on it.
2. **No "linter-off" ablation.** The linter is **constitutive** — it generates the tree; turning it off
   yields a *failed build*, not a degraded method (cf. removing self-attention to "ablate" a Transformer).
   Verification is therefore handled by **diagnostics** (§8), not by crippling the build.
3. **Deterministic test grading only** for the headline (no LLM-as-judge).
4. **Use an existing, recognized benchmark — never an invented one** (an independent researcher's
   self-made benchmark is a desk-reject). This reversed an earlier mistake (a custom "re-break probe"
   suite), now dropped to an engineering diagnostic at most.
5. **Contamination is not fatal for relative comparisons:** the test is *with vs without MCTS-Mem* on the
   same model/tasks, so memorization is shared across arms. But it can still shrink headroom or interact
   with memory, so report relative deltas and treat absolute scores cautiously. (Distinct from temporal
   *leakage*, §7, which is a real blocker and is handled.)
6. **Minimize build cost:** build for only 1–2 repos; pick the testbed to **amortize** the build over as
   many deterministic, design-relevant tasks as possible.

---

## 3. Novelty & positioning

The contribution is **not** any single ingredient (each has prior art) but a specific combination,
pitched precisely or a reviewer collapses it onto a neighbor.

- *Not* "structured design memory" — ADRs, IBIS/QOC, SEURAT own that.
- *Not* "agent memory" — Mem0, A-MEM, MemGPT own that.
- *Not* "compress experience into reusable form" — Experience Factory (1988), CBR own that.

**The defensible core (three concrete deltas, each maps to something a named competitor provably lacks):**
1. **Retroactive distillation of a repo's *existing* history** (Lore only enriches *new* commits going
   forward → zero value on any pre-adoption codebase, i.e. all real ones).
2. **VCS-grounded structural + provenance verification** — a deterministic linter enforcing, against the
   git repo, that the memory is internally consistent and append-only (links resolve, re-decision
   winner/loser reasons match **verbatim**, no committed entry silently edited/deleted vs git HEAD, every
   claim falsifiability-tagged, `.alt/` frozen, no module-map nodes). This is beyond Lore's **format-only**
   `validate` and beyond CommitDistill/ACE/ReasoningBank (no verification at all). **Honest scope:** it is
   *structural/provenance/append-only* verification — **not** semantic checking that a `(code)` fact is
   true of the current code. Semantic code-state checking is future work, not a current claim.
3. **First empirical, deterministic measurement** that structured git-derived memory lifts agent task
   success (Lore proposes a study but runs none; CommitDistill's positive signal was weak and on a
   different task).

Position **Lore as complementary prior art** (write-path for new commits vs our read/distill-path over
legacy history); run named systems as **baselines**, not rivals to out-argue.

---

## 4. Competitive landscape — PDF-verified facts

Seven PDFs in `paper/sources/` with per-paper data sheets (`*.data.md`, verbatim quotes + locations).
Key facts **[verified from PDF]**:

- **Lore** (arXiv 2603.15566, single-author preprint, Mar 2026) — coins "Decision Shadow" + a `Rejected:`
  trailer; **forward-only** (serializes new commits, no retroactive mining); `validate` checks **commit
  format only** (no semantic/state contradiction; no `doctor` command — an earlier HTML-derived claim was
  wrong); **reports zero results** (proposes a two-team/six-month study). The nearest twin; our three
  deltas (§3) are exactly what it lacks.
- **CommitDistill** (arXiv 2605.18284, 2026) — mines git history into typed units with a **9-heuristic
  regex extractor**; downstream task is **LLM-judged file/identifier *localization*** on **requests +
  flask (n=200)**; **null at the mean** (Table VIII: CD-v2 +0.015 [-0.035,+0.065], BM25 +0.030, all CIs
  cross zero); hard stratum (control ≤0.5, n=102): control 0.304, CD-v2 +0.123, **BM25 +0.162**.
  **Caution, not a verdict:** this is *localization, LLM-judged, 2 small repos, regex extraction* — NOT
  SWE-bench resolve-rate. It does not show that *better-distilled* git memory fails on resolve-rate.
- **ReasoningBank** (arXiv 2509.25140, Google, ICLR 2026) — memory from the agent's **own past task
  trajectories**, LLM-as-judge labeled (judge acc 72.7%). SWE-bench Verified (Table 2, mini-SWE-agent,
  bash-only ReAct): Gemini-2.5-flash **34.2 → 38.8**, Gemini-2.5-pro **54.0 → 57.4**; baselines = No-memory
  + Synapse; **AWM excluded** ("action space … open-ended … difficult to extract … workflows"). Code public
  (`google-research/reasoning-bank`) but Vertex/Gemini-coupled + online streaming — reimplement, don't fork.
- **Subtask-Memory** (arXiv 2602.21611, 2026) — memory from **test-time trajectories**; SWE-bench Verified,
  mini-SWE-agent; baseline is a **reproduction of ReasoningBank**, which it beats: Gemini-Flash 36.3 →
  **41.9**, Pro 53.5 → **60.3**, Claude-3.7 52.2 → **56.1**. Evidence that memory *can* move SWE-bench
  Verified resolve-rate (trajectory source).
- **ACE** (arXiv 2510.04618, 2025) — itemized playbook bullets w/ counters; Generator/Reflector/Curator;
  AppWorld 42.4 → **59.4**, FiNER 70.7 → **78.3**, Formula 67.5 → **85.5**. **No verification** (dedup only).
- **SWE-Exp** (arXiv 2507.23361) — experience bank from trajectories on SWE-bench Verified; ~41.6% open-
  source / ~73% with Claude Sonnet; public code.
- **SWE-QA** (arXiv 2509.14635) — codebase Q&A, 720 Qs balanced (~180 "Why"); **LLM-as-judge**. Not usable
  as a deterministic headline.

**Standing line:** the SOTA memory line (ReasoningBank, SWE-Exp, Subtask) mines the agent's *own attempts*;
MCTS-Mem's **git-history source** is a distinct axis (and available at t=0 — a cold-start property
attempt-memory lacks).

---

## 5. The evaluation decision (and the journey)

**Rejected and why:**
- *Headlining SWE-bench Verified resolve-rate naively* — washout risk (CommitDistill caution); Verified
  "difficulty" is fix-*time*, not design-relevance (§9). Stratified reporting is fine; the mean alone is fragile.
- *A custom "re-break probe" suite* — deterministic and on-thesis, **but an invented benchmark**, a
  non-starter for an independent author. **Dropped** (survives only as an engineering diagnostic).

**Chosen:** an **existing, recognized, deterministic-test-graded benchmark with design-relevant tasks**,
maximizing tasks-per-build → **SWE-bench Pro**.

**Options surveyed:** SWE-bench Pro (deterministic, long-horizon, multi-file) · SWE-Atlas (Scale 2026:
Codebase-QnA 124 / Refactoring 70 / Test-writing 90 — strongest design-fit but **mixed/LLM-judge**) ·
RefactorBench (Microsoft, ICLR'25, 100, deterministic) · SWE-Refactor (Java, 1,099, deterministic) ·
FeatureBench (200, deterministic) · SWE-EVO / FeatBench / MigrationBench / SWE-Lancer. Codebase-QA sets
(SWE-QA, CoReQA) are mostly LLM-judged → excluded from the deterministic headline.

**Why SWE-bench Pro:** deterministic ✓; recognized (Scale, public leaderboards) ✓; substantial multi-file
tasks (~107 LOC / 4 files avg) ✓; **50–100 deterministic tasks per repo → strong amortization** ✓;
baselines run on the same `mini-SWE-agent` scaffold ✓. Caveat: it is *issue-resolution*, so it does not
*isolate* design-decision knowledge — whether MCTS-Mem helps is the empirical question.

---

## 6. Testbed choice — repository

Objective: **(deterministic) × (design-relevant) × (many tasks per build) × (rich history to distill).**

**SWE-bench Pro public per-repo task counts [verified — queried HF `ScaleAI/SWE-bench_Pro`, test split, 731 rows]:**

| repo | tasks | lang |  | repo | tasks | lang |
|---|---|---|---|---|---|---|
| ansible/ansible | 96 | py |  | future-architect/vuls | 62 | go |
| internetarchive/openlibrary | 91 | py |  | navidrome/navidrome | 57 | go |
| flipt-io/flipt | 85 | go |  | element-hq/element-web | 56 | js |
| qutebrowser/qutebrowser | **79** | py |  | NodeBB/NodeBB | 44 | js |
| gravitational/teleport | 76 | go |  | tutao/tutanota | 20 | ts |
| protonmail/webclients | 65 | js |  | | | |

**Initial build:** `qutebrowser/qutebrowser`.

- It had 79 deterministic tasks per single build, a coherent Python desktop architecture, and an affordable
  first MCTS-Mem/harness path.
- The full79 repeat1 later showed that qutebrowser is useful as a prototype and dilution result, but probably
  not the strongest main proof repo: C4 beat C0 (`31/79` vs `24/79`) while only edging C1 raw git (`31/79`
  vs `30/79`).

**Current repo-selection state:** Flipt is the active next target. `ansible/ansible` had the most screened
history/design tasks (44/96), while `flipt-io/flipt` was chosen as the best practical next target (42/85,
strong config/schema/database/API compatibility cluster, probably more tractable than Ansible). See
`paper/evaluations/swebench_history_repo_screen.md` and `paper/evaluations/flipt/`.

**Current Flipt run state:** GPT-5.2 Codex is the active evaluation model through the local Responses API
proxy at `http://127.0.0.1:8789`. The strict full repeat at
`paper/evaluations/flipt/results/full85_three_arm_gpt52_codex_cutoffgit_repeat1` remains a diagnostic only:
local grades were C0=8/85, C1=7/85, and C4=4/85, but the audit found an over-restrictive generation harness
(`step_limit=24`, 600s wall time, 2048 output tokens, read-only rejections) despite complete artifacts,
passing cutoff-history guards, sane patch extraction, and an 85/85 reference-patch oracle. See
`paper/evaluations/flipt/docs/gpt52_repeat1_audit.md`.

The relaxed full repeat is now complete at
`paper/evaluations/flipt/results/full85_three_arm_gpt52_codex_relaxed_cutoffgit_repeat1`: each arm has 85
predictions and 85 trajectories. Final local targeted grades after force-regrading Docker pull failures are
C0=7/85, C1=8/85, and C4=8/85. Paired outcomes are C4 vs C1 = 2 wins / 2 losses / 6 both / 75 neither, and
C4 vs C0 = 3 wins / 2 losses / 5 both / 75 neither. This is operationally cleaner than the strict run, but
it is still not a strong positive full-corpus patch-generation result: C4 ties raw cutoff git and only edges
the no-memory baseline by one task. Initial paired analysis is in
`paper/evaluations/flipt/docs/gpt52_relaxed_paired_analysis.md`: C4-only wins are plausible interface/lifecycle
memory tasks, but C4 also loses tasks with relevant retrieved memory. C4 means `C1 + MCTS-Mem`; `C0 + MCTS-Mem` should be named
`C5_mcts_mem_only` if that ablation is added later. Earlier GPT-5.5 Flipt outputs are preserved as
exploratory only and must not be overwritten.

**Caveat:** the repo screen is a heuristic and should be followed by reviewer-scored task selection. The
qutebrowser result shows that textual history/design signals alone can still wash out at the pooled mean.

---

## 7. Time-travel / leakage protocol (MANDATORY)

*The biggest correctness risk, and the main review omission.* MCTS-Mem is mined from git history, and a
SWE-bench Pro task's **fix commit** (and later rationale about it) lives in that same history. If a task's
memory includes anything at or after its resolving commit, the experiment is invalid — every memory
condition would leak the answer.

**Rule.** For each evaluated task, the memory (C1–C4) and the raw/summary corpora are built **only from
commits that are strict ancestors of that task's `base_commit`** — i.e. within `git rev-list <base_commit>`.
The fix commit, the task's PR, and everything after are excluded. Two acceptable forms (pilot picks the
cheaper for qutebrowser):
- **Per-task cutoff:** the tree/corpus is sliced at each task's `base_commit`; or
- **Single cutoff T:** build from commits before T, evaluate only tasks whose `base_commit` is after T.

**Enforcement (hard gate in the build/inject harness):** the builder refuses any commit not in
`git rev-list <base_commit>`. Do **not** rely on a hidden upstream fix SHA: SWE-bench-style datasets expose
`base_commit`, `patch`, and `test_patch`, but may not expose the actual merged fix commit. The safe rule is
therefore: every memory/corpus artifact must be derivable solely from the ancestor set of `base_commit`.

**Live-shell enforcement:** the agent container must not expose full repository history. For Flipt, the clean
runner reinitializes the checkout as a one-commit repository at the task snapshot before the agent starts and
rejects live history commands (`git log`, `git show`, `git rev-list`, `git blame`, revision-qualified
`git grep`, etc.). The interrupted Flipt run
`results/full85_three_arm_gpt55_mt2048_repeat1_unguarded_exploratory_stopped49` violated this rule and is
exploratory only; do not report it as a clean paper result.

**Leak red-team (run before trusting any number):** scan each produced memory/corpus for exact gold-patch
hunks, gold test-patch hunks, post-base PR/issue identifiers when available, and other fix metadata. The
provided **context** must contain zero gold patch text / fix-commit metadata / post-base evidence. This is
not a requirement that agents solve zero tasks — a no-memory or raw-history agent may legitimately solve a
task from the problem statement and code alone. A deliberately contaminated artifact (containing gold-patch
text) must trip the gate (negative control).

---

## 8. Experimental design

**Benchmark / scaffold / grading:** SWE-bench Pro (qutebrowser), upstream `SWE-agent/mini-swe-agent`,
official Docker harness, **deterministic** FAIL_TO_PASS + PASS_TO_PASS. Metric = **Resolve Rate**, reported
overall and **stratified** (patch size / file-count — standard analysis, not an invented metric). All
conditions obey the §7 cutoff.

**Conditions** — same scaffold, same backbone, same step budget, temp 0, **matched injected-token budget**,
shared retriever surface where applicable; vary only the memory slot:

| ID | Memory slot | Role |
|----|-------------|------|
| C0 | empty | floor |
| C1 | raw git log — top-k pre-cutoff commits+diffs, tuned chunk×k | same source, retrieval, no distillation |
| C4 | **MCTS-Mem** (rendered nodes; Items/Facts/Moves/`.alt`/provenance intact) | the method |

Dropped from the current evaluation: format-only memory ablations, no-`.alt`, CommitDistill-style regex units,
and C5 ReasoningBank. They are plausible future ablations/baselines, but the paper budget now prioritizes
the three-arm C0/C1/C4 result and any needed repeats over running another ablation pass.

**What the comparisons do and do NOT show (current three-arm evaluation):**
- **C4 > C0** tests whether adding MCTS-Mem improves the agent over no memory on the same tasks/model/harness;
  repeat1 is positive on this comparison.
- **C4 > C1** is the core control: it tests whether a distilled MCTS-Mem tree beats raw pre-cutoff git-history
  retrieval from the same repository source. Repeat1 is only +1 for C4 on the full corpus, so this does not yet
  settle the reviewer objection that "any git history would help."
- The current plan does **not** isolate the value of tree layout versus prose-only memory, because the
  format-only ablation was dropped for cost/control-surface reasons. Do not claim that the tree format alone
  is causally responsible.
- The task-resolve ladder also does **not** isolate verification. Verification is supported by the separate
  lint/fault-injection diagnostic below, not by a runtime linter-off or weaker-baseline comparison.

**Verification diagnostic (separate from resolve-rate, since the ladder can't isolate it):**
- **Static fault-injection / lint catch-rate** — inject each fault class (broken link, disagreeing move
  pair, edited committed entry, missing tag, module-map node) into valid trees; report catch-rate +
  false-positive rate. This shows the linter *works* as the tree-validity checker. It is **not** a runtime
  ablation and does not claim that removing the linter is a meaningful variant of MCTS-Mem.
- **R-append implementation for time-travel trees:** materialize each accepted built tree in its own git
  repo/worktree, commit that tree as the baseline, then run `mcts-mem lint` against that repository HEAD.
  Otherwise the current linter's append-only-vs-HEAD check is ambiguous for retroactive, per-cutoff
  artifacts.

**Backbones:** two (one frontier + one open-weight). **Controls:** matched token budget (`tiktoken`), shared
retriever, same harness; report the triple (resolve-rate, mean context-tokens, latency).

**Proof criteria (statistical rule set, before running expensive experiments):**
- **Primary:** C4 > C1 and C4 > C0, paired resolve rate, matched tokens where the context slot is non-empty.
  Report paired bootstrap confidence intervals and a McNemar test; report both backbones if a second one is
  run. Treat <3 absolute points as weak/noisy unless stratified effects are large and consistent.
- **Deferred ablations:** format-only memory variants, no-`.alt`, CommitDistill-style regex units, and
  trajectory memory are future work unless the three-arm result needs follow-up.
- **Diagnostic:** the lint/fault-injection suite catches structural contradictions in candidate trees before
  a tree is accepted as valid.
- **Exploratory:** C4 vs C5 — git-history vs trajectory memory (a source comparison).

**The bet, stated honestly:** git-history memory *might* wash out at the mean (CommitDistill caution) — but
that null was on LLM-judged localization over 2 repos with regex extraction, **not** SWE-bench resolve-rate,
and Subtask-Memory shows the resolve number *can* move (+3–6 pts) with memory. Whether MCTS-Mem moves it is
**genuinely untested** and is what the pilot/experiment answers.

### Current qutebrowser selected-subset pilot (2026-06-26)

The initial qutebrowser build and local SWE-bench Pro harness are now working well enough for small selected
batches. A failed full `79 x 3` harness trial exists and must not be cited as a model-quality result; it was
dominated by empty patches, Docker startup failures, and proxy/tool-call failures. The useful signal is a
memory-relevance-selected subset, graded deterministically with the local qutebrowser Pro Docker grader.

Selection protocol: all 79 qutebrowser tasks were scored by a 3-reviewer memory-relevance pass, then the
highest-ranked tasks were evaluated with C0 no-memory baseline, C1 raw pre-cutoff git-history context, and a
trimmed MCTS-Mem condition `C4_mcts_mem_top8w900` (top 8 retrieved memory records, max 900 words). Contexts
obey the per-task ancestor cutoff protocol in §7. Small-batch grading uses `--workers 1` to avoid
Docker/Colima/QEMU load flakes.

Current clean C0-vs-C4 progression:

| selected slice | C0 no memory | trimmed MCTS-Mem | memory-only wins |
| --- | ---: | ---: | --- |
| top 6 memory-relevance tasks | 1/6 | 3/6 | `1943fa07`, `46e6839e` |
| top 10 memory-relevance tasks | 1/10 | 3/10 | `1943fa07`, `46e6839e` |
| top 12 memory-relevance tasks | 2/12 | 4/12 | `1943fa07`, `46e6839e` |

Current three-arm selected top-12 control:

| condition | resolved | resolved short ids | notes |
| --- | ---: | --- | --- |
| C0 no memory | 2/12 | `ed19d7f5`, `0aa57e4f` | no memory floor |
| C1 raw git | 1/12 | `ed19d7f5` | 9/12 nonempty; raw history did not recover the memory-only wins |
| C4 trimmed MCTS-Mem | 4/12 | `ed19d7f5`, `1943fa07`, `46e6839e`, `0aa57e4f` | beats both controls on this selected slice |

Concrete wins:

- `1943fa07`: memory condition moved pinned-tab ownership/lifecycle toward `AbstractTab.set_pinned`; C0
  missed the ownership boundary.
- `46e6839e`: memory condition replaced `pkg_resources` version parsing with a Qt-native helper and passed
  the selected version/utility tests; C0 produced an invalid rescued diff/import failure.

Interpretation discipline:

- The top-6 result is the clearest positive pilot: `1/6 -> 3/6` on a selected architecture/history-heavy
  slice.
- The top-10 and top-12 extensions are broader checks preserving the same absolute +2 delta: `1/10 -> 3/10`
  and `2/12 -> 4/12`.
- Ranks 7-12 added one overlap win and no memory-only wins, so do not imply monotonic gains as the slice
  expands.
- The C1 raw-git control is now complete on top 12 and resolves only `ed19d7f5` (`1/12`), below both C0
  (`2/12`) and C4 (`4/12`). On this selected slice, raw pre-cutoff git context does **not** explain the
  MCTS-Mem wins.
- This remains selected-slice evidence: the slice is small and selected, and C1 had three empty patches. Use
  it as a controlled stratified complement to the full-corpus result, not as the pooled headline number.

Artifact pointers:

```text
/Users/bytedance/Dev/MCTS-Mem/paper/evaluations/qutebrowser_mcts_mem_eval.md
/Users/bytedance/Dev/MCTS-Mem/paper/evaluations/qutebrowser/artifacts/selected_top12/local_grade_reports/baseline_c0_memory_top6_gpt55_testctx_guarded_mt2048_rescue.summary.json
/Users/bytedance/Dev/MCTS-Mem/paper/evaluations/qutebrowser/artifacts/selected_top12/local_grade_reports/c4_top6.C4_mcts_mem_top8w900.summary.json
/Users/bytedance/Dev/MCTS-Mem/paper/evaluations/qutebrowser/artifacts/selected_top12/local_grade_reports/baseline_c0_memory_rank7_10_gpt55_testctx_guarded_mt2048_rescue_retry1.summary.json
/Users/bytedance/Dev/MCTS-Mem/paper/evaluations/qutebrowser/artifacts/selected_top12/local_grade_reports/c4_rank7_10.C4_mcts_mem_top8w900.summary.json
/Users/bytedance/Dev/MCTS-Mem/paper/evaluations/qutebrowser/artifacts/selected_top12/local_grade_reports/baseline_c0_memory_rank11_12_gpt55_testctx_guarded_mt2048_rescue.summary.json
/Users/bytedance/Dev/MCTS-Mem/paper/evaluations/qutebrowser/artifacts/selected_top12/local_grade_reports/c4_rank11_12.C4_mcts_mem_top8w900.summary.json
/Users/bytedance/Dev/MCTS-Mem/paper/evaluations/qutebrowser/artifacts/selected_top12/local_grade_reports/c1_raw_git_memory_top12_gpt55_testctx_guarded_mt2048_rescue_retry1.summary.json
```

### Current qutebrowser full-corpus result (2026-06-27)

The clean full 79-task qutebrowser run has now completed for the three paper arms. This is one stochastic
repeat, not the planned three-repeat robustness set.

Paper-side summary archive:

```text
/Users/bytedance/Dev/MCTS-Mem/paper/evaluations/qutebrowser/artifacts/full79_three_arm_gpt55_mt2048_repeat1/local_grade_reports
```

Detailed paper-side evaluation record:

```text
/Users/bytedance/Dev/MCTS-Mem/paper/evaluations/qutebrowser_mcts_mem_eval.md
```

Generation used `anthropic/claude-gpt-5.5`, `max_tokens=2048`, `agent.step_limit=24`,
`agent.max_consecutive_format_errors=4`, `--include-test-context`, and concurrent one-worker generation for
`C0`, `C1_raw_git`, and `C4_mcts_mem_top8w900`. Local grading was serial with `--workers 1`.

Full79 repeat1 result:

| condition | total | nonempty | resolved | status counts |
| --- | ---: | ---: | ---: | --- |
| C0 no memory | 79 | 73 | 24 | `empty_patch=6`, `resolved=24`, `unresolved=49` |
| C1 raw git | 79 | 71 | 30 | `empty_patch=8`, `resolved=30`, `unresolved=40`, `test_environment_failed=1` |
| C4 trimmed MCTS-Mem | 79 | 69 | 31 | `empty_patch=10`, `resolved=31`, `unresolved=37`, `test_environment_failed=1` |

Paired resolved-count deltas:

| comparison | C4 wins | C4 losses | net |
| --- | ---: | ---: | ---: |
| C4 vs C0 | 10 | 3 | +7 |
| C4 vs C1 | 6 | 5 | +1 |

Interpretation discipline:

- The full-corpus repeat supports a claim that trimmed MCTS-Mem improves over no memory in this harness:
  `31/79` vs `24/79` (+7 absolute; paired net +7).
- The pooled advantage over raw pre-cutoff git context is only `31/79` vs `30/79` (+1 absolute; paired net
  +1). Per the predeclared rule above, this is weak/noisy unless paired/bootstrap or stratified analyses show
  a consistent effect.
- The selected top-12 result still supports a memory-relevance story (`C0=2/12`, `C1=1/12`, `C4=4/12`), but
  the full corpus forces a more conservative paper claim: raw git is a strong control on the pooled benchmark.
- C4 had more empty patches (`10`) and fewer nonempty predictions (`69/79`) than C0 and C1, so report
  generation reliability/control-loop cost as a limitation.

Full79 grade artifacts:

```text
/Users/bytedance/Dev/MCTS-Mem/paper/evaluations/qutebrowser/artifacts/full79_three_arm_gpt55_mt2048_repeat1/local_grade_reports/summary.json
/Users/bytedance/Dev/MCTS-Mem/paper/evaluations/qutebrowser/artifacts/full79_three_arm_gpt55_mt2048_repeat1/local_grade_reports/C0.summary.json
/Users/bytedance/Dev/MCTS-Mem/paper/evaluations/qutebrowser/artifacts/full79_three_arm_gpt55_mt2048_repeat1/local_grade_reports/C1_raw_git.summary.json
/Users/bytedance/Dev/MCTS-Mem/paper/evaluations/qutebrowser/artifacts/full79_three_arm_gpt55_mt2048_repeat1/local_grade_reports/C4_mcts_mem_top8w900.summary.json
```

### SWE-bench Pro repo screen for a better memory target (2026-06-27)

Because qutebrowser's pooled full79 result was diluted (`C4=31/79`, `C1=30/79`), we screened all public
`ScaleAI/SWE-bench_Pro` repos for explicit history/design-relevance signals. The screen is heuristic: it
counts tasks with core history signals such as migration, legacy, deprecation, compatibility, regression,
upgrade/downgrade, or schema, plus supporting design evidence such as API/config/database/state/refactor
language or matching issue tags.

Paper-side artifacts:

```text
/Users/bytedance/Dev/MCTS-Mem/paper/evaluations/swebench_history_repo_screen.md
/Users/bytedance/Dev/MCTS-Mem/paper/evaluations/swebench_history_repo_screen.json
/Users/bytedance/Dev/MCTS-Mem/paper/evaluations/score_swebench_history_relevance.py
```

Top absolute-count candidates:

| repo | tasks | screened history/design tasks | rate | interpretation |
| --- | ---: | ---: | ---: | --- |
| `ansible/ansible` | 96 | 44 | 0.46 | most absolute history-related tasks; many compatibility/deprecation/legacy cases; likely expensive |
| `flipt-io/flipt` | 85 | 42 | 0.49 | near-top count and more tractable; strong config/schema/database/API compatibility cluster |
| `qutebrowser/qutebrowser` | 79 | 34 | 0.43 | textually history-rich, but empirically diluted in full79 repeat1 |
| `gravitational/teleport` | 76 | 26 | 0.34 | upgrade/cluster compatibility cases; operationally heavier |
| `element-hq/element-web` | 56 | 22 | 0.39 | UI/state/refactor signals; frontend stack may add noise |

Recommendation: the literal answer to "which repo has the most history-related tests?" is `ansible/ansible`.
The best practical next target is probably `flipt-io/flipt`: almost as many screened history/design tasks as
Ansible, but likely a cleaner and smaller harness for testing whether MCTS-Mem beats raw git. Before spending
on full generation, run the same reviewer-scored memory-relevance selection pass on `ansible/ansible` and
`flipt-io/flipt`, then choose the repo with the larger high-confidence selected slice.

### Current Flipt evaluation workspace (2026-06-27)

We are proceeding with `flipt-io/flipt` as the next target and keeping the new workspace self-contained under
`paper/`.

Paper-side artifacts:

```text
/Users/bytedance/Dev/MCTS-Mem/paper/repos/flipt
/Users/bytedance/Dev/MCTS-Mem/paper/evaluations/flipt/README.md
/Users/bytedance/Dev/MCTS-Mem/paper/evaluations/flipt/docs/preflight.md
/Users/bytedance/Dev/MCTS-Mem/paper/evaluations/flipt/docs/plan.md
```

Current state:

| artifact | status |
| --- | --- |
| Flipt repo clone | `paper/repos/flipt` at `acda1ab153efd8dc29aa6adb011a997b14a48b87` |
| SWE-bench Pro task snapshot | 85 rows in `paper/evaluations/flipt/tasks/flipt_swebench_pro_tasks.jsonl` |
| C0 dataset | generated for all 85 tasks |
| C1 raw-git dataset | generated for all 85 tasks from pre-cutoff commit messages |
| C4 MCTS-Mem dataset | pending Flipt MCTS-Mem history records |
| MCTS-Mem tree | Stage-1 skeleton in `paper/evaluations/flipt/mcts_mem`, `lint --skeleton` clean |
| history mining windows | 340 windows over 5,099 commits in `paper/evaluations/flipt/extraction/history_windows.json` |

Flipt preflight signals: 71/85 tasks mention configuration, 24 YAML, 23 storage, 21 schema, 20 environment,
17 namespace, 17 compatibility, 17 API, 16 git, and 14 evaluation. This makes Flipt a better practical target
than qutebrowser for testing whether distilled design memory can beat raw git context.

Next step: mine/reduce/audit Flipt MCTS-Mem records under `paper/evaluations/flipt/extraction/`, then generate
`C4_mcts_mem_top8w900` and run reviewer selection before spending on full 85-task repeats.

---

## 8b. Design-targeted track — SWE-Atlas Codebase QnA on kitty (2026-06-28)

A second, **design-targeted** evaluation (rationale: issue-resolution like SWE-bench Pro is low-power for
*design-rationale* memory — the qutebrowser washout. SWE-Atlas **Codebase QnA** asks the agent to *explain
how/why a subsystem works*, which is exactly what MCTS-Mem encodes). Full record:
`paper/evaluations/swe_atlas_qna/RESULTS.md` (+ `docs/runbook.md`, `mcts_mem_kitty/`).

**Setup.** 26 kitty QnA tasks (one shared `base_commit` `815df1e2`, 2024-06-24). Agent = mini-swe-agent on
`gpt-5.2-codex` via a local Anthropic→OpenAI litellm bridge; SWE-Atlas rubric judge (same model). Harness =
harbor + local Docker. **Pollution control (critical):** the official kitty image's `.git` leaks ~1yr of
*future* commits (master @ 2025-06-27) — so three condition images were built: **C0** no `.git`; **C1** `.git`
truncated to ancestors of the cutoff only; **C4** no `.git` + the distilled MCTS-Mem tree injected (51-node
lint-clean tree built by an 8-agent fan-out per the build skill, from past-only history). Single run, NCONC=3.

**Metric reality.** The **official metric is binary** (pass iff *all* must-have rubric items pass) and **floors
at 1–2/26 for every arm** — these are hard all-or-nothing questions and gpt-5.2-codex is below the benchmark's
intended frontier tier. Signal is reported on **item-recall** (fraction of rubric items passed; non-official,
powered), with no-answer scored as 0.

**Result (paired, n=23 tasks valid in all three arms; item-recall):**

| arm | item-recall | C4 contrast |
|---|---:|---|
| C0 no history | 0.388 | — |
| C1 raw past-only git | 0.443 | — |
| **C4 MCTS-Mem** | **0.490** | vs C0 **+0.102** (12W/6L) · vs C1 **+0.047** (8W/6L) |

Full-corpus answer-rate also rises with memory: C0 15/25 → C1 15/24 → **C4 18/26** (memory lets the agent
commit an answer more often), and recall-given-answered 0.639 → 0.680 → **0.717**.

**Verdict (honest).** The ordering **C4 (distilled) > C1 (raw git) > C0 (no history)** holds — *directionally*
supporting the thesis that structured/distilled design memory beats raw git retrieval. But it is **not
decisive**: the load-bearing C4-vs-C1 contrast is **+0.047, 8W/6L on n=23** (weak), it rides a non-official
partial-credit metric (official binary floors), and it is a **single run, n≈23, sub-frontier model**. To make
it decisive: frontier agent model (lift binary off the floor), task-order/seed **repeats**, larger N (pool more
SWE-Atlas QnA repos). Harness + pollution controls + tree are all built and reusable for that.

**Frontier probe (gpt-5.5).** Ran the same harness on gpt-5.5 (second proxy) — C0 baseline only is clean:
**binary lifts off the floor to 5/23 = 0.217** (vs codex 0.04) and recall|answered rises to **0.830** (vs
0.639). This confirms the two assumptions the verdict above leans on: a frontier model is materially stronger,
and the official binary starts to discriminate at the frontier. The gpt-5.5 *treatment* arms (C1/C4) could not
be scored: two harness↔model frictions block them — (a) the Responses-API native-tool path **collapses** at
large context (gpt-5.5 emits empty `command` args after ~66K tokens; harbor then mislabels it
`ApiRateLimitError` because "rate limiting" appears in the kitty source + injected memory), and the 13K-token
C4 injection makes the treatment arm hit it *first* (biasing against MCTS-Mem); (b) the text-based
chat-completions path cures the collapse but gpt-5.5 **batches ~20 actions/turn**, which the single-action
parser rejects. Neither is a method failure; **codex (context-stable, single-action) is the primary directional evidence on partial-credit rubric recall, not an official-pass-rate proof.** Full
write-up: `paper/evaluations/swe_atlas_qna/RESULTS.md` (Frontier-model probe section).

---

## 9. Key data (with provenance)

- **SWE-bench Verified difficulty [verified — queried HF, all 500]:** `<15 min` 194 (39%) · `15 min–1 hr`
  261 (52%) · `1–4 hr` 42 (8%) · `>4 hr` 3 (0.6%). Non-`<15min` per repo: django 139/231, sympy 50/75,
  sphinx 22/44, matplotlib 19/34, sklearn 19/32, astropy 18/22, xarray 17/22. **Caveat:** "difficulty" is
  human fix-*time*, a proxy for effort, **not** design-relevance. (Corrects an earlier "mostly trivial"
  overstatement — a 61% ≥15min majority, but only 9% are ≥1 hr.)
- **SWE-bench Pro [verified]:** 1,865 total (731 public / 11 repos; 858 held-out; 276 commercial);
  deterministic tests; ~107 LOC / 4.1 files avg; per-repo counts in §6. Public on HF, harness MIT.
- **Benchmark facts [web-surfaced, primary-source-confirmed by agents]:** SWE-Atlas (2605.08366, 284 tasks,
  mixed grading, public Apache-2.0) · RefactorBench (2503.07832, 100, deterministic, ICLR'25) · others §5.
- **Competitor numbers:** §4 (PDF-verified) and `paper/sources/*.data.md`.

---

## 10. Open questions, risks, next steps

**Resolved by this revision:** temporal leakage (now §7); the verification overclaim (now scoped to
structural/VCS-grounded, §1/§3); ladder attribution, ablation-scope framing, ReasoningBank placement (§8).

**Still open / unverified (priority order):**
1. **Create a Flipt memory-relevance stratum** — relaxed full repeat generation, local grading, and initial
   paired analysis are complete (`C0=7/85`, `C1=8/85`, `C4=8/85`). C4 ties raw cutoff git on total resolved
   count and paired net (`2W/2L`), and only edges C0 by one task (`3W/2L`). The next useful step is reviewer
   scoring or automated ranking of the 85 tasks by history/design dependence before spending on repeat2/repeat3
   or selected-slice runs.
2. **Analyze qutebrowser paired wins/losses and strata** — C4-vs-C0 is 10 wins / 3 losses; C4-vs-C1 is 6 wins
   / 5 losses. Use this mainly to understand failure modes and what kinds of tasks MCTS-Mem helps.
3. **Decide whether qutebrowser repeat2/repeat3 are worth running** — repeat1 is complete (`C0=24/79`,
   `C1=30/79`, `C4=31/79`). C4 clearly beats no memory in this repeat, but the +1 over raw git is weak/noisy;
   a better memory-relevant repo may be a better use of budget than repeating qutebrowser immediately.
4. **Broaden the selected qutebrowser slice only if useful** — top 12 preserves the +2 C0-vs-C4 delta and C1
   does not explain the selected memory wins, but ranks 7-12 added no new memory-only wins. A top-15 extension
   should run ranks 13-15 only, not rerun completed tasks, and should still use serial local grading.
5. **Build cost at scale** — confirm tokens/commit and total $ on the real repo (est. <$2k, unverified).

**Honest limitation to state in the paper:** because the linter is constitutive (no linter-off) and the
task-resolve ladder cannot isolate verification, the paper can show *that a lint-validated MCTS-Mem tree helps
over no memory in qutebrowser repeat1* (C4 > C0 there), but Flipt does not currently provide a strong positive
full-corpus patch-generation result. The strict run was invalidated as a harness diagnostic, and the relaxed
run ties raw cutoff git at 8/85 while only edging C0 by one task. Any main task-success claim now needs a
narrower audited slice, another repo, or repeat evidence after a concrete correction and stratified analysis.
The paper can still show *that the linter catches invalid tree structures* (diagnostic). It
should **not** claim a clean causal decomposition saying "verification alone is why task success improves."
The method is the complete build-and-use pipeline.

**Risks:** washout at the pooled mean (mitigate: stratify + design-relevant subset); "just raw git history /
more context" remains a strong alternative on the pooled full corpus despite the selected-slice C1 result;
source-mismatch vs trajectory-memory systems (framed as a feature, reported not hidden).

**Immediate next step:** create a Flipt memory-relevance stratum using reviewer scoring or an automated task
ranker, seeded by the paired-analysis deltas (`dbe26396`, `f1bc91a1`, `7161f7b8`, `b2170346`), before spending
on repeats or selected-slice extensions.

---

## 11. Repository pointers

- Method + linter: `src/`, `lint.py`, `skills/mcts-mem-build/SKILL.md`, `skills/mcts-mem-use/SKILL.md`.
- Reference tree: `../Silverfir-nano/mcts_mem` (370 nodes, lint-clean).
- Primary sources: `paper/sources/*.pdf` + `paper/sources/*.data.md` (verbatim quotes + locations).
- README / rationale: `README.md`, `rationale.md`.
