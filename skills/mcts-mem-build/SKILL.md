---
name: mcts-mem-build
description: >-
  Build an MCTS-Mem design tree for an existing project by recovering its design history —
  the decisions that still hold, the alternatives that were tried and dropped, and the
  dated evidence behind each — from git history, design documents, papers, and author
  input. A one-time, history-spanning job that stands up the design memory the
  `mcts-mem-use` skill then keeps current. Invoke only on an explicit request — the user
  names the skill, or asks directly to build, set up, or extract a design tree for a
  repository. Never trigger it uninvited.
---

# Building an MCTS-Mem tree from a project's history

This file is self-contained: it teaches the tree format and the recovery method from zero.
Assume no prior knowledge of MCTS-Mem.

## What you're doing, and why

A codebase records *what* a project does today. It does not record *why* — why this approach
and not the obvious alternative, what was tried and abandoned, what each choice cost, what is
settled by measurement versus picked on a hunch. That reasoning is the most valuable thing a
project produces and the most perishable: it lives in people's heads and in chat logs that
evaporate. When it's gone, every new contributor re-derives it, or silently re-breaks a
choice that was settled for a reason.

Much of it is recoverable. Git history records what changed and often why; deleted files,
reverted branches, and abandoned approaches hold the dead ends; design documents and the
author hold the rest. **This skill is a one-time recovery of that reasoning into an MCTS-Mem
tree** — after which the project keeps it current incrementally (that is the `mcts-mem-use`
skill's job).

Hold one idea above all others throughout: **you are recovering decisions, not summarizing
code.** A decision is a point where there was a real choice — alternatives, evidence, and a
reason one won. Code that any competent engineer would have written the same way given the
spec is *not* a decision and must not enter the tree. This is what keeps the tree small and
high-signal: it tracks the branch points of the design, not the design's surface. A tree that
mirrors the module layout has failed.

## What you produce

```
<project-root>/mcts_mem/
├── <project>.md     the root node, named after the system (e.g. silverfir.md)
└── <project>/       its subtree — nested nodes, with .alt/ and .fact/ folders
```

The tree *is* those plain Markdown files — nothing else. A single `mcts_mem/` can hold several
trees side by side, each namespaced by its root name.

# Part 1 — The tree format (the contract)

The filesystem **is** the tree. There is exactly one top-level node: the root, named after the
system. Everything hangs beneath it. **Ignore every `.alt/` folder and the main tree IS the
current design** — its Items are statements true of the code today; the `.alt/` folders are
history.

**`<name>.md` is a node** — one design decision — with up to three parts in this exact order:

- **Items** (top, no heading): bullet statements true of the current design. They state
  *what is*, never *why*, and they are **concepts, not code** — each must hold for *any*
  faithful implementation of the decision. At most **one** code identifier per node,
  parenthesized, only as a findability anchor; never enumerate functions, methods, or fields.
  Items are checkable, never argued — **no "so that / because" tails** (the why lives in Facts
  and Moves). They describe **live code only** — never commented-out, planned, or `TODO`
  behavior.

- **`## Facts`** (only if the node has any): a dated, append-only log of evidence.
  `- <YYYY-MM-DD> [(<8-char-commit>)] <kind>: <text> (provenance)`. `kind` is an open label
  (`measurement`, `pitfall`, `rationale`, `statement`, …). The hash anchors the entry to a
  specific commit and is independent of the provenance tag (see below); the bracket is optional.

- **`## Moves`** (only if the node has any): a dated, append-only log of *re-decisions* —
  written **only** when something crosses the `.alt/` boundary or is dropped. Never for births,
  item edits, or progress.

**`<name>/`** (a folder) holds the node's **sub-parts** — finer decisions all in force at once.

**`<name>.alt/`** holds the node's **rejected alternatives and superseded forms**, each a full
frozen node with the reason it lost. **Walking into `.alt/` walks back in time.** An `.alt/`
member's Moves always end in `replaced by` or `removed`. **`.alt/` is a *flat* set** — rivals
for one decision are siblings, so an `.alt/` member never has its own `.alt/`. A supersession
chain (A → B → C) lands as flat siblings under the live node; the order lives in the paired
Moves, not in nested folders (the linter enforces this as `R-altnest`).

**`<name>.fact/`** holds **graduated evidence** — a document too big for one `## Facts` line (a
recovered design paper, a measurement table, a long diagnosis), linked from a `## Facts` entry.
Fact files are pure prose, no headings; a fact recovered retroactively carries `commit: <hash>`
on its first line.

**`[[double-bracket links]]`** connect nodes by name.

### Provenance — on every Facts and Moves entry, no exceptions

Every entry ends with one tag that answers a single question: **what could prove this claim
wrong?**

- `(code)` — re-reading or re-running the code could. A claim about *what* the code does or
  *how* it works, including a mechanism "because" whose cause is also in the code. You needn't
  run it; it's enough that the claim is checkable against the code (you *could* check out the
  commit and confirm it really fixes that bug).
- `(sourced)` — checking a human record could: a commit message, a design doc, a paper, a chat
  log, or the author. Usually the *why* behind a choice, on record.
- `(uncertain)` — nothing could, because it's your own reading of intent (why a branch was
  deleted; whether a commit "fixes a bug" when nothing says so). It is greppable, and you
  upgrade it to `(code)`/`(sourced)` only if you later find real backing. **An inference is
  never anything better than `(uncertain)`** — there is no separate "inferred" tier, because
  grading your own confidence is the false precision this scheme exists to avoid.

**Reading a doc, plan, or commit message is checking a *source*, not the code** — so a *why* a
human recorded is `(sourced)` even when the behavior it explains is also visible in the code.
Keep `(code)` for the *what / how* (including a mechanism "because" whose cause is in the code);
use `(sourced)` for the *why behind a choice* once a human has put it on record.

An unmarked entry is invalid. **If the clauses of one entry have different answers, they are
different entries — split them.** ("The doc was deleted" is `(code)`; "so the design was
abandoned" is `(uncertain)` — two entries, not one.) Never let an intent-guess ride inside a
`(code)` entry; that is the fastest way to poison the tree.

The **hash is independent of the tag**: include the 8-char commit hash whenever the entry is
anchored to a specific commit, and omit it when the claim is tied to no single commit (a general
statement, an interview answer). The entry form brackets the hash as optional `[(<hash>)]` for
exactly this reason. (A literal `[[...]]` token quoted from source is backtick-escaped so it
does not read as a link; verbatim-why comparison ignores backticks and line-wrapping.)

### Moves — the verbs

- `- <date> (<hash>) replaced [[X]]: <why> (provenance)` — on the winner (live node).
- `- <date> (<hash>) replaced by [[X]]: <why> (provenance)` — on the loser (now in `.alt/`).
  **The `<why>` is copied verbatim on both sides** — the same sentence, never paraphrased — so
  the two halves of a re-decision can never tell different stories. Only the `<why>` must match:
  each side's date and hash record the commit that wrote *that* side and may differ.
- `- <date> (<hash>) dropped: <what>: <why> (provenance)` — a capability removed with **no
  successor**. One line on the nearest live node; no ghost node.
- `- <date> (<hash>) removed: <why> (provenance)` — a whole node deleted with no successor (the
  node itself moves into `.alt/`).
- `- <date> (<hash>) revived: <why> (provenance)` — rare.

### Structure rules

- **A node exists only if a real alternative exists** (or was genuinely weighed). Otherwise the
  content is an Item on the nearest real node, or nothing. The tree is **not a module map**.
- **Alternatives are a flat set.** A node's `.alt/` holds rivals for *one* decision as siblings;
  an `.alt/` member never has its own `.alt/`. Successive superseded forms (A replaced by B
  replaced by C) all sit side by side under the live node — the supersession order is recorded in
  the paired Moves, not in nested folders. (A rejected branch's own *children* may still carry
  their `.alt/`; what is forbidden is an alternative nesting alternatives.)
- **Representation budget follows decision density.** An unweighed path stays thin — never pad
  a missing fact with description. Fact density is the confidence signal: a node thick with
  facts was fought over; a thin node honestly says "nobody weighed this; reconsider freely."
- **The tree must be generatively sufficient:** tree + spec + ordinary engineering competence
  rebuilds the code. (This is also the test for whether a line is an Item — see the regeneration
  test below.)
- **The tree never references its own construction** — no batches, windows, ledgers, extraction
  bookkeeping, or "this node was added because…". It records the design, not the paperwork of
  recording it.
- **Never invent a rival.** Record only alternatives that really existed in this codebase or
  were really weighed. A fabricated alternative is the most damaging possible error — it reads
  as real history and there is no way for a later reader to catch it.

### A worked example — copy the *form*, never the names

A node from a *fictional* key-value store `acorn` (root `acorn.md`; this is
`acorn/storage/page-cache.md`):

```markdown
- Reads go through a fixed-size page cache (`PageCache`); a page is only ever loaded from disk
  on a cache miss.

- Dirty pages are written back on eviction, not on every mutation.

## Facts

- 2031-04-02 (ab12cd34) measurement: under the ingest benchmark, write-through spent 71% of
  wall time blocked on synchronous page writes; batching at eviction cut ingest latency 3.4x —
  full run data in [[page-cache.fact/write-through-stall]] (code).

- 2031-05-10 (bc23de45) rationale: the cache is sized to the working set, not to total RAM —
  the design note `docs/cache-sizing.md` argues a bigger cache only trades memory for a
  diminishing hit-rate gain past the working set (sourced).

- 2031-06-17 (ef56ab78) pitfall: a crash between mutation and eviction loses the dirty page; a
  write-ahead log now sits in front of the cache (code).

- 2031-07-01 (df45ab67) rationale: eviction scans the page table in reverse index order; no
  commit, note, or doc says why, and forward order would behave identically — possibly just how
  it was first written (uncertain).

## Moves

- 2031-04-02 (ab12cd34) replaced [[write-through-cache]]: write-through stalled every mutation
  on disk latency; batching at eviction removed the stall (code).

- 2031-09-05 (cd34ef56) dropped: per-page checksums — the storage layer gained end-to-end
  checksums, making the cache's own redundant (code).
```

`write-through-cache.md` then sits in `page-cache.alt/`, Items frozen, its Moves ending with
the same why **verbatim**: `replaced by [[page-cache]]: write-through stalled every mutation on
disk latency; batching at eviction removed the stall (code).`

# Part 2 — The judgment that makes or breaks the tree

Most of the skill is here, because this is where trees go wrong. Every commit (or author
statement, or chat-log claim) is a piece you classify, then either confirm the tree already
accounts for it or repair the tree.

### Classify each piece

- **add** — new code. **LOW density:** at most one item, usually none. What code *is* is not a
  design decision and is already recorded in the code. Completing a skeleton ("now functional")
  changes no decision.
- **change / delete** — **HIGH density:** something happened; find it. A replaced working
  mechanism is a re-decision (see below). A deletion with no successor is a `dropped`/`removed`.
- **bug fix** — usually nothing (see "bugs are not design"). Sometimes a pitfall fact. Sometimes
  a re-decision (when it replaces the mechanism's *form*).
- **conformance** — the spec/test-suite dictated it, no alternative existed. Record nothing; it
  is forced.
- **statement** (author answer, chat log, design doc) — file as a fact at the node it bears on;
  if it reveals an unrecorded design, repair the tree first.

### Settling vs re-decision — the call you will get wrong most often

When a working mechanism or representation is replaced, the default is **re-decision**: move
the old form into `.alt/` and write paired Move lines. The exceptions are narrow, and getting
the boundary right is the core skill.

- **Settling** applies *only while the mechanism has never been exercised* — never run by any
  binary, test, or pass over real input. A parser that parses real modules is already consumed,
  even if the wider product is incomplete. Only a form that *never executed* is settling.
- **Completing an incomplete stub is settling, not a re-decision** — even when the finished form
  expresses more than the stub. A stub that punts (a raw byte forwarded undecoded, a `todo!`, an
  arm returning a default) was never a weighed alternative, just unfinished work. Filling it in
  is item edits, not an `.alt/`. *The discriminator:* was the old form a complete mechanism that
  **worked and was replaced**, or a placeholder that was **filled in**?
- **An expressivity wall always wins:** if the prior form could not express something the new
  one can, it is a re-decision no matter how briefly it lived — **provided the prior form was a
  complete, working design.**
- **Two tiebreakers, in order.** (1) A **type-level wall** — the old form's signature could not
  hold the new capability at all (a borrow-only reader cannot carry caller-owned input) — is a
  re-decision regardless of whether it ever ran. An "awkward but possible" indirection is *not*
  a wall. (2) When the repo **cannot show** whether a form was ever exercised (early
  construction, no tests yet), **default to re-decision** — a dropped transition is
  unrecoverable, while an over-recorded `.alt/` is visible and reviewable. Asymmetric risk
  decides.
- **External dependencies are always a re-decision** — adopting or dropping the *engine's own*
  dependency is a commitment the moment it is declared, whether or not the code using it ran.
  But **test-harness, build, and tooling dependencies are paperwork** — excluded from the tree
  entirely; adopting or dropping them is never a tree event.

A worked contrast: replacing a byte-scanning boundary-finder with an opcode walk is a
re-decision (different mechanism); flipping a skip-predicate inside the same loop is a pitfall
fact (same mechanism, fixed bug).

### When the re-decided thing is an *internal aspect* of a node

Promote that aspect to a child node so its rejected form has a home in the child's `.alt/`:
`parent/aspect.md` (current) + `parent/aspect.alt/old-aspect.md`, with paired Move lines. The
test is objective: **if the chosen form exists because the old form hit an expressivity wall**
— something it could not do, which the move why states — the rejected shape pays rent; promote
it. Only a pure-taste replacement with no wall (the old form worked, the new is merely nicer)
folds to a why-only `rationale` fact. Never put a half-node in `.alt/` that describes only one
facet of its parent.

### `dropped` vs `replaced`

`dropped` is **only** for a capability removed outright with no successor. Dropping an external
dependency but **reimplementing its capability in-tree is a `replaced` re-decision** — the
in-tree code is the successor, so the dependency's rejected shape goes in `.alt/`.

### Bugs are not design

A localized bug — the code runs but computes the wrong thing (a flipped predicate, an
off-by-one) — does **not** change the design. Write the Item at the design the code
*structurally implements*; record the bug as a **pitfall fact at the commit that fixes it**
(that is where the lesson crystallizes), never by describing buggy behavior in an Item.
*Pitfall admission line:* a slip **inside the mechanism's own invariant logic** — its guards,
boundary conditions, the rules that make it correct (an underflow guard that never fired, an
error built at the decode boundary but never raised) — is instructive and is filed at its fix;
a generic coding slip with no mechanism-specific lesson is skipped.

*The transition gate:* a transition is a re-decision between **two different mechanisms** — its
old and new must name different things. If old and new are the same mechanism, or the only change
is internal logic, a thread-safety guard (a lock, a marshal-to-thread), a null/bounds check, a
dedup or already-done flag, a scale/DPI correction, or a perf tweak that keeps the same form, it
is **not** a transition — it is a pitfall fact (if it teaches a mechanism invariant) or nothing.
A bug fix earns a transition only when it changes the mechanism's **form, representation, or
type-signature** (an ownership model `ScopedPtr`→raw pointer; a value returned
by-reference→by-value). Recording bug fixes and thread-safety guards as transitions is the
sweep's second-most-common false positive after paperwork.

Distinct from a bug: an **unimplemented** capability (a `TODO`, a stub, a missing branch — the
code does not do it at all) must never be asserted by an Item, even when it is the design's
evident intent. State only what the code performs; the unimplemented half is recorded when it
is implemented.

### Paperwork is not design

A large fraction of commits touch no decision at all, and the sweep's single most common failure
is dressing one as a decision. **Always SKIP — never a transition or birth:** build / packaging /
link configuration (`BUILD.gn`, CMake, `.mk`, `.gni`, linker or compiler flags, SHARED↔STATIC,
`.so`/`.a` bundling, load entry-point renames); version bumps of build / test / lint / CI tooling;
generated files; **pure renames and moves** (a file, directory, or symbol relocated — including
across namespaces — with the design unchanged); **convention / style** (guard-macro
standardization, include reordering, formatting, lint, comments, license, typos); and
**test-only / docs / example** edits that reveal no engine decision. Identity across a rename is
re-derived later from name + anchors, so a pure rename needs no transition; record the design
change *only* when the rename also changes the design. (Adopting or dropping the engine's own
*runtime* capability is still a re-decision — it is the link mode and packaging of a dependency,
not its existence, that is paperwork.) A weaker sweep model over-records this and the transition
gate above far more than a strong one, so the miner prompt must name both traps explicitly, and
the audit must hunt them (see Stage 4).

### The regeneration test (what is even an Item)

A line earns its place as an Item only if a faithful rebuild from the tree + spec + ordinary
competence could **legitimately diverge** here without it. If a competent rebuilder could
equally pick another shape, it's an Item (even when no alternative was ever weighed). If the
line only restates what the spec or basic competence dictates anyway, it is noise — cut it.
This is the test that keeps the tree from becoming a module map.

### Facts, not arguments

A fact is a grounded observation with provenance. An argument dressed as a fact is the
confirmation-bias trap. Before writing any fact, name (a) the decision it bears on and (b) what
a future implementor would do differently knowing it — if you can't name both, it's narration,
not a fact. A re-decision's why lives in its Move line, **not** a fact; a `rationale` fact is
only for a why that has no move to carry it. Never file a fact that restates an Item or a Move.
Repository/process observations (commit shapes, renames, file counts, "now functional") are
never facts.

### Record density is a quality signal

The map is not a changelog. A typical 10–20 commit window should emit only a handful of records;
a dense window must be dense because the history is genuinely full of design decisions, not
because the mapper wrote down every edit. **Do not record** TODO churn, scaffolding, tiny
refactors, style-only cleanups, file shuffles, trivial fixups, typo/comment/log changes, null
checks, guard additions, one-off crash fixes with no mechanism-specific lesson, or implementation
details a competent rebuilder would freely rediscover. If a window emits records for most commits,
or multiple records per ordinary bug-fix commit, treat that as a mapper-quality smell: re-read the
records and prune until each one changes a future design decision. High density is allowed only
when the diff shows many real branch points (new runtime backend, serialization format change,
ownership model replacement, cross-thread architecture change, capability removal/replacement,
measurement-backed choice). The reduce should receive design evidence, not noise to filter later.

### When the why cannot be recovered

A decision can be real and its reason unfindable — not in the code, not in any message, doc, or
chat log. **Never guess one to fill the gap.** Record the decision and tag its why
`(uncertain)`: e.g. `rationale: chosen as the baseline approach; no commit, doc, or note records
why (uncertain)`. You may add your best reading in the text, flagged as a guess — but the tag
stays `(uncertain)`, and the guess is not evidence. This differs from a node nobody ever weighed,
which simply has *no facts at all* (a thin node that says "reconsider freely"). Every
`(uncertain)` entry is greppable; resolving them is open-ended (Stage 5).

# Part 3 — The method

The work spans the whole history, so run it as a **fan-out**, not a single linear read. The
key structural insight that makes fan-out *safe*: of every judgment above, **only two need
global state — naming** (is this the same concept another window already saw?) **and
placement** (where in the tree does it land?). Everything else — what happened, settling vs
re-decision, the why, provenance, the loser's last-coherent state — is **commit-local**,
judged from the diff plus the code at the parent commit, which git serves at any point in
history. So the commit-local work runs concurrently and the two global judgments defer to one
reduce step.

*(How it was actually run: a workflow engine fanned out Opus subagents — one per commit window
for the map, then a reduce agent, with fresh adversarial auditors between. You can use any
orchestration that gives you parallel agents; sequential batches work too, just slower. The
method below is what matters, not the tool.)*

### Stage 1 — Skeleton from HEAD

One pass over the code at HEAD builds the main tree: **nodes and items only — no Facts, no
Moves, no `.alt/`.** This is legitimate because items are statements true of the current code,
and HEAD is the one state you can read and verify directly; history is then mined to explain
*how* it got there. Judge from the code alone — don't run `git log`. **Bias coarse:** the
reduce can deepen a too-coarse skeleton locally, while a too-fine one forces cross-window
merges. Treat the skeleton as *scaffolding, not output* — its nodes are presumed module-map
until history earns them; the reduce prunes every node no timeline touches.

Lint the skeleton with `npx mcts-mem lint --skeleton` before mining history. That checks its
*form* (one root, the section/heading shape, item form, resolvable links) while skipping the
R-thin "every node records a decision" rule — which a skeleton deliberately cannot satisfy yet,
since its nodes are scaffolding until Stages 2–3 add Facts/Moves/`.alt` or prune them. This is
the **only** time you pass `--skeleton`; every later stage and the finished tree must pass plain
`npx mcts-mem lint`.

### Stage 2 — Mine the history (the map, fanned out)

Cut history into fixed **windows of 10–20 commits** in `git log --reverse` order (production
used 15). A commit's `seq` is its global ordinal, fixed by the cut, so window outputs
concatenate without coordination. One agent per window reads **every diff at full depth** (not
commit messages — messages are often wrong or fabricated) and writes **exactly two files; it
never writes the tree:**

- **`win-<NN>.ledger.tsv`** — one row per commit: `seq  piece-id  class  verdict  ref  depth
  batch`. Verdicts: **RECORD** (design info emitted; ref lists the record ids), **COVERED** (an
  implementation of a design already evident; ref names the covering concept), **FORCED**
  (conformance), **SKIP** (nothing for the tree — licenses, formatting, pure file motion,
  implementation slips; one-word reason). A verdict without its required ref is invalid.
- **`win-<NN>.records.jsonl`** — placement-free **evidence records**, one JSON object per line.
  This is the heart of map output. Types:
  - **transition** — a re-decision or deletion: `verb` (replaced/dropped/removed), `old`
    concept, `new` concept (null for dropped/removed), `why` (one sentence — the reduce writes
    it verbatim on both sides), and for replaced/removed `frozen_items` (the loser's items at
    its **last-coherent blob**, drafted now — map time is the only moment the loser's code is in
    hand).
  - **fact** — `kind`, `concept`, `text`.
  - **birth** — a mechanism's first appearance: a concept plus at most one item-worthy line.
    Births are identity evidence for the reduce, not tree content. **A why must never ride
    inside a birth's item** — reasoning demonstrable from the diff is its own `fact` record
    (kind `rationale`), or it is silently lost when the birth's node is pruned.
  - **uncertain why** — a real decision whose reason the diff and records can't supply: a `fact`
    record tagged `(uncertain)` (optionally a flagged guess in its text). No separate "question"
    record, no questions file.

  Each concept is `{name, anchors: [code identifiers / paths at this commit]}`; anchors are the
  join keys the reduce resolves identity with, so a rename is just a transition whose old/new
  anchors differ — identity survives renames with no agent tracing lineages.

**COVERED and SKIP are not fact-free.** Before moving on from such a commit, ask one more
question: does the diff demonstrate a rationale, a pitfall at its fix, or evidence that an
abstraction has more than one consumer? If yes, emit the `fact` record even though no structure
changed. (Windows that treated COVERED as terminal lost every rationale fact — a real, repeated
failure.)

### Stage 3 — Reduce into the skeleton

One agent reads the skeleton and **every record — never the diffs.** In order:

1. **Identity** — cluster records into concept timelines by anchors and names; transitions
   stitch timelines across their own rename boundaries.
2. **Fold, in seq order** — each timeline's transitions become a node and a *flat* `.alt/` of its
   superseded forms (the final form is the live node; every predecessor is a sibling alternative,
   never nested under another). Move
   pairs are generated from each transition's single `why`, so they are verbatim by
   construction. `frozen_items` become the alt's items; facts attach to the generation current
   at their seq; a `dropped` lands on the surviving parent. Aspect promotion is decided here,
   with the node's whole transition set in view.
3. **Prune** — delete every skeleton node whose whole subtree gained no `.alt/`, no Facts, and
   no Moves; its items collapse to the nearest surviving ancestor **only if they pass the
   regeneration test** (otherwise they were module-map and are deleted). A commitment that
   passes regeneration but has no recorded why may instead earn its node with a `(uncertain)`
   rationale fact. This is "a node exists only if a real alternative exists" applied to the skeleton.
4. **Placements** — record where every record id landed (a tree path, or `discarded: <reason>`).
   The reduce never invents: every Facts/Moves line derives from a record. An unrecoverable why
   stays tagged `(uncertain)` wherever it lands — there is no questions list to write.

**If the records outgrow one context, reduce hierarchically:** a router clusters records by
top-level subtree (target ~50–150 each); one sub-reduce per subtree with **strict ownership** —
a sub-reduce that finds a record whose timeline belongs to another subtree **hands it back for
re-routing; it never places across an ownership boundary** (cross-placed transitions get
silently dropped otherwise). Then a root agent does root facts, top-level prune, cross-links,
and merges placements.

### Stage 4 — Audit adversarially (the gate the linter cannot be)

After each window, and after the reduce, a **fresh agent with no extractor context** —
adversarial (assume defects exist until the evidence says otherwise), classifying **from diffs,
never commit messages** — re-checks the work. It is detection-only; it never edits the tree.

- **Faithfulness** — every Item of every current (non-`.alt`) node is true of the code at the
  relevant commit. Read the source there; don't trust the Item.
- **Completeness** — every change/delete commit's design event is recorded at the right
  structure: a replaced working mechanism is a re-decision (loser in `.alt/`, paired Moves); an
  expressivity-wall aspect is a promoted node+alt, not a fact, not buried on an unrelated node,
  not mislabeled (`dropped` vs `replaced`).
- **False positives** — run completeness in reverse: every recorded transition must be a *real*
  re-decision. Flag any whose old and new are the same mechanism, or that is paperwork-shaped (a
  rename, a build/link tweak, a namespace move) or bug-fix-shaped (a guard, a null/bounds check, a
  thread-safety lock, a dedup flag). These are the sweep's two commonest false positives and must
  be demoted to a pitfall fact or dropped, not left as a spurious `.alt/` re-decision.
- **Spot-check** — re-derive a few RECORD/COVERED/SKIP rows from their diffs; confirm no
  intent-guess hides under a `(code)` or `(sourced)` tag (it should be `(uncertain)`).

**The closure check is mandatory and is what makes parallel mode safe.** *Placement alone does
not prove a transition was folded* — a placed transition that never became a Moves entry is a
silently dropped re-decision. Mechanically verify: every placed (non-discarded) transition
appears as a Moves entry at a placed node; every transition chain ends at a real node or in a
`dropped`/`removed`; every record id appears in placements exactly once. This is not optional
polish: on the production run, sampled adversarial audits caught **3** dropped re-decisions; the
closure check caught **22**. Do not chase audit-sampling convergence — the closure check and a
whole-tree audit are the deliberate second pass.

Fix loop: relay the diff-backed defect list to the parked agent (which fixes in place and
re-lints); the same auditor re-checks the fixed spots plus an adjacent glance. **Bound it: two
rounds, then escalate** to the human for a ruling rather than looping forever.

### Stage 5 — Resolve the uncertainties (open-ended)

Building the tree leaves a set of `(uncertain)` entries — real decisions whose *why* the code
and the records could not supply. They are **not** a blocking interview queue; they are a
worklist you grep out (`npx mcts-mem uncertain`) and chip away at by whatever means is available:

- ask a human, *if one is reachable* — but never assume the author still exists or remembers;
- search further — a design doc, a paper, an old chat log you hadn't read;
- or conclude it's lost and leave the entry `(uncertain)`.

When you find real backing, **append** a higher-tier fact (`(code)` or `(sourced)`) that supplies
the why and references the decision — never rewrite the immutable `(uncertain)` entry. **"Habit,
no strong reason" is a real, valuable answer** — record it (the author said it → `(sourced)`).
The one rule that never bends: if the why is not recoverable, it stays `(uncertain)`; you never
invent one to make the tree look complete.

### Stage 6 (advanced) — Merging multiple histories

If the project was restarted, forked, or renamed across repos/eras, you'll extract each history
and merge them. The discipline, learned the hard way:

- **Same-design subsystems become one living node.** If a subsystem carried forward across the
  restart essentially unchanged, its facts from both eras **interleave chronologically** in one
  node — do not mirror the predecessor into `.alt/`.
- **Strip-and-restore is continuity with a gap, never a re-decision.** If the new codebase
  dropped a feature at its birth and brought it back later, that is the *same node*, not a
  drop-then-revive. The restart itself is a **root fact**, not a Move.
- **No false fork at the root.** Do not park the entire predecessor era in a root-level `.alt/`
  as if the project chose the new codebase *over* the old one — they are one continuous project.
  (This exact false fork was built and rejected twice on the reference project.)
- Only genuinely **re-decided** forms — where the new era made a different choice and the old
  one hit a wall — become flat `.alt/` siblings, with the why; un-recoverable whys are tagged
  `(uncertain)`.

### Stage 7 — Certify

Done means: `npx mcts-mem lint` is clean; the closure checks hold; every window audit and the
reduce audit are clean; every open unknown is either answered (with a `(code)`/`(sourced)` fact)
or honestly left `(uncertain)` — never guessed. Run a **final fresh certifier** over the strongest invariants — and note it audits the
*human's* touch-ups too: on the reference project the certifier caught a human observer's
"kind-laundering" edit (relabeling a fact's kind to slip a check). Correct data drawn to the
wrong conclusion, and a wrongly-relabeled fact, are both things only fresh adversarial eyes
catch.

# Part 4 — Recovery, and a note on the linter

**Recovery.** This is a long, interruption-prone job. Persist progress as **on-disk
per-window outputs plus an audit-state file** (window → status → source) — never an
orchestrator's in-memory journal, because concurrent stages interleave nondeterministically and
journal replay re-runs paid work. Resume by re-launching filtered to the unfinished windows
read straight off that file. **Chunk long sweeps** into several smaller runs so an interruption
loses little.

**The linter.** `npx mcts-mem lint` is the executable form of the format rules — run it like
recompiling, and fix until clean before calling any stage done. It mechanically enforces what
the prose above teaches: one top-level node; no orphan `.alt/`/`.fact/` folders; Items then
`## Facts` then `## Moves` and no other headings; every entry dated, labeled, and tagged with one
of `(code)`/`(sourced)`/`(uncertain)`; Moves only for boundary events, append-only, paired whys
verbatim; every `[[link]]` resolves; no node without a real alternative/fact/move (the "not a
module map" rule); items carry no rationale tails; one claim per entry; the tree never references
its own construction; and the closure checks. A clean lint proves the tree is *internally consistent* —
it does **not** prove your facts are *true*. That is the auditor's job, and yours. (One flag, used
only in Stage 1: `npx mcts-mem lint --skeleton` skips R-thin while the skeleton is pre-prune
scaffolding; every later stage and the finished tree lint *plain*.)

# When it is done

- The tree is at `mcts_mem/<project>/` with root `mcts_mem/<project>.md`; nothing else lives in
  `mcts_mem/`.
- `npx mcts-mem lint` is clean; closure and audits hold.
- Every open unknown is answered or honestly marked `(uncertain)`.
- Tell the project to keep it alive: from now on, anyone planning a change consults the tree
  first and records re-decisions into it as they happen (the `mcts-mem-use` skill). A tree
  nobody maintains goes stale, and a stale tree misleads — which is worse than no tree at all.
