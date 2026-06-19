# MCTS-Mem

> MCTS-Mem is a structured, verifiable memory of *how a project was decided* — every
> choice that stuck, every alternative that was tried, and the recorded reason each one
> won or lost. You read it by **following its structure**, not by searching it, and a
> linter checks it the way a compiler checks code — so the knowledge stays consistent
> and trustworthy instead of becoming a pile of notes that might quietly contradict
> itself. Built once from a project's history, kept current as it evolves, and read by
> humans and AI agents before they change anything.

## Remember how you got here, not the code

On a large project, people don't carry the code in their heads — they carry **how it
got there**: the decisions that worked, the ones that failed, and the facts that drove
each. The current code is only the latest path; the durable asset is the knowledge
accumulated reaching it, and that knowledge — not the source — is what lets someone
change the system confidently, or even understand it. Today it lives in people's heads
and in chat logs that evaporate.

MCTS-Mem takes that knowledge out of individual brains and puts it in one place,
organized by a model of how it accumulates: every decision, fact, failure, and
contradiction sits at the point in the design it bears on. Thousands of commits' worth
of reasoning — normally scattered across diffs, dead branches, and deleted files —
becomes one artifact a newcomer or an agent can read in minutes, share, and build on.

## Structure is the point

A pile of notes — however well written — can hold contradictions and errors that are
never found. You retrieve a passage but can't be sure it's complete, current, or
consistent with what's filed elsewhere, and deciding on knowledge you only *probably*
have is a risk you can't measure. That is the ceiling a free-text or embedding-based
memory hits: it can recall, but it can't guarantee the recalled set is consistent — so
every answer carries a residue of doubt.

Structure removes the doubt. You don't search the tree, you **follow** it: each node
leads to its alternatives, its supporting evidence, and the decisions made downstream,
so the shape itself is the index and tells you where to look next. And because a
decision lives at one node with its evidence and alternatives beside it, **what you see
at that node is everything you need to decide** — not a sample that might be missing the
contradicting fact two hops away. The gain isn't just speed; the answer is **accurate,
deterministic, and verifiable**, and you reason *with confidence*, because anything that
could make you wrong would itself be at the node.

## Verified like source code

Structure is only trustworthy if it's *enforced*, so the rules are executable.
`npx mcts-mem lint` runs a set of mechanical, deterministic checks over the whole tree —
each the executable form of a rule the skills specify — and passes only when every
invariant holds:

- **Links resolve.** Every cross-reference points at a real node; nothing dangles.
- **Re-decisions can't contradict themselves.** A replacement and the alternative it
  superseded must record the *same* reason, **verbatim** on both sides — a tree whose
  two halves tell different stories won't pass.
- **History is append-only.** No recorded fact or move can be silently edited or
  deleted; corrections are *new, dated* entries, so the record of what was believed and
  when stays auditable.
- **Every claim is sourced.** Each fact and move ends with one tag answering *what could
  prove it wrong* — `(code)` (checkable against the code), `(sourced)` (resting on a human
  record: commit message, doc, paper, chat log, author), or `(uncertain)` (an unbacked
  reading of intent). Evidence, record, and guess are never confused.
- **Every node earns its place.** A node that records no decision, evidence, or
  alternative is rejected; reading a node is never noise.

Lint checks *consistency*, not truth — whether a measurement is correct is a separate
matter — but when it passes, those guarantees are *proven*, not hoped for. The memory is
checked the way code is checked by a compiler and a test suite, which is what most
memory systems cannot offer: its **logical consistency is a property of the artifact**,
not of how carefully someone wrote it down.

Because the record is append-only and every fact carries its origin, it can also be
**re-checked**. History can be wrong — an early bad measurement can drive a decision
that was reasonable on the data but wrong in fact. You reproduce the fact, append the
corrected one, and **re-decide**: the solution is re-found under updated knowledge,
without erasing the record of how it was first reached.

## A remembered search — why "MCTS"

Building the system *was* a search over a space of possible designs: you try a branch,
learn something (a fact), and that result shapes where you look next. Like Monte-Carlo
Tree Search, MCTS-Mem records that search — the branches taken and abandoned, and the
evidence (the **value**) on each — so the next exploration starts from the accumulated
result instead of from scratch. New or re-validated facts update that value, and that is
what **improves the policy**: stronger evidence revives a branch pruned on bad data, or
retires one that only looked good on thin data. This is the one sense in which "search"
applies — the exploration that *produced* the tree, never how you read it.

## Beyond software

Anything that advances by trying things and learning fits the same model. A team on a
hard task records what it learned, what failed, what succeeded, and the decisions that
followed. Research does it explicitly: run an experiment, record the facts, decide how
to improve the method — which is exactly *refining the search policy* for the next
experiment.

And because every memory shares one model, **memories merge**. Separate trees combine
into a single prior for a whole topic — for instance, general JIT-engine knowledge that
unifies what was learned building JSC and V8 — turning the accumulated reasoning of many
independent efforts into one thing you can consult.

## How to use it

MCTS-Mem ships as two **skills** plus a small helper CLI. You don't run a program against
your codebase — you point your AI coding agent at a skill, and it follows the method:

- **`mcts-mem-use`** — consult a tree before you plan a change, and update it when you
  re-decide something. Reach for it before any non-trivial design, refactor, or rewrite in
  a repo that has an `mcts_mem/` folder.
- **`mcts-mem-build`** — the one-time job of reconstructing a tree from a project's history
  (git, design docs, the author). Run it once per repository; `mcts-mem-use` keeps it
  current afterward.

Each skill is a single self-contained `SKILL.md` — the tree format and the full method are
written inside it, so any agent that can load a skill can read and maintain a tree with no
other setup. Drop the `skills/` directory into your agent's skills path and ask it to build
or consult the design memory.

The one piece of running code is the linter: `npx mcts-mem lint <path-to-mcts_mem>`
validates a tree the way a compiler validates source — links resolve, re-decisions agree,
history is append-only, every claim is tagged. Run it after any edit; a clean lint is a
cheap, mechanical guarantee that the structure holds.

## The deeper idea

Why a design memory is shaped like a *search* — and why that matters more as AI makes
building cheap enough to explore the solution space in earnest — is in
[`rationale.md`](rationale.md): the MCTS framing, the model's own evolution (including the
dead ends it discarded), and the honest constraints on what it can do.
