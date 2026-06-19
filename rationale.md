# Rationale

The README explains how to read and use an MCTS-Mem tree. This file explains why the
tree has this shape.

The short version: a project is not only a codebase. It is the result of a search through
possible designs. Most of that search is lost. MCTS-Mem records it as a structured,
linted artifact so humans and agents can reuse the hard-won parts instead of rediscovering
them.

Another way to say this: software engineering is not only the act of producing code. It is
also the work of making acceptable programs cheaper to find and bad programs harder to
reach. MCTS-Mem is one artifact in that work: it records the constraints and dead ends
that were learned through previous search.

## A Project Is A Search

Building a system is a search over possible designs.

You choose an approach, implement enough of it to learn something, keep or reject it, and
let the result shape the next choice. Some branches become the current design. Some are
deleted. Some fail for reasons that only become obvious after a benchmark, a bug, a port,
or a failed rewrite.

The code remembers only the branch that survived. Git remembers changes in time order.
Design docs remember selected moments. The expensive knowledge is the search itself:

- what alternatives were considered
- what was tried seriously enough to produce evidence
- why a branch lost
- which facts supported the winner
- which facts are weak, stale, or uncertain

That knowledge usually lives in people, chats, abandoned branches, old benchmark notes, and
commit messages. MCTS-Mem gives it a place to live next to the project.

## Lowering Future Search Cost

An AI coding agent samples from a large space of possible changes. Better prompts and
larger context help it search, but the surrounding engineering environment matters just as
much. Type systems, tests, schemas, architecture rules, resource budgets, design systems,
and observability all reshape the space: they make some bad candidates impossible, some
bad candidates easy to reject, and some good candidates easier to recognize.

MCTS-Mem is weaker than a type system or a formal spec. It does not make a bad program
unrepresentable. Its job is different: it makes past search visible. It tells the next
human or agent which branches were already tried, why they lost, and which local
constraints mattered when the current design won.

That reduces future search cost. A future change does not start from "all plausible
implementations." It starts from a smaller, better-shaped space: current decisions, known
dead ends, sourced facts, uncertain assumptions, and the places where the design boundary
has already been fought over.

## What "MCTS" Means Here

MCTS-Mem does not run Monte Carlo Tree Search over your codebase. The name describes the
history being recorded.

The analogy is:

- **Options** are candidate design choices.
- **A decision** chooses one option at a point in the design.
- **The current project** is the set of choices that currently won, not one linear path.
- **A trial** is building, testing, measuring, or otherwise trying a design seriously
  enough to learn something. In MCTS terms, this is the rollout. In software terms, it is
  not deployment; it is the work done to test an option.
- **A fact** is what the trial taught.
- **A re-decision** happens when new facts change which option should win.

The most important difference from board-game MCTS is cost. In a game, rollouts are cheap
and you can run millions. In software, one serious trial can mean days of implementation,
a port to new hardware, a benchmark campaign, or a dead-end rewrite. You cannot brute-force
the design space.

That makes the accumulated fact-base valuable. It is not a magic value function, but it is
the best available estimate of which branches are promising and which branches already
cost the project enough to learn from.

## Why The Memory Is A Tree

The tree is organized by decisions because decisions are the unit you need when changing a
system.

If you are about to touch a cache, the useful question is not "what text matches cache?"
It is:

- what cache design currently won?
- what alternatives did it replace?
- what facts made the current design win?
- what assumptions are still uncertain?
- which more specific decisions sit underneath it?

A flat document, wiki, or embedding index can contain those answers, but it cannot make the
set of answers complete by shape. A tree can put the current choice, its rejected
alternatives, and its evidence at the same decision point.

The tree also keeps the two kinds of branching separate:

- **Child nodes** are refinement: decisions that only make sense under the parent decision.
  If the parent says "use a resource-keyed cache," children might decide invalidation
  policy, key encoding, and memory budget.
- **Sibling nodes** are neighboring decisions under the same parent. They should be mostly
  readable independently.
- **`.alt/` nodes** are alternatives to the node they sit beside. They lost, were replaced,
  or were removed.
- **`.fact/` files** are supporting evidence for one node. They are not decisions.

This distinction matters. A bad hierarchy lies about independence. If two sibling decisions
keep changing together, that is evidence that the cut was wrong and the tree should be
reorganized.

This is also why the tree is not organized primarily by files. Files are implementation
locations. A decision is a constraint on future search. Sometimes a decision maps neatly to
one file, but often it spans an interface, an invariant, a benchmark result, or a rejected
architecture. The tree follows the decision because that is what the next search needs.

## A Failure Case The Tree Avoids

Imagine a bug appears in cache invalidation. A search query for "stale endpoint cache" may
find an old note saying endpoint-local caches were fast. It may not find the later fact
that endpoint-local caches were abandoned because writes through another endpoint left
stale entries. The missing fact is not necessarily text-similar to the query.

In an MCTS-Mem tree, the live cache decision owns the rejected endpoint-local alternative
and the replacement reason. A reader following the decision reaches both the tempting old
branch and the reason it lost.

That is the main bet: for design memory, structure should do work that search alone cannot
reliably do.

## What Actually Ships

The shipped system is deliberately small:

- A memory is a directory of Markdown files.
- Each node is one decision.
- The main tree is the current design.
- Rejected and superseded alternatives sit in sibling `.alt/` directories.
- Larger supporting evidence can live in `.fact/` files.
- Facts and moves are dated and tagged with provenance.
- A CLI linter checks the grammar and internal consistency.
- Agent skills describe how to build and use the tree.

The CLI is intentionally modest:

```sh
npx mcts-mem view mcts_mem --alt --depth 2
npx mcts-mem show <node> mcts_mem
npx mcts-mem uncertain mcts_mem
npx mcts-mem lint mcts_mem
```

The format stays plain because a memory that is hard to review will rot. Markdown diffs,
simple paths, and small entries are boring on purpose.

## Provenance Is Part Of The Claim

Every fact and move ends with one of three tags:

- `(code)`: checkable against the current code
- `(sourced)`: backed by a human record, such as a commit, issue, doc, paper, chat log, or
  author statement
- `(uncertain)`: an inference with no stronger backing

The tag is not decoration. It is the honesty signal. A confident-sounding inference is
still `(uncertain)` if nothing can check it. A source can still be wrong, but at least the
reader knows what kind of claim they are looking at.

The record is append-only for the same reason. If a benchmark was wrong, the fix is not to
rewrite the old entry until history looks clean. The fix is to add the corrected fact and
make a new decision if the correction changes the outcome.

This is one way to turn implicit constraints into explicit ones. A senior engineer may
know that two modules must not couple, that an optimization was rejected because it broke a
port, or that a simple-looking cache design failed under invalidation. If that knowledge
exists only in memory or chat, an agent cannot reliably respect it. In MCTS-Mem, it becomes
a dated claim attached to the decision it constrains.

## What The Linter Checks

The linter checks structural consistency under the grammar. It does not check truth.

It can catch:

- a link to a node that does not exist
- a replacement whose opposite side is missing
- a replacement pair whose reasons drifted apart
- a fact or move with no provenance tag
- committed Facts or Moves that were edited or removed instead of corrected append-only
- empty nodes that describe module shape without recording a decision

It cannot tell you whether a benchmark was run correctly, whether a source is stale, or
whether an author drew the right lesson from a failure. That remains engineering judgment.

For append-only history, lint uses git when available: committed Facts and Moves are
compared against `HEAD`, while new entries are allowed. An intentional format migration
should be committed as the new baseline.

The value is narrower and still useful: the record is auditable, old claims remain visible,
and contradictions in the structure do not quietly accumulate.

## Why Not Git, ADRs, Wikis, Or RAG

These tools are useful. MCTS-Mem is aimed at a gap between them.

**Git** records what changed and when. It is bad at preserving the road not taken. Deleted
branches, failed prototypes, and meeting decisions disappear unless someone records them
elsewhere.

**ADRs** are the closest relative. They record decisions, context, and consequences. The
problem is that ADRs are usually a flat chronological list. They are good for the first
decision and weaker for the tenth re-decision, the superseded alternative, and the measured
reason the old branch should stay dead.

**Wikis and design docs** can hold all the prose, but prose drifts. Two pages can disagree
for months without any mechanical signal.

**RAG and embedding memory** can retrieve relevant text. Retrieval is not the same thing
as a complete decision record. It can return the passage most similar to your query while
missing the contradictory fact filed under different words.

MCTS-Mem can still use those sources. It folds their useful claims into a structured record
where each decision owns its evidence and alternatives.

## Why Now

Design-rationale systems are not new. Older systems such as IBIS, QOC, and DRL already
understood that decisions, options, and arguments matter. Many failed in practice because
capture cost was high and the benefit arrived too late. Recording rationale became extra
work for someone else in the future.

The working environment has changed. Coding agents can read history, propose structure,
draft entries, run checks, and keep the tree updated while doing engineering work. That
makes the memory cheaper to capture at the moment it is useful.

This does not remove the old lessons:

- Start with useful prose; formalize incrementally.
- Record facts, not arguments disguised as facts.
- Keep provenance visible.
- Let humans decide what a result means when the abstraction is hard.

The agent can help capture and maintain the tree. It should not be trusted to invent the
meaning of a hard result without review.

## How Code And Memory Stay Aligned

For design intent, code is downstream of the tree. The tree records what the project
currently believes the design is; the code is one implementation of that design.

When code changes in a way that changes a decision, the tree should change too. That does
not mean every small patch needs a ceremony. It means a non-trivial refactor, rewrite,
performance reversal, API boundary change, or revived old approach should leave a move in
the memory.

A fork from an old node makes downstream assumptions suspect until checked. Good module
boundaries reduce that blast radius. Bad boundaries show up as facts: decisions that were
supposed to be independent keep changing together.

This does not mean code stops mattering. The running implementation is still the final
artifact that users experience. But for AI-assisted maintenance, source code is often not
enough as the highest-level source of truth. Intent, constraints, evals, budgets, policies,
and design history may need to live in artifacts that guide generation and review. MCTS-Mem
is one source-of-truth artifact for that layer: why the design got this way.

## What Is Explored But Not Shipped

The shipped retrieval model is simple: follow the structure, use the CLI views, or grep.

There is a larger idea behind the project: a mature fact-base could become a transferable
value function for future design work. A lesson learned in one subsystem might help a
different subsystem that shares the same mechanism but none of the same keywords.

That would likely need retrieval over mechanisms, not just text similarity; broad recall
followed by judgment; and periodic consolidation from specific facts into reusable class
memories. Those ideas are not part of the current tool. They are research direction, not a
promise.

## When It Is Worth It

MCTS-Mem is most useful for:

- long-lived systems
- projects with repeated rewrites or ports
- performance-sensitive or high-stakes design choices
- teams where knowledge leaves with people
- codebases maintained by agents that need context before acting

It is probably not worth it for:

- throwaway projects
- code that is almost entirely forced by a spec
- teams that will not keep the tree current
- decisions with no meaningful alternatives

A stale tree is worse than no tree because it gives false confidence. The linter helps with
structure, but upkeep is still a discipline.

## The Human-AI Split

AI can help with the mechanical and archival work:

- find relevant commits and docs
- propose candidate nodes and alternatives
- draft facts with provenance
- run lint
- notice when code changed a recorded decision
- surface uncertain entries that need review

Humans are still responsible for the hard part: deciding what a result teaches. A benchmark
can be real and still be interpreted too broadly. A failed prototype can reject one design
or merely expose a flawed implementation. The system is useful only if those distinctions
remain visible.

## Bottom Line

MCTS-Mem treats design history as a first-class artifact. It does not claim that structure
solves judgment. It claims that judgment gets better when the old decisions, old
alternatives, and old evidence are still there, attached to the place where they matter,
and checked well enough that the record cannot quietly contradict itself.

It makes the next search cheaper by preserving the parts of the space the project already
paid to explore, including the parts it learned to avoid.
