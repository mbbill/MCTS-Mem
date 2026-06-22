// Tests for the STRUCTURAL lint rules of the mcts-mem CLI:
//   R-root, R-orphan, R-empty, R-altnest, R-title, R-sections, R-items, R-tail
//
// Strategy: start from the lint-clean tree (validFiles()) and perturb exactly
// ONE thing per case, so we know which rule must fire. For every rule we assert
// BOTH directions: it fires on the bad input AND it does NOT false-positive on
// the good input. We prefer lintFiles() for precise per-rule assertions and use
// runCli() for end-to-end exit-code / output behavior.
//
// These assertions encode the INTENDED behavior from skills/mcts-mem-use/SKILL.md
// ("The grammar in full"), not merely whatever the code happens to do.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as h from './helpers.js';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

// count how many of the reported violations carry a given rule id
const count = (r, rule) => r.rules.filter((x) => x === rule).length;
// did this rule fire at all?
const fired = (r, rule) => r.rules.includes(rule);
// the set of distinct rules that fired (handy for "ONLY this rule" assertions)
const distinct = (r) => [...new Set(r.rules)].sort();

// Assert that `rule` fired and that NO OTHER rule fired. This is the core
// "perturb exactly one thing" contract: the change must be attributable to one
// rule and must not collaterally trip an unrelated one.
function onlyRule(r, rule) {
  assert.ok(fired(r, rule), `expected ${rule} to fire; got ${JSON.stringify(r.rules)}`);
  const others = distinct(r).filter((x) => x !== rule);
  assert.deepEqual(others, [], `expected only ${rule}; also got ${JSON.stringify(others)}`);
}

// Minimal single-node tree (one clean root) for rules that don't need the full
// .alt/.fact scaffolding. Uses --skeleton in callers when there are no facts.
const ITEM = (body, anchor = 'X') => `- ${body} (\`${anchor}\`).\n`;
const FACT = `- 2031-01-01 (00000001) statement: the store is append-only (code).\n`;
const cleanRoot = (items = ITEM('A stores one value per key')) =>
  `${items}\n## Facts\n\n${FACT}`;

// ===========================================================================
// Baseline: the canonical valid tree lints clean (no false positives at all).
// ===========================================================================

test('baseline: validFiles() lints completely clean', async () => {
  const r = await h.lintFiles(h.validFiles());
  assert.deepEqual(r.rules, [], `valid tree should produce no violations; got ${JSON.stringify(r.errors)}`);
  assert.equal(r.nodeCount, 3);
  assert.equal(r.factCount, 1);
});

test('baseline: validFiles() lints clean end-to-end via the CLI (exit 0)', () => {
  const t = h.tmpTree(h.validFiles());
  try {
    const r = h.runCli(['lint', t.root]);
    assert.equal(r.code, 0, `stderr: ${r.stderr}`);
    assert.match(r.stdout, /lint clean: 3 nodes, 1 fact files/);
  } finally {
    t.cleanup();
  }
});

// ===========================================================================
// R-root — exactly one top-level node directly under the tree root.
// ===========================================================================

test('R-root: the valid tree has exactly one top node (no R-root)', async () => {
  const r = await h.lintFiles(h.validFiles());
  assert.ok(!fired(r, 'R-root'));
});

test('R-root: two top-level node files fire R-root (and nothing structural-root else)', async () => {
  const r = await h.lintFiles({
    'a.md': cleanRoot(ITEM('Node A', 'A')),
    'b.md': cleanRoot(ITEM('Node B', 'B')),
  });
  onlyRule(r, 'R-root');
  const msg = r.errors.find((e) => e.rule === 'R-root').msg;
  assert.match(msg, /found 2/);
  assert.match(msg, /a\.md/);
  assert.match(msg, /b\.md/);
});

test('R-root: zero top-level node files fire R-root', async () => {
  // every node lives under a subdir; the root dir itself holds no .md
  const r = await h.lintFiles({
    'sub/a.md': cleanRoot(ITEM('Buried node', 'A')),
  });
  assert.ok(fired(r, 'R-root'));
  assert.match(r.errors.find((e) => e.rule === 'R-root').msg, /found 0/);
});

test('R-root: three top-level node files report count 3', async () => {
  const r = await h.lintFiles({
    'a.md': cleanRoot(ITEM('A', 'A')),
    'b.md': cleanRoot(ITEM('B', 'B')),
    'c.md': cleanRoot(ITEM('C', 'C')),
  });
  assert.ok(fired(r, 'R-root'));
  assert.match(r.errors.find((e) => e.rule === 'R-root').msg, /found 3/);
});

test('R-root: child nodes under <name>/ do NOT count as top-level', async () => {
  // root a.md + a child under a/ — exactly one top node, so no R-root.
  const r = await h.lintFiles({
    'a.md': cleanRoot(ITEM('Root', 'A')),
    'a/child.md': cleanRoot(ITEM('Child', 'C')),
  });
  assert.ok(!fired(r, 'R-root'), `unexpected: ${JSON.stringify(r.errors)}`);
});

// ===========================================================================
// R-orphan — a X/, X.alt/, or X.fact/ directory needs a sibling X.md.
// ===========================================================================

test('R-orphan: valid tree has every dir backed by a sibling .md (no R-orphan)', async () => {
  const r = await h.lintFiles(h.validFiles());
  assert.ok(!fired(r, 'R-orphan'));
});

test('R-orphan: a plain subtree dir <name>/ with no <name>.md fires R-orphan', async () => {
  const r = await h.lintFiles({
    'a.md': cleanRoot(ITEM('Root', 'A')),
    // dir "b/" exists (holds a node) but there is no sibling b.md
    'b/child.md': cleanRoot(ITEM('Child', 'C')),
  });
  assert.ok(fired(r, 'R-orphan'));
  const orphan = r.errors.find((e) => e.rule === 'R-orphan');
  assert.match(orphan.path, /\bb$/);
  assert.match(orphan.msg, /no sibling b\.md/);
});

test('R-orphan: an .alt/ dir with no base <name>.md sibling fires R-orphan', async () => {
  const r = await h.lintFiles({
    'a.md': cleanRoot(ITEM('Root', 'A')),
    // foo.alt/ has a member but there is no foo.md
    'foo.alt/old.md': `${ITEM('Old form', 'O')}\n## Moves\n\n- 2031-01-01 (00000001) replaced by [[a]]: it lost (code).\n`,
  });
  assert.ok(fired(r, 'R-orphan'));
  assert.ok(r.errors.some((e) => e.rule === 'R-orphan' && /foo\.alt/.test(e.path) && /no sibling foo\.md/.test(e.msg)));
});

test('R-orphan: a .fact/ dir with no base <name>.md sibling fires R-orphan', async () => {
  const r = await h.lintFiles({
    'a.md': cleanRoot(ITEM('Root', 'A')),
    'bar.fact/note.md': 'just prose, no headings\n',
  });
  assert.ok(fired(r, 'R-orphan'));
  assert.ok(r.errors.some((e) => e.rule === 'R-orphan' && /bar\.fact/.test(e.path) && /no sibling bar\.md/.test(e.msg)));
});

test('R-orphan: removing a backing node MD orphans BOTH its .alt/ and .fact/ dirs', async () => {
  const v = h.validFiles();
  delete v['acorn/page-cache.md']; // leaves page-cache.alt/ and page-cache.fact/ stranded
  const r = await h.lintFiles(v);
  const orphanPaths = r.errors.filter((e) => e.rule === 'R-orphan').map((e) => e.path).sort();
  assert.equal(orphanPaths.length, 2, `expected 2 orphans; got ${JSON.stringify(orphanPaths)}`);
  assert.ok(orphanPaths.some((p) => p.endsWith('page-cache.alt')));
  assert.ok(orphanPaths.some((p) => p.endsWith('page-cache.fact')));
});

// ===========================================================================
// R-empty — an .alt/ or .fact/ directory with no .md inside.
//           (A plain <name>/ subtree dir does NOT trigger R-empty.)
// ===========================================================================

test('R-empty: valid tree has populated .alt/.fact dirs (no R-empty)', async () => {
  const r = await h.lintFiles(h.validFiles());
  assert.ok(!fired(r, 'R-empty'));
});

test('R-empty: an .alt/ dir with a sibling but no .md inside fires R-empty (only)', async () => {
  const r = await h.lintFiles({
    'a.md': cleanRoot(ITEM('Root', 'A')),
    'a.alt/.keep': 'not markdown\n', // sibling a.md exists, but the dir holds no node
  });
  onlyRule(r, 'R-empty');
  assert.match(r.errors.find((e) => e.rule === 'R-empty').path, /a\.alt$/);
});

test('R-empty: an empty .fact/ dir (sibling present, no .md) fires R-empty (only)', async () => {
  const r = await h.lintFiles({
    'a.md': cleanRoot(ITEM('Root', 'A')),
    'a.fact/readme.txt': 'evidence body but wrong extension\n',
  });
  onlyRule(r, 'R-empty');
  assert.match(r.errors.find((e) => e.rule === 'R-empty').path, /a\.fact$/);
});

test('R-empty: a plain <name>/ subtree dir with no .md does NOT fire R-empty', async () => {
  const r = await h.lintFiles({
    'a.md': cleanRoot(ITEM('Root', 'A')),
    'a/.keep': 'x\n', // a/ exists with a sibling a.md, no .md child — but it is not .alt/.fact
  });
  assert.ok(!fired(r, 'R-empty'), `R-empty should be reserved for .alt/.fact dirs; got ${JSON.stringify(r.errors)}`);
});

test('R-empty: an .alt/ dir that DOES contain a .md does not fire R-empty', async () => {
  const r = await h.lintFiles({
    'a.md': cleanRoot(ITEM('Root', 'A')),
    'a.alt/old.md': `${ITEM('Old', 'O')}\n## Moves\n\n- 2031-01-01 (00000001) replaced by [[a]]: lost (code).\n`,
  });
  assert.ok(!fired(r, 'R-empty'));
});

// ===========================================================================
// R-altnest — an .alt member must not have its own .alt/. Alternatives are
// rivals for ONE decision (a flat set under the live node); a supersession
// chain flattens to siblings, with the lineage carried by the paired Moves.
// ===========================================================================

// validFiles() has a flat page-cache.alt/write-through.md — give write-through
// its OWN alt (disk-log) and the .alt/ nests, which is what R-altnest forbids.
function nestedAltFiles() {
  const f = h.validFiles();
  f['acorn/page-cache.alt/write-through.md'] =
`- Every mutation writes its page to disk before returning.

## Moves

- 2031-03-01 (aa11bb22) replaced [[disk-log]]: the append-only disk log forced a sequential scan on every read (code).

- 2031-04-02 (ab12cd34) replaced by [[page-cache]]: write-through stalled every mutation on disk latency; batching at eviction removed the stall (code).
`;
  f['acorn/page-cache.alt/write-through.alt/disk-log.md'] =
`- Mutations append to a single on-disk log; reads scan the whole log.

## Moves

- 2031-03-01 (aa11bb22) replaced by [[write-through]]: the append-only disk log forced a sequential scan on every read (code).
`;
  return f;
}

test('R-altnest: the flat valid tree does not fire R-altnest', async () => {
  const r = await h.lintFiles(h.validFiles());
  assert.ok(!fired(r, 'R-altnest'));
});

test('R-altnest: an .alt member with its own .alt/ fires R-altnest (only)', async () => {
  const r = await h.lintFiles(nestedAltFiles());
  onlyRule(r, 'R-altnest');
  assert.match(r.errors.find((e) => e.rule === 'R-altnest').path, /write-through\.alt$/);
});

test('R-altnest: a child of an .alt member MAY have its own .alt/ (rejected branch keeps its design)', async () => {
  // page-cache.alt/write-through (alt member) has a child `flush`, and flush has
  // its own alternative — that is the internal design of a rejected branch, not
  // a nested rival, so R-altnest must NOT fire on it.
  const f = h.validFiles();
  f['acorn/page-cache.alt/write-through/flush.md'] =
`- Dirty pages flush on a fixed interval.

## Moves

- 2031-03-05 (cc33dd44) replaced [[flush-on-write]]: per-write flushing serialized the hot path (code).
`;
  f['acorn/page-cache.alt/write-through/flush.alt/flush-on-write.md'] =
`- Each write flushes its own page immediately.

## Moves

- 2031-03-05 (cc33dd44) replaced by [[flush]]: per-write flushing serialized the hot path (code).
`;
  const r = await h.lintFiles(f);
  assert.ok(!fired(r, 'R-altnest'), `R-altnest is for nested rivals, not a rejected branch's own design; got ${JSON.stringify(r.errors)}`);
});

// ===========================================================================
// R-title — a node file must start with an Item bullet, not a heading.
// ===========================================================================

test('R-title: valid root starts with an item, not a heading (no R-title)', async () => {
  const r = await h.lintFiles(h.validFiles());
  assert.ok(!fired(r, 'R-title'));
});

test('R-title: a leading "# Title" heading fires R-title', async () => {
  const r = await h.lintFiles({
    'a.md': `# Acorn\n\n${ITEM('A stores values', 'A')}\n## Facts\n\n${FACT}`,
  });
  assert.ok(fired(r, 'R-title'));
});

test('R-title: a leading "## Facts" (any heading first) fires R-title', async () => {
  // first non-blank line is a heading → R-title; nothing precedes the section.
  const r = await h.lintFiles({
    'a.md': `## Facts\n\n${FACT}`,
  }, { skeleton: true });
  assert.ok(fired(r, 'R-title'));
});

test('R-title: blank lines before the first item do not trip R-title', async () => {
  // leading blank lines, then an item — first NON-blank line is the bullet.
  const r = await h.lintFiles({
    'a.md': `\n\n${ITEM('A stores values', 'A')}\n## Facts\n\n${FACT}`,
  });
  assert.ok(!fired(r, 'R-title'), `leading blank lines are fine; got ${JSON.stringify(r.errors)}`);
});

test('R-title: an item beginning with "#" content (in a code span) does not false-positive', async () => {
  // The item text legitimately mentions a "#" — but the LINE starts with "- ",
  // so R-title (which checks the first char of the first non-blank line) must not fire.
  const r = await h.lintFiles({
    'a.md': `- The directive uses a leading \`#\` marker (\`X\`).\n\n## Facts\n\n${FACT}`,
  });
  assert.ok(!fired(r, 'R-title'));
});

// ===========================================================================
// R-sections — only "## Facts" then "## Moves"; correct order; nothing else.
// ===========================================================================

test('R-sections: valid Facts-then-Moves node is accepted (no R-sections)', async () => {
  const r = await h.lintFiles(h.validFiles());
  assert.ok(!fired(r, 'R-sections'));
});

test('R-sections: an items-only node (no headings) is accepted under --skeleton', async () => {
  const r = await h.lintFiles({
    'a.md': `${ITEM('Item one', 'X')}- Item two.\n`,
  }, { skeleton: true });
  assert.ok(!fired(r, 'R-sections'), `no headings is legal; got ${JSON.stringify(r.errors)}`);
});

test('R-sections: a Facts-only node is accepted (no R-sections)', async () => {
  const r = await h.lintFiles({
    'a.md': cleanRoot(),
  });
  assert.ok(!fired(r, 'R-sections'));
});

test('R-sections: a Moves-only node is accepted (no R-sections)', async () => {
  const r = await h.lintFiles({
    'a.md': `${ITEM('Root', 'A')}\n## Moves\n\n- 2031-01-01 (00000001) dropped: feature: it lost (code).\n`,
  });
  assert.ok(!fired(r, 'R-sections'), `Moves-only is legal; got ${JSON.stringify(r.errors)}`);
});

test('R-sections: Moves before Facts fires R-sections (out of order)', async () => {
  const r = await h.lintFiles({
    'a.md': `${ITEM('Root', 'A')}\n## Moves\n\n- 2031-01-01 (00000001) dropped: feature: it lost (code).\n\n## Facts\n\n${FACT}`,
  });
  onlyRule(r, 'R-sections');
  assert.ok(r.errors.some((e) => /out of order/.test(e.msg)));
});

test('R-sections: an unknown heading (## Notes) fires R-sections', async () => {
  const r = await h.lintFiles({
    'a.md': `${ITEM('Root', 'A')}\n## Facts\n\n${FACT}\n## Notes\n\n- 2031-01-01 statement: x (code).\n`,
  });
  assert.ok(fired(r, 'R-sections'));
  assert.ok(r.errors.some((e) => e.rule === 'R-sections' && /unexpected heading/.test(e.msg) && /Notes/.test(e.msg)));
});

test('R-sections: a sub-heading (### Detail) under a section is rejected', async () => {
  const r = await h.lintFiles({
    'a.md': `${ITEM('Root', 'A')}\n## Facts\n\n${FACT}\n### Detail\n\nmore\n`,
  });
  assert.ok(fired(r, 'R-sections'));
  assert.ok(r.errors.some((e) => e.rule === 'R-sections' && /### Detail/.test(e.msg)));
});

test('R-sections: a duplicate "## Facts" heading fires R-sections (out of order)', async () => {
  // Two Facts headings: seq=[Facts,Facts] but the allowed-ordered projection is
  // also [Facts,Facts] (both are in `allowed`)... assert intended behavior: a
  // repeated section is not the canonical [Facts] / [Facts,Moves] shape.
  const r = await h.lintFiles({
    'a.md': `${ITEM('Root', 'A')}\n## Facts\n\n${FACT}\n## Facts\n\n- 2031-01-02 statement: y (code).\n`,
  });
  assert.ok(fired(r, 'R-sections'), `two Facts sections should be rejected; got ${JSON.stringify(r.errors)}`);
});

// ===========================================================================
// R-items — every paragraph in the Items section must start with "- ".
// ===========================================================================

test('R-items: valid items all start with "- " (no R-items)', async () => {
  const r = await h.lintFiles(h.validFiles());
  assert.ok(!fired(r, 'R-items'));
});

test('R-items: a stray non-bullet paragraph in the items section fires R-items', async () => {
  const r = await h.lintFiles({
    'a.md': `${ITEM('Real item', 'X')}\nThis is prose, not a bullet.\n\n## Facts\n\n${FACT}`,
  });
  onlyRule(r, 'R-items');
  assert.match(r.errors.find((e) => e.rule === 'R-items').msg, /non-item content/);
});

test('R-items: an asterisk bullet ("* ") is not an item and fires R-items', async () => {
  const r = await h.lintFiles({
    'a.md': `* Item with the wrong bullet marker.\n\n## Facts\n\n${FACT}`,
  });
  // The "* " line is not a heading (no R-title) and is not "- " → R-items.
  onlyRule(r, 'R-items');
});

test('R-items: a multi-line WRAPPED item (continuation indented, no blank line) is one item, no R-items', async () => {
  const r = await h.lintFiles({
    'a.md':
      `- The page cache evicts the least-recently-used page on a miss\n` +
      `  and reloads from disk on the next access (\`X\`).\n\n## Facts\n\n${FACT}`,
  });
  assert.ok(!fired(r, 'R-items'), `a wrapped bullet is a single item; got ${JSON.stringify(r.errors)}`);
});

test('R-items: two items separated by a blank line are both accepted', async () => {
  const r = await h.lintFiles({
    'a.md': `${ITEM('First', 'X')}\n${ITEM('Second')}\n## Facts\n\n${FACT}`,
  });
  assert.ok(!fired(r, 'R-items'));
});

test('R-items: an item carrying em-dashes and backticks is accepted', async () => {
  const r = await h.lintFiles({
    'a.md': `- The store keeps one value per key — overwritten in place — via \`Store::put\` (\`X\`).\n\n## Facts\n\n${FACT}`,
  });
  assert.ok(!fired(r, 'R-items'));
});

// ===========================================================================
// R-tail — an Item must not carry a rationale tail.
//   Fires on: so / so that / because / thus / hence / therefore
//   Allowed:  since
// ===========================================================================

test('R-tail: a clean item with no rationale tail does not fire', async () => {
  const r = await h.lintFiles(h.validFiles());
  assert.ok(!fired(r, 'R-tail'));
});

test('R-tail: "because" tail fires R-tail (only)', async () => {
  const r = await h.lintFiles({
    'a.md': `- The cache evicts LRU pages because the working set exceeds capacity (\`X\`).\n\n## Facts\n\n${FACT}`,
  });
  onlyRule(r, 'R-tail');
  assert.match(r.errors.find((e) => e.rule === 'R-tail').msg, /rationale tail/);
});

test('R-tail: "so" tail fires R-tail', async () => {
  const r = await h.lintFiles({
    'a.md': `- Pages are pinned so reads never block on disk (\`X\`).\n\n## Facts\n\n${FACT}`,
  });
  assert.ok(fired(r, 'R-tail'));
});

test('R-tail: "so that" tail fires R-tail', async () => {
  const r = await h.lintFiles({
    'a.md': `- Pages are pinned, so that reads never block (\`X\`).\n\n## Facts\n\n${FACT}`,
  });
  assert.ok(fired(r, 'R-tail'));
});

test('R-tail: "thus" tail fires R-tail', async () => {
  const r = await h.lintFiles({
    'a.md': `- Writes batch at eviction, thus latency stays flat (\`X\`).\n\n## Facts\n\n${FACT}`,
  });
  assert.ok(fired(r, 'R-tail'));
});

test('R-tail: "hence" tail fires R-tail', async () => {
  const r = await h.lintFiles({
    'a.md': `- Writes batch at eviction, hence flat latency (\`X\`).\n\n## Facts\n\n${FACT}`,
  });
  assert.ok(fired(r, 'R-tail'));
});

test('R-tail: "therefore" tail fires R-tail', async () => {
  const r = await h.lintFiles({
    'a.md': `- Writes batch at eviction, therefore latency is flat (\`X\`).\n\n## Facts\n\n${FACT}`,
  });
  assert.ok(fired(r, 'R-tail'));
});

test('R-tail: "since" is ALLOWED — a since-clause item does not fire R-tail', async () => {
  const r = await h.lintFiles({
    'a.md': `- The store has kept one value per key since the first release (\`X\`).\n\n## Facts\n\n${FACT}`,
  });
  assert.ok(!fired(r, 'R-tail'), `"since" must be permitted; got ${JSON.stringify(r.errors)}`);
});

test('R-tail: "because" rejected but "since" allowed in otherwise-identical items', async () => {
  const bad = await h.lintFiles({
    'a.md': `- The cache pins hot pages because they are read often (\`X\`).\n\n## Facts\n\n${FACT}`,
  });
  const good = await h.lintFiles({
    'a.md': `- The cache pins hot pages since they are read often (\`X\`).\n\n## Facts\n\n${FACT}`,
  });
  assert.ok(fired(bad, 'R-tail'), 'because → fire');
  assert.ok(!fired(good, 'R-tail'), 'since → allowed');
});

test('R-tail: a rationale tail wrapped across two lines still fires (paragraph is flattened)', async () => {
  const r = await h.lintFiles({
    'a.md':
      `- The cache evicts least-recently-used pages\n` +
      `  because the working set exceeds capacity (\`X\`).\n\n## Facts\n\n${FACT}`,
  });
  assert.ok(fired(r, 'R-tail'), `flattened multi-line tail must still be caught; got ${JSON.stringify(r.errors)}`);
});

test('R-tail: a leading capitalized "So" mid-sentence still fires (case-insensitive)', async () => {
  // ". So it ..." flattens to "... . So it ..." → matched (case-insensitive),
  // since there is a separating space before "So" and a space after.
  const r = await h.lintFiles({
    'a.md': `- The cache stays warm. So reads rarely block (\`X\`).\n\n## Facts\n\n${FACT}`,
  });
  assert.ok(fired(r, 'R-tail'));
});

test('R-tail: "so" as the final word (followed by "." only) does NOT fire (boundary needs [ ,])', async () => {
  // The keyword must be followed by a [ ,] separator. When "so" is the literal
  // last word — "... stays so." with nothing but a period after it — the regex
  // does not match. This pins the exact word-boundary contract.
  // (No code-anchor here: a trailing " (`X`)." would put a SPACE after "so" and
  //  legitimately match, so we omit the anchor to isolate the boundary.)
  const r = await h.lintFiles({
    'a.md': `- A pinned page is held by the cache and the design stays so.\n\n## Facts\n\n${FACT}`,
  });
  assert.ok(!fired(r, 'R-tail'), `trailing "so." with no [ ,] separator must not fire; got ${JSON.stringify(r.errors)}`);
});

test('R-tail: words that merely CONTAIN a keyword (e.g. "sober", "sothat") do not fire', async () => {
  const r1 = await h.lintFiles({
    'a.md': `- The watchdog keeps the system sober under load (\`X\`).\n\n## Facts\n\n${FACT}`,
  });
  const r2 = await h.lintFiles({
    'a.md': `- The token uses a thingsothat compound identifier (\`X\`).\n\n## Facts\n\n${FACT}`,
  });
  assert.ok(!fired(r1, 'R-tail'), '"sober" must not match "so"');
  assert.ok(!fired(r2, 'R-tail'), '"sothat" run-together must not match');
});

test('R-tail: a keyword inside parentheses "(because ...)" fires (paren is a valid lead separator)', async () => {
  const r = await h.lintFiles({
    'a.md': `- The cache pins hot pages (because cold reads are rare) (\`X\`).\n\n## Facts\n\n${FACT}`,
  });
  assert.ok(fired(r, 'R-tail'));
});

test('R-tail: a since-tail across a line wrap is still allowed (negative for "since")', async () => {
  const r = await h.lintFiles({
    'a.md':
      `- The store has held one value per key\n` +
      `  since the project's first release (\`X\`).\n\n## Facts\n\n${FACT}`,
  });
  assert.ok(!fired(r, 'R-tail'));
});

// ===========================================================================
// Cross-rule isolation: each single perturbation produces exactly its own rule.
// This is the strongest "no false-positive" guarantee — drift in any rule would
// show up here as a collateral hit.
// ===========================================================================

test('isolation: each one-thing perturbation fires only its intended rule', async () => {
  const v = h.validFiles;

  // R-title: prepend a heading to the (already valid) page-cache child.
  const titled = v();
  titled['acorn/page-cache.md'] = `# Page cache\n\n` + titled['acorn/page-cache.md'];
  let r = await h.lintFiles(titled);
  assert.deepEqual(distinct(r).filter((x) => x !== 'R-sections'), ['R-title'],
    `R-title perturbation produced ${JSON.stringify(r.rules)}`);
  // (a leading title also counts as an unexpected/out-of-order heading → R-sections)
  assert.ok(fired(r, 'R-sections'), 'a title heading is also an unexpected section heading');

  // R-tail: inject a "because" tail into one item, nothing else touched.
  const tailed = v();
  tailed['acorn.md'] = `- Acorn stores key-value pairs because callers want fast lookup (\`Store\`).\n\n## Facts\n\n- 2031-02-01 (00000001) statement: the store is a single append-only file on disk (code).\n`;
  r = await h.lintFiles(tailed);
  assert.deepEqual(distinct(r), ['R-tail'], `R-tail perturbation produced ${JSON.stringify(r.rules)}`);

  // R-items: inject a stray paragraph into the items section.
  const strayed = v();
  strayed['acorn.md'] = `- Acorn stores key-value pairs, one value per key (\`Store\`).\n\nStray narration.\n\n## Facts\n\n- 2031-02-01 (00000001) statement: the store is a single append-only file on disk (code).\n`;
  r = await h.lintFiles(strayed);
  assert.deepEqual(distinct(r), ['R-items'], `R-items perturbation produced ${JSON.stringify(r.rules)}`);
});

// ===========================================================================
// Tag / hash edge cases that must NOT disturb the structural rules.
// (These structural rules are agnostic to provenance; we assert they stay
//  silent while exercising tag/hash variants the grammar allows.)
// ===========================================================================

test('structural rules: trailing "." after the provenance tag does not disturb structure', async () => {
  // PROV allows "(code)." with a trailing dot. The structural rules under test
  // (title/sections/items/tail) must remain silent.
  const r = await h.lintFiles({
    'a.md': `${ITEM('Root', 'A')}\n## Facts\n\n- 2031-01-01 (00000001) statement: append-only on disk (code).\n`,
  });
  for (const rule of ['R-title', 'R-sections', 'R-items', 'R-tail', 'R-root', 'R-orphan', 'R-empty']) {
    assert.ok(!fired(r, rule), `${rule} fired unexpectedly: ${JSON.stringify(r.errors)}`);
  }
});

test('structural rules: a fact entry with NO hash (general statement) is structurally fine', async () => {
  const r = await h.lintFiles({
    'a.md': `${ITEM('Root', 'A')}\n## Facts\n\n- 2031-01-01 statement: a general claim tied to no commit (sourced).\n`,
  });
  for (const rule of ['R-title', 'R-sections', 'R-items', 'R-tail', 'R-root', 'R-orphan', 'R-empty']) {
    assert.ok(!fired(r, rule), `${rule} fired unexpectedly: ${JSON.stringify(r.errors)}`);
  }
});

test('structural rules: a [[link]] inside a backtick code span is left to R-link, not structure', async () => {
  // A bracketed token in a code span is NOT a real link (R-link strips backticks
  // before scanning). The STRUCTURAL rules here must be silent regardless.
  const r = await h.lintFiles({
    'a.md': `- The query syntax accepts a \`[[name]]\` placeholder token (\`X\`).\n\n## Facts\n\n${FACT}`,
  });
  for (const rule of ['R-title', 'R-sections', 'R-items', 'R-tail']) {
    assert.ok(!fired(r, rule), `${rule} fired unexpectedly: ${JSON.stringify(r.errors)}`);
  }
});

// ===========================================================================
// End-to-end via the CLI: exit codes and rule labels in the output.
// ===========================================================================

test('cli: a structural violation makes `lint` exit 1 and name the rule on stderr', () => {
  const t = h.tmpTree(h.validFiles());
  try {
    // perturb exactly one item with a rationale tail
    t.write('acorn.md',
      `- Acorn stores key-value pairs because callers want speed (\`Store\`).\n\n## Facts\n\n- 2031-02-01 (00000001) statement: the store is a single append-only file on disk (code).\n`);
    const r = h.runCli(['lint', t.root]);
    assert.equal(r.code, 1);
    assert.match(r.stderr, /\[R-tail\]/);
    assert.match(r.stderr, /violation/);
  } finally {
    t.cleanup();
  }
});

test('cli: R-root violation (two top nodes) exits 1 and reports the count', () => {
  const t = h.tmpTree({
    'a.md': cleanRoot(ITEM('A', 'A')),
    'b.md': cleanRoot(ITEM('B', 'B')),
  });
  try {
    const r = h.runCli(['lint', t.root]);
    assert.equal(r.code, 1);
    assert.match(r.stderr, /\[R-root\]/);
    assert.match(r.stderr, /found 2/);
  } finally {
    t.cleanup();
  }
});

test('cli: --skeleton still enforces structural rules (R-title fires under skeleton)', () => {
  const t = h.tmpTree({
    'a.md': `# Title\n\n${ITEM('Root', 'A')}`,
  });
  try {
    const r = h.runCli(['lint', t.root, '--skeleton']);
    assert.equal(r.code, 1);
    assert.match(r.stderr, /\[R-title\]/);
  } finally {
    t.cleanup();
  }
});

// ===========================================================================
// Line-ending sensitivity (adversarial / "Windows-y blank lines").
//
// NOTE: the parser normalizes CRLF / lone CR to LF before parsing (parseNode),
// so a node authored with Windows line endings parses identically to LF — its
// "## Facts"/"## Moves" headings are recognized and its entries validated. We
// pin that the same content lints clean under both CRLF and LF endings.
// ===========================================================================

test('line-endings: an LF-only node with blank-line separators lints clean', async () => {
  const r = await h.lintFiles({
    'a.md': `- Item one (\`X\`).\n\n- Item two.\n\n## Facts\n\n${FACT}`,
  });
  assert.deepEqual(r.rules, [], `LF tree should be clean; got ${JSON.stringify(r.errors)}`);
});

test('line-endings: a CRLF node normalizes to LF — heading recognized, lints clean', async () => {
  const lf = `- Item one (\`X\`).\n\n## Facts\n\n- 2031-01-01 (00000001) statement: append-only on disk (code).\n`;
  const crlf = lf.replace(/\n/g, '\r\n');
  const r = await h.lintFiles({ 'a.md': crlf });
  // CRLF is normalized before parsing, so "## Facts" is a real section and the
  // fact is validated — identical to the LF case above; nothing fires.
  assert.deepEqual(r.rules, [], `CRLF should normalize and lint clean; got ${JSON.stringify(r.errors)}`);
});
