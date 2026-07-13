# SWE-Atlas Codebase QnA — kitty 3-arm results (complete)

Pollution-controlled experiment on the 26 kitty Codebase-QnA tasks (shared base_commit
`815df1e2`, 2024-06-24). Agent = mini-swe-agent on `gpt-5.2-codex` via the local
Anthropic→OpenAI litellm bridge; judge = same model on the SWE-Atlas rubric grader.
Single run, NCONC=3, effort=high. Conditions vary only the memory/history given to the agent:

- **C0** — no history (`.git` stripped).
- **C1** — raw git history, ancestors of `815df1e2` only (+ nudge to explore it).
- **C4** — MCTS-Mem distilled tree injected (whole 51-node tree, ~9.7k words), no `.git`.

## Metrics

- **Binary pass** = the official SWE-Atlas QnA metric: a task passes iff the answer satisfies
  **every** must-have rubric item. It **floors at 1–2/26 for all arms** — these are hard,
  all-or-nothing architecture questions and this model is not frontier; no signal here.
- **Item-recall** = fraction of rubric items the judge passes (partial credit). **Non-official**,
  reported as the powered secondary metric. A task where the agent produced **no answer**
  (hit the step limit / wrote no `answer.txt`) scores **0 recall** (it satisfied 0 rubric items).
- **Answer-rate** = fraction of tasks where the agent produced a usable answer at all.

## Headline — full corpus (no-answer = 0; errored trials excluded)

| arm | n | **item-recall** | recall \| answered | answer-rate | binary |
|---|---:|---:|---:|---:|---:|
| **C0** no history | 25 | 0.383 | 0.639 | 15/25 | 1/25 |
| **C1** raw git (past-only) | 24 | 0.425 | 0.680 | 15/24 | 2/24 |
| **C4** MCTS-Mem | 26 | **0.496** | **0.717** | **18/26** | 2/26 |

## Rigorous paired comparison (n=23 tasks valid in all three arms)

| arm | paired item-recall | answers |
|---|---:|---:|
| C0 | 0.388 | 14/23 |
| C1 | 0.443 | 15/23 |
| C4 | **0.490** | 16/23 |

| contrast | mean Δ | per-task win / loss / tie |
|---|---:|---|
| **C4 vs C0** | **+0.102** | 12 / 6 / 5 |
| **C4 vs C1** | **+0.047** | 8 / 6 / 9 |
| C1 vs C0 | +0.056 | 8 / 7 / 8 |

## Interpretation

**The ordering holds: C4 (distilled MCTS-Mem) > C1 (raw git) > C0 (no history)** on item-recall,
on both the full corpus and the paired set. C4's advantage has **two components**:
1. **Answer-rate** — C4 let the agent produce a usable answer more often (18/26 vs 15/26): the
   injected design memory gave it enough to commit an answer where it otherwise stalled out.
2. **Completeness when it did answer** — recall|answered 0.717 (C4) > 0.680 (C1) > 0.639 (C0).

**Honest limitations (do not oversell):**
- The signal is **small and underpowered**: C4 vs C1 — the load-bearing "distilled beats raw git"
  contrast — is **+0.047 with 8 wins / 6 losses** on n=23. Directionally right, not significant.
- It rides on a **non-official, partial-credit metric**; the official binary floors at the noise level.
- **Single run, no repeats, n≈23**; gpt-5.2-codex is below the benchmark's intended frontier tier,
  so absolute scores are low and the binary can't discriminate.
- C4 vs C0 (+0.102, 12/6) is the clearest effect, but that's the easy contrast (memory vs nothing);
  the paper-relevant one is C4 vs C1, which is weak here.

**Takeaway for the paper.** This is consistent with the MASTER.md thesis (distilled, structured
design memory helps a coding agent, beyond raw git retrieval) but at this scale/model it is a
**directional, not decisive** result. To make it decisive: a frontier agent model (so the official
binary lifts off the floor), task-order/seed **repeats**, and a larger N (pool more SWE-Atlas QnA
repos). The harness, pollution controls, and tree are all in place to do that.

## Frontier-model probe — gpt-5.5

The paper's "to make it decisive" list above calls for a frontier agent model so the official
binary lifts off the floor. We ran the same harness on **gpt-5.5** (the user's second proxy,
`127.0.0.1:8787`, via the same litellm bridge; judge held fixed on gpt-5.2-codex).

**C0 baseline (no history) — valid, complete:**

| model | n graded | recall \| answered | binary | answer-rate |
|---|---:|---:|---:|---:|
| gpt-5.2-codex | 25 | 0.639 | 1/25 = 0.04 | 15/25 |
| **gpt-5.5** | 23 | **0.830** | **5/23 = 0.217** | 16/23 |

Two things confirmed: (1) the **frontier model is clearly stronger** on these tasks
(recall|answered 0.830 vs 0.639); (2) **the official binary lifts off the floor** (0.217 vs
0.04) — i.e. with a frontier agent the all-or-nothing metric starts to discriminate, exactly as
predicted. This validates the benchmark choice and the "needs a frontier model" diagnosis.

**Treatment arms (C1/C4) on gpt-5.5 — blocked by a harness artifact, not reported as a result.**
The gpt-5.5 trials suffer a **tool-calling collapse at large accumulated context**: after ~15–20
productive turns (~66K+ tokens of tool-call/result history) the model begins emitting bash tool
calls with an **empty `command` argument**, interleaved with intermittent litellm errors, until
the format-error cap aborts the trial. harbor then **mis-labels** the abort `ApiRateLimitError`
(its classifier regex `rate.?limit` matches the benign phrase "rate limiting" that occurs in the
kitty source *and* in the injected memory text). Verified **not** a real rate-limit and **not** a
context-window limit: the 8787 backend returns 200 on an 84K-token request on both the
chat/completions and responses paths; single requests succeed.

Why this **invalidates the gpt-5.5 treatment comparison specifically**: the C4 arm prepends the
~13K-token MCTS-Mem render to the first message, so C4 starts at ~16K tokens and reaches the
collapse zone **faster** than C0 (which starts ~3K). Result: C4 errors on ~46% of trials vs C0's
~15%, and it drops out preferentially on the **deep, many-turn tasks** — exactly the ones where
design memory helps most. So a "completed" gpt-5.5 C4 would be **biased against MCTS-Mem** by a
harness artifact. We therefore **do not** report a gpt-5.5 C1/C4 comparison; the context-stable
**codex 3-arm above remains the controlled result**, and if anything it is conservative (codex
absorbs the same 13K injection without collapse).

We also tried the obvious fix — routing gpt-5.5 through mini-swe-agent's **text-based** model
(`litellm.completion()` / chat-completions with regex-parsed ` ```mswea_bash_command``` ` actions
instead of native Responses-API tool calls). This **does** cure the collapse (gpt-5.5 emits real
commands at large context, no empty args), confirming the collapse is specific to the
Responses-API native-tool path. But it exposes a **second, independent** friction: gpt-5.5
**batches aggressively** — it emits ~20 command blocks in a single turn — and mini-swe-agent's
text-based parser requires exactly one action per turn, so every turn is rejected and no command
runs, even with an explicit one-action instruction and a corrected single-action error template.
Making it work would require patching the harness to execute multiple actions per turn, which
would have gpt-5.5 running ~20 commands/turn while codex runs 1/turn — a different agent loop,
not a clean cross-model comparison.

**Net:** gpt-5.5 corroborates the two load-bearing assumptions (frontier model is stronger; the
official binary becomes informative at the frontier). The frontier *treatment* comparison is
blocked by two harness↔model integration frictions (Responses-API tool-call collapse at large
context; single-action parser vs. gpt-5.5's batching) — **neither is a failure of MCTS-Mem or of
the method.** The context-stable, single-action-compliant **codex run is the primary directional C0<C1<C4
evidence on partial-credit rubric recall**, and it is conservative: codex absorbs the same 13K-token injection without collapse. It is **not** an official-pass-rate proof: the official binary remains 1/26, 2/26, 2/26.

## Artifacts
- Per-arm summaries: `results/kitty_{C0,C1,C4}/qna_summary.json`; gpt-5.5: `results/kitty_C0_gpt55/`
- Tree (the C4 method artifact): `mcts_mem_kitty/` (51 nodes, lint-clean) + rendered memory
  `mcts_mem_kitty_render/kitty_design_memory.md`
- Harness/runbook: `docs/runbook.md`; conditions: `conditions/{C0,C1,C4}/`
