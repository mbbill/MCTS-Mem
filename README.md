# MCTS-Mem

*MCTS-Mem is a structured, checkable record of **why** a codebase is the way it is — the
decisions that currently hold, the alternatives they replaced, and the evidence behind each.
This README builds the idea up from the problem it solves, one step at a time.*

## The problem: documentation goes wrong and nothing tells you

Every project writes things down — design docs, wikis, comments, decision records. On a good
team these are kept next to the code and updated as it changes. And yet anyone who has worked on
a long-lived project has hit the same thing: the writing drifts. A design doc describes an
approach the code dropped a year ago. Two wiki pages disagree. A note explains a rule that no
longer applies. The knowledge becomes stale, or wrong, or missing, or quietly
self-contradictory — and usually you find out only after it has already misled someone.

Why does this happen to documentation but, most of the time, not to code? Because code has a
compiler. Compiling is a mechanical consistency check: if the code contradicts itself, it does
not build, and someone fixes it before it ships. Documentation has no such check. Nothing
verifies that two documents agree, that a claim still matches the code, or that a decision
written down last year is still the one in force. Inconsistency in prose is *undetectable*, so
it accumulates in silence. That is the root problem, and it is why written project knowledge is
so often untrustworthy.

## Why retrieval (RAG) does not fix it

The modern reflex is to pour all that text into a retrieval system and let an AI pull up whatever
looks relevant. But retrieval solves a different problem than the one above. RAG optimizes
*recall accuracy* — finding the passages most similar to your query. It says nothing about
whether those passages are current, correct, or complete.

The failure is structural, not incidental. Suppose you ask about approach A. Retrieval returns
the text about A. But the things you most need to know are often that A was *replaced* by B, or
that A *contradicts* C — and B and C are not worded like a question about A, so similarity search
never returns them. The model answers confidently from A alone, never learning that A is dead.
Graph-based retrieval (GraphRAG and similar) adds links between pieces of text, but it is still
not a strict, checkable structure that can say "these two claims are inconsistent," so it does
not close the gap either.

The lesson: the fix for undetectable inconsistency cannot be better search over unstructured
text. It has to be knowledge structured well enough to be *checked* — the way code is checked by
compiling.

## Why that is normally impossible — and why software is the exception

Here is the hard part. General knowledge cannot be structured this way. What people know is a
tangle: every fact relates to many others through contradiction, dependency, and exception, and
there is no ground truth to anchor any of it. You cannot build a consistency checker for
"everything a team knows." This is why decades of knowledge-management and design-rationale
systems struggled.

Software is the exception, for one specific reason: **code compiles.** Because it compiles, the
codebase is, by construction, a self-consistent state. And in a disciplined project, so is every
commit in its history — each one is a working, checkable state of the system. So a project's
history is not a heap of notes. It is a state machine, walked step by step from the empty initial
state to what ships today, through a long chain of self-consistent states you can check out and
verify one at a time.

That backbone is what makes software's knowledge structurable where general knowledge is not.

## Decisions drive the transitions, and facts drive the decisions

What moves the system from one state to the next? A **decision** — to refactor this, replace
that, add this capability. And no decision happens for no reason; behind each is a **fact** that
forced it: a bug, a new requirement, a benchmark result, a port that failed, a review that
rejected an approach.

So the history has a precise shape: a verifiable sequence of states, with an evidenced decision
at each step between them. A version of the software that compiles is one traversal of the space
of possible designs; the result it reaches — its performance, its feature set, its failures — is
reviewed, found wanting somewhere, and that review drives the next decisions, which move you to a
neighboring point in the space. Development *is* a search, and its steps are decisions backed by
facts.

## Recording the search as a tree

If the valuable thing is this sequence of decisions and the facts behind them, then record it
directly:

- the **live node** is the decision that currently holds;
- beside it, a **`.alt/`** folder keeps the alternatives it replaced, each frozen with the dated
  reason it lost;
- its **facts** are the dated evidence that drove the choice.

This flattens the whole decision history into a tree you can walk. And because the backbone is
the git history, the tree can be *reconstructed after the fact*: mine the commits, the diffs, and
the design docs, and turn every real design change into a decision record. (That is what the
`mcts-mem-build` skill does; on a large real-world engine it recovers on the order of a thousand
decision nodes from the history alone.)

The tree grows by **decisions, not commits.** A single decision that took ten commits to land is
one node; a refactor that removes one mechanism and adds another is a decision even in a single
commit. The project's own rate of re-deciding sets the resolution — a natural boundary that keeps
the tree small and high-signal instead of mirroring the file layout.

## Why this is Monte Carlo Tree Search

Try a design, build it, measure it, keep or reject it, let the result steer the next attempt —
searching a space too large to enumerate by sampling expensive outcomes and using them to decide
where to look next. That is the shape of **Monte Carlo Tree Search**, whose four steps are:
**select** a promising node, **expand** it with a candidate move, **roll out** from there to get
a value, and **backpropagate** that value up the tree so the next selection is better-informed.

People object that this "isn't real MCTS" because no algorithm is running the search. That
misreads the algorithm. Nothing in MCTS requires the rollout or the evaluation to be computed by
a machine. A board-game engine mechanizes rollouts only because, in a game, a rollout is cheap.
In software the rollout is *building and measuring* a design — a benchmark, a test suite, a
production incident, a review — which costs days, so people and AI perform it instead of a coded
simulator. The structure is identical:

- a **node** is a design decision;
- **selection** is choosing which decision to push forward or reopen — exploiting what works, or
  exploring an alternative that might be better;
- **expansion** is trying an option: a new approach, a refactor, a rewrite;
- the **rollout** is implementing that option far enough to get a real signal;
- **backpropagation** is the resulting fact updating your confidence in that branch and the ones
  above it.

And precisely because each rollout costs days rather than milliseconds, you can afford very few,
and throwing their results away is ruinous. Persisting the tree so no expensive rollout is ever
paid for twice is the whole point — that is the **Mem**. MCTS-Mem is the memory of this search:
the value estimates (facts), the branch that won (the live tree), and the branches that lost
(`.alt/`), so every future decision starts from everything the project already learned. (Letting
an agent drive the loop itself — pick an untried branch, build it, measure, write the result
back — is a direction the project points at, not something it ships today.)

## What the structure gives you that search cannot

Now the payoff returns to the original problem. Because the winning decision *owns* its rejected
alternatives, reaching a decision means reaching — by construction — both the current design and
the reasons the tempting alternatives are dead. The contradicting fact is structurally adjacent,
not filed under different words.

Concretely: a bug appears in cache invalidation. A search for "stale endpoint cache" may surface
an old note that per-endpoint caches were fast, and miss the later fact that they were abandoned
because a write through another endpoint left stale entries — that fact is not worded like the
query. In an MCTS-Mem tree, the live cache decision owns the rejected per-endpoint alternative
and the reason it lost, so a reader following the decision reaches the tempting old branch *and*
the reason it is dead. That is structure doing what similarity search cannot.

## Checking the tree like a compiler

The last piece closes the loop with the problem we started from. The tree is not just folders; it
is a grammar with a checker:

- every decision is backed by dated facts;
- every fact and re-decision ends in a **provenance tag** — `(code)` (checkable against the code),
  `(sourced)` (backed by a human record: commit, doc, chat, author), or `(uncertain)` (an
  unbacked reading of intent);
- the two halves of every replacement state the same reason, verbatim, so they cannot drift
  apart;
- the log is **append-only**, enforced against git — a benchmark later found wrong is corrected by
  *adding* a new dated fact, never by editing the old one away.

`npx mcts-mem lint` checks all of this the way a compiler checks code. It cannot check truth — a
benchmark can still be wrong, a source stale — but it makes *inconsistency detectable*, which is
exactly what documentation lacked at the start. Uncertainty no longer hides inside confident
prose: every unbacked inference is tagged `(uncertain)` and greppable. And reconstruction can be
incremental — rebuild from the code, record the decisions whose reason cannot yet be recovered as
`(uncertain)`, and slot in the real reason later when an RFC or an old thread turns up. The record
fills in over time and can be trusted at each step, because at each step it still passes the
check.

## Concepts

An MCTS-Mem tree is a directory of Markdown files; the shape is the model.

- **Node** (`<name>.md`) — one design decision. Its **Items** (top, no heading) state what is true
  of the current design; **`## Facts`** log the dated evidence; **`## Moves`** log re-decisions.
- **Child node** (`<name>/`) — a finer decision made under the parent, all in force at once (a
  cache node's children might decide invalidation, key format, memory budget).
- **Sibling node** — a neighboring decision under the same parent, readable on its own.
- **Main tree** — ignore every `.alt/` and what remains is the current design.
- **`.alt/` directory** — rejected and superseded alternatives, each a frozen node with the reason
  it lost. A flat set: rivals for one decision are siblings, never nested.
- **`.fact/` directory** — evidence too big for one line (a recovered design note, a measurement
  table).
- **Provenance tag** — every fact and move ends in `(code)`, `(sourced)`, or `(uncertain)`.
- **Lint** — `npx mcts-mem lint <path>` checks the grammar and internal consistency.

## A small example

This is not from a real project; it shows the shape. A service once cached each endpoint
separately, then moved to one resource-keyed cache because invalidation kept leaking through
endpoint-specific behavior.

```text
mcts_mem/
  service.md
  service/
    request-cache.md
    request-cache.alt/
      per-endpoint-cache.md
    request-cache.fact/
      cache-benchmark.md
```

The live decision, `mcts_mem/service/request-cache.md`:

```md
- Responses are cached by resource id, with one invalidation path shared by every
  endpoint that exposes the resource.

## Facts

- 2024-05-02 benchmark: endpoint-local caches gave faster hit paths, but used more
  memory and left stale entries after writes that reached the same resource through a
  different endpoint (sourced).

## Moves

- 2024-05-03 replaced [[per-endpoint-cache]]: per-endpoint caches made invalidation depend
  on endpoint-specific behavior; a resource-keyed cache keeps invalidation at the data
  boundary, even though it gives up a few hit-path shortcuts (sourced).
```

The rejected alternative, `mcts_mem/service/request-cache.alt/per-endpoint-cache.md`, is frozen
with the same reason on its own side:

```md
- Each endpoint owns its own response cache and invalidates it from endpoint handlers.

## Moves

- 2024-05-03 replaced by [[request-cache]]: per-endpoint caches made invalidation depend
  on endpoint-specific behavior; a resource-keyed cache keeps invalidation at the data
  boundary, even though it gives up a few hit-path shortcuts (sourced).
```

The current design reads cleanly without losing the old one; the losing branch is kept so a
future change can inspect why it lost; the replacement reason is copied on both sides so lint
catches drift; the fact is dated and tagged so a later reader knows what kind of evidence it was.

## What it enables

- **Give an AI the full history, not just the current code.** Ask an agent to design a new
  renderer with only the code in hand, and it will confidently re-propose approaches this project
  already tried and rejected — it has no way to know they are dead. With the decision tree and its
  `.alt/` branches in context, its proposal starts from everything already learned, not from zero.
- **Guide a rewrite or a port.** Rewriting from language A to B, the tree is the map of pitfalls
  already paid for: here is what was tried, here is where it broke, here is the reason not to walk
  into it again.
- **Self-evolving software (research direction).** With the loop closed, an agent could keep
  exploring untried branches — build, measure, write the result back — so the tree's accumulating
  value estimates steer future search toward the good region. This is where the project points,
  not what it ships today.

## Quickstart

For a repository that already has `mcts_mem/`:

```sh
npx mcts-mem view mcts_mem --depth 2
npx mcts-mem view mcts_mem --alt --depth 2
npx mcts-mem show request-cache mcts_mem
npx mcts-mem uncertain mcts_mem
npx mcts-mem lint mcts_mem
```

Use `view` to scan the tree, `show` to read one decision in full, `uncertain` to find entries
that still need better evidence, and `lint` after any edit. To explore the tree in a browser:

```sh
npx mcts-mem serve mcts_mem
```

Then open `http://localhost:4173`. The viewer reads the tree from disk on each request, so reload
after editing. Use `--port N` to choose another port.

For a repository without a tree, use the `mcts-mem-build` skill to reconstruct the first version
from git history, design docs, old branches, and author input. After that, use the `mcts-mem-use`
skill before non-trivial changes so the agent reads the relevant decisions and records a
re-decision when a decision changes. The build and use workflows are agent skills, not CLI
subcommands: the CLI handles inspection and linting; the skills tell an agent how to build and
maintain the tree.

## What lint checks

`npx mcts-mem lint <path>` checks consistency, not truth. It verifies that:

- cross-references resolve to real nodes;
- replacement pairs agree on the same reason, verbatim;
- committed Facts and Moves were corrected append-only, not edited or deleted (checked against git
  `HEAD`);
- every Fact and Move carries a provenance tag;
- entries use the expected shape;
- `.alt/` members end as replaced, removed, or otherwise frozen;
- no node merely names a component without recording a decision, fact, alternative, or child.

The compact entry shape:

```md
- YYYY-MM-DD kind: claim (code).
- YYYY-MM-DD (abc12345) replaced [[old-node]]: reason (sourced).
- YYYY-MM-DD (abc12345) replaced by [[new-node]]: same reason (sourced).
```

A clean lint means the tree is structurally sound under these rules. It cannot catch a bad
benchmark method, a stale source, or a wrong interpretation — that stays engineering judgment.
The value is that uncertainty is visible and the record cannot quietly contradict itself.

## Installation

There is no global install. Run the CLI with `npx`:

```sh
npx mcts-mem --help
```

The memory workflow lives in two agent skills:

- `skills/mcts-mem-build/SKILL.md`
- `skills/mcts-mem-use/SKILL.md`

Copy both folders under `skills/` into your agent's skills directory. For Claude Code, that is
`~/.claude/skills/` (personal) or `.claude/skills/` (project-local). The skills use the open
[Agent Skills](https://agentskills.io) format, so the same files work with any agent that supports
it.

## When it's worth it

MCTS-Mem pays off for long-lived systems, projects with repeated rewrites or ports,
performance-sensitive or high-stakes design choices, teams where knowledge leaves with people, and
codebases maintained by agents that need context before acting.

It is not worth it for throwaway projects, code almost entirely forced by a spec, decisions with
no meaningful alternatives, or teams that will not keep the tree current. A stale tree is worse
than no tree, because it gives false confidence — the linter checks structure, but upkeep is still
a discipline.

## Further reading

[`rationale.md`](rationale.md) is the longer argument: why project history looks like a search,
how MCTS-Mem lowers the cost of future change, why this is not just ADRs plus retrieval, and where
the MCTS analogy helps and where it stops.
