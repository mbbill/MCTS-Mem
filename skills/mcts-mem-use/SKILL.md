---
name: mcts-mem-use
description: >-
  Consult and maintain an MCTS-Mem design tree — a structured, verifiable record of *why*
  a project is built the way it is: the decisions in force, the alternatives that were
  tried and rejected, and the dated evidence behind each. Invoke only on an explicit
  request — the user names the skill, or asks directly to consult the tree ("check the
  design tree", "what does the tree say about X") or to maintain it ("update the design
  tree", "record this decision"). Never trigger it uninvited, even for design or
  architecture work in a repository that has an `mcts_mem/` folder.
---

# Working with an MCTS-Mem design tree

You are in a repository that keeps an **MCTS-Mem tree**: a folder named `mcts_mem/` at the
project root. This skill is everything you need to read it and to keep it true. Assume no
prior knowledge of MCTS-Mem — this file is self-contained.

## What an MCTS-Mem tree is, and why you should care

A codebase tells you *what* the project does today. It does not tell you *why* it is that
way — why this approach and not the obvious alternative, what was tried and abandoned, what
each choice cost, what is settled by hard measurement versus picked on a hunch. That
reasoning is the most valuable thing a long-lived project produces and the most perishable:
it lives in people's heads and in chat logs that evaporate. When it is gone, every new
contributor — human or agent — re-derives it from scratch, or worse, silently re-breaks a
choice without knowing it was ever made.

An MCTS-Mem tree is that reasoning, written down in a form you can trust:

- It records **decisions, not code** — the points where there was a real choice. Code any
  competent engineer would write the same way given the spec is not in the tree.
- Every rejected alternative is **kept**, frozen with the measured reason it lost, sitting
  right next to the choice that beat it — so you can see what has already been tried here
  and why, and reclaim a dead end later if the reason it died has since lapsed.
- Every claim is **dated and sourced**, so you can tell a measured fact from a human's
  assertion from an unverified guess, and weight it accordingly.
- It is **checkable** — a linter validates the whole tree the way a compiler checks code,
  so when it passes you can rely on what you read instead of re-verifying it.

That is why this skill asks two things of you, and they are the whole job:

1. **Read the tree before you plan a non-trivial change** — so you start from the project's
   accumulated judgment instead of from zero, and don't re-open a measured-closed choice
   blind.
2. **Update the tree before you finalize a change that re-decides something** — so it stays
   true. A tree that has drifted out of sync with the code is *worse* than no tree: readers
   trust it and get misled.

## Where it lives

```
<project-root>/mcts_mem/
├── <project>.md     the root node, named after the system (e.g. silverfir.md)
└── <project>/       its subtree — nested nodes, with .alt/ and .fact/ folders
```

The tree *is* those plain Markdown files. One `mcts_mem/` may hold more than one tree, each
namespaced by its root name. If a repo has no `mcts_mem/` folder, there is no tree and this
skill does not apply.

## How a tree is shaped

**The filesystem is the tree.** There is exactly one top-level node — the root, named after
the system. Everything else hangs beneath it.

- **`<name>.md` is a node** — one design decision. It has up to three parts, in this exact
  order:
  - **Items** (at the top, no heading): bullet statements that are *true of the current
    design*. They state *what is*, never *why* — and they are concepts, not code (each must
    hold for any faithful implementation of the decision).
  - **`## Facts`**: a dated, append-only log of evidence — measurements, pitfalls, recorded
    rationale — each tagged with where it came from.
  - **`## Moves`**: a dated, append-only log of *re-decisions* — what was replaced, dropped,
    or removed, and why.
- **`<name>/`** (a folder) holds the node's **sub-parts** — finer decisions that are all in
  force at once under it.
- **`<name>.alt/`** holds the node's **rejected alternatives and superseded forms**, each a
  full frozen node with the reason it lost. **Walking into `.alt/` walks back in time.**
- **`<name>.fact/`** holds **graduated evidence** — a document too big for a single `## Facts`
  line (a recovered design paper, a measurement table, a long diagnosis), linked from a
  `## Facts` entry.
- **`[[double-bracket links]]`** connect related nodes by name.

To read the *current* design, **ignore every `.alt/`**: the main tree's Items are statements
true of the code today. The `.alt/` folders are history — superseded forms and roads not taken.
You do not skip them, though: before proposing a change you walk the relevant `.alt/`
(Job 1), because that is the record of what was already tried here and why it lost.

## Job 1 — Before you plan: read the tree

The goal is to start where the project's reasoning already is, not where you'd start cold.

- **Follow the structure; do not grep it.** The shape carries the meaning. Walking from a
  node into its `.alt/` shows you what was tried — the flat set of rejected rivals, with their
  Moves giving the order and why each form lost — context a keyword jump throws away. An agent that lands on a node by `grep` sees
  the answer stripped of the reasoning that makes it trustworthy. Start at the root, descend
  by subsystem. Use `grep` only as a last-resort locator when you genuinely can't place a
  topic by structure.
- Find the subsystem your change touches. Read its **Items** (what holds now), its
  **`## Facts`** (what is known and measured), and its **`## Moves`** (what changed and why).
  Follow `[[links]]` to related nodes.
- **Before you propose an approach, open the subsystem's `.alt/`.** If your idea is
  already in there, it was tried — read the recorded reason it lost *before* re-proposing
  it. Re-open it only if that reason no longer holds under today's constraints; if so, say
  so explicitly and name the reason that lapsed. (Dead ends are kept, not deleted, precisely
  so they can be reclaimed when the world changes.)
- **Read fact density as a confidence signal.** A node thick with facts was fought over —
  reconsider it carefully, and only with evidence that beats what's on record. A thin node
  (no facts) honestly says "nobody weighed this; reconsider freely."
- **Heed the provenance tags.** A `(code)` fact is checkable against the code; a `(sourced)`
  fact rests on a human record (commit message, doc, paper, chat log, author); an `(uncertain)`
  fact is someone's unbacked reading of intent. Weight them accordingly — trust `(uncertain)`
  least.

Then build your plan *on top of* what the tree settled. Don't re-derive it, and don't
reverse a measured-closed choice without evidence that beats the one on record.

## Job 2 — Before you land: update the tree if it's a re-decision

The tree records **decisions, not activity** — which is why most changes touch it not at
all. Judge which kind of change you just made:

- **You changed or extended something an Item asserts** → edit that Item to match. Item
  edits are silent; git records when.
- **You replaced a mechanism, dropped a capability, or adopted an alternative that was
  actually weighed** → that is a *re-decision*; record it (below), in the **same change** as
  the code, so the tree never lags reality.
- **Pure churn** — a localized bug fix, a rename, a cosmetic refactor → nothing, or at most
  a `pitfall` fact at the fix.

**The test for a re-decision:** did the old form hit a wall the new one clears — something
it could not express or do? Then the rejected shape is a lesson worth keeping; record it. If
the old form worked fine and the new one is merely nicer, that is taste — at most a one-line
`rationale` fact, no move.

### Recording a re-decision — file motion plus paired log lines, in one change

1. Move the superseded node into the sibling `.alt/` folder (e.g. `dispatch.md` →
   `dispatch.alt/old-dispatch.md`). Its Items **freeze** at their last-true state. If what
   you re-decided is an *internal aspect* of a node rather than a whole node, first promote
   that aspect to a child node, so its rejected form has a home in the child's `.alt/`.
2. On the **winner** (the live node), append to `## Moves`:
   `- <YYYY-MM-DD> (<8-char-commit>) replaced [[loser]]: <why> (provenance)`
3. On the **loser** (now in `.alt/`), append the mirror line:
   `- <YYYY-MM-DD> (<8-char-commit>) replaced by [[winner]]: <why> (provenance)`

   **The `<why>` is copied verbatim on both sides** — the same sentence, not paraphrased —
   so the two halves of a re-decision can never tell different stories. The linter enforces
   this. Only the `<why>` must match: each side's date and hash record the commit that wrote
   *that* side and may differ.

For a capability removed with **no successor**, skip the file motion and write one line on
the nearest live node: `- <date> (<hash>) dropped: <what>: <why> (provenance)`. For a whole
node deleted with no successor: `- <date> (<hash>) removed: <why> (provenance)` (the node
itself moves into `.alt/`). Reviving a previously-rejected alternative is
`- <date> (<hash>) revived: <why> (provenance)` and is rare.

Note: **dropping an external dependency but reimplementing its capability in-tree is not a
`dropped`** — the in-tree code is the successor, so it is a `replaced` re-decision (the
dependency's rejected shape goes in `.alt/`). `dropped` is only for a capability removed
outright.

### Writing Facts

Append to the node's `## Facts`:
`- <YYYY-MM-DD> [(<8-char-commit>)] <kind>: <text> (provenance)`

- **kind** is a short, open label: `measurement`, `pitfall`, `rationale`, `statement`, … —
  pick the word that fits.
- **Before writing any fact, pass its admission test:** name (a) the decision it bears on
  and (b) what a future implementor would do differently knowing it. If you can't name both,
  it's not a fact — it's narration, and it doesn't belong.
- A fact records **evidence**, never a restatement of an Item or a Move, and never the
  project's paperwork (commit shapes, renames, file counts, "now functional", milestones).
  Facts are about the *design*.
- A re-decision's *why* lives in its Moves line, **not** in a fact. A `rationale` fact is for
  a why that has no move to carry it — the reasoning behind a current design that never
  displaced a predecessor.
- The log is **append-only**: never edit or delete a committed entry. History can be wrong;
  correct it with a *new, dated* entry, so the record of what was believed and when stays
  auditable.
- If a current commitment's *why* isn't recoverable from the code or any record, **never guess
  one**. Record it with the why tagged `(uncertain)` (e.g. `rationale: chosen as the baseline;
  no commit, doc, or note records why (uncertain)`); you may add your best reading in the text,
  flagged as a guess, but the tag stays `(uncertain)`. A fabricated rationale dressed as fact is
  the one thing that poisons the tree.

### Writing Items

- Items are **concepts, not code**. Each must hold for *any* faithful implementation of the
  decision. At most **one** code identifier per node, parenthesized, only as a findability
  anchor — never enumerate functions, methods, or fields.
- Items are checkable, never argued — **no "so that / because" tails**. The why lives in
  Facts and Moves.
- The **regeneration test** decides whether a line is even an Item: would a faithful rebuild
  from the tree plus the spec plus ordinary engineering competence *legitimately diverge*
  here without this line? If a competent rebuilder could equally pick another shape, it's an
  Item — *even when no alternative was ever weighed* (this test is about the line; whether the
  *node* deserves to exist is the separate "a node exists only if a real alternative exists"
  rule). If the line only restates what the spec or basic competence dictates anyway, it is
  not — drop it.
- Items describe the **live code only** — never commented-out, aspirational, planned, or
  `TODO` behavior. State only what the code actually does today.
- A localized bug (the code runs but computes the wrong thing — a flipped predicate, an
  off-by-one) does **not** change the design: leave the Item stating the design, and record
  the bug as a `pitfall` fact at the commit that fixes it.

## The grammar in full — the rules the linter enforces

Everything above in one reference. When you write to the tree, this is the contract.

**Provenance — on every Facts entry and every Moves entry.** Each entry ends with one tag that
answers a single question: **what could prove this claim wrong?**
- `(code)` — re-reading or re-running the code could (a claim about *what* the code does or
  *how* it works; you needn't run it, it just has to be checkable against the code).
- `(sourced)` — checking a human record could: a commit message, design doc, paper, chat log,
  or the author. Usually the *why* behind a choice, on record.
- `(uncertain)` — nothing could; it's your own reading of intent. Greppable; upgrade it only
  when you find real backing. An inference is never better than `(uncertain)` — there is no
  separate "inferred" tier, because grading your own confidence is false precision.

**Reading a doc, plan, or commit message is checking a *source*, not the code** — so a *why* a
human recorded is `(sourced)` even when the behavior it explains is also visible in the code.
Keep `(code)` for the *what / how* (including a mechanism "because" whose cause is in the code);
use `(sourced)` for the *why behind a choice* once a human has put it on record.

An unmarked entry is invalid. **If the clauses of one entry have different answers, split them
into separate entries** — never let an intent-guess ride inside a `(code)` entry.

The **hash is independent of the tag**: include the 8-char commit hash whenever the entry is
anchored to a specific commit, and omit it when the claim is tied to no single commit (a general
statement, an interview answer). The entry form brackets the hash as optional `[(<hash>)]` for
exactly this reason.

**Moves** are written **only** when something crosses the `.alt/` boundary or is dropped —
never for births, item edits, or progress. A node that never moved has no `## Moves` section.
The verbs: `replaced [[X]]` / `replaced by [[X]]` (paired, why verbatim on both sides),
`dropped`, `removed`, `revived`. An `.alt/` member's Moves always end in `replaced by` or
`removed` (walking in walks back in time; revival is the rare exception). 8-char hashes.

**Facts** graduate to a file in `<name>.fact/` only when the evidence has *body* — a
measurement table, a recovered document, a long diagnosis. The `## Facts` section then
carries a one-line entry linking it. Fact files are pure prose, no headings; a fact recovered
retroactively from history carries `commit: <hash>` on its first line.

**Structure rules:**
- A node exists **only if a real alternative exists** (or was genuinely weighed). Otherwise
  the content is an Item on the nearest real node, or nothing. **The tree is not a module
  map.** Representation budget follows decision density: an unweighed path stays thin — never
  pad a missing fact with description.
- The tree must be **generatively sufficient**: tree + spec + ordinary competence rebuilds
  the code. Items are checked against the implementation.
- **A replacement is a re-decision by default.** When a working mechanism or representation
  is replaced, move the old form into `.alt/` with paired Moves — unless the change is purely
  cosmetic (a rename, a restyle). If the old shape could not express something the new one
  can, *that delta is the lesson* — record it. When the thing re-decided is an internal
  aspect of a node, promote that aspect to a child node so its rejected form has a home.
- **Never invent a rival.** Record only alternatives that really existed in this codebase or
  were really weighed. A fabricated alternative is the most damaging possible error, because
  it reads as real history.
- **The tree never references its own construction** — no extraction bookkeeping, batch
  numbers, or "this node was added because…". It records the design, not the paperwork of
  recording it.

## Verify — run the linter, like recompiling

After any tree edit, run the linter the way you'd recompile after editing code, and fix until
clean before you call the change done:

```
npx mcts-mem lint
```

A clean lint means the tree is *internally consistent* — links resolve, the two halves of
every re-decision agree, the form is right, nothing committed was silently rewritten. It does
**not** check that your facts are *true*; that is your judgment. But "lint clean" is to the
tree what a passing compile is to code.

If the linter isn't available, self-check the same invariants by hand: exactly one top-level
node; every `<name>/`, `<name>.alt/`, `<name>.fact/` has a sibling `<name>.md`; each node is
Items, then optional `## Facts`, then optional `## Moves`, and no other headings; every
Facts/Moves entry is dated, labeled, and tagged `(code)`/`(sourced)`/`(uncertain)`; every Move uses a boundary verb
and (for replacements) has its verbatim twin; every `[[link]]` resolves; an `.alt/` node ends
its Moves with `replaced by` / `removed`; no committed entry was edited or deleted.

## The one failure to avoid

**Silent divergence** — the code moving while the tree stays behind. If a change makes a
holds-true Item false, either the change is wrong or the Item must be updated; never leave
them disagreeing. Everything in this skill exists to prevent that one thing, because the
moment the tree and the code disagree silently, the tree stops being trustworthy — and an
untrusted memory is just dead weight.
