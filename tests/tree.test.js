// Thorough tests for the mcts-mem parser/model (src/tree.js) plus end-to-end CLI
// behavior. Each rule/function is tested BOTH for firing on the bad/edge input
// AND for not false-positiving on the good input. Most lint tests start from
// validFiles() and perturb exactly one thing, then assert the targeted rule is
// present and no unrelated rule fired.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as h from './helpers.js';
import {
  blocks,
  normWhy,
  parseNode,
  parseEntry,
  logical,
  resolve,
  relatives,
  loadTree,
  ENTRY_HEAD,
  PROV,
  MOVE_VERB,
} from '../src/tree.js';

// ---------------------------------------------------------------------------
// helpers local to this file
// ---------------------------------------------------------------------------

// Mutate exactly one file in a fresh validFiles() map and return the new map.
function perturb(rel, transform) {
  const files = h.validFiles();
  files[rel] = transform(files[rel]);
  return files;
}

// Assert a lint run fired exactly the expected rule(s) and nothing else.
function assertRules(result, expected, label) {
  const got = [...result.rules].sort();
  const want = [...expected].sort();
  assert.deepEqual(got, want, `${label}: rules ${JSON.stringify(got)} != ${JSON.stringify(want)}`);
}

// ===========================================================================
// blocks() — split a section body into "- " entry blocks
// ===========================================================================

test('blocks: splits two entries separated by a blank line', () => {
  const body = '\n- 2031-01-01 (00000001) statement: a (code).\n\n- 2031-01-02 (00000002) statement: b (code).\n';
  const b = blocks(body);
  assert.equal(b.length, 2);
  assert.ok(b[0].startsWith('- 2031-01-01'));
  assert.ok(b[1].startsWith('- 2031-01-02'));
});

test('blocks: a multi-line wrapped entry stays one block', () => {
  const body = '- 2031-01-01 (00000001) statement: a line\n  that wraps over\n  three lines (code).';
  const b = blocks(body);
  assert.equal(b.length, 1);
  assert.equal(b[0], '- 2031-01-01 (00000001) statement: a line\n  that wraps over\n  three lines (code).');
});

test('blocks: a new "- " line starts a new block even without a blank separator', () => {
  // Two bullets back-to-back, no blank line between them.
  const body = '- 2031-01-01 (00000001) statement: a (code).\n- 2031-01-02 (00000002) statement: b (code).';
  const b = blocks(body);
  assert.equal(b.length, 2);
  assert.ok(b[1].startsWith('- 2031-01-02'));
});

test('blocks: wrapped lines after a bullet stay attached, then a new bullet splits', () => {
  const body = '- one\n  wrap-a\n  wrap-b\n- two\n  wrap-c';
  const b = blocks(body);
  assert.equal(b.length, 2);
  assert.equal(b[0], '- one\n  wrap-a\n  wrap-b');
  assert.equal(b[1], '- two\n  wrap-c');
});

test('blocks: empty / whitespace-only bodies produce no blocks', () => {
  assert.deepEqual(blocks(''), []);
  assert.deepEqual(blocks(null), []);
  assert.deepEqual(blocks(undefined), []);
  assert.deepEqual(blocks('\n\n  \n   \n'), []);
});

test('blocks: Windows-y CRLF blank lines still separate blocks', () => {
  // The blank separator is "\r" which trims to "" — must still split.
  const body = '- 2031-01-01 (00000001) statement: first (code).\r\n\r\n- 2031-01-02 (00000002) statement: second (code).\r';
  const b = blocks(body);
  assert.equal(b.length, 2);
  assert.ok(b[0].startsWith('- 2031-01-01'));
  assert.ok(b[1].startsWith('- 2031-01-02'));
});

test('blocks: leading non-bullet prose before the first bullet is dropped', () => {
  // Lines before any "- " with no open block are ignored.
  const body = 'stray prose line\nmore prose\n- 2031-01-01 (00000001) statement: a (code).';
  const b = blocks(body);
  assert.equal(b.length, 1);
  assert.ok(b[0].startsWith('- 2031-01-01'));
});

// ===========================================================================
// normWhy() — comparable why: strip head+provenance, collapse, drop trailing dot
// ===========================================================================

test('normWhy: two whys are equal iff the same sentence (backticks/ws/dot collapsed)', () => {
  const a = '- 2031-01-01 (00000001) replaced [[x]]: foo `bar`   baz qux (code).';
  const b = '- 2031-02-09 (deadbeef) replaced by [[y]]: foo bar baz qux (sourced)';
  assert.equal(normWhy(a), 'foo bar baz qux');
  assert.equal(normWhy(a), normWhy(b));
});

test('normWhy: em-dashes are preserved (not stripped), and survive equality', () => {
  const a = '- 2031-01-01 (00000001) replaced [[x]]: the stall — removed at eviction (code).';
  const b = '- 2031-01-01 (00000001) replaced by [[y]]: the stall — removed at eviction (code).';
  assert.equal(normWhy(a), 'the stall — removed at eviction');
  assert.equal(normWhy(a), normWhy(b));
});

test('normWhy: collapses interior whitespace runs and strips trailing dots', () => {
  // PROV removes "(code)" (with at most one optional dot); \s+ collapses runs;
  // a run of trailing dots in the content is removed by the final .replace.
  assert.equal(normWhy('- 2031-01-01 (00000001) statement:   spaced    out   text. (code).'), 'spaced out text');
  assert.equal(normWhy('- 2031-01-01 (00000001) statement: trailing dots here... (code)'), 'trailing dots here');
});

test('normWhy: a different sentence is NOT equal', () => {
  const a = '- 2031-01-01 (00000001) replaced [[x]]: reason alpha (code).';
  const b = '- 2031-01-01 (00000001) replaced by [[y]]: reason beta (code).';
  assert.notEqual(normWhy(a), normWhy(b));
});

test('normWhy: strips the [[link]] in the head before the colon', () => {
  const a = '- 2031-01-01 (00000001) replaced [[page-cache]]: the only thing kept (code).';
  assert.equal(normWhy(a), 'the only thing kept');
});

// ===========================================================================
// parseNode() — items / ## Facts / ## Moves split + heading order
// ===========================================================================

test('parseNode: splits items, Facts, Moves and records heading order', () => {
  const text = [
    '- item one (X).',
    '- item two.',
    '',
    '## Facts',
    '',
    '- 2031-01-01 (00000001) statement: f1 (code).',
    '',
    '## Moves',
    '',
    '- 2031-01-01 (00000001) replaced [[y]]: w (code).',
  ].join('\n');
  const n = parseNode(text);
  assert.deepEqual(n.headings, ['## Facts', '## Moves']);
  assert.ok(n.itemsText.includes('item one'));
  assert.ok(n.itemsText.includes('item two'));
  assert.ok(!n.itemsText.includes('## Facts'));
  assert.equal(n.facts.length, 1);
  assert.equal(n.moves.length, 1);
});

test('parseNode: a node with only items has empty facts/moves and no headings', () => {
  const n = parseNode('- just an item (X).');
  assert.deepEqual(n.headings, []);
  assert.deepEqual(n.facts, []);
  assert.deepEqual(n.moves, []);
  assert.ok(n.itemsText.includes('just an item'));
});

test('parseNode: records headings in file order (out-of-order is preserved for the linter)', () => {
  const text = '- i (X).\n\n## Moves\n\n- 2031-01-01 (00000001) dropped: c: w (code).\n\n## Facts\n\n- 2031-01-01 (00000001) statement: f (code).';
  const n = parseNode(text);
  // parseNode preserves source order so R-sections can detect it.
  assert.deepEqual(n.headings, ['## Moves', '## Facts']);
});

test('parseNode: an unknown heading is captured in the heading list', () => {
  const text = '- i (X).\n\n## Bogus\n\nstuff';
  const n = parseNode(text);
  assert.deepEqual(n.headings, ['## Bogus']);
});

// ===========================================================================
// parseEntry() — date, hash (8hex or null), kind, tag, isMove, verb
// ===========================================================================

test('parseEntry: a fact entry with hash', () => {
  const e = parseEntry('- 2031-04-02 (ab12cd34) measurement: cut latency 3.4x (code).');
  assert.equal(e.date, '2031-04-02');
  assert.equal(e.hash, 'ab12cd34');
  assert.equal(e.kind, 'measurement');
  assert.equal(e.tag, 'code');
  assert.equal(e.isMove, false);
  assert.equal(e.verb, null);
});

test('parseEntry: a fact entry with NO hash → hash is null', () => {
  const e = parseEntry('- 2031-02-01 statement: a general claim (sourced).');
  assert.equal(e.date, '2031-02-01');
  assert.equal(e.hash, null);
  assert.equal(e.kind, 'statement');
  assert.equal(e.tag, 'sourced');
  assert.equal(e.isMove, false);
});

test('parseEntry: a "replaced [[X]]" move → isMove, verb=replaced', () => {
  const e = parseEntry('- 2031-04-02 (ab12cd34) replaced [[write-through]]: w (code).');
  assert.equal(e.isMove, true);
  assert.equal(e.verb, 'replaced');
  assert.equal(e.hash, 'ab12cd34');
  // ENTRY_HEAD captures the verb phrase as the "kind" group here.
  assert.equal(e.kind, 'replaced');
});

test('parseEntry: a "replaced by [[X]]" move → verb=replaced by', () => {
  const e = parseEntry('- 2031-04-02 (ab12cd34) replaced by [[page-cache]]: w (code).');
  assert.equal(e.isMove, true);
  assert.equal(e.verb, 'replaced by');
  assert.equal(e.kind, 'replaced by');
});

test('parseEntry: dropped / removed / revived verbs', () => {
  const d = parseEntry('- 2031-01-01 (00000001) dropped: a capability: why (code).');
  assert.equal(d.isMove, true);
  assert.equal(d.verb, 'dropped');
  const r = parseEntry('- 2031-01-01 (00000001) removed: why (code).');
  assert.equal(r.isMove, true);
  assert.equal(r.verb, 'removed');
  const v = parseEntry('- 2031-01-01 (00000001) revived: why (code).');
  assert.equal(v.isMove, true);
  assert.equal(v.verb, 'revived');
});

test('parseEntry: tag is read from the provenance at the end (uncertain)', () => {
  const e = parseEntry('- 2031-02-02 rationale: chosen as baseline; no record (uncertain).');
  assert.equal(e.tag, 'uncertain');
  assert.equal(e.isMove, false);
});

test('parseEntry: a 7-hex hash is NOT a valid hash → date/hash/kind all null (head not matched)', () => {
  const e = parseEntry('- 2031-01-01 (0000001) statement: x (code).');
  // ENTRY_HEAD requires exactly 8 hex; with a 7-hex parenthetical the optional
  // hash group fails and the kind "(0000001) statement" is not a valid kind,
  // so the whole head fails to match.
  assert.equal(e.date, null);
  assert.equal(e.hash, null);
  assert.equal(e.kind, null);
});

test('parseEntry: flat collapses multi-line wraps to a single line', () => {
  const e = parseEntry('- 2031-01-01 (00000001) statement: line one\n  wrap two (code).');
  assert.equal(e.flat, '- 2031-01-01 (00000001) statement: line one wrap two (code).');
});

// raw regex spot checks (the source-of-truth for the rules above)
test('ENTRY_HEAD / PROV / MOVE_VERB raw behavior', () => {
  assert.ok(ENTRY_HEAD.test('- 2031-01-01 (00000001) statement: x (code).'));
  assert.ok(ENTRY_HEAD.test('- 2031-01-01 statement: x (code).')); // hash optional
  assert.ok(!ENTRY_HEAD.test('- not an entry head'));

  assert.ok(PROV.test('blah (code).'));
  assert.ok(PROV.test('blah (sourced)'));
  assert.ok(PROV.test('blah (uncertain).'));
  assert.ok(!PROV.test('blah (inferred).')); // only the three tiers

  assert.ok(MOVE_VERB.test('- x (00000001) replaced [[y]]: w'));
  assert.ok(MOVE_VERB.test('- x dropped: w'));
  assert.ok(!MOVE_VERB.test('- 2031-01-01 (00000001) statement: x (code).'));
});

// ===========================================================================
// logical() — strip .alt segments (pivot-proof), keep .fact
// ===========================================================================

test('logical: strips .alt segments so a pivot does not change a path', () => {
  assert.equal(logical('/r', '/r/a/b.alt/c.md'), 'a/b/c');
  // multiple .alt segments all stripped
  assert.equal(logical('/r', '/r/x.alt/y.alt/z.md'), 'x/y/z');
});

test('logical: keeps the .fact suffix (it is part of the logical name)', () => {
  assert.equal(logical('/r', '/r/a/b.fact/c.md'), 'a/b.fact/c');
});

test('logical: a plain main-tree path is unchanged', () => {
  assert.equal(logical('/r', '/r/acorn/page-cache.md'), 'acorn/page-cache');
});

// ===========================================================================
// resolve() — unique stem, ambiguous-by-nearness, .fact link, unresolvable
// ===========================================================================

test('resolve: a unique stem resolves regardless of frm', () => {
  const t = h.tmpTree(h.validFiles());
  try {
    const ctx = loadTree(t.root);
    const fromPC = ctx.nodeFiles.find((p) => h.posix(p).endsWith('/page-cache.md'));
    assert.equal(logical(ctx.root, ctx.resolve('acorn', fromPC)), 'acorn');
  } finally {
    t.cleanup();
  }
});

test('resolve: an unresolvable name returns null', () => {
  const t = h.tmpTree(h.validFiles());
  try {
    const ctx = loadTree(t.root);
    const from = ctx.nodeFiles[0];
    assert.equal(ctx.resolve('does-not-exist', from), null);
  } finally {
    t.cleanup();
  }
});

test('resolve: an explicit [[x.fact/slug]] link resolves to the fact file', () => {
  const t = h.tmpTree(h.validFiles());
  try {
    const ctx = loadTree(t.root);
    const fromPC = ctx.nodeFiles.find((p) => h.posix(p).endsWith('/page-cache.md'));
    const r = ctx.resolve('page-cache.fact/stall', fromPC);
    assert.ok(r);
    assert.equal(logical(ctx.root, r), 'acorn/page-cache.fact/stall');
  } finally {
    t.cleanup();
  }
});

test('resolve: an ambiguous stem is disambiguated by directory nearness', () => {
  // "dup" exists under x/ and under y/. Resolving from deep inside x/ picks
  // x's copy; from deep inside y/ picks y's copy.
  const files = {
    'root.md': '- Root (X).\n\n## Facts\n\n- 2031-01-01 (00000001) statement: r (code).\n',
    'root/x.md': '- x (X1).\n\n## Facts\n\n- 2031-01-01 (00000001) statement: x (code).\n',
    'root/x/dup.md': '- dup x (D).\n\n## Facts\n\n- 2031-01-01 (00000001) statement: dx (code).\n',
    'root/x/sub.md': '- subx (S).\n\n## Facts\n\n- 2031-01-01 (00000001) statement: s (code).\n',
    'root/x/sub/from.md': '- fromx (F).\n\n## Facts\n\n- 2031-01-01 (00000001) statement: f (code).\n',
    'root/y.md': '- y (Y1).\n\n## Facts\n\n- 2031-01-01 (00000001) statement: y (code).\n',
    'root/y/dup.md': '- dup y (D).\n\n## Facts\n\n- 2031-01-01 (00000001) statement: dy (code).\n',
    'root/y/sub.md': '- suby (S).\n\n## Facts\n\n- 2031-01-01 (00000001) statement: s (code).\n',
    'root/y/sub/from.md': '- fromy (F).\n\n## Facts\n\n- 2031-01-01 (00000001) statement: f (code).\n',
  };
  const t = h.tmpTree(files);
  try {
    const ctx = loadTree(t.root);
    const fromX = ctx.nodeFiles.find((p) => h.posix(p).endsWith('/x/sub/from.md'));
    const fromY = ctx.nodeFiles.find((p) => h.posix(p).endsWith('/y/sub/from.md'));
    assert.equal(logical(ctx.root, ctx.resolve('dup', fromX)), 'root/x/dup');
    assert.equal(logical(ctx.root, ctx.resolve('dup', fromY)), 'root/y/dup');
  } finally {
    t.cleanup();
  }
});

test('resolve: a stem ref with a path prefix resolves on the last segment', () => {
  const t = h.tmpTree(h.validFiles());
  try {
    const ctx = loadTree(t.root);
    const fromPC = ctx.nodeFiles.find((p) => h.posix(p).endsWith('/page-cache.md'));
    // "anything/acorn" resolves on the "acorn" tail.
    assert.equal(logical(ctx.root, ctx.resolve('whatever/acorn', fromPC)), 'acorn');
  } finally {
    t.cleanup();
  }
});

test('resolve (module export) callable directly with a ctx', () => {
  const t = h.tmpTree(h.validFiles());
  try {
    const ctx = loadTree(t.root);
    const fromPC = ctx.nodeFiles.find((p) => h.posix(p).endsWith('/page-cache.md'));
    assert.equal(resolve(ctx, 'acorn', fromPC), ctx.resolve('acorn', fromPC));
  } finally {
    t.cleanup();
  }
});

// ===========================================================================
// relatives() — children / alts / factFiles
// ===========================================================================

test('relatives: returns children, alts, and fact files of a node', () => {
  const t = h.tmpTree(h.validFiles());
  try {
    const ctx = loadTree(t.root);
    const acorn = ctx.nodeFiles.find((p) => h.posix(p).endsWith('/acorn.md'));
    const rel = relatives(ctx, acorn);
    // acorn/ has page-cache.md as a child
    assert.equal(rel.children.length, 1);
    assert.ok(h.posix(rel.children[0]).endsWith('/acorn/page-cache.md'));
    // acorn itself has no .alt/ and no .fact/
    assert.deepEqual(rel.alts, []);
    assert.deepEqual(rel.factFiles, []);
  } finally {
    t.cleanup();
  }
});

test('relatives: a node with an .alt member and a .fact file lists both', () => {
  const t = h.tmpTree(h.validFiles());
  try {
    const ctx = loadTree(t.root);
    const pc = ctx.nodeFiles.find((p) => h.posix(p).endsWith('/page-cache.md'));
    const rel = relatives(ctx, pc);
    assert.deepEqual(rel.children, []);
    assert.equal(rel.alts.length, 1);
    assert.ok(h.posix(rel.alts[0]).endsWith('/page-cache.alt/write-through.md'));
    assert.equal(rel.factFiles.length, 1);
    assert.ok(h.posix(rel.factFiles[0]).endsWith('/page-cache.fact/stall.md'));
  } finally {
    t.cleanup();
  }
});

// ===========================================================================
// loadTree() — partitions node files vs fact files vs dirs
// ===========================================================================

test('loadTree: separates node files from .fact/ files', () => {
  const t = h.tmpTree(h.validFiles());
  try {
    const ctx = loadTree(t.root);
    assert.equal(ctx.nodeFiles.length, 3); // acorn, page-cache, write-through
    assert.equal(ctx.factFiles.length, 1); // stall
    assert.ok(h.posix(ctx.factFiles[0]).endsWith('/stall.md'));
    // stem map keys present
    assert.ok(ctx.stems.has('acorn'));
    assert.ok(ctx.stems.has('page-cache'));
    assert.ok(ctx.stems.has('write-through'));
  } finally {
    t.cleanup();
  }
});

test('loadTree: throws on a missing root', () => {
  assert.throws(() => loadTree('/nonexistent/path/that/does/not/exist-xyz'), /tree root not found/);
});

// ===========================================================================
// LINT: validFiles is the clean baseline (no false positives)
// ===========================================================================

test('lint: the canonical valid tree is fully clean', async () => {
  const r = await h.lintFiles(h.validFiles());
  assertRules(r, [], 'valid baseline');
  assert.equal(r.nodeCount, 3);
  assert.equal(r.factCount, 1);
});

// ---- R-tail: rationale tail in an item ("because" rejected, "since" allowed) ----

test('lint R-tail: "because" tail in an item fires R-tail (only)', async () => {
  const files = perturb('acorn.md', (s) =>
    s.replace('- Acorn stores key-value pairs, one value per key (`Store`).',
      '- Acorn stores key-value pairs because it must (`Store`).'));
  assertRules(await h.lintFiles(files), ['R-tail'], 'because');
});

test('lint R-tail: "so that" tail in an item fires R-tail', async () => {
  const files = perturb('acorn.md', (s) =>
    s.replace('- Acorn stores key-value pairs, one value per key (`Store`).',
      '- Acorn stores pairs, so that reads are fast (`Store`).'));
  assertRules(await h.lintFiles(files), ['R-tail'], 'so that');
});

test('lint R-tail: "since" is allowed in an item (no false positive)', async () => {
  const files = perturb('acorn.md', (s) =>
    s.replace('- Acorn stores key-value pairs, one value per key (`Store`).',
      '- Acorn stores key-value pairs since it began (`Store`).'));
  assertRules(await h.lintFiles(files), [], 'since allowed');
});

// ---- R-prov: missing provenance tag ----

test('lint R-prov: an entry with no provenance tag fires R-prov (only)', async () => {
  const files = perturb('acorn.md', (s) => s.replace('(code).', '.'));
  assertRules(await h.lintFiles(files), ['R-prov'], 'missing prov');
});

test('lint: a valid trailing-dot-after-tag entry is clean (no R-prov false positive)', async () => {
  // PROV allows an optional "." after the tag; validFiles already uses "(code)."
  // Re-affirm a "(sourced)." form is fine.
  const files = perturb('acorn.md', (s) => s.replace('(code).', '(sourced).'));
  assertRules(await h.lintFiles(files), [], 'sourced. is clean');
});

// ---- R-entry: malformed entry head ----

test('lint R-entry: a 7-hex hash makes a malformed head → R-entry fires', async () => {
  const files = perturb('acorn.md', (s) => s.replace('(00000001)', '(0000001)'));
  const r = await h.lintFiles(files);
  assert.ok(r.rules.includes('R-entry'), `expected R-entry, got ${JSON.stringify(r.rules)}`);
});

test('lint: a valid 8-hex hash entry is clean (no R-entry false positive)', async () => {
  // Baseline already uses 8-hex; confirm replacing with another 8-hex stays clean.
  const files = perturb('acorn.md', (s) => s.replace('(00000001)', '(0a0b0c0d)'));
  assertRules(await h.lintFiles(files), [], '8-hex clean');
});

test('lint: an entry with NO hash (general statement) is clean — hash is optional', async () => {
  const files = perturb('acorn.md', (s) =>
    s.replace('- 2031-02-01 (00000001) statement:', '- 2031-02-01 statement:'));
  assertRules(await h.lintFiles(files), [], 'no-hash allowed');
});

// ---- R-link: unresolvable link; backtick code span is not a link ----

test('lint R-link: an unresolvable [[link]] fires R-link', async () => {
  const files = perturb('acorn.md', (s) =>
    s.replace('- Acorn stores key-value pairs, one value per key (`Store`).',
      '- Acorn links to [[not-a-real-node]] here (`Store`).'));
  assertRules(await h.lintFiles(files), ['R-link'], 'bad link');
});

test('lint R-link: a [[...]] inside a backtick code span is NOT treated as a link', async () => {
  const files = perturb('acorn.md', (s) =>
    s.replace('- Acorn stores key-value pairs, one value per key (`Store`).',
      '- Acorn uses `[[not-a-real-node]]` syntax in code (`Store`).'));
  assertRules(await h.lintFiles(files), [], 'codespan not a link');
});

// ---- R-pair: verbatim-why on both halves of a re-decision ----

test('lint R-pair: a why that differs from its twin fires R-pair', async () => {
  const files = perturb('acorn/page-cache.md', (s) =>
    s.replace('write-through stalled every mutation on disk latency; batching at eviction removed the stall (code).',
      'a completely different reason that does not match the twin (code).'));
  assertRules(await h.lintFiles(files), ['R-pair'], 'why mismatch');
});

test('lint: the paired move with identical whys is clean (no R-pair false positive)', async () => {
  // Re-style only the trailing dot / backticks on one side: normWhy must collapse
  // these so the pair still matches.
  const files = perturb('acorn/page-cache.md', (s) =>
    s.replace('batching at eviction removed the stall (code).',
      'batching at eviction removed the stall. (code).'));
  assertRules(await h.lintFiles(files), [], 'cosmetic-only twin is clean');
});

// ---- R-sections: unexpected / out-of-order headings ----

test('lint R-sections: an unexpected heading fires R-sections', async () => {
  const files = perturb('acorn.md', (s) => s + '\n## Notes\n\nsome notes\n');
  const r = await h.lintFiles(files);
  assert.ok(r.rules.includes('R-sections'), `expected R-sections, got ${JSON.stringify(r.rules)}`);
});

test('lint R-sections: Moves-before-Facts fires R-sections (order)', async () => {
  // Build a node where Moves appears before Facts.
  const files = h.validFiles();
  files['acorn/page-cache.md'] = [
    '- Reads go through a fixed-size page cache (`PageCache`); a page loads from disk only on a miss.',
    '',
    '## Moves',
    '',
    '- 2031-04-02 (ab12cd34) replaced [[write-through]]: write-through stalled every mutation on disk latency; batching at eviction removed the stall (code).',
    '',
    '## Facts',
    '',
    '- 2031-04-02 (ab12cd34) measurement: batching at eviction cut ingest latency 3.4x — data in [[page-cache.fact/stall]] (code).',
  ].join('\n') + '\n';
  const r = await h.lintFiles(files);
  assert.ok(r.rules.includes('R-sections'), `expected R-sections, got ${JSON.stringify(r.rules)}`);
});

// ---- R-frozen: an .alt member's Moves must end in replaced by / removed ----

test('lint R-frozen: an .alt member whose Moves end in "revived" fires R-frozen', async () => {
  const files = h.validFiles();
  files['acorn/page-cache.alt/write-through.md'] =
    '- Every mutation writes its page to disk before returning.\n\n## Moves\n\n- 2031-04-02 (ab12cd34) revived: came back (code).\n';
  const r = await h.lintFiles(files);
  assert.ok(r.rules.includes('R-frozen'), `expected R-frozen, got ${JSON.stringify(r.rules)}`);
});

test('lint: the .alt member ending in "replaced by" is clean (no R-frozen false positive)', async () => {
  // This is exactly the valid baseline shape — re-affirm it does not fire R-frozen.
  const r = await h.lintFiles(h.validFiles());
  assert.ok(!r.rules.includes('R-frozen'), 'baseline must not fire R-frozen');
});

// ---- R-thin: a module-map node with no decision; --skeleton skips it ----

test('lint R-thin: a leaf node with no facts/moves/children/alts fires R-thin', async () => {
  const files = h.validFiles();
  // Add a thin child with nothing but an item.
  files['acorn/page-cache/thin.md'] = '- A purely descriptive component (Thing).\n';
  const r = await h.lintFiles(files);
  assert.ok(r.rules.includes('R-thin'), `expected R-thin, got ${JSON.stringify(r.rules)}`);
});

test('lint --skeleton: R-thin is skipped under skeleton mode', async () => {
  const files = h.validFiles();
  files['acorn/page-cache/thin.md'] = '- A purely descriptive component (Thing).\n';
  const r = await h.lintFiles(files, { skeleton: true });
  assert.ok(!r.rules.includes('R-thin'), `R-thin must be skipped under --skeleton, got ${JSON.stringify(r.rules)}`);
});

// ---- R-orphan / R-empty: structure dirs ----

test('lint R-empty: an empty .alt/ directory fires R-empty', async () => {
  const files = h.validFiles();
  // Put a placeholder (non-.md) so the dir exists but has no .md node.
  files['acorn/page-cache.alt/.keep'] = 'x';
  // Remove the real alt member so the dir is genuinely empty of .md.
  delete files['acorn/page-cache.alt/write-through.md'];
  const r = await h.lintFiles(files);
  assert.ok(r.rules.includes('R-empty'), `expected R-empty, got ${JSON.stringify(r.rules)}`);
});

test('lint R-orphan: a .fact/ dir with no sibling .md fires R-orphan', async () => {
  const files = h.validFiles();
  // A fact dir whose sibling node does not exist.
  files['acorn/ghost.fact/doc.md'] = 'commit: ab12cd34\n\nsome body prose.\n';
  const r = await h.lintFiles(files);
  assert.ok(r.rules.includes('R-orphan'), `expected R-orphan, got ${JSON.stringify(r.rules)}`);
});

// ---- R-root: exactly one top-level node ----

test('lint R-root: a second top-level node fires R-root', async () => {
  const files = h.validFiles();
  files['second-root.md'] = '- another root (Y).\n\n## Facts\n\n- 2031-01-01 (00000001) statement: y (code).\n';
  const r = await h.lintFiles(files);
  assert.ok(r.rules.includes('R-root'), `expected R-root, got ${JSON.stringify(r.rules)}`);
});

// ---- R-verb: a Moves entry with no boundary verb ----

test('lint R-verb: a Moves entry using a non-boundary verb fires R-verb', async () => {
  const files = h.validFiles();
  // Replace the valid move line with one that has a valid head + tag but no
  // boundary verb (so R-entry/R-prov stay quiet and only R-verb fires alongside
  // the now-broken pair).
  files['acorn/page-cache.md'] = [
    '- Reads go through a fixed-size page cache (`PageCache`); a page loads from disk only on a miss.',
    '',
    '## Facts',
    '',
    '- 2031-04-02 (ab12cd34) measurement: batching at eviction cut ingest latency 3.4x — data in [[page-cache.fact/stall]] (code).',
    '',
    '## Moves',
    '',
    '- 2031-04-02 (ab12cd34) statement: not actually a move verb (code).',
  ].join('\n') + '\n';
  const r = await h.lintFiles(files);
  assert.ok(r.rules.includes('R-verb'), `expected R-verb, got ${JSON.stringify(r.rules)}`);
});

// ---- R-factfile: a .fact/ file must not contain headings ----

test('lint R-factfile: a heading inside a fact file fires R-factfile', async () => {
  const files = perturb('acorn/page-cache.fact/stall.md', (s) => '## A heading\n\n' + s);
  const r = await h.lintFiles(files);
  assert.ok(r.rules.includes('R-factfile'), `expected R-factfile, got ${JSON.stringify(r.rules)}`);
});

test('lint: a heading-free fact file is clean (no R-factfile false positive)', async () => {
  const r = await h.lintFiles(h.validFiles());
  assert.ok(!r.rules.includes('R-factfile'), 'baseline fact file must not fire R-factfile');
});

// ---- R-title: a file starting with a heading ----

test('lint R-title: a node starting with a heading fires R-title', async () => {
  const files = perturb('acorn.md', (s) => '# Acorn\n\n' + s);
  const r = await h.lintFiles(files);
  assert.ok(r.rules.includes('R-title'), `expected R-title, got ${JSON.stringify(r.rules)}`);
});

// ---- R-meta: workflow-metadata vocabulary ----

test('lint R-meta: construction-bookkeeping vocabulary fires R-meta', async () => {
  const files = perturb('acorn.md', (s) =>
    s.replace('- Acorn stores key-value pairs, one value per key (`Store`).',
      '- Acorn stores key-value pairs; see the design tree note (`Store`).'));
  const r = await h.lintFiles(files);
  assert.ok(r.rules.includes('R-meta'), `expected R-meta, got ${JSON.stringify(r.rules)}`);
});

// ===========================================================================
// END-TO-END CLI behavior & exit codes
// ===========================================================================

test('cli lint: clean tree exits 0 with a summary', () => {
  const t = h.tmpTree(h.validFiles());
  try {
    const r = h.runCli(['lint', t.root]);
    assert.equal(r.code, 0);
    assert.match(r.stdout, /lint clean: 3 nodes, 1 fact files/);
  } finally {
    t.cleanup();
  }
});

test('cli lint: a violation exits 1 and prints the rule', () => {
  const files = perturb('acorn.md', (s) => s.replace('(code).', '.'));
  const t = h.tmpTree(files);
  try {
    const r = h.runCli(['lint', t.root]);
    assert.equal(r.code, 1);
    assert.match(r.stderr, /\[R-prov\]/);
    assert.match(r.stderr, /violation/);
  } finally {
    t.cleanup();
  }
});

test('cli lint: missing root reports an error and exits 1', () => {
  const r = h.runCli(['lint', '/nope/does/not/exist-zzz']);
  assert.equal(r.code, 1);
  assert.match(r.stderr, /tree root not found|mcts-mem lint/);
});

test('cli show: a known node prints items, Facts and Moves; exits 0', () => {
  const t = h.tmpTree(h.validFiles());
  try {
    const r = h.runCli(['show', 'page-cache', t.root]);
    assert.equal(r.code, 0);
    assert.match(r.stdout, /## Facts/);
    assert.match(r.stdout, /## Moves/);
    assert.match(r.stdout, /page cache/i);
  } finally {
    t.cleanup();
  }
});

test('cli show: an unknown node exits 1 with a no-match message', () => {
  const t = h.tmpTree(h.validFiles());
  try {
    const r = h.runCli(['show', 'no-such-node', t.root]);
    assert.equal(r.code, 1);
    assert.match(r.stdout, /no node matches/);
  } finally {
    t.cleanup();
  }
});

test('cli show: an .alt member is labeled superseded/rejected', () => {
  const t = h.tmpTree(h.validFiles());
  try {
    const r = h.runCli(['show', 'write-through', t.root]);
    assert.equal(r.code, 0);
    assert.match(r.stdout, /superseded|rejected|\.alt/);
  } finally {
    t.cleanup();
  }
});

test('cli show: with no <node> argument exits 2', () => {
  const r = h.runCli(['show']);
  assert.equal(r.code, 2);
  assert.match(r.stderr, /needs a <node>/);
});

test('cli view: renders the root and a child; --alt walks rejected alternatives', () => {
  const t = h.tmpTree(h.validFiles());
  try {
    const plain = h.runCli(['view', t.root]);
    assert.equal(plain.code, 0);
    assert.match(plain.stdout, /acorn/);
    assert.match(plain.stdout, /page-cache/);
    // The .alt member is hidden without --alt.
    assert.ok(!plain.stdout.includes('write-through'), 'plain view must hide .alt members');

    const alt = h.runCli(['view', t.root, '--alt']);
    assert.equal(alt.code, 0);
    assert.match(alt.stdout, /write-through/);
  } finally {
    t.cleanup();
  }
});

test('cli uncertain: clean tree reports no open uncertainties; exits 0', () => {
  const t = h.tmpTree(h.validFiles());
  try {
    const r = h.runCli(['uncertain', t.root]);
    assert.equal(r.code, 0);
    assert.match(r.stdout, /no open uncertainties/);
  } finally {
    t.cleanup();
  }
});

test('cli uncertain: an (uncertain) entry is listed under its node', () => {
  const files = perturb('acorn.md', (s) =>
    s.replace('- 2031-02-01 (00000001) statement: the store is a single append-only file on disk (code).',
      '- 2031-02-01 (00000001) statement: the store is a single append-only file on disk (code).\n- 2031-02-02 rationale: chosen as baseline; no record (uncertain).'));
  const t = h.tmpTree(files);
  try {
    const r = h.runCli(['uncertain', t.root]);
    assert.equal(r.code, 0);
    assert.match(r.stdout, /1 uncertain entry/);
    assert.match(r.stdout, /acorn/);
    assert.match(r.stdout, /chosen as baseline/);
  } finally {
    t.cleanup();
  }
});

test('cli help / version / unknown command', () => {
  assert.equal(h.runCli(['help']).code, 0);
  assert.equal(h.runCli([]).code, 0); // no command -> help
  assert.match(h.runCli(['--version']).stdout, /^0\.\d/);
  const unk = h.runCli(['frobnicate']);
  assert.equal(unk.code, 2);
  assert.match(unk.stderr, /unknown command/);
});

// ===========================================================================
// R-append: append-only-vs-HEAD git check
// ===========================================================================

// NOTE: This test asserts the SPECIFIED behavior and currently FAILS — it
// documents a real CLI bug. The R-append check computes
//   path.relative(git_toplevel, nodeFilePath)
// where git_toplevel comes from `git rev-parse --show-toplevel` (which returns a
// realpath-canonicalized path) but nodeFilePath comes from loadTree's
// `path.resolve(root)` (which does NOT resolve symlinks). When the tree lives
// under a symlinked path — the macOS default temp dir, or any repo whose path
// contains a symlink — the two bases disagree, `git show HEAD:<rel>` fails for
// every node, each file is silently treated as "new" and skipped, and the
// append-only check becomes a no-op. The companion test below proves the check
// itself is correct once the paths are aligned, isolating the defect to the
// missing realpath normalization in loadTree/lint.
test('cli lint R-append: editing a committed Facts entry fires R-append', () => {
  const t = h.tmpTree(h.validFiles());
  try {
    h.gitInitCommit(t.dir);
    // Mutate a committed fact's text in the working tree (still grammar-clean,
    // so only the append-only-vs-HEAD check should object).
    t.write('acorn.md',
      h.validFiles()['acorn.md'].replace('a single append-only file on disk',
        'TWO append-only files on disk'));
    const r = h.runCli(['lint', t.root]);
    assert.equal(r.code, 1);
    assert.match(r.stderr, /\[R-append\]/);
  } finally {
    t.cleanup();
  }
});

// Companion: when the root path is already canonical (realpath-resolved, so it
// matches `git rev-parse --show-toplevel`), the R-append check works correctly.
// This pins the working half of the rule and localizes the bug above to the
// symlinked-path / missing-realpath gap rather than the check logic itself.
test('lint R-append (realpath root): editing a committed entry fires R-append', async () => {
  const t = h.tmpTree(h.validFiles());
  try {
    h.gitInitCommit(t.dir);
    t.write('acorn.md',
      h.validFiles()['acorn.md'].replace('a single append-only file on disk',
        'TWO append-only files on disk'));
    const fs = await import('node:fs');
    const realRoot = fs.realpathSync(t.root);
    const { lint } = await import('../src/lint.js');
    const r = lint(realRoot, {});
    const rules = r.errors.map((e) => e.rule);
    assert.ok(rules.includes('R-append'), `expected R-append, got ${JSON.stringify(rules)}`);
  } finally {
    t.cleanup();
  }
});

test('cli lint R-append: an untouched committed tree is clean for R-append', () => {
  const t = h.tmpTree(h.validFiles());
  try {
    h.gitInitCommit(t.dir);
    const r = h.runCli(['lint', t.root]);
    assert.equal(r.code, 0, `expected clean, stderr=${r.stderr}`);
    assert.ok(!r.stderr.includes('R-append'));
  } finally {
    t.cleanup();
  }
});

test('cli lint: a committed edit fires R-append; re-committing it clears it', () => {
  const t = h.tmpTree(h.validFiles());
  try {
    h.gitInitCommit(t.dir);
    t.write('acorn.md',
      h.validFiles()['acorn.md'].replace('a single append-only file on disk',
        'TWO append-only files on disk'));
    const edited = h.runCli(['lint', t.root]);
    assert.equal(edited.code, 1, `expected R-append after a committed edit, stderr=${edited.stderr}`);
    // a sanctioned rewrite is finalized by committing it → HEAD is the new baseline
    h.gitInitCommit(t.dir, 'migrate');
    const recommitted = h.runCli(['lint', t.root]);
    assert.equal(recommitted.code, 0, `expected clean after re-commit, stderr=${recommitted.stderr}`);
  } finally {
    t.cleanup();
  }
});
