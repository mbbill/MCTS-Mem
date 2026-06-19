// End-to-end and edge-case tests for the `view` and `show` commands of the
// mcts-mem CLI (src/view.js), driven through the real binary via runCli (which
// forces NO_COLOR so output is plain). Behaviour is asserted against the grammar
// in skills/mcts-mem-use/SKILL.md: the tree renders root-first with ├─/└─
// connectors and Nf/Nm/↩N annotations; --alt walks rejected alts marked ✗;
// --depth limits depth; a legend prints. show <node> prints the logical path,
// items, ## Facts, ## Moves, and the alternatives it beat, exits 0 when found,
// non-zero with a message when missing/ambiguous, and tags provenance as
// (code)/(sourced)/(uncertain).
//
// Strategy: start from validFiles() (a lint-clean tree) and perturb exactly one
// thing per test, so when an assertion fires we know which behaviour is under
// test. We assert both the positive (a feature shows up on the input that should
// trigger it) and the negative (it does NOT show on the good baseline).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as h from './helpers.js';

// ---- small helpers -------------------------------------------------------

// run `mcts-mem view <root> [extra...]`
function view(root, ...extra) {
  return h.runCli(['view', root, ...extra]);
}
// run `mcts-mem show <query> <root>`
function show(query, root) {
  return h.runCli(['show', query, root]);
}
const lines = (s) => s.split('\n');
// the rendered line for a node by stem (ignoring connector / annotation suffix)
function lineFor(stdout, stem) {
  return lines(stdout).find((l) => l.replace(/[│├└─✗\s]+/g, ' ').includes(stem));
}

// A tree with a grandchild, so depth limiting has something to clip.
function deepTree() {
  const v = h.validFiles();
  v['acorn/page-cache/eviction.md'] =
`- Pages evict by clock approximation (\`Clock\`).

## Facts

- 2031-05-01 (cd34ef56) rationale: clock approximates LRU at lower cost (code).
`;
  return v;
}

// =========================================================================
// view — structure: root first, connectors, legend
// =========================================================================

test('view: root node prints first, before any connectors', () => {
  const t = h.tmpTree(h.validFiles());
  try {
    const r = view(t.root);
    assert.equal(r.code, 0, r.stderr);
    const ls = lines(r.stdout).filter((l) => l.trim());
    // first non-empty line is the root, with no tree connector
    assert.ok(ls[0].startsWith('acorn'), `first line should be root: ${JSON.stringify(ls[0])}`);
    assert.ok(!ls[0].includes('├') && !ls[0].includes('└'), 'root line must have no connector');
  } finally { t.cleanup(); }
});

test('view: child lines use ├─/└─ connectors; last child uses └─', () => {
  const v = h.validFiles();
  // give acorn two children so we can see ├─ (not last) and └─ (last)
  v['acorn/wal.md'] =
`- A write-ahead log fronts the store (\`Wal\`).

## Facts

- 2031-03-01 (99999999) rationale: durability needs an ordered log (code).
`;
  const t = h.tmpTree(v);
  try {
    const r = view(t.root);
    assert.equal(r.code, 0, r.stderr);
    // children sort alphabetically: page-cache then wal → page-cache is ├─, wal is └─
    const pc = lineFor(r.stdout, 'page-cache');
    const wal = lineFor(r.stdout, 'wal');
    assert.ok(pc.includes('├─'), `non-last child should use ├─: ${JSON.stringify(pc)}`);
    assert.ok(wal.includes('└─'), `last child should use └─: ${JSON.stringify(wal)}`);
  } finally { t.cleanup(); }
});

test('view: single child uses └─ (it is the last)', () => {
  const t = h.tmpTree(h.validFiles());
  try {
    const r = view(t.root);
    const pc = lineFor(r.stdout, 'page-cache');
    assert.ok(pc.includes('└─'), `sole child should use └─: ${JSON.stringify(pc)}`);
    assert.ok(!pc.includes('├─'), 'sole child should not use ├─');
  } finally { t.cleanup(); }
});

test('view: a legend line prints, naming the annotation alphabet', () => {
  const t = h.tmpTree(h.validFiles());
  try {
    const r = view(t.root);
    assert.match(r.stdout, /legend:/);
    assert.match(r.stdout, /Nf facts/);
    assert.match(r.stdout, /Nm moves/);
    assert.match(r.stdout, /↩N alternatives/);
    assert.match(r.stdout, /fought over/);
    assert.match(r.stdout, /reconsider freely/);
  } finally { t.cleanup(); }
});

test('view: without --alt, the hint to pass --alt prints', () => {
  const t = h.tmpTree(h.validFiles());
  try {
    const r = view(t.root);
    assert.match(r.stdout, /pass --alt to walk the rejected alternatives/);
  } finally { t.cleanup(); }
});

test('view: with --alt, the "pass --alt" hint is suppressed', () => {
  const t = h.tmpTree(h.validFiles());
  try {
    const r = view(t.root, '--alt');
    assert.equal(r.code, 0, r.stderr);
    assert.doesNotMatch(r.stdout, /pass --alt to walk the rejected alternatives/);
    // the legend itself still prints
    assert.match(r.stdout, /legend:/);
  } finally { t.cleanup(); }
});

// =========================================================================
// view — annotations: Nf / Nm / ↩N
// =========================================================================

test('view: annotations show Nf facts, Nm moves, ↩N alternatives', () => {
  const t = h.tmpTree(h.validFiles());
  try {
    const r = view(t.root);
    const root = lineFor(r.stdout, 'acorn');
    const pc = lineFor(r.stdout, 'page-cache');
    // root has 1 fact, no moves, no alts
    assert.match(root, /\b1f\b/);
    assert.doesNotMatch(root, /\bm\b/); // no Nm on root
    assert.doesNotMatch(root, /↩/);     // no alt count on root
    // page-cache has 1 fact, 1 move, 1 alt
    assert.match(pc, /\b1f\b/);
    assert.match(pc, /\b1m\b/);
    assert.match(pc, /↩1/);
  } finally { t.cleanup(); }
});

test('view: fact count reflects multiple facts (5f), enabling the "fought over" signal', () => {
  const v = h.validFiles();
  v['acorn/page-cache.md'] =
`- Reads go through a fixed-size page cache (\`PageCache\`); a page loads from disk only on a miss.

## Facts

- 2031-04-02 (ab12cd34) measurement: batching at eviction cut ingest latency 3.4x — data in [[page-cache.fact/stall]] (code).

- 2031-04-03 (ab12cd35) measurement: second fact (code).

- 2031-04-04 (ab12cd36) measurement: third fact (code).

- 2031-04-05 (ab12cd37) measurement: fourth fact (code).

- 2031-04-06 (ab12cd38) measurement: fifth fact (code).

## Moves

- 2031-04-02 (ab12cd34) replaced [[write-through]]: write-through stalled every mutation on disk latency; batching at eviction removed the stall (code).
`;
  const t = h.tmpTree(v);
  try {
    const r = view(t.root);
    const pc = lineFor(r.stdout, 'page-cache');
    assert.match(pc, /\b5f\b/, `page-cache should annotate 5 facts: ${JSON.stringify(pc)}`);
  } finally { t.cleanup(); }
});

test('view: a multi-line wrapped fact still counts as ONE fact', () => {
  const v = h.validFiles();
  v['acorn/page-cache.md'] =
`- Reads go through a fixed-size page cache (\`PageCache\`); a page loads from disk only on a miss.

## Facts

- 2031-04-02 (ab12cd34) measurement: batching at eviction cut ingest
  latency 3.4x — the \`evict()\` path matters here (code).

## Moves

- 2031-04-02 (ab12cd34) replaced [[write-through]]: write-through stalled every mutation on disk latency; batching at eviction removed the stall (code).
`;
  const t = h.tmpTree(v);
  try {
    const r = view(t.root);
    const pc = lineFor(r.stdout, 'page-cache');
    assert.match(pc, /\b1f\b/, `wrapped fact must count once: ${JSON.stringify(pc)}`);
    assert.doesNotMatch(pc, /\b2f\b/);
  } finally { t.cleanup(); }
});

test('view: a node with no facts/moves/alts gets no annotation suffix', () => {
  const v = h.validFiles();
  // a thin child with no Facts/Moves; (lint would flag R-thin, but view tolerates it)
  v['acorn/notes.md'] = `- A plain note node (\`Notes\`).\n`;
  const t = h.tmpTree(v);
  try {
    const r = view(t.root);
    const notes = lineFor(r.stdout, 'notes');
    assert.ok(notes, 'notes node should render');
    assert.doesNotMatch(notes, /\d+f/);
    assert.doesNotMatch(notes, /\d+m/);
    assert.doesNotMatch(notes, /↩/);
  } finally { t.cleanup(); }
});

// =========================================================================
// view — --alt
// =========================================================================

test('view --alt: rejected alts render, marked with ✗', () => {
  const t = h.tmpTree(h.validFiles());
  try {
    const noAlt = view(t.root);
    const withAlt = view(t.root, '--alt');
    // baseline: the alt node is NOT shown as a tree line
    assert.ok(!noAlt.stdout.includes('write-through'),
      'write-through must not appear without --alt');
    // with --alt: it appears, marked ✗
    assert.ok(withAlt.stdout.includes('write-through'),
      'write-through must appear with --alt');
    const wt = lineFor(withAlt.stdout, 'write-through');
    assert.ok(wt.includes('✗'), `alt line must carry ✗: ${JSON.stringify(wt)}`);
  } finally { t.cleanup(); }
});

test('view --alt: an alt nests under the node it lost to (deeper indent)', () => {
  const t = h.tmpTree(h.validFiles());
  try {
    const r = view(t.root, '--alt');
    const wt = lineFor(r.stdout, 'write-through');
    // write-through is the alt of page-cache (a child of root), so it sits one
    // level deeper than page-cache — its line has indentation before the connector.
    assert.match(wt, /^\s+/, `alt should be indented under its winner: ${JSON.stringify(wt)}`);
  } finally { t.cleanup(); }
});

// =========================================================================
// view — --depth
// =========================================================================

test('view --depth 1: shows the root + first level, hides grandchildren', () => {
  const t = h.tmpTree(deepTree());
  try {
    const full = view(t.root);
    const d1 = view(t.root, '--depth', '1');
    // sanity: full render shows the grandchild
    assert.ok(full.stdout.includes('eviction'), 'full render should include grandchild');
    // depth 1 keeps page-cache but drops eviction
    assert.ok(d1.stdout.includes('page-cache'), 'depth 1 keeps first-level child');
    assert.ok(!d1.stdout.includes('eviction'), 'depth 1 must hide the grandchild');
  } finally { t.cleanup(); }
});

test('view --depth 2: brings the grandchild back', () => {
  const t = h.tmpTree(deepTree());
  try {
    const d2 = view(t.root, '--depth', '2');
    assert.ok(d2.stdout.includes('eviction'), 'depth 2 should show the grandchild');
  } finally { t.cleanup(); }
});

// =========================================================================
// view — malformed-tree tolerance (warnings, no crash)
// =========================================================================

test('view: 2 top-level nodes prints a warning but still renders one tree', () => {
  const v = h.validFiles();
  v['banana.md'] =
`- Banana is an unrelated second root (\`Banana\`).

## Facts

- 2031-02-01 (33333333) rationale: standalone (code).
`;
  const t = h.tmpTree(v);
  try {
    const r = view(t.root);
    assert.equal(r.code, 0, 'view does not exit non-zero on a multi-root tree');
    assert.match(r.stdout, /2 top-level nodes; expected 1/);
    assert.match(r.stdout, /mcts-mem lint/);
    // it still renders the alphabetically-first root (acorn) and its child
    assert.ok(r.stdout.includes('acorn'));
    assert.ok(r.stdout.includes('page-cache'));
  } finally { t.cleanup(); }
});

test('view: 0 top-level nodes warns and returns without a legend (no crash)', () => {
  const t = h.tmpTree({
    'sub/x.md': '- x (`X`).\n\n## Facts\n\n- 2031-01-01 (44444444) rationale: y (code).\n',
  });
  try {
    const r = view(t.root);
    assert.equal(r.code, 0);
    assert.match(r.stdout, /0 top-level nodes; expected 1/);
    // early return: no legend
    assert.doesNotMatch(r.stdout, /legend:/);
  } finally { t.cleanup(); }
});

test('view: a nonexistent root exits 1 with a "tree root not found" message', () => {
  const r = view('/tmp/mm-definitely-not-a-real-tree-xyz-12345');
  assert.equal(r.code, 1);
  assert.match(r.stderr, /tree root not found/);
});

// =========================================================================
// show — happy path: root, child, alt
// =========================================================================

test('show <child>: exits 0 and prints the logical path as the first line', () => {
  const t = h.tmpTree(h.validFiles());
  try {
    const r = show('page-cache', t.root);
    assert.equal(r.code, 0, r.stderr);
    assert.equal(lines(r.stdout)[0].trim(), 'acorn/page-cache');
  } finally { t.cleanup(); }
});

test('show <child>: prints items, ## Facts, ## Moves, and the alternatives section', () => {
  const t = h.tmpTree(h.validFiles());
  try {
    const r = show('page-cache', t.root);
    // item text (a concept line) is rendered
    assert.match(r.stdout, /Reads go through a fixed-size page cache/);
    // section headers
    assert.match(r.stdout, /## Facts/);
    assert.match(r.stdout, /## Moves/);
    // the alternatives ("rejected / superseded") section listing the rejected alt
    assert.match(r.stdout, /alternatives \(rejected \/ superseded\):/);
    const altLine = lines(r.stdout).find((l) => l.includes('write-through') && l.includes('✗'));
    assert.ok(altLine, 'the rejected alt should be listed under ✗');
  } finally { t.cleanup(); }
});

test('show <child>: lists sub-decisions and graduated .fact/ evidence', () => {
  const t = h.tmpTree(h.validFiles());
  try {
    // page-cache has a .fact/ but no children; root has a child (sub-decision).
    const pc = show('page-cache', t.root);
    assert.match(pc.stdout, /graduated evidence \(\.fact\/\):/);
    assert.match(pc.stdout, /stall\.md/);

    const root = show('acorn', t.root);
    assert.match(root.stdout, /sub-decisions:/);
    assert.ok(lines(root.stdout).some((l) => l.trim() === 'page-cache'),
      'root should list page-cache as a sub-decision');
  } finally { t.cleanup(); }
});

test('show <root>: exits 0, has no Moves section and no alternatives section', () => {
  const t = h.tmpTree(h.validFiles());
  try {
    const r = show('acorn', t.root);
    assert.equal(r.code, 0, r.stderr);
    assert.equal(lines(r.stdout)[0].trim(), 'acorn');
    assert.match(r.stdout, /## Facts/);
    assert.doesNotMatch(r.stdout, /## Moves/);
    assert.doesNotMatch(r.stdout, /alternatives \(rejected/);
  } finally { t.cleanup(); }
});

test('show <alt member>: logical path drops .alt and marks it superseded/rejected', () => {
  const t = h.tmpTree(h.validFiles());
  try {
    const r = show('write-through', t.root);
    assert.equal(r.code, 0, r.stderr);
    const first = lines(r.stdout)[0];
    // logical path strips ".alt" → acorn/page-cache/write-through
    assert.match(first, /^acorn\/page-cache\/write-through\b/);
    assert.match(first, /superseded \/ rejected — in \.alt\//);
    // the alt has Moves (ends in "replaced by") but no Facts
    assert.match(r.stdout, /## Moves/);
    assert.doesNotMatch(r.stdout, /## Facts/);
  } finally { t.cleanup(); }
});

// =========================================================================
// show — provenance rendering: (code) / (sourced) / (uncertain)
// =========================================================================

test('show: a (code) fact renders its tag as "(code)" and strips it from the claim', () => {
  const t = h.tmpTree(h.validFiles());
  try {
    const r = show('page-cache', t.root);
    // the measurement entry's kind line carries (code)
    const kindLine = lines(r.stdout).find((l) => l.includes('measurement'));
    assert.ok(kindLine, 'measurement kind line should exist');
    assert.match(kindLine, /\(code\)/);
    // the claim line below it must NOT still carry the trailing (code) tag
    const claimLine = lines(r.stdout).find((l) => l.includes('batching at eviction cut ingest'));
    assert.ok(claimLine, 'claim line should exist');
    assert.doesNotMatch(claimLine, /\(code\)\s*$/);
  } finally { t.cleanup(); }
});

test('show: a (sourced) fact renders "(sourced)"', () => {
  const v = h.validFiles();
  v['acorn.md'] =
`- Acorn stores key-value pairs, one value per key (\`Store\`).

## Facts

- 2031-02-01 statement: the store model came from the author interview, no single commit (sourced).
`;
  const t = h.tmpTree(v);
  try {
    const r = show('acorn', t.root);
    const kindLine = lines(r.stdout).find((l) => l.includes('statement'));
    assert.match(kindLine, /\(sourced\)/);
    assert.doesNotMatch(kindLine, /\(code\)/);
  } finally { t.cleanup(); }
});

test('show: an (uncertain) fact renders "(uncertain)"', () => {
  const v = h.validFiles();
  v['acorn.md'] =
`- Acorn stores key-value pairs, one value per key (\`Store\`).

## Facts

- 2031-02-01 (00000001) rationale: chosen as the baseline; no commit, doc, or note records why (uncertain).
`;
  const t = h.tmpTree(v);
  try {
    const r = show('acorn', t.root);
    const kindLine = lines(r.stdout).find((l) => l.includes('rationale'));
    assert.match(kindLine, /\(uncertain\)/);
    // the claim below keeps the human-readable text minus the tag
    const claimLine = lines(r.stdout).find((l) => l.includes('chosen as the baseline'));
    assert.ok(claimLine);
    assert.doesNotMatch(claimLine, /\(uncertain\)\s*$/);
  } finally { t.cleanup(); }
});

// =========================================================================
// show — hash forms in the rendered head
// =========================================================================

test('show: an 8-hex-hashed fact renders "(<hash>)" in the head; a no-hash fact omits it', () => {
  const v = h.validFiles();
  v['acorn.md'] =
`- Acorn stores key-value pairs, one value per key (\`Store\`).

## Facts

- 2031-02-01 (00000001) statement: anchored to a commit (code).

- 2031-02-02 statement: a general statement tied to no single commit (sourced).
`;
  const t = h.tmpTree(v);
  try {
    const r = show('acorn', t.root);
    const hashed = lines(r.stdout).find((l) => l.includes('2031-02-01'));
    const nohash = lines(r.stdout).find((l) => l.includes('2031-02-02'));
    assert.match(hashed, /\(00000001\)/, 'hashed fact head should show the hash');
    assert.doesNotMatch(nohash, /\([0-9a-f]{8}\)/, 'no-hash fact head must not invent a hash');
    // it still shows the date
    assert.match(nohash, /2031-02-02/);
  } finally { t.cleanup(); }
});

// =========================================================================
// show — adversarial claim text: em-dash, backticks, trailing "." after tag
// =========================================================================

test('show: em-dashes and backticks survive into the rendered claim', () => {
  const v = h.validFiles();
  v['acorn/page-cache.md'] =
`- Reads go through a fixed-size page cache (\`PageCache\`); a page loads from disk only on a miss.

## Facts

- 2031-04-02 (ab12cd34) measurement: latency dropped 3.4x — the \`evict()\` path is what mattered (code).

## Moves

- 2031-04-02 (ab12cd34) replaced [[write-through]]: write-through stalled every mutation on disk latency; batching at eviction removed the stall (code).
`;
  const t = h.tmpTree(v);
  try {
    const r = show('page-cache', t.root);
    const claim = lines(r.stdout).find((l) => l.includes('latency dropped 3.4x'));
    assert.ok(claim, 'claim line should render');
    assert.ok(claim.includes('—'), 'em-dash should survive');
    assert.ok(claim.includes('`evict()`'), 'backticks should survive in the claim');
  } finally { t.cleanup(); }
});

test('show: a trailing "." after the provenance tag is stripped with the tag', () => {
  // PROV allows an optional trailing ".", and view.claim() strips "(tag).".
  const v = h.validFiles();
  v['acorn.md'] =
`- Acorn stores key-value pairs, one value per key (\`Store\`).

## Facts

- 2031-02-01 (00000001) statement: the store is a single append-only file on disk (code).
`;
  const t = h.tmpTree(v);
  try {
    const r = show('acorn', t.root);
    const claim = lines(r.stdout).find((l) => l.includes('append-only file'));
    assert.ok(claim);
    // neither the tag nor its trailing dot should remain on the claim
    assert.doesNotMatch(claim, /\(code\)/);
    assert.doesNotMatch(claim, /\(code\)\.\s*$/);
    assert.ok(claim.trim().endsWith('on disk'), `claim should end at the real text: ${JSON.stringify(claim)}`);
  } finally { t.cleanup(); }
});

test('show: a multi-line wrapped entry is flattened to a single claim line', () => {
  const v = h.validFiles();
  v['acorn/page-cache.md'] =
`- Reads go through a fixed-size page cache (\`PageCache\`); a page loads from disk only on a miss.

## Facts

- 2031-04-02 (ab12cd34) measurement: batching at eviction cut ingest
  latency 3.4x across the benchmark suite (code).

## Moves

- 2031-04-02 (ab12cd34) replaced [[write-through]]: write-through stalled every mutation on disk latency; batching at eviction removed the stall (code).
`;
  const t = h.tmpTree(v);
  try {
    const r = show('page-cache', t.root);
    // the two source lines collapse onto one rendered claim line
    const claim = lines(r.stdout).find((l) => l.includes('batching at eviction cut ingest'));
    assert.ok(claim, 'flattened claim should exist on one line');
    assert.ok(claim.includes('latency 3.4x across the benchmark suite'),
      `the wrapped continuation should join the same line: ${JSON.stringify(claim)}`);
  } finally { t.cleanup(); }
});

// =========================================================================
// show — not found / ambiguous / missing arg
// =========================================================================

test('show: an unknown node exits non-zero with a "no node matches" message', () => {
  const t = h.tmpTree(h.validFiles());
  try {
    const r = show('does-not-exist', t.root);
    assert.notEqual(r.code, 0);
    assert.match(r.stdout, /no node matches "does-not-exist"/);
  } finally { t.cleanup(); }
});

test('show: an ambiguous stem exits non-zero and lists every match by logical path', () => {
  const v = h.validFiles();
  // two distinct nodes share the stem "shared"
  v['acorn/shared.md'] = `- B (\`B\`).\n\n## Facts\n\n- 2031-05-01 (11111111) rationale: b (code).\n`;
  v['acorn/page-cache/shared.md'] = `- A (\`A\`).\n\n## Facts\n\n- 2031-05-01 (22222222) rationale: a (code).\n`;
  const t = h.tmpTree(v);
  try {
    const r = show('shared', t.root);
    assert.notEqual(r.code, 0);
    assert.match(r.stdout, /"shared" is ambiguous — 2 matches:/);
    assert.match(r.stdout, /acorn\/shared/);
    assert.match(r.stdout, /acorn\/page-cache\/shared/);
  } finally { t.cleanup(); }
});

test('show: a unique stem is NOT reported as ambiguous (negative of the ambiguity rule)', () => {
  const t = h.tmpTree(h.validFiles());
  try {
    const r = show('page-cache', t.root);
    assert.equal(r.code, 0);
    assert.doesNotMatch(r.stdout, /ambiguous/);
    assert.doesNotMatch(r.stdout, /no node matches/);
  } finally { t.cleanup(); }
});

test('show: the ".md" suffix on the query is tolerated and resolves the same node', () => {
  const t = h.tmpTree(h.validFiles());
  try {
    const bare = show('page-cache', t.root);
    const dotmd = show('page-cache.md', t.root);
    assert.equal(dotmd.code, 0, dotmd.stderr);
    assert.equal(lines(dotmd.stdout)[0].trim(), 'acorn/page-cache');
    assert.equal(lines(bare.stdout)[0].trim(), lines(dotmd.stdout)[0].trim());
  } finally { t.cleanup(); }
});

test('show: with no <node> argument, exits with code 2 and an explanatory error', () => {
  const r = h.runCli(['show']);
  assert.equal(r.code, 2);
  assert.match(r.stderr, /show: needs a <node> name or logical path/);
});

test('show: a unique logical path resolves to exactly that node (BUG: reported ambiguous)', () => {
  // The help says <node> is "a node name or a logical path". A logical path that
  // matches exactly one node should show it (exit 0), not be called ambiguous.
  const t = h.tmpTree(h.validFiles());
  try {
    const r = show('acorn/page-cache', t.root);
    assert.equal(r.code, 0,
      `unique logical path should resolve (got code ${r.code}: ${JSON.stringify(r.stdout)})`);
    assert.equal(lines(r.stdout)[0].trim(), 'acorn/page-cache');
    assert.doesNotMatch(r.stdout, /ambiguous/);
  } finally { t.cleanup(); }
});

// =========================================================================
// fixture-validity edges (lintFiles) — confirm our perturbations are the only
// change, and exercise the grammar edges named in the brief. These pin that the
// trees we feed view/show are lint-clean except where intended.
// =========================================================================

test('lint: the baseline validFiles() tree is lint-clean (non-git)', async () => {
  const r = await h.lintFiles(h.validFiles());
  assert.deepEqual(r.rules, [], `baseline should lint clean: ${JSON.stringify(r.errors)}`);
});

test('lint: "since" is allowed in an item, "because" is rejected (R-tail) — and nothing else fires', async () => {
  const sinceV = h.validFiles();
  sinceV['acorn.md'] =
`- Acorn has stored key-value pairs since the first release (\`Store\`).

## Facts

- 2031-02-01 (00000001) statement: x is true of the store (code).
`;
  const since = await h.lintFiles(sinceV);
  assert.deepEqual(since.rules, [], `"since" must not trip R-tail: ${JSON.stringify(since.errors)}`);

  const becauseV = h.validFiles();
  becauseV['acorn.md'] =
`- Acorn stores key-value pairs because it is the fast path (\`Store\`).

## Facts

- 2031-02-01 (00000001) statement: x is true of the store (code).
`;
  const because = await h.lintFiles(becauseV);
  assert.deepEqual(because.rules, ['R-tail'], `"because" should fire only R-tail: ${JSON.stringify(because.errors)}`);
});

test('lint: a [[link]] inside a backtick code span is NOT treated as a link (no R-link)', async () => {
  const tickV = h.validFiles();
  tickV['acorn.md'] =
`- Acorn treats \`[[notalink]]\` as a literal token, not a reference (\`Store\`).

## Facts

- 2031-02-01 (00000001) statement: the store is a single append-only file on disk (code).
`;
  const r = await h.lintFiles(tickV);
  assert.ok(!r.rules.includes('R-link'),
    `a backticked [[..]] must not be a link: ${JSON.stringify(r.errors)}`);
  // and the tree is otherwise clean
  assert.deepEqual(r.rules, []);
});

test('lint: a bare unresolvable [[link]] DOES fire R-link (positive of the above)', async () => {
  const v = h.validFiles();
  v['acorn.md'] =
`- Acorn references [[no-such-node]] for real (\`Store\`).

## Facts

- 2031-02-01 (00000001) statement: the store is a single append-only file on disk (code).
`;
  const r = await h.lintFiles(v);
  assert.ok(r.rules.includes('R-link'), `bare unresolvable link should fire R-link: ${JSON.stringify(r.errors)}`);
});

test('lint: a fact entry missing its provenance tag fires R-prov (and only R-prov)', async () => {
  const v = h.validFiles();
  v['acorn.md'] =
`- Acorn stores key-value pairs, one value per key (\`Store\`).

## Facts

- 2031-02-01 (00000001) statement: the store is a single append-only file on disk
`;
  const r = await h.lintFiles(v);
  assert.deepEqual(r.rules, ['R-prov'], `missing tag should fire only R-prov: ${JSON.stringify(r.errors)}`);
});

test('lint: a Facts entry with no hash is valid (hash is independent of the tag)', async () => {
  const v = h.validFiles();
  v['acorn.md'] =
`- Acorn stores key-value pairs, one value per key (\`Store\`).

## Facts

- 2031-02-01 statement: the store model is a general property, tied to no single commit (sourced).
`;
  const r = await h.lintFiles(v);
  assert.deepEqual(r.rules, [], `a hashless general fact must be valid: ${JSON.stringify(r.errors)}`);
});

test('lint: a malformed 7-hex hash fails the entry head (R-entry)', async () => {
  const v = h.validFiles();
  v['acorn.md'] =
`- Acorn stores key-value pairs, one value per key (\`Store\`).

## Facts

- 2031-02-01 (0000001) statement: hash is only seven hex digits (code).
`;
  const r = await h.lintFiles(v);
  assert.ok(r.rules.includes('R-entry'), `a 7-hex hash should fail R-entry: ${JSON.stringify(r.errors)}`);
});

test('view/show: trees with em-dash + backtick whys still lint clean (fixture integrity)', async () => {
  const v = h.validFiles();
  v['acorn/page-cache.md'] =
`- Reads go through a fixed-size page cache (\`PageCache\`); a page loads from disk only on a miss.

## Facts

- 2031-04-02 (ab12cd34) measurement: latency dropped 3.4x — the \`evict()\` path is what mattered (code).

## Moves

- 2031-04-02 (ab12cd34) replaced [[write-through]]: write-through stalled every mutation on disk latency; batching at eviction removed the stall (code).
`;
  const r = await h.lintFiles(v);
  assert.deepEqual(r.rules, [], `em-dash/backtick fixture should be clean: ${JSON.stringify(r.errors)}`);
});
