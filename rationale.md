# The idea behind MCTS-Mem

This is the *why* behind the format. It is not needed to use MCTS-Mem — the skills are
self-contained — but it explains where the shape came from, why it differs from the tools you already have,
and what it can and cannot do. It is written for a human deciding whether to trust or
extend the approach.

## The premise: a project is a search, and almost nobody records it

Building a system is a search over a space of possible designs. You pick an approach,
implement enough to learn something, and what you learn reshapes where you look next.
Traditional software engineering runs *very few* of these searches, because a single
"rollout" — actually building the thing — is enormously expensive. So the solution space
stays vastly under-explored, and the scarce, valuable skill is generalizing well from a
handful of expensive samples. That is what a good architect does, and the knowledge they
build doing it is the most valuable and most perishable thing a project has: it lives in
heads and in chat logs that evaporate.

MCTS-Mem is a place to record that search so it compounds instead of evaporating — the
branches taken and abandoned, and the evidence on each.

## The framing: Monte Carlo Tree Search with expensive rollouts

The model is an MCTS over the solution space:

- **Options** are points in the space — candidate choices.
- **A decision** is choosing an option; the current design is a **traversal** of chosen
  options, not a single path (independent sub-problems branch in parallel).
- **A rollout is building and measuring** — *faithfully*. A faithful attempt produces a
  **fact** whatever happens: a benchmark, a bug, "it compiles", "it regressed 8%", or "it
  can't be built at all under these constraints." Only a faithful attempt is a valid
  rollout; code that deviated from the design by error is a harness defect, not data.
- **Facts re-weight options**, which changes which traversal is best, which changes what
  you build next.

The one fact that defines everything: **in classic MCTS rollouts are cheap and you do
millions; here a rollout is building software and is catastrophically expensive.** You can
never cover the space by brute force, so the engine is **value estimation, not search
volume** — predicting an option's worth cheaply enough that you rarely pay for a full
rollout. This is the AlphaGo→AlphaZero move: replace random rollouts with a learned value
function. **The accumulated fact-base is that value function.** Anyone who treats this as
cheap board-game MCTS will design the wrong thing.

Why this can work now, when 1980s–90s design-rationale systems (IBIS, QOC, DRL) were
abandoned: those failed on **capture cost without immediate benefit** and **premature
formalization** — recording the rationale was a chore that paid off only for someone else,
later. The fix that worked back then was a trained human *facilitator* who structured the
record live, so capture bought immediate value. An LLM is that facilitator, always
available: it can propose options, run rollouts, and record facts continuously. That is
the single change that makes the old idea viable — and it does not repeal the two rules the
field learned: **incremental formalization** (a note is valid as prose first; structure is
added only as it stabilizes) and **facts, not arguments** (a fact is a grounded observation
with provenance; an argument dressed as a fact is the confirmation-bias trap).

## What actually ships

The model above is realized as a plain tree of Markdown files — deliberately the part the
90s systems got right by accident: a medium that is cheap to write, cheap to review, and
diffs cleanly, or it rots. The grammar lives in the skills; in brief:

- The **filesystem is the tree**; one node per real *decision*, never per module. Ignore
  every `.alt/` folder and the main tree is the current design.
- A node's **rejected alternatives and superseded forms** sit in a sibling `.alt/` folder,
  frozen with the reason each lost — so walking into `.alt/` walks back through what was
  tried. A dead end is kept, not deleted, so it can be reclaimed if the reason it died ever
  lapses.
- A node's **evidence** is its dated `## Facts` (graduating to `.fact/` files when a
  measurement table or recovered document has real body) and its `## Moves` (the
  re-decisions, with the winning/losing reason copied verbatim on both sides so the two
  halves can never disagree).
- Every fact and move is **tagged by what could prove it wrong**: `(code)` (checkable
  against the code), `(sourced)` (a human record — commit message, doc, paper, chat log,
  author), or `(uncertain)` (the agent's own reading of intent, backed by nothing). That
  tag is the honest confidence signal, and an inference is never anything better than
  `(uncertain)`.
- A **linter** enforces all of this mechanically. It checks *consistency*, not truth — but
  a clean lint is to the tree what a passing compile is to code.

Code is downstream of the tree: it implements the current traversal, and the only alignment
that matters is whether it does so faithfully. A fork (a refactor) is an expansion-plus-
rollout from a node; it makes everything downstream of it *stale until re-verified*, because
a choice that was best under the old prefix may not be under the new one. Staleness is kept
cheap by good modular cuts (the blast radius stops at module boundaries) and by re-verifying
only as deeply as the change plausibly matters.

Two structural choices earn their keep. *Independent* sub-problems branch in parallel — a
three-stage pipeline opens three sibling sub-trees, each reasoned about in isolation — while
genuine *alternatives* are the OR-branches that end up in `.alt/`. That parallel split is just
modular decomposition, and it is itself a decision: a bad cut that separates two coupled things
surfaces later as a fact ("these 'independent' modules keep changing together") that forces a
re-cut. And the ontology is deliberately **minimal** — decisions, their evidence, and a root,
nothing else; the pull to add node types (a "goal" type, a "question" type) is strong and should
be resisted, because every richer ontology tried here proved worse.

## Why not the tools you already have

The reasoning behind a design *can* be written with tools every team has — and usually is,
badly. What each misses is specific:

- **Commit history and changelogs** record *what* changed, in time order. You cannot follow
  them to "the decision about X and the alternatives it beat," and they never hold the road
  *not* taken — the branch deleted, the approach killed in a meeting. The reasoning that
  matters most is exactly what git does not capture.
- **ADRs (architecture decision records)** are the closest cousin: a decision, its context,
  its consequences. But they are a flat, append-only *list* you read by searching; nothing
  ties a decision to the rejected alternatives as a structure you can walk, nothing checks an
  ADR against the code so they rot silently, and they capture the *first* decision, not the
  re-decisions and measured reversals that accumulate over a system's life. MCTS-Mem keeps the
  superseded form beside the live one and lets a linter keep the two consistent.
- **A wiki or design docs** are prose that can hold contradictions no one ever finds. You
  retrieve a passage and cannot be sure it is complete, current, or consistent with what is
  filed elsewhere — so you decide on knowledge you only *probably* have.
- **RAG or embedding memory** over those same docs and chat logs can *recall* a passage but
  cannot guarantee the recalled set is complete or self-consistent: it returns what is
  *similar*, not the fact *contradicting* it two hops away. (MCTS-Mem's own fact-base may one
  day use retrieval — but over a structured, deduplicated, consistency-checked corpus, not a
  raw pile.)

The difference is a single property: **everything for a decision lives at one node, the
structure is the index, and a linter makes consistency a property of the artifact.** So what
you read is complete and current by construction — not a sample that might be missing the
contradicting fact you didn't think to search for. That is what lets you act on the memory with
confidence rather than a residue of doubt.

## When it's worth it

The cost is a one-time extraction plus light upkeep; the payoff is collected every time
someone — human or agent — avoids re-deriving a settled choice or reviving a measured dead end.
So it earns its keep on **long-lived systems that are rewritten and extended repeatedly,
high-stakes decisions where re-breaking a choice is expensive, and teams or agents that turn
over** (the reasoning would otherwise leave with them). It is *not* worth it for a throwaway,
for code that is almost entirely forced or spec-driven with few weighed alternatives, or
anywhere the upkeep discipline won't be kept — because a tree that has drifted out of sync
misleads, which is worse than no tree at all.

## The fact-base as a value function — shipped, and explored

What ships is the simple, durable core: evidence co-located with its decision, dated,
tagged, append-only, linter-checked. That is enough to *record* the search and to read it by
following structure.

What is **explored but not built** is the layer that would make the fact-base a true
*transferable value function* — retrieval that surfaces the right past evidence for a new,
surface-dissimilar situation (an ARM32 register-aliasing lesson surfacing for a new RISC-V
backend it shares no keywords with). The design studied for that, grounded in 2023–2026
agentic-memory / RAG work, is: store raw observations cheaply; expand a query into the
*mechanisms* it involves before retrieving (HyDE-style) so cross-mechanism transfer works;
recall generously and let an LLM judge filter at read time (visible-failure by design); and
run a periodic reflection pass that consolidates many specific instances into one class
memory. None of that is implemented — the shipped retrieval story is "follow the structure,
or grep" — and it is recorded here as the considered direction, not a promise. Heavy
machinery (full graph-RAG indexing, temporal knowledge-graph infrastructure) was judged
overkill at the scale a single project's memory reaches.

## Honest constraints

State these to anyone who builds on it:

- **Rollouts are expensive.** The near-term reality is a few costly rollouts steered by heavy
  human/AI value-estimation, not millions of cheap ones. The economics improve only as
  build-and-verify cost falls.
- **The action space is generative and unbounded.** Unlike Go, the options at a node are not
  enumerable — you can always invent a new one. The option-*proposer* is itself an AI
  component, and its quality is the ceiling on everything.
- **Facts go stale.** The solution space shifts as tools, models, and hardware change; "too
  slow to compile" becomes false when devices grow. Facts have a shelf life — date them. An
  explicit, dated fact is still better than tacit intuition: inspectable, not immune.
- **Abstraction is the bottleneck.** A mis-scoped or over-generalized lesson is worse than no
  lesson — it misleads every future search that retrieves it. Deciding *what a rollout
  actually teaches* is the highest-leverage, most human-shaped step.

## The human–AI division

- **AI may**: propose options, run rollouts, record facts with provenance, draft option
  weights, detect when code has diverged from the current design, and surface under-explored
  nodes.
- **The human must**: choose among high-level options, and — the irreplaceable part —
  **decide what a rollout means**: what it generalizes to and what it does not. The machine
  gathers experience; the human decides what it teaches. This gap is real and was witnessed
  during the model's own construction: an automated reviewer collected falsification data
  perfectly, then drew the wrong conclusion from the summary statistic. Correct data, wrong
  lesson. Closing that gap is the system's center of gravity, not a node type.
