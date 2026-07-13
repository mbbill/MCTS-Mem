# MCTS-Mem paper outline — revised after critic review

This outline incorporates three independent critiques:

- empirical/statistical validity,
- paper narrative / venue fit,
- adversarial reviewer rejection risk.

The key revision is to stop treating the paper as a broad benchmark-performance paper. The defensible paper is about **decision memory as missing context for software-engineering agents**, with strongest evidence on design/codebase understanding and only directional evidence on external all-or-nothing benchmark pass rates.

---

## Working title

Preferred title:

> **Decision Memory for Software Engineering Agents**

Alternative titles:

1. **Recovering Design Rationale as Agent Memory**
2. **From Git History to Decision Memory for Coding Agents**
3. **MCTS-Mem: Recovering Design Decisions as Agent-Readable Memory**

Recommendation: use **Decision Memory for Software Engineering Agents** as the paper title and introduce **MCTS-Mem** as the system/artifact name.

Reason: ML reviewers may expect “MCTS” to mean an online Monte Carlo Tree Search algorithm. The paper should not invite that misunderstanding. MCTS-Mem does not run MCTS at inference time; it uses a tree-shaped decision-memory representation inspired by design-space branching.

Early clarification to include:

> MCTS-Mem does not run online Monte Carlo Tree Search during inference. The name reflects a design-space view of software history: live decisions, rejected alternatives, and evidence are represented as an auditable tree. The contribution studied here is the recovered decision-memory artifact and its use by agents.

---

## Central thesis

Do **not** claim:

> MCTS-Mem decisively improves official benchmark pass rates across software-engineering benchmarks.

Current evidence does not support that.

Defensible thesis:

> Long-lived codebases contain latent design rationale that current agents do not reliably recover from code or raw git. MCTS-Mem converts that rationale into a structured, provenance-tracked decision-memory artifact. This substantially improves design/codebase understanding in a custom mechanism benchmark and yields directional evidence on external codebase-understanding and patch-generation tasks, but it does not yet establish robust official-pass-rate gains over raw git.

Short version:

> MCTS-Mem improves agents' access to design rationale. The effect is strongest on design/codebase understanding, clearer in partial-credit understanding metrics, and weaker or currently inconclusive on external all-or-nothing patch/pass metrics.

---

## Claim ladder

The paper should explicitly separate claims by evidentiary strength.

| claim | status | evidence |
|---|---|---|
| MCTS-Mem helps answer design-rationale questions | **supported within custom benchmark** | Lynx: 32/50 perfect vs 10/50; 479.2/496 vs 434.1/496 partial |
| MCTS-Mem improves external codebase-QA partial understanding | **suggestive** | SWE-Atlas kitty: rubric items 127/256 vs 107/256 raw git vs 97/256 no history; official binary floored |
| MCTS-Mem improves patch generation over no memory | **suggestive** | qutebrowser: 31/79 vs 24/79, one repeat |
| MCTS-Mem beats raw git on external patch generation | **not established** | qutebrowser: 31/79 vs 30/79; Flipt relaxed ties raw git at 8/85 |
| MCTS-Mem improves official external all-or-nothing metrics | **not established** | SWE-Atlas binary 1/26, 2/26, 2/26; qutebrowser raw-git gap tiny |
| The tree/alternative structure is the causal factor | **not isolated yet** | no flattened-memory / same-token / no-alt ablation yet |

Use this ladder to keep the paper honest. It is better to say a narrower true claim than a broad claim reviewers can reject.

---

## Evidence-strength matrix for intro

The intro should contain one compact table like this, not a scoreboard that hides caveats.

| study | external? | task type | primary metric | C4 vs C0 | C4 vs C1/raw git | defensible claim |
|---|---:|---|---|---:|---:|---|
| Lynx design QA | no, custom | design/codebase QA | perfect answers, partial rubric score | 32/50 vs 10/50; 479.2/496 vs 434.1/496 | no clean raw-git C1 yet | strong mechanism-aligned evidence; construct-validity caveats |
| SWE-Atlas kitty | yes | codebase QA | official binary + non-official rubric items | binary 2/26 vs 1/26; items 127/256 vs 97/256 | binary 2/26 vs 2/26; items 127/256 vs 107/256 | directional external understanding evidence; official binary not improved over raw git |
| qutebrowser SWE-bench Pro | yes | patch generation | resolved tasks | 31/79 vs 24/79 | 31/79 vs 30/79 | promising vs no memory; not decisive vs raw git |
| Flipt strict run | yes | patch generation | resolved tasks | 4/85 vs 8/85 | 4/85 vs 7/85 | negative/noisy diagnostic; harness validity warning |
| Flipt relaxed run | yes | patch generation | resolved tasks | 8/85 vs 7/85 | 8/85 vs 8/85 | operationally cleaner; still weak/no full-corpus advantage over raw git |

This table should be followed immediately by:

> The evidence is strongest for the intermediate capability MCTS-Mem is designed to improve: design and rationale understanding. Evidence that these understanding gains reliably convert into official patch-generation pass-rate gains is currently weaker.

---

## Abstract

The abstract should foreground the mechanism and avoid presenting mixed metrics as equally strong.

Suggested abstract:

> Coding agents can inspect current code, but they often lack the historical rationale explaining why a codebase has its current shape. We introduce MCTS-Mem, a provenance-tracked decision-memory representation that distills git history, documentation, and tests into live design commitments, rejected alternatives, and evidence. On a custom 50-question Lynx design-QA benchmark, MCTS-Mem increases perfect-answer rate from 10/50 to 32/50 over a code-focused baseline. On external evaluations, the evidence is more directional: in one qutebrowser SWE-bench Pro repeat, MCTS-Mem resolves 31/79 tasks versus 24/79 with no history and 30/79 with raw git; on SWE-Atlas kitty QnA, official binary pass rates remain floored while non-official rubric-item correctness improves from 97/256 without history and 107/256 with raw git to 127/256 with MCTS-Mem. These results suggest that structured decision memory is a useful complement to code and raw git for codebase understanding, while also identifying patch-generation reliability and stronger baselines as remaining bottlenecks.

Notes:

- Always call Lynx **custom**.
- Always say SWE-Atlas item correctness is **non-official**.
- Always include raw-git numbers where available.
- Do not say “proof” in the abstract.

---

## 1. Introduction

### 1.1 Problem

Coding agents usually see current files, tests, and sometimes commit history. They often miss:

- why a mechanism exists,
- which alternatives were tried,
- why a dependency was removed,
- which bugs encode design invariants,
- which historical choices should not be rediscovered.

Core sentence:

> Code tells the agent what the system does now; it rarely tells the agent why this shape survived.

### 1.2 Thesis

> A compact, structured memory of design decisions should help agents more than raw code alone, and may help beyond raw git when the relevant history is noisy, scattered, or alternative-laden.

Be careful: “may help beyond raw git” is more defensible than “beats raw git.”

### 1.3 Contributions

Use contributions that do not overstate automation or benchmark strength.

1. **Problem formulation:** historical design rationale as missing context for software-engineering agents.
2. **Representation:** MCTS-Mem, a provenance-tracked decision-memory tree containing current commitments, rejected alternatives, dated facts, and re-decisions.
3. **Construction and use protocol:** cutoff-safe historical distillation from git/docs/tests into a linted artifact that can be injected or retrieved by agents.
4. **Empirical finding:** decision memory substantially improves a custom design-QA benchmark, directionally improves external codebase-understanding partial metrics, and shows modest/noisy transfer to patch-generation pass rates.

### 1.4 Result preview

Use the evidence-strength matrix above.

Do not use a “strongest comparison” column. That sounds cherry-picked. Use “primary metric,” “C4 vs C0,” “C4 vs C1,” and “defensible claim.”

---

## 2. Historical design rationale as missing agent context

Purpose: make the conceptual case before presenting the artifact.

### 2.1 Why current code is insufficient

Current code exposes implementation state, but not:

- alternatives considered and rejected,
- reasons for constraints,
- historical bugs that encode invariants,
- design boundaries between subsystems,
- tradeoffs that future edits should preserve.

### 2.2 Why raw git is insufficient

Raw git is a strong baseline and should be respected, but it is not the same as decision memory.

Raw git problems:

- noisy commits and mechanical changes,
- uneven commit messages,
- temporally scattered rationale,
- deleted alternatives not organized as alternatives,
- difficult retrieval target for agents,
- agents may spend steps searching rather than reasoning.

Key sentence:

> MCTS-Mem does not assume history is unavailable; it assumes raw history is the wrong shape for an agent under context and step budgets.

### 2.3 Decision memory vs generic retrieval

Contrast with:

- RAG over code,
- commit retrieval,
- agent scratchpads,
- prior trajectory memory,
- examples/reflections.

Key distinction:

> Prior memory systems typically store snippets, examples, or summaries. MCTS-Mem stores decisions: live commitments, rejected alternatives, and provenance-backed evidence.

---

## 3. MCTS-Mem: a decision-memory representation

### 3.1 Core abstraction

Filesystem tree:

- root node = system-level decision,
- child nodes = sub-decisions,
- `.alt/` = rejected/superseded alternatives,
- `.fact/` = large evidence documents,
- Markdown node = Items/Facts/Moves.

Include one concrete example node, preferably from a real tree but shortened.

```markdown
- Rendering is GPU-backed and avoids an external UI toolkit.

## Facts
- 2024-06-24 rationale: ... (sourced)

## Moves
- 2022-... replaced [[old-renderer]]: ... (code)
```

### 3.2 Items, Facts, Moves

- **Items:** statements true of the current design.
- **Facts:** dated evidence with commit/source/provenance.
- **Moves:** re-decisions such as replacements, removals, and revivals.

### 3.3 Provenance and auditability

Explain tags:

- `(code)` — checkable by code or rerun,
- `(sourced)` — checkable by human record,
- `(uncertain)` — inference requiring caution.

Emphasize that provenance is central because design-rationale memory is otherwise easy to hallucinate.

### 3.4 Why alternatives matter

This is a differentiator. Add an explicit subsection:

> Rejected alternatives are first-class because many maintenance errors come from rediscovering a path the project already abandoned.

Explain `.alt/` and paired Moves.

### 3.5 Why the format is agent-readable

- Markdown/plain files,
- compact hierarchy,
- grep/search-friendly,
- links decisions to evidence,
- can be injected wholesale or retrieved selectively.

---

## 4. Constructing and using decision memory

This merges the original “MCTS-Mem design” and “Building MCTS-Mem” details into one method section.

### 4.1 Inputs

- code at cutoff,
- git commits before cutoff,
- docs,
- tests,
- deleted code,
- commit messages.

### 4.2 Construction protocol

High-level protocol:

1. Sweep history for decision-bearing commits.
2. Classify changes: add/change/delete/bugfix/paperwork.
3. Promote real alternatives into `.alt/`.
4. Add facts with provenance.
5. Lint tree for format and consistency.
6. Render or retrieve relevant memory for the agent.

Call this a **semi-automated historical distillation protocol**, not a fully automated mining algorithm unless the paper actually makes automation central.

### 4.3 Leakage and cutoff protocol

Add a table per benchmark:

| benchmark | cutoff | memory sources | benchmark questions known during construction? | future-history audit | notes |
|---|---|---|---|---|---|
| Lynx | project-specific | code/docs/git/MCTS-Mem | clarify | needs doc-only audit | custom mechanism benchmark |
| qutebrowser | task cutoff | cutoff git / memory render | clarify | cutoff guarded | external SWE-bench Pro |
| kitty SWE-Atlas | `815df1e2`, 2024-06-24 | cutoff-only history | no future commits | official image leaked future `.git`; rebuilt | external QnA |
| Flipt | task cutoff | cutoff git / memory | clarify | guard documented | diagnostic |

Do not hide that Lynx needs stronger fairness audit.

### 4.4 Use by agents

Define condition variants carefully. The current “C4” treatment is not identical across experiments.

Suggested condition names:

| label | meaning |
|---|---|
| C0 | no useful history/memory |
| C1 | raw cutoff-only git/history |
| C4m | MCTS-Mem only |
| C4g | raw cutoff history plus MCTS-Mem |

If the paper keeps C4 for simplicity, include a footnote/table specifying exact condition per benchmark:

- qutebrowser: trimmed MCTS-Mem context, top 8 records / 900 words.
- kitty: whole 51-node MCTS-Mem tree injected, no `.git`.
- Flipt: cutoff git plus MCTS-Mem.

This prevents reviewers from accusing the paper of aggregating inconsistent treatments.

### 4.5 Construction cost

If quantified, report:

- number of nodes,
- tokens/words injected,
- approximate agent/human time,
- lint checks,
- audit steps.

If not quantified, keep this in Limitations rather than making unsupported efficiency claims.

---

## 5. Evaluation design

### 5.1 Research questions

Use a ladder from mechanism to downstream transfer.

**RQ1 — Mechanism:** Does decision memory improve design/rationale understanding?

- Lynx design-QA.

**RQ2 — External understanding:** Does distilled memory improve external codebase-QA relative to no history and raw git?

- SWE-Atlas kitty.

**RQ3 — Downstream transfer:** Do understanding gains transfer to patch-generation success?

- qutebrowser SWE-bench Pro.
- Flipt diagnostic.

**RQ4 — Metrics:** When do partial understanding gains convert into official all-or-nothing successes?

- compare binary, partial-credit, answer-rate, and paired wins/losses.

### 5.2 Metrics

Separate official and secondary metrics.

Patch generation:

- official/targeted resolved count,
- nonempty patch rate,
- paired wins/losses,
- repeats where available.

Codebase QnA:

- official binary pass,
- non-official rubric-item correctness/recall,
- answer rate,
- paired task comparison.

Lynx QA:

- task-level perfect answer rate,
- per-task partial rubric score,
- weighted binary as supplemental.

Important metric rules:

- Unit of inference is the **task/question**, not individual rubric bullets.
- Do not treat `496` Lynx rubric points or `256` SWE-Atlas rubric items as independent samples.
- Report official metrics first when using external benchmarks.
- Mark partial-credit metrics as secondary/non-official.

### 5.3 Statistical reporting

Add at minimum:

- paired wins/losses/ties,
- bootstrap confidence intervals over tasks,
- exact sign/McNemar tests for binary paired outcomes where appropriate.

Do not overstate significance. Current rough sanity checks:

- Lynx perfect discordant cases: strong (`24` MCTS-only perfect vs `2` code-only-only perfect; sign-test roughly `p ≈ 1e-5`).
- qutebrowser C4 vs C1: `6W/5L`, not informative.
- kitty C4 vs C1: `8W/6L/9T`, not informative.
- Flipt relaxed C4 vs C1: `2W/2L/6 both/75 neither`, exactly balanced; earlier strict Flipt was unfavorable (`0W/3L` against C1) but is treated as a harness-validity warning.

### 5.4 Baselines and missing controls

Acknowledge what is included and what is missing.

Included:

- no-memory/no-history baseline,
- raw cutoff git baseline in qutebrowser/kitty/Flipt,
- MCTS-Mem treatment.

Missing / future controls:

- matched-token raw-git summaries,
- flattened MCTS-Mem baseline,
- no-`.alt` / facts-only ablation,
- random/irrelevant memory baseline,
- clean raw-git fair Lynx baseline,
- independent judge/human audit for rubric grading.

---

## 6. RQ1: Design-QA results — mechanism-aligned understanding

### 6.1 Benchmark

Lynx 50-case architecture/codebase QA benchmark.

Conditions:

- baseline: code-focused/code+git condition, MCTS-Mem hidden,
- treatment: MCTS-aware condition reads MCTS-Mem and verifies with code.

Be precise: if code-only had git access, call it **code+git baseline**, not “code-only.”

### 6.2 Main result

| condition | perfect answers | partial score | weighted binary |
|---|---:|---:|---:|
| code/code+git baseline | 10/50 = 20% | 434.1/496 = 87.5% | 95/496 = 19.2% |
| MCTS-aware | 32/50 = 64% | 479.2/496 = 96.6% | 320/496 = 64.5% |

Additional task-level facts:

- 24 MCTS-only perfect cases,
- 2 baseline-only perfect cases,
- 8 both perfect,
- 16 neither perfect.

This is the strongest empirical result.

### 6.3 Interpretation

MCTS-Mem helps with:

- design rationale,
- alternatives and discarded paths,
- scattered implementation details,
- project-specific invariants.

Include one qualitative example where MCTS-Mem answers a question the baseline missed.

### 6.4 Validity caveat — must be explicit

This result is custom and mechanism-aligned, not an external benchmark.

Known issue:

- the code/git-fair audit lists 19 cases where rubric content may depend on doc-only/source-only facts.

Required wording:

> This benchmark tests the value of the full decision-memory artifact, including facts distilled from project records. It does not by itself isolate whether the tree structure beats raw code/git-recoverable information.

If possible before submission:

- finish code/git-fair Lynx variant,
- or report a subset excluding audited doc-only/source-only cases,
- or partition cases into code/git-recoverable vs doc/source-assisted vs uncertain.

Without this, Lynx should be called **mechanism evidence**, not a clean causal proof against raw git.

---

## 7. RQ2: External codebase-QA results — SWE-Atlas kitty

This section comes before qutebrowser because it tests the intended intermediate capability: codebase/design understanding.

### 7.1 Setup

- SWE-Atlas Codebase QnA,
- kitty repo,
- 26 tasks,
- shared base commit `815df1e2` (2024-06-24),
- C0 no git,
- C1 cutoff-only git,
- C4 MCTS-Mem tree.

Pollution control:

- official kitty image leaked future git history,
- rebuilt condition images:
  - C0 no `.git`,
  - C1 ancestors of cutoff only,
  - C4 no `.git` plus MCTS-Mem built from past-only history.

### 7.2 Official metric first

| arm | official binary pass |
|---|---:|
| C0 | 1/26 |
| C1 | 2/26 |
| C4 | 2/26 |

State clearly:

> On the official all-or-nothing metric, this run does not establish an MCTS-Mem advantage over raw git.

### 7.3 Secondary partial-credit analysis

Rubric-item correctness over all 26 tasks, with no-answer/error as 0:

| arm | rubric items correct | item accuracy |
|---|---:|---:|
| C0 | 97/256 | 37.9% |
| C1 | 107/256 | 41.8% |
| C4 | 127/256 | 49.6% |

Answered-only:

| arm | answered tasks | correct among answered |
|---|---:|---:|
| C0 | 15 | 97/157 = 61.8% |
| C1 | 15 | 107/159 = 67.3% |
| C4 | 18 | 127/177 = 71.8% |

Paired valid set, n=23:

| arm | paired item recall |
|---|---:|
| C0 | 0.388 |
| C1 | 0.443 |
| C4 | 0.490 |

Contrasts:

- C4 vs C0: +0.102, 12W/6L/5T.
- C4 vs C1: +0.047, 8W/6L/9T.

### 7.4 Interpretation

Key sentence:

> MCTS-Mem improves coverage of rubric items and answer production, but the current run does not move enough tasks across the all-or-nothing threshold.

This is external support for the understanding claim, but it remains directional because:

- official binary is floored,
- partial-credit metric is non-official,
- n is small,
- one run,
- C4-vs-C1 paired comparison is weak.

### 7.5 Frontier probe

Briefly mention only what is valid:

- gpt-5.5 C0 baseline:
  - binary 5/23,
  - recall|answered 0.830.

Interpretation:

> A C0-only frontier probe suggests the official SWE-Atlas binary may become less floored with a stronger model; treatment comparisons remain blocked by harness/model integration issues.

Do **not** imply frontier validation of MCTS-Mem.

Move detailed gpt-5.5 tool-call collapse / batching diagnosis to appendix.

---

## 8. RQ3: Patch-generation transfer — SWE-bench Pro qutebrowser

### 8.1 Setup

- SWE-bench Pro,
- qutebrowser,
- 79 tasks,
- one completed clean repeat,
- conditions:
  - C0 no memory,
  - C1 raw pre-cutoff git,
  - C4 MCTS-Mem top8w900.

### 8.2 Main result

| arm | resolved | nonempty |
|---|---:|---:|
| C0 | 24/79 | 73/79 |
| C1 raw git | 30/79 | 71/79 |
| C4 MCTS-Mem | 31/79 | 69/79 |

Paired:

| contrast | wins | losses | net |
|---|---:|---:|---:|
| C4 vs C0 | 10 | 3 | +7 |
| C4 vs C1 | 6 | 5 | +1 |

### 8.3 Interpretation

Use cautious wording:

> In one qutebrowser repeat, MCTS-Mem resolved more tasks than no memory and narrowly more than raw git. The comparison to raw git is not statistically established.

Do not say “clearly beats no memory” unless backed by repeats/CI. Use “promising” or “directional.”

### 8.4 Memory-relevance slice

Top-12 selected slice:

| arm | resolved |
|---|---:|
| C0 | 2/12 |
| C1 | 1/12 |
| C4 | 4/12 |

Use only as mechanism analysis.

Required caveat:

> This selected slice is exploratory unless relevance scoring and the cutoff were fixed before seeing outcomes.

If possible, report all relevance bins, not just top-12.

### 8.5 Limitations

- one repeat,
- C4-vs-C1 is +1 task only,
- C4 has lowest nonempty rate,
- no matched-token raw-git baseline,
- no flattened-memory ablation.

---

## 9. Diagnostic patch-generation result — Flipt

This can be short in the main paper or partly moved to appendix, but it should not be hidden. The final relaxed full run is complete and operationally cleaner than the earlier strict run, yet it still does **not** provide positive full-corpus evidence that MCTS-Mem beats raw git.

### 9.1 Final relaxed GPT-5.2 full run

Conditions:

- `C0`: snapshot `.git`, no memory.
- `C1_git_history`: cutoff-limited `.git`, no injected memory.
- `C4_git_history_mcts_mem`: `C1_git_history` plus MCTS-Mem context.

Generation completed all 85 instances in all three arms. Final local targeted grades:

| arm | total | nonempty | resolved | status counts |
|---|---:|---:|---:|---|
| C0 | 85 | 84 | 7 | `empty_patch=1`, `resolved=7`, `unresolved=77` |
| C1 raw cutoff git | 85 | 85 | 8 | `resolved=8`, `unresolved=77` |
| C4 raw git + MCTS-Mem | 85 | 85 | 8 | `resolved=8`, `unresolved=77` |

Paired outcomes:

| comparison | C4 wins | C4 losses | both resolved | neither resolved |
|---|---:|---:|---:|---:|
| C4 vs C1 raw git | 2 | 2 | 6 | 75 |
| C4 vs C0 | 3 | 2 | 5 | 75 |

Recommended wording:

> The relaxed Flipt run is complete and cleaner than the strict diagnostic, but it does not produce a strong full-corpus patch-generation win. MCTS-Mem ties raw cutoff git at 8/85 and only edges no-memory by one task, with balanced paired outcomes against raw git. We therefore use Flipt as negative/diagnostic evidence and as a target for stratified memory-relevance analysis, not as headline positive evidence.

### 9.2 Strict GPT-5.2 run as harness-validity warning

Earlier strict run:

| arm | resolved |
|---|---:|
| C0 | 8/85 |
| C1 | 7/85 |
| C4 | 4/85 |

State plainly:

> Under the strict harness, MCTS-Mem underperformed.

The strict result should be reported as a failed/diagnostic experiment rather than a clean capability comparison because multiple predefined harness-validity criteria failed:

- step limit 24,
- 600s wall-time limit,
- 2048 output-token cap,
- aggressive read-only rejections,
- many timeout/rescue trajectories,
- depressed baseline,
- relaxed C0 smoke improved from strict first-10 2/10 to relaxed 3/10,
- reference-patch oracle resolved 85/85, so the grader can pass correct patches.

### 9.3 Next Flipt analysis

No populated memory-relevance stratum exists yet. The next useful analysis is to score/rank the 85 Flipt tasks for history/design dependence and report C0/C1/C4 by stratum. The paired-delta cases are seeds:

- C4-only over C1: `dbe26396`, `f1bc91a1`.
- C4 losses to C1: `7161f7b8`, `b2170346`.

Move detailed per-instance failure notes to appendix.

---

## 10. Analysis: when does decision memory help?

This section merges the old cross-benchmark analysis and discussion.

### 10.1 Main empirical pattern

Ranking by current evidence strength:

1. Mechanism-aligned design/codebase QA: strong.
2. External codebase-QA partial-credit understanding: suggestive.
3. Patch generation vs no memory: suggestive.
4. Patch generation vs raw git: not established.
5. Official all-or-nothing external QA: not established.

### 10.2 Raw git is a strong baseline

Evidence:

- qutebrowser: C1 30/79, C4 31/79.
- kitty: C1 107/256, C4 127/256 on item correctness; binary tied 2/26.
- Flipt relaxed: C1 8/85, C4 8/85; paired C4-vs-C1 2W/2L. Earlier strict Flipt was unfavorable to C4 (4/85 vs 7/85) and is kept as a harness-validity warning.

Interpretation:

> MCTS-Mem's value is not that history exists; it is that history is distilled into decisions. Current evidence supports this more strongly for codebase understanding than for patch generation.

### 10.3 Why partial understanding gains may not become task passes

All-or-nothing success also requires:

- exact localization,
- correct edit synthesis,
- test execution,
- no regressions,
- harness compliance,
- enough remaining context/steps.

MCTS-Mem can improve reasoning coverage without crossing the final pass threshold.

### 10.4 Failure modes

- irrelevant memory can distract,
- context overhead,
- stale or uncertain facts,
- raw git sometimes enough,
- treatment arms can hit model/harness limits,
- patch tasks require implementation precision beyond rationale.

---

## 11. Related work

### 11.1 Memory for coding agents

- ReasoningBank,
- Subtask-Memory,
- ACE,
- CommitDistill.

Be explicit:

> Our empirical baselines are no-history and raw-history controls, not full implementations of these prior memory systems.

### 11.2 Repository understanding benchmarks

- SWE-bench,
- SWE-bench Pro,
- SWE-Atlas,
- SWE-QA.

### 11.3 Design rationale and architectural knowledge

- architecture decision records,
- design-rationale recovery,
- software archaeology,
- commit archaeology.

### 11.4 Distinction

> MCTS-Mem is not a cache of previous solutions or a retrieval index over commits. It is a structured representation of live decisions, rejected alternatives, and provenance-backed evidence.

---

## 12. Limitations and threats to validity

### 12.1 Custom benchmark validity

- Lynx is custom and mechanism-aligned.
- Some rubric items may depend on design-doc/source-only facts.
- Code/git-fair variant is currently draft.
- Need subset or revised run excluding doc-only cases.

### 12.2 Raw-git and same-token controls

Missing controls:

- matched-token raw git,
- same-token generic repo summary,
- flattened memory,
- facts-only/no-alternatives ablation,
- random/irrelevant memory.

### 12.3 Statistical power

- external runs are single-repeat,
- C4-vs-C1 effects are small,
- paired tests are underpowered,
- need bootstrap CIs and repeats.

### 12.4 Metric validity

- official all-or-nothing metrics may hide partial improvements,
- partial-credit metrics are non-official,
- LLM-judge grading may be noisy,
- rubric bullets are not independent samples.

### 12.5 Leakage and pollution

- future-history leakage found in official kitty image and fixed,
- need uniform cutoff/pollution audits across all future runs,
- memory builders/questions/rubrics need documented separation.

### 12.6 Model and harness interaction

- gpt-5.5 treatment comparisons blocked by tool-call/parser failures,
- Flipt strict harness depressed all arms,
- infrastructure details can affect pass rates.

### 12.7 Construction cost and scalability

- MCTS-Mem currently requires historical distillation and auditing,
- human/agent effort should be quantified,
- incremental maintenance story should be validated.

---

## 13. Conclusion

Conclusion should be balanced:

> MCTS-Mem turns historical design rationale into an auditable, agent-readable decision-memory artifact. Current evidence shows strong gains on a custom design-QA benchmark and directional gains on external codebase-understanding metrics, while patch-generation pass-rate improvements remain modest and not yet clearly superior to raw git. These results support decision memory as a promising complement to code and raw history, and identify the next requirements for decisive validation: fairer raw-git controls, same-token ablations, multi-run external evaluations, and stable frontier-model harnesses.

---

## Appendices

### Appendix A: MCTS-Mem format specification

- Items/Facts/Moves,
- `.alt/`,
- `.fact/`,
- provenance tags,
- linter rules.

### Appendix B: Construction guidelines

- what counts as a decision,
- bugs vs design,
- paperwork exclusion,
- alternative promotion,
- pollution cutoff.

### Appendix C: Full benchmark details

- Lynx 50 cases,
- SWE-Atlas kitty 26 tasks,
- qutebrowser 79 tasks,
- Flipt strict/relaxed diagnostic.

### Appendix D: Full per-task tables

- Lynx case table,
- SWE-Atlas per-question rubric-item table,
- qutebrowser per-task resolved matrix,
- Flipt diagnostic matrix.

### Appendix E: Harness and infrastructure notes

- local proxy,
- litellm bridge,
- gpt-5.5 failure diagnosis,
- git-pager issue,
- future-history leakage in kitty image.

### Appendix F: Additional analyses to add if time permits

Highest-value additions before submission:

1. Lynx code/git-fair subset or rerun excluding doc-only cases.
2. Bootstrap CIs and paired tests for all task-level comparisons.
3. Matched-token raw-git baseline on SWE-Atlas or Lynx.
4. Flattened-memory baseline.
5. No-`.alt` / facts-only ablation.
6. Judge-swap or human audit for SWE-Atlas partial-credit scoring.
7. Relevance-stratified qutebrowser analysis across all bins, not only top-12.

---

## Writing rules for the paper

1. Never call the current evidence an official-pass-rate proof.
2. Always distinguish official metrics from secondary partial-credit metrics.
3. Always include raw-git numbers when available.
4. Always call Lynx custom/mechanism-aligned.
5. Treat Flipt as visible diagnostic evidence, not hidden failure.
6. Use “directional,” “suggestive,” or “not established” for C4-vs-C1 external results.
7. Do not imply gpt-5.5 validates MCTS-Mem treatment effects; only C0 was valid.
8. Keep infrastructure postmortems in appendix unless needed for validity.
9. Avoid saying “MCTS-Mem beats raw git” without qualification.
10. Emphasize the actual contribution: provenance-tracked decision memory for agent understanding.
