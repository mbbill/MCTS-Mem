# MCTS-Mem

Projects forget why the code is the way it is.

MCTS-Mem records that missing layer as a decision tree. The main tree is the design that
currently won. Rejected or superseded designs stay beside it in `.alt/` folders. Facts
and re-decisions are dated, tagged with provenance, and checked by a linter.

It does not replace code, git, or design docs. It keeps the reasoning that usually falls
between them: what was tried, what failed, what evidence mattered, and which old branch
should not be revived unless its old reason has changed.

It does not generate code. It narrows future work by making old constraints, failed
branches, and decision boundaries explicit.

## The Claims

- The current code is only the surviving branch, not the whole design history.
- Project memory should be organized around decisions, not around time, files, or search
  keywords.
- Rejected alternatives matter. A dead end can be more valuable than the winning branch if
  it stops the team from paying for the same lesson twice.
- Unrecorded design intent becomes debt: the project relies on a rule, but no durable
  artifact tells a future human or agent to respect it.
- The record should be mechanically checkable. A linter cannot prove a benchmark or source
  is true, but it can check links, replacement pairs, provenance tags, entry shape, and
  append-only history.
- Agents need an explicit record because they do not carry the team's tacit context. Before
  an agent changes a project, it needs a way to read the decisions that shaped the area it
  is about to touch.

## Why "MCTS"?

MCTS-Mem does not run Monte Carlo Tree Search over your codebase.

The name describes the history being recorded. Building software often works like an
expensive search: try a design, learn from it, keep or reject it, then let that result
shape the next branch. MCTS-Mem records that search after it happens: the chosen branch,
the abandoned branches, and the facts that changed the choice.

For the longer argument, see [`rationale.md`](rationale.md).

## Concepts

An MCTS-Mem tree is a directory of Markdown files. The shape is the model:

- **Node**: one design decision. A node is not a module summary unless the module boundary
  itself was the decision.
- **Child node**: a more specific decision made under a parent decision. For example, a
  cache node might have child nodes for invalidation, memory budget, and key format.
- **Sibling node**: another decision under the same parent. Siblings should be decisions
  that can mostly be read independently.
- **Main tree**: the current design. If you ignore every `.alt/` directory, you are looking
  at what the project currently believes.
- **`.alt/` directory**: rejected, replaced, or superseded alternatives for a node. These
  are kept because the reason they lost may matter later.
- **`.fact/` directory**: larger supporting evidence for a node, such as a recovered design
  note or benchmark summary.
- **Facts**: dated observations that changed or support a decision.
- **Moves**: dated decision changes: replaced, replaced by, revived, removed.
- **Provenance tags**: every fact and move ends in `(code)`, `(sourced)`, or `(uncertain)`.
  The tag says what could check or falsify the claim.
- **Lint**: `npx mcts-mem lint <path>` checks the tree grammar and internal consistency.

The intended reading style is structural. You do not ask "what text matches this topic?"
first. You find the decision node, then read its facts, moves, child decisions, and
alternatives.

## A Small Example

This is not from a real project. It shows the shape.

Suppose a service once cached each endpoint separately, then moved to one resource-keyed
cache because invalidation kept leaking through endpoint-specific behavior.

The tree might contain:

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

The live decision:

```text
mcts_mem/service/request-cache.md
```

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

The rejected alternative:

```text
mcts_mem/service/request-cache.alt/per-endpoint-cache.md
```

```md
- Each endpoint owns its own response cache and invalidates it from endpoint handlers.

## Moves

- 2024-05-03 replaced by [[request-cache]]: per-endpoint caches made invalidation depend
  on endpoint-specific behavior; a resource-keyed cache keeps invalidation at the data
  boundary, even though it gives up a few hit-path shortcuts (sourced).
```

The mechanics are the point:

- The current design is easy to read without losing the old one.
- The losing branch is not deleted, so a future change can inspect why it lost.
- The replacement reason is copied on both sides, so lint can catch drift.
- The fact is dated and tagged, so a later reader knows what kind of evidence it was.

If the benchmark was later found to be wrong, you would not edit it away. You would add a
new dated fact, then re-decide from the corrected record.

## Quickstart

For a repository that already has `mcts_mem/`:

```sh
npx mcts-mem view mcts_mem --depth 2
npx mcts-mem view mcts_mem --alt --depth 2
npx mcts-mem show request-cache mcts_mem
npx mcts-mem uncertain mcts_mem
npx mcts-mem lint mcts_mem
```

Use `view` to scan the tree, `show` to read one decision in full, `uncertain` to find
entries that still need better evidence, and `lint` after any edit.

For a repository without a tree, use the `mcts-mem-build` skill to reconstruct the first
version from git history, design docs, old branches, and author input. The skills are
installed below. After that, use `mcts-mem-use` before non-trivial changes so the agent
reads the relevant decisions and updates the tree when a decision changes.

The build/use workflows are agent skills, not CLI subcommands. The CLI handles inspection
and linting; the skills tell an agent how to build and maintain the tree.

You can create a tree manually, but the build skill is the safer path for an existing
project because the hard part is not making files; it is reconstructing what the old
decisions meant. For a manual experiment, keep exactly one top-level node under
`mcts_mem/`, make each file one decision, put rejected alternatives in `.alt/`, and run
`npx mcts-mem lint mcts_mem` early.

When updating a decision by hand:

1. Find or create the node for the decision.
2. Add dated Facts for new evidence.
3. If the decision replaced an older design, move or create the older design under the
   node's `.alt/` directory.
4. Add matching `replaced [[old]]:` and `replaced by [[new]]:` Moves with the same reason.
5. Run `npx mcts-mem lint mcts_mem`.

## What Lint Checks

`npx mcts-mem lint <path-to-mcts_mem>` checks consistency, not truth.

It currently checks that:

- cross-references resolve to real nodes
- replacement pairs agree on the same reason
- committed Facts and Moves were not edited or removed instead of corrected append-only
- Facts and Moves carry provenance tags
- entries use the expected shape
- `.alt/` members end as replaced, removed, or otherwise frozen
- finished trees do not contain files that only name a component without recording a
  decision, fact, alternative, or child decision

The compact entry shape is:

```md
- YYYY-MM-DD kind: claim (code).
- YYYY-MM-DD kind: claim (sourced).
- YYYY-MM-DD kind: claim (uncertain).
- YYYY-MM-DD (abc12345) replaced [[old-node]]: reason (code).
- YYYY-MM-DD (abc12345) replaced by [[new-node]]: same reason (code).
```

The commit hash is optional, but if present it is eight hex characters. Move entries use
one of the boundary verbs the linter recognizes: `replaced`, `replaced by`, `dropped`,
`removed`, or `revived`. For Facts, `kind` is a free-form lowercase label such as
`benchmark`, `rationale`, `pitfall`, or `statement`.

Append-only checking is based on git. When the tree is inside a git repository, lint
compares committed Facts and Moves against `HEAD`; new entries are allowed, but committed
entries should not be edited or removed. If you intentionally migrate the tree format in
bulk, commit that migration so `HEAD` becomes the new baseline.

A clean lint means the tree is structurally sound under these rules. It does not mean every
measurement, source, or inference is correct. Lint cannot catch a bad benchmark method, a
stale source, or a wrong human interpretation. The value is that uncertainty is visible and
the record can be corrected without erasing what was believed before.

## Installation

There is no global CLI install step. Run the CLI with `npx`:

```sh
npx mcts-mem --help
```

The memory workflow itself lives in two agent skills:

- `skills/mcts-mem-build/SKILL.md`
- `skills/mcts-mem-use/SKILL.md`

Ask your coding agent to install them:

> Install the MCTS-Mem skills. Fetch these two files from
> https://github.com/mbbill/MCTS-Mem: `skills/mcts-mem-build/SKILL.md` and
> `skills/mcts-mem-use/SKILL.md`. Save each one into the agent's skills directory,
> preserving the folder names `mcts-mem-build/` and `mcts-mem-use/`.

Manual install is also fine: copy the two folders under `skills/` into your agent's
skills directory. For Claude Code, that can be `~/.claude/skills/` for personal skills or
`.claude/skills/` for project-local skills.

The skills use the open [Agent Skills](https://agentskills.io) format, so the same files
can be used by agents that support that format.

## Further Reading

[`rationale.md`](rationale.md) is the longer argument: why project history looks like a
search, how MCTS-Mem lowers future change cost, why this is not just ADRs plus retrieval,
where the MCTS analogy helps, and where it stops.
