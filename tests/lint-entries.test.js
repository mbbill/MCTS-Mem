// Per-entry lint rules for the mcts-mem design-tree linter.
//
// Scope: the rules that govern a single Facts/Moves *entry* (and the whole-text
// R-meta scan):
//   R-entry      entry head well-formed ("- <date> [(<8hex>)] <kind>:" or a move "[[link]]:")
//   R-prov       entry ends in exactly one of (code)/(sourced)/(uncertain)
//   R-verb       a Moves entry carries a boundary verb
//                (replaced / replaced by / dropped / removed / revived)
//   R-join       one claim per entry (reject which is why / that is why / the
//                reason / hence / therefore)
//   R-redundant  a rationale fact must not share a commit hash with a Moves
//                entry on the same node
//   R-meta       tree text must not contain construction vocabulary
//                (ledger / batch report / design tree / extraction run / deferred until)
//
// Method: start from helpers.validFiles() (a fully lint-clean tree) and perturb
// exactly ONE thing, so we know which rule should fire. Each test asserts both
// that the target rule fires AND that no unrelated rule false-positives.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as h from './helpers.js';

// ---- small assertion helpers -------------------------------------------------

// The only rules a given perturbation is allowed to raise, exactly.
function assertOnly(rules, expected) {
  const want = [...expected].sort();
  const got = [...rules].sort();
  assert.deepEqual(got, want,
    `expected exactly rules ${JSON.stringify(want)} but got ${JSON.stringify(got)}`);
}

// A rule must be present (it may also be accompanied by others — use sparingly).
function assertHas(rules, rule) {
  assert.ok(rules.includes(rule), `expected rule ${rule} in ${JSON.stringify(rules)}`);
}

// A rule must be absent.
function assertLacks(rules, rule) {
  assert.ok(!rules.includes(rule), `did not expect rule ${rule} in ${JSON.stringify(rules)}`);
}

// Build a files-map from validFiles() with one node file replaced.
function withNode(rel, content) {
  const f = h.validFiles();
  f[rel] = content;
  return f;
}

// Replace just the Facts section body of acorn/page-cache.md, leaving its (clean,
// paired) Moves section intact — so only Facts-side rules can fire.
function pageCacheFacts(factsBody) {
  return withNode('acorn/page-cache.md',
`- Reads go through a fixed-size page cache (\`PageCache\`).

## Facts

${factsBody}

## Moves

- 2031-04-02 (ab12cd34) replaced [[write-through]]: write-through stalled every mutation on disk latency; batching at eviction removed the stall (code).
`);
}

// A page-cache.md with ONLY a Moves section (no Facts, no paired loser concerns
// unless the body keeps the (ab12cd34) replaced pairing). The .alt twin in
// validFiles() still ends in 'replaced by', satisfying R-frozen.
function pageCacheMoves(movesBody) {
  return withNode('acorn/page-cache.md',
`- Reads go through a fixed-size page cache (\`PageCache\`).

## Moves

${movesBody}
`);
}

// =============================================================================
// Baseline: validFiles() is lint-clean. Every perturbation test relies on this.
// =============================================================================

test('baseline: validFiles() lints completely clean', async () => {
  const r = await h.lintFiles(h.validFiles());
  assert.deepEqual(r.rules, [], `validFiles should be clean, got ${JSON.stringify(r.errors)}`);
  assert.equal(r.nodeCount, 3);
  assert.equal(r.factCount, 1);
});

// =============================================================================
// R-entry — Facts/Moves entry head well-formed
//   /^- (\d{4}-\d{2}-\d{2})( \(([0-9a-f]{8})\))? ([a-z][a-z -]*?)(:| \[\[)/
// =============================================================================

test('R-entry: clean head with hash + kind + colon does NOT fire', async () => {
  const r = await h.lintFiles(pageCacheFacts(
    '- 2031-04-02 (ab12cd34) measurement: batching cut latency (code).'));
  assertOnly(r.rules, []);
});

test('R-entry: head with NO hash is valid (hash is optional)', async () => {
  const r = await h.lintFiles(pageCacheFacts(
    '- 2031-04-02 measurement: a general claim not pinned to a commit (sourced).'));
  assertOnly(r.rules, []);
});

test('R-entry: kind with an internal space (e.g. "measurement table") is valid', async () => {
  const r = await h.lintFiles(pageCacheFacts(
    '- 2031-04-02 (ab12cd34) measurement table: see the figures (code).'));
  assertOnly(r.rules, []);
});

test('R-entry: 7-hex hash fires R-entry (must be exactly 8)', async () => {
  const r = await h.lintFiles(pageCacheFacts(
    '- 2031-04-02 (ab12cd3) measurement: too few hex digits (code).'));
  assertOnly(r.rules, ['R-entry']);
});

test('R-entry: 9-hex hash fires R-entry (must be exactly 8)', async () => {
  const r = await h.lintFiles(pageCacheFacts(
    '- 2031-04-02 (ab12cd345) measurement: too many hex digits (code).'));
  assertOnly(r.rules, ['R-entry']);
});

test('R-entry: non-hex character in the hash fires R-entry', async () => {
  const r = await h.lintFiles(pageCacheFacts(
    '- 2031-04-02 (ab12cd3g) measurement: g is not hex (code).'));
  assertOnly(r.rules, ['R-entry']);
});

test('R-entry: uppercase kind fires R-entry (kind must be lowercase)', async () => {
  const r = await h.lintFiles(pageCacheFacts(
    '- 2031-04-02 (ab12cd34) Measurement: leading cap (code).'));
  assertOnly(r.rules, ['R-entry']);
});

test('R-entry: malformed date (single-digit month) fires R-entry', async () => {
  const r = await h.lintFiles(pageCacheFacts(
    '- 2031-4-02 (ab12cd34) measurement: bad date (code).'));
  assertOnly(r.rules, ['R-entry']);
});

test('R-entry: missing the colon / link terminator fires R-entry', async () => {
  const r = await h.lintFiles(pageCacheFacts(
    '- 2031-04-02 (ab12cd34) measurement no terminator here (code).'));
  assertOnly(r.rules, ['R-entry']);
});

test('R-entry: a move head ("- <date> (<hash>) <verb> [[link]]:") is a valid entry head', async () => {
  // The original page-cache Moves line uses the " [[" terminator form — already
  // covered by baseline. Here we add a second clean Facts line that uses the
  // colon form to re-confirm both terminators are accepted side by side.
  const r = await h.lintFiles(pageCacheFacts(
    `- 2031-04-02 (ab12cd34) measurement: batching cut ingest latency 3.4x (code).
- 2031-04-03 (dd11dd11) statement: the cache is fixed-size (code).`));
  assertOnly(r.rules, []);
});

// =============================================================================
// R-prov — entry ends in exactly one (code)/(sourced)/(uncertain)
//   /\((code|sourced|uncertain)\)\.?\s*$/
// =============================================================================

test('R-prov: each of the three tags is accepted', async () => {
  for (const tag of ['code', 'sourced', 'uncertain']) {
    const r = await h.lintFiles(pageCacheFacts(
      `- 2031-04-02 (ab12cd34) measurement: a claim (${tag}).`));
    assertOnly(r.rules, []);
  }
});

test('R-prov: a trailing "." after the tag is allowed', async () => {
  const r = await h.lintFiles(pageCacheFacts(
    '- 2031-04-02 (ab12cd34) measurement: a claim (code).'));
  assertOnly(r.rules, []);
});

test('R-prov: tag without trailing dot is allowed', async () => {
  const r = await h.lintFiles(pageCacheFacts(
    '- 2031-04-02 (ab12cd34) measurement: a claim (code)'));
  assertOnly(r.rules, []);
});

test('R-prov: missing tag fires R-prov (and nothing else)', async () => {
  const r = await h.lintFiles(pageCacheFacts(
    '- 2031-04-02 (ab12cd34) measurement: no tag at all.'));
  assertOnly(r.rules, ['R-prov']);
});

test('R-prov: uppercase tag (Code) fires R-prov', async () => {
  const r = await h.lintFiles(pageCacheFacts(
    '- 2031-04-02 (ab12cd34) measurement: wrong case (Code).'));
  assertOnly(r.rules, ['R-prov']);
});

test('R-prov: invented tag (inferred) fires R-prov — there is no inferred tier', async () => {
  const r = await h.lintFiles(pageCacheFacts(
    '- 2031-04-02 (ab12cd34) measurement: my reading (inferred).'));
  assertOnly(r.rules, ['R-prov']);
});

test('R-prov: tag present but not at the end fires R-prov', async () => {
  const r = await h.lintFiles(pageCacheFacts(
    '- 2031-04-02 (ab12cd34) measurement: (code) then trailing prose afterward.'));
  assertOnly(r.rules, ['R-prov']);
});

test('R-prov: em-dash and backticks in the why do not break the tag detection', async () => {
  const r = await h.lintFiles(pageCacheFacts(
    '- 2031-04-02 (ab12cd34) measurement: the `PageCache` won — by 3.4x (sourced).'));
  assertOnly(r.rules, []);
});

test('R-prov: a multi-line (wrapped) entry whose tag ends the LAST line is clean', async () => {
  const r = await h.lintFiles(pageCacheFacts(
    `- 2031-04-02 (ab12cd34) measurement: this fact wraps onto a second
  continuation line and the tag closes it out (code).`));
  assertOnly(r.rules, []);
});

test('R-prov: a wrapped entry with the tag on the FIRST line (continuation after) fires R-prov', async () => {
  // PROV anchors with $ (no /m), so the tag must terminate the whole block.
  const r = await h.lintFiles(pageCacheFacts(
    `- 2031-04-02 (ab12cd34) measurement: tag is here (code)
  but then prose continues on a wrapped line`));
  assertOnly(r.rules, ['R-prov']);
});

// =============================================================================
// R-verb — a Moves entry must carry a boundary verb
//   replaced [[X]] / replaced by [[X]] / dropped / removed / revived
// =============================================================================

test('R-verb: a Moves entry with kind but no boundary verb fires R-verb', async () => {
  // "statement" is a valid entry head but not a move verb. Removing the paired
  // 'replaced' from page-cache means R-pair has nothing to check; the .alt twin
  // still ends in 'replaced by', so R-frozen stays quiet.
  const r = await h.lintFiles(pageCacheMoves(
    '- 2031-04-02 (ab12cd34) statement: this belongs in Facts, not Moves (code).'));
  assertOnly(r.rules, ['R-verb']);
});

test('R-verb: "replaced" without a [[link]] fires R-verb (verb form requires the link)', async () => {
  const r = await h.lintFiles(pageCacheMoves(
    '- 2031-04-02 (ab12cd34) replaced the old write path: it stalled (code).'));
  // ENTRY_HEAD still parses ("replaced the old write path" is a kind), so R-entry
  // is quiet; only the verb form is wrong.
  assertOnly(r.rules, ['R-verb']);
});

test('R-verb: "dropped:" (no successor, no hash) is a valid boundary verb', async () => {
  const r = await h.lintFiles(pageCacheMoves(
    '- 2031-04-02 dropped: the experimental prefetch path; it never paid off (code).'));
  assertOnly(r.rules, []);
});

test('R-verb: "removed:" is a valid boundary verb', async () => {
  const r = await h.lintFiles(pageCacheMoves(
    '- 2031-04-02 (ab12cd34) removed: the legacy cache, no successor (code).'));
  assertOnly(r.rules, []);
});

test('R-verb: "revived:" is a valid boundary verb', async () => {
  const r = await h.lintFiles(pageCacheMoves(
    '- 2031-04-02 (ab12cd34) revived: the prefetch path now pays off (code).'));
  assertOnly(r.rules, []);
});

test('R-verb does NOT fire on Facts entries (it is Moves-only)', async () => {
  // A Facts entry with no verb is normal; R-verb must not be raised for Facts.
  const r = await h.lintFiles(pageCacheFacts(
    '- 2031-04-02 (ab12cd34) measurement: plain fact, no verb (code).'));
  assertLacks(r.rules, 'R-verb');
  assertOnly(r.rules, []);
});

test('R-verb: the baseline paired "replaced [[..]]" move is accepted', async () => {
  // Sanity: the validFiles() move already carries a verb — confirm via baseline-ish.
  const r = await h.lintFiles(h.validFiles());
  assertLacks(r.rules, 'R-verb');
});

// =============================================================================
// R-join — one claim per entry
//   /\b(which is why|that is why|the reason|hence|therefore)\b/i
// =============================================================================

test('R-join: "which is why" in a Facts entry fires R-join', async () => {
  const r = await h.lintFiles(pageCacheFacts(
    '- 2031-04-03 (dd11dd11) rationale: it stalled which is why batching won (code).'));
  assertOnly(r.rules, ['R-join']);
});

test('R-join: "that is why" fires', async () => {
  const r = await h.lintFiles(pageCacheFacts(
    '- 2031-04-03 (dd11dd11) rationale: it stalled that is why batching won (code).'));
  assertOnly(r.rules, ['R-join']);
});

test('R-join: "the reason" fires', async () => {
  const r = await h.lintFiles(pageCacheFacts(
    '- 2031-04-03 (dd11dd11) rationale: the reason batching won was the stall (code).'));
  assertOnly(r.rules, ['R-join']);
});

test('R-join: "hence" fires', async () => {
  const r = await h.lintFiles(pageCacheFacts(
    '- 2031-04-03 (dd11dd11) rationale: it stalled hence batching won (code).'));
  assertOnly(r.rules, ['R-join']);
});

test('R-join: "therefore" fires (case-insensitive)', async () => {
  const r = await h.lintFiles(pageCacheFacts(
    '- 2031-04-03 (dd11dd11) rationale: it stalled Therefore batching won (code).'));
  assertOnly(r.rules, ['R-join']);
});

test('R-join: a multi-line entry that splits the phrase across the wrap still fires', async () => {
  // flat = block.replace(/\s+/g,' ') joins lines, so "which is\n  why" -> "which is why".
  const r = await h.lintFiles(pageCacheFacts(
    `- 2031-04-03 (dd11dd11) rationale: it stalled which is
  why batching won (code).`));
  assertOnly(r.rules, ['R-join']);
});

test('R-join NEGATIVE: "henceforth" does not fire (word boundary)', async () => {
  const r = await h.lintFiles(pageCacheFacts(
    '- 2031-04-03 (dd11dd11) rationale: henceforth batching is the default (code).'));
  assertOnly(r.rules, []);
});

test('R-join NEGATIVE: "since" / "because" are NOT R-join words', async () => {
  // (R-join is the entry-chaining rule; "since"/"because" tails are an Items
  // concern, not a Facts/Moves R-join concern.)
  const r1 = await h.lintFiles(pageCacheFacts(
    '- 2031-04-03 (dd11dd11) rationale: batching won since the stall vanished (code).'));
  assertLacks(r1.rules, 'R-join');
  assertOnly(r1.rules, []);
  const r2 = await h.lintFiles(pageCacheFacts(
    '- 2031-04-03 (dd11dd11) rationale: batching won because the stall vanished (code).'));
  assertLacks(r2.rules, 'R-join');
  assertOnly(r2.rules, []);
});

test('R-join: fires inside a Moves entry too (and on both paired sides)', async () => {
  // Inject the chained phrase into BOTH halves of a replaced/replaced-by pair,
  // keeping the why verbatim-identical so R-pair stays quiet. R-join fires once
  // per side.
  const f = h.validFiles();
  f['acorn/page-cache.md'] =
`- Reads go through a fixed-size page cache (\`PageCache\`).

## Moves

- 2031-04-02 (ab12cd34) replaced [[write-through]]: it stalled which is why batching won (code).
`;
  f['acorn/page-cache.alt/write-through.md'] =
`- Every mutation writes its page to disk before returning.

## Moves

- 2031-04-02 (ab12cd34) replaced by [[page-cache]]: it stalled which is why batching won (code).
`;
  const r = await h.lintFiles(f);
  assertLacks(r.rules, 'R-pair'); // whys still match verbatim
  // R-join fired for both the winner and the loser entry.
  assert.equal(r.rules.filter((x) => x === 'R-join').length, 2,
    `expected R-join on both sides, got ${JSON.stringify(r.rules)}`);
  assertOnly(r.rules, ['R-join', 'R-join']);
});

// =============================================================================
// R-redundant — a rationale fact must not share a commit hash with a Moves
//                entry on the SAME node (the move already records the why)
// =============================================================================

test('R-redundant: a rationale fact sharing the move hash fires R-redundant', async () => {
  // page-cache.md's Moves carry (ab12cd34). A rationale fact with that same hash
  // duplicates the why the move already records.
  const r = await h.lintFiles(pageCacheFacts(
    '- 2031-04-02 (ab12cd34) rationale: batching at eviction is the design (code).'));
  assertOnly(r.rules, ['R-redundant']);
});

test('R-redundant NEGATIVE: a measurement (not rationale) sharing the hash does NOT fire', async () => {
  const r = await h.lintFiles(pageCacheFacts(
    '- 2031-04-02 (ab12cd34) measurement: batching cut latency 3.4x (code).'));
  assertOnly(r.rules, []);
});

test('R-redundant NEGATIVE: a rationale fact with a DIFFERENT hash does NOT fire', async () => {
  const r = await h.lintFiles(pageCacheFacts(
    '- 2031-03-01 (99999999) rationale: a why that carries no move (code).'));
  assertOnly(r.rules, []);
});

test('R-redundant NEGATIVE: a rationale fact with NO hash does NOT fire', async () => {
  const r = await h.lintFiles(pageCacheFacts(
    '- 2031-03-01 rationale: a why with no commit anchor (uncertain).'));
  assertOnly(r.rules, []);
});

test('R-redundant: only triggered by Moves on the SAME node, not a move elsewhere', async () => {
  // acorn.md has NO Moves. A rationale fact on acorn.md with hash ab12cd34 (which
  // is a move hash on page-cache.md, a different node) must NOT fire R-redundant.
  const r = await h.lintFiles(withNode('acorn.md',
`- Acorn stores key-value pairs, one value per key (\`Store\`).

## Facts

- 2031-02-01 (ab12cd34) rationale: a why local to the root node (code).
`));
  assertLacks(r.rules, 'R-redundant');
  assertOnly(r.rules, []);
});

test('R-redundant: kind matched exactly — "rationale" trims surrounding spaces', async () => {
  // "rationale " (with trailing space before colon is impossible via head regex),
  // confirm exact-kind path by using kind "rationale" and a non-rationale "status".
  const r = await h.lintFiles(pageCacheFacts(
    `- 2031-04-02 (ab12cd34) rationale: shares the move hash (code).
- 2031-04-03 (ab12cd34) statement: this also shares but is not rationale (code).`));
  // Exactly one R-redundant (from the rationale line); the statement line is exempt.
  assert.equal(r.rules.filter((x) => x === 'R-redundant').length, 1,
    `expected exactly one R-redundant, got ${JSON.stringify(r.rules)}`);
  assertOnly(r.rules, ['R-redundant']);
});

// =============================================================================
// R-meta — the tree never references its own construction
//   ['ledger','batch report','design tree','extraction run','deferred until']
//   scanned over the WHOLE node text, lowercased.
// =============================================================================

for (const word of ['ledger', 'batch report', 'design tree', 'extraction run', 'deferred until']) {
  test(`R-meta: construction vocabulary "${word}" fires R-meta`, async () => {
    const r = await h.lintFiles(pageCacheFacts(
      `- 2031-04-02 (ab12cd34) measurement: this prose mentions a ${word} somewhere (code).`));
    assertOnly(r.rules, ['R-meta']);
  });
}

test('R-meta: matching is case-insensitive (LEDGER)', async () => {
  const r = await h.lintFiles(pageCacheFacts(
    '- 2031-04-02 (ab12cd34) measurement: see the LEDGER for details (code).'));
  assertOnly(r.rules, ['R-meta']);
});

test('R-meta: fires even when the phrase is inside a backtick code span', async () => {
  // R-meta scans the raw text and does NOT strip backtick spans, so a `design tree`
  // in a code span still counts as construction vocabulary.
  const r = await h.lintFiles(pageCacheFacts(
    '- 2031-04-02 (ab12cd34) measurement: the field is named `design tree` here (code).'));
  assertOnly(r.rules, ['R-meta']);
});

test('R-meta: fires when the phrase is in an Item, not just an entry', async () => {
  // R-meta scans the whole node text, including the Items section.
  const r = await h.lintFiles(withNode('acorn.md',
`- Acorn keeps an internal ledger of pages (\`Store\`).

## Facts

- 2031-02-01 (00000001) statement: the store is a single append-only file on disk (code).
`));
  assertOnly(r.rules, ['R-meta']);
});

test('R-meta NEGATIVE: ordinary design prose without the banned phrases is clean', async () => {
  const r = await h.lintFiles(pageCacheFacts(
    '- 2031-04-02 (ab12cd34) measurement: the cache batches writes at eviction (code).'));
  assertOnly(r.rules, []);
});

// =============================================================================
// Cross-cutting / adversarial edge cases
// =============================================================================

test('edge: empty Facts section produces no entry errors', async () => {
  const r = await h.lintFiles(withNode('acorn.md',
`- Acorn stores key-value pairs, one value per key (\`Store\`).

## Facts
`));
  // No entries to validate; nothing fires.
  assertOnly(r.rules, []);
});

test('edge: a [[..]] inside a backtick code span is not treated as a link', async () => {
  // R-link strips backtick spans before scanning for links, so an unresolvable
  // [[name]] living inside backticks must NOT raise R-link.
  const r = await h.lintFiles(pageCacheFacts(
    '- 2031-04-02 (ab12cd34) measurement: the syntax is `[[not-a-real-node]]` (code).'));
  assertLacks(r.rules, 'R-link');
  assertOnly(r.rules, []);
});

test('edge: ambiguous stem-like kind ("replaced by" prose) — Facts entry not misread as a move', async () => {
  // A Facts entry whose text happens to mention "replaced" should not be forced
  // through the Moves-only R-verb rule (Facts are never checked for verbs).
  const r = await h.lintFiles(pageCacheFacts(
    '- 2031-04-02 (ab12cd34) measurement: write-through was replaced by batching (code).'));
  assertLacks(r.rules, 'R-verb');
  assertOnly(r.rules, []);
});

test('edge: CRLF blank line BETWEEN entries within an LF-heading section is clean', async () => {
  // The blank-line separator carries a \r; blocks() trims it to '' and still
  // splits, and PROV's \s* swallows the trailing \r — so the entries lint clean.
  const f = h.validFiles();
  f['acorn.md'] =
    '- Acorn stores key-value pairs (`Store`).\n\n## Facts\n\n' +
    '- 2031-02-01 (00000001) statement: first fact (code).\r\n\r\n' +
    '- 2031-02-02 (00000002) statement: second fact (code).\n';
  const r = await h.lintFiles(f);
  assertOnly(r.rules, []);
});

test('edge: a fully CRLF node is normalized — ## Facts recognized and validated', async () => {
  // parseNode normalizes CRLF→LF, so a Windows-authored node parses like LF: the
  // heading is a real section and its entry is validated (not hidden in items).
  const good = h.validFiles();
  good['acorn.md'] =
    '- item line (`Store`).\r\n\r\n## Facts\r\n\r\n' +
    '- 2031-02-01 (00000001) statement: foo (code).\r\n';
  assert.deepEqual((await h.lintFiles(good)).rules, [], 'a clean CRLF node should lint clean');
  // and a bad entry inside a CRLF node IS caught — validation reaches it:
  const bad = h.validFiles();
  bad['acorn.md'] =
    '- item line (`Store`).\r\n\r\n## Facts\r\n\r\n' +
    '- 2031-02-01 (00000001) statement: foo (bogus).\r\n';
  assertHas((await h.lintFiles(bad)).rules, 'R-prov');
});

// =============================================================================
// End-to-end: the CLI `lint` command — exit codes + output shape
// =============================================================================

test('e2e: clean tree exits 0 and prints "lint clean"', () => {
  const t = h.tmpTree(h.validFiles());
  try {
    const res = h.runCli(['lint', t.root]);
    assert.equal(res.code, 0, `stderr: ${res.stderr}`);
    assert.match(res.stdout, /lint clean: 3 nodes, 1 fact files/);
  } finally {
    t.cleanup();
  }
});

test('e2e: an R-prov violation exits 1 and reports the rule on stderr', () => {
  const f = pageCacheFacts('- 2031-04-02 (ab12cd34) measurement: no tag at all.');
  const t = h.tmpTree(f);
  try {
    const res = h.runCli(['lint', t.root]);
    assert.equal(res.code, 1);
    assert.match(res.stderr, /\bR-prov\b/);
    assert.match(res.stderr, /1 violation\(s\):/);
  } finally {
    t.cleanup();
  }
});

test('e2e: an R-verb violation is reported by the CLI', () => {
  const t = h.tmpTree(pageCacheMoves(
    '- 2031-04-02 (ab12cd34) statement: not a move verb (code).'));
  try {
    const res = h.runCli(['lint', t.root]);
    assert.equal(res.code, 1);
    assert.match(res.stderr, /\bR-verb\b/);
  } finally {
    t.cleanup();
  }
});

test('e2e: an R-meta violation is reported by the CLI', () => {
  const t = h.tmpTree(pageCacheFacts(
    '- 2031-04-02 (ab12cd34) measurement: mentions the ledger (code).'));
  try {
    const res = h.runCli(['lint', t.root]);
    assert.equal(res.code, 1);
    assert.match(res.stderr, /\bR-meta\b/);
  } finally {
    t.cleanup();
  }
});

test('e2e: an R-redundant violation is reported by the CLI', () => {
  const t = h.tmpTree(pageCacheFacts(
    '- 2031-04-02 (ab12cd34) rationale: dup of the move why (code).'));
  try {
    const res = h.runCli(['lint', t.root]);
    assert.equal(res.code, 1);
    assert.match(res.stderr, /\bR-redundant\b/);
  } finally {
    t.cleanup();
  }
});
