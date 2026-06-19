// Tests for the relational / structural-content lint rules of the mcts-mem CLI:
//   R-link, R-pair, R-frozen, R-thin (+ --skeleton suppression), R-factfile.
//
// Strategy: start from a lint-clean tree (validFiles()) and perturb exactly ONE
// thing, so we know which rule must fire. For each rule we assert BOTH that it
// fires on the bad/edge input AND that it does not false-positive on the good
// input, and that no UNRELATED rule fired alongside it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as h from './helpers.js';

// --- small assertion helpers --------------------------------------------------

// assert exactly this multiset of rules fired (order-independent)
function assertRules(rules, expected, ctx = '') {
  const sort = (a) => [...a].sort();
  assert.deepEqual(sort(rules), sort(expected),
    `${ctx}\n  expected rules ${JSON.stringify(sort(expected))}\n  got           ${JSON.stringify(sort(rules))}`);
}
// assert a rule fired at least once and NO other rule fired
function assertOnly(rules, rule, ctx = '') {
  assert.ok(rules.includes(rule), `${ctx}: expected ${rule} to fire, got ${JSON.stringify(rules)}`);
  const others = rules.filter((r) => r !== rule);
  assert.deepEqual(others, [], `${ctx}: unrelated rule(s) fired: ${JSON.stringify(others)}`);
}
function countRule(rules, rule) {
  return rules.filter((r) => r === rule).length;
}

// =============================================================================
// Sanity: the baseline tree is clean. If this ever fails, every perturbation
// test below is suspect.
// =============================================================================

test('baseline validFiles() lints completely clean', async () => {
  const r = await h.lintFiles(h.validFiles());
  assertRules(r.rules, [], 'validFiles should be lint-clean');
  assert.equal(r.nodeCount, 3);
  assert.equal(r.factCount, 1);
});

// =============================================================================
// R-link — every [[link]] resolves; a [[...]] inside a backtick code span is
// NOT a link (linter strips `code spans` before scanning).
// =============================================================================

test('R-link fires on an unresolvable link in Items', async () => {
  const f = h.validFiles();
  f['acorn/linker.md'] =
`- This node references [[does-not-exist]] in its items.

## Facts

- 2031-01-01 (00000002) statement: a checkable claim (code).
`;
  const r = await h.lintFiles(f);
  assertOnly(r.rules, 'R-link', 'broken link in items');
});

test('R-link fires on an unresolvable link inside a Facts entry', async () => {
  const f = h.validFiles();
  f['acorn/linker.md'] =
`- A node.

## Facts

- 2031-01-01 (00000002) measurement: result lives in [[no-such-fact.fact/x]] (code).
`;
  const r = await h.lintFiles(f);
  assert.ok(r.rules.includes('R-link'), 'fact-file link should not resolve');
  // Only R-link should fire (the entry head/prov/etc. are well-formed).
  assertOnly(r.rules, 'R-link', 'broken fact link');
});

test('R-link does NOT fire for a [[link]] inside a backtick code span', async () => {
  const f = h.validFiles();
  // Keep the item phrasing free of rationale words (so/because/thus/...) so the
  // only thing under test is whether the bracketed token inside backticks counts
  // as a link. It must not.
  f['acorn/linker.md'] =
`- The literal token \`[[does-not-exist]]\` appears inside a code span here.

## Facts

- 2031-01-01 (00000002) statement: a checkable claim (code).
`;
  const r = await h.lintFiles(f);
  assertRules(r.rules, [], 'code-span [[...]] must not be treated as a link');
});

test('R-link: a code span on the same line does not hide a real adjacent link', async () => {
  // `code` then a genuine broken [[link]] outside the span -> R-link still fires.
  const f = h.validFiles();
  f['acorn/linker.md'] =
`- Has a \`Store\` code span and a real [[ghost]] link both on one line.

## Facts

- 2031-01-01 (00000002) statement: a checkable claim (code).
`;
  const r = await h.lintFiles(f);
  assertOnly(r.rules, 'R-link', 'real link beside a code span');
});

test('R-link does NOT fire on the valid baseline links', async () => {
  // The baseline contains [[page-cache.fact/stall]], [[write-through]], [[page-cache]].
  const r = await h.lintFiles(h.validFiles());
  assert.equal(countRule(r.rules, 'R-link'), 0);
});

test('R-link resolves a link that points across the .alt boundary', async () => {
  // page-cache (main) links [[write-through]] which lives in page-cache.alt/.
  // This is a clean cross-boundary resolution; perturb nothing else.
  const r = await h.lintFiles(h.validFiles());
  assert.ok(!r.rules.includes('R-link'));
});

// =============================================================================
// R-pair — a `replaced [[X]]` move at hash H on the winner must have a verbatim
// twin `replaced by [[winner]]` at the SAME H inside X (the loser). The why is
// compared backtick- and whitespace-insensitively (and trailing dots ignored).
// =============================================================================

test('R-pair: clean paired move (baseline) does not fire', async () => {
  const r = await h.lintFiles(h.validFiles());
  assert.equal(countRule(r.rules, 'R-pair'), 0);
});

test('R-pair fires when the loser has no "replaced by" twin', async () => {
  const f = h.validFiles();
  // Loser node keeps a Moves section but with a non-twin verb (removed:),
  // so it is still a frozen .alt member (no R-frozen) but has no twin.
  f['acorn/page-cache.alt/write-through.md'] =
`- Every mutation writes its page to disk before returning.

## Moves

- 2031-04-02 (ab12cd34) removed: no successor recorded here (code).
`;
  const r = await h.lintFiles(f);
  assertOnly(r.rules, 'R-pair', 'loser missing replaced-by twin');
});

test('R-pair fires when the twin exists but the why differs', async () => {
  const f = h.validFiles();
  f['acorn/page-cache.alt/write-through.md'] =
`- Every mutation writes its page to disk before returning.

## Moves

- 2031-04-02 (ab12cd34) replaced by [[page-cache]]: a completely different reason text (code).
`;
  const r = await h.lintFiles(f);
  assertOnly(r.rules, 'R-pair', 'twin why mismatch');
});

test('R-pair: whys that differ only by backticks/whitespace are accepted (same hash)', async () => {
  // Keep the hashes equal here so we isolate the backtick/whitespace/trailing-dot
  // insensitivity of normWhy from the separate hash-matching bug below.
  const f = h.validFiles();
  f['acorn/page-cache.md'] =
`- Reads go through a fixed-size page cache (\`PageCache\`); a page loads from disk only on a miss.

## Facts

- 2031-04-02 (ab12cd34) measurement: batching at eviction cut ingest latency 3.4x — data in [[page-cache.fact/stall]] (code).

## Moves

- 2031-04-02 (ab12cd34) replaced [[write-through]]: write-through stalled every mutation on disk latency; batching at eviction removed the stall (code).
`;
  f['acorn/page-cache.alt/write-through.md'] =
`- Every mutation writes its page to disk before returning.

## Moves

- 2031-04-02 (ab12cd34) replaced by [[page-cache]]: write-through  stalled  every \`mutation\` on disk latency;
  batching at eviction removed the \`stall\` (code).
`;
  const r = await h.lintFiles(f);
  // Loser why has backticks, doubled spaces, a wrapped line, and a trailing dot;
  // normWhy collapses all of these, so R-pair must NOT fire.
  assert.equal(countRule(r.rules, 'R-pair'), 0,
    `whitespace/backtick/trailing-dot-insensitive why should match: ${JSON.stringify(r.rules)}`);
  assertRules(r.rules, [], 'backtick/whitespace-insensitive why, same hash');
});

// SPEC says (SKILL.md, "Recording a re-decision"): "Only the <why> must match:
// each side's date and hash record the commit that wrote *that* side and may
// differ." So a verbatim why with DIFFERENT hashes on the two sides must lint
// clean. This test asserts that spec-correct behavior. It currently FAILS:
// R-pair finds the twin via `(<winner-hash>) replaced by [[`, so a loser written
// at a different commit is never matched and R-pair false-positives "no twin".
test('R-pair accepts a verbatim why even when the two sides have different hashes (SPEC)', async () => {
  const f = h.validFiles();
  f['acorn/page-cache.md'] =
`- Reads go through a fixed-size page cache (\`PageCache\`); a page loads from disk only on a miss.

## Facts

- 2031-04-02 (ab12cd34) measurement: batching at eviction cut ingest latency 3.4x — data in [[page-cache.fact/stall]] (code).

## Moves

- 2031-04-02 (ab12cd34) replaced [[write-through]]: write-through stalled every mutation on disk latency; batching at eviction removed the stall (code).
`;
  f['acorn/page-cache.alt/write-through.md'] =
`- Every mutation writes its page to disk before returning.

## Moves

- 2031-04-09 (deadbeef) replaced by [[page-cache]]: write-through stalled every mutation on disk latency; batching at eviction removed the stall (code).
`;
  const r = await h.lintFiles(f);
  assert.equal(countRule(r.rules, 'R-pair'), 0,
    `per SKILL.md the two sides' hashes may differ when the why is verbatim; ` +
    `R-pair must not fire: ${JSON.stringify(r.rules)}`);
});

test('R-pair: em-dash and backticks in the why still match across the pair', async () => {
  const f = h.validFiles();
  f['acorn/page-cache.md'] =
`- Reads go through a fixed-size page cache (\`PageCache\`); a page loads from disk only on a miss.

## Facts

- 2031-04-02 (ab12cd34) measurement: batching at eviction cut ingest latency 3.4x — data in [[page-cache.fact/stall]] (code).

## Moves

- 2031-04-02 (ab12cd34) replaced [[write-through]]: write-through stalled — every mutation blocked on \`fsync\` (code).
`;
  f['acorn/page-cache.alt/write-through.md'] =
`- Every mutation writes its page to disk before returning.

## Moves

- 2031-04-02 (ab12cd34) replaced by [[page-cache]]: write-through stalled — every mutation blocked on \`fsync\` (code).
`;
  const r = await h.lintFiles(f);
  assertRules(r.rules, [], 'em-dash + backtick why is verbatim on both sides');
});

test('R-pair does NOT fire when the winner link is unresolvable (R-link owns that)', async () => {
  const f = h.validFiles();
  // Winner names a loser that does not exist -> R-link fires, R-pair stays quiet
  // (the linter skips the pair check when resolve() returns null).
  f['acorn/page-cache.md'] =
`- Reads go through a fixed-size page cache (\`PageCache\`); a page loads from disk only on a miss.

## Facts

- 2031-04-02 (ab12cd34) measurement: batching at eviction cut ingest latency 3.4x — data in [[page-cache.fact/stall]] (code).

## Moves

- 2031-04-02 (ab12cd34) replaced [[ghost-loser]]: write-through stalled every mutation on disk latency; batching at eviction removed the stall (code).
`;
  // The now-orphaned write-through.alt member still ends in 'replaced by', so it
  // is frozen-valid; but it links [[page-cache]] (resolves) and its own twin is
  // unmatched from the winner side. R-pair only scans from the 'replaced [[' side,
  // which now points at a ghost -> skipped. So we expect R-link, not R-pair.
  const r = await h.lintFiles(f);
  assert.ok(r.rules.includes('R-link'), 'ghost loser should trip R-link');
  assert.equal(countRule(r.rules, 'R-pair'), 0,
    `R-pair must defer to R-link when the loser is unresolvable: ${JSON.stringify(r.rules)}`);
});

// =============================================================================
// R-frozen — an .alt member's LAST Move must end in 'replaced by'/'removed';
// a main-tree node's last Move must NOT end in 'replaced by' (unless 'revived').
// =============================================================================

test('R-frozen: baseline .alt member (ends in replaced by) is clean', async () => {
  const r = await h.lintFiles(h.validFiles());
  assert.equal(countRule(r.rules, 'R-frozen'), 0);
});

test('R-frozen fires when an .alt member has NO Moves at all', async () => {
  const f = h.validFiles();
  // write-through is an .alt member; strip its Moves entirely.
  f['acorn/page-cache.alt/write-through.md'] =
`- Every mutation writes its page to disk before returning.
`;
  const r = await h.lintFiles(f);
  // Three legitimate consequences of stripping the loser's Moves:
  //  - R-frozen: an .alt member's last Move no longer ends in replaced-by/removed
  //    (there are no Moves);
  //  - R-pair:   the winner's 'replaced [[write-through]]' has no twin anymore;
  //  - R-thin:   a node with no .alt/no Facts/no Moves/no children is a
  //    module-map node.
  // The point of this case is that R-frozen genuinely fires; assert exactly this set.
  assert.ok(r.rules.includes('R-frozen'), `R-frozen must fire: ${JSON.stringify(r.rules)}`);
  assertRules(r.rules, ['R-frozen', 'R-pair', 'R-thin'], 'alt member with no moves');
});

test('R-frozen fires when an .alt member ends in "dropped:" (not replaced by/removed)', async () => {
  const f = h.validFiles();
  f['acorn/page-cache.alt/write-through.md'] =
`- Every mutation writes its page to disk before returning.

## Moves

- 2031-04-02 (ab12cd34) replaced by [[page-cache]]: write-through stalled every mutation on disk latency; batching at eviction removed the stall (code).
- 2031-05-01 (cafebabe) dropped: a trailing non-terminal move (code).
`;
  const r = await h.lintFiles(f);
  // The 'replaced by' twin still exists with the right why, so R-pair is quiet;
  // but the LAST move is 'dropped:', so the member is not frozen-terminal.
  assertOnly(r.rules, 'R-frozen', 'alt member last move is dropped:');
});

test('R-frozen: an .alt member ending in "removed:" is accepted', async () => {
  const f = h.validFiles();
  // A second, independent .alt member that is removed-with-no-successor.
  f['acorn/page-cache.alt/no-cache.md'] =
`- Reads always hit the disk; nothing is cached.

## Moves

- 2031-04-02 (ab12cd34) removed: caching was always required for ingest throughput (code).
`;
  const r = await h.lintFiles(f);
  assert.equal(countRule(r.rules, 'R-frozen'), 0,
    `removed: is a valid frozen terminal: ${JSON.stringify(r.rules)}`);
  assertRules(r.rules, [], 'alt member ending in removed:');
});

test('R-frozen fires when a MAIN-tree node ends its Moves in "replaced by"', async () => {
  const f = h.validFiles();
  // A main-tree node (not under any .alt/) whose last move is 'replaced by' —
  // a sign it should itself be in an .alt/ folder.
  f['acorn/misplaced.md'] =
`- A node that looks like it should be frozen but lives in the main tree.

## Moves

- 2031-05-01 (00000099) replaced by [[page-cache]]: superseded by the page cache for throughput (code).
`;
  const r = await h.lintFiles(f);
  assertOnly(r.rules, 'R-frozen', 'main-tree node ends in replaced by');
});

test('R-frozen does NOT fire on a main-tree node whose last move ends in "replaced by" but mentions "revived"', async () => {
  const f = h.validFiles();
  f['acorn/back-from-the-dead.md'] =
`- A node revived into the main tree.

## Moves

- 2031-05-01 (00000099) replaced by [[page-cache]]: revived after the disk-latency constraint lapsed (code).
`;
  const r = await h.lintFiles(f);
  assert.equal(countRule(r.rules, 'R-frozen'), 0,
    `'revived' in the line exempts a main-tree replaced-by from R-frozen: ${JSON.stringify(r.rules)}`);
});

test('R-frozen does NOT fire on a main-tree node ending in "removed:" or "dropped:"', async () => {
  const f = h.validFiles();
  f['acorn/gone.md'] =
`- A capability that was dropped from the main tree.

## Moves

- 2031-05-01 (00000099) dropped: feature pulled with no successor (code).
`;
  const r = await h.lintFiles(f);
  assert.equal(countRule(r.rules, 'R-frozen'), 0,
    `main-tree dropped:/removed: is fine: ${JSON.stringify(r.rules)}`);
  assertRules(r.rules, [], 'main-tree dropped node');
});

// =============================================================================
// R-thin — a node with NO .alt/, NO Facts, NO Moves, and NO children is a
// module-map node. --skeleton (skeleton:true) suppresses ONLY R-thin.
// =============================================================================

test('R-thin fires on a node with no alt/facts/moves/children', async () => {
  const f = h.validFiles();
  f['acorn/bare.md'] = `- A bare module-map node that records no decision.
`;
  const r = await h.lintFiles(f);
  assertOnly(r.rules, 'R-thin', 'bare module-map node');
});

test('R-thin: --skeleton suppresses R-thin', async () => {
  const f = h.validFiles();
  f['acorn/bare.md'] = `- A bare module-map node that records no decision.
`;
  const r = await h.lintFiles(f, { skeleton: true });
  assert.equal(countRule(r.rules, 'R-thin'), 0, 'skeleton must skip R-thin');
  assertRules(r.rules, [], 'skeleton: only R-thin suppressed, nothing else changes');
});

test('R-thin: --skeleton suppresses ONLY R-thin, not other rules', async () => {
  // A tree that is simultaneously thin AND has another violation (a broken link).
  // Under --skeleton the broken link must STILL fire.
  const f = h.validFiles();
  f['acorn/bare.md'] = `- A bare module-map node.
`;
  f['acorn/broken.md'] =
`- This node links [[nowhere]].

## Facts

- 2031-01-01 (00000005) statement: a claim (code).
`;
  const without = await h.lintFiles(f);
  const withSkel = await h.lintFiles(f, { skeleton: true });
  assert.ok(without.rules.includes('R-thin'), 'thin fires without skeleton');
  assert.ok(without.rules.includes('R-link'), 'link fires without skeleton');
  assert.equal(countRule(withSkel.rules, 'R-thin'), 0, 'skeleton removes R-thin');
  assert.ok(withSkel.rules.includes('R-link'), 'skeleton keeps R-link');
});

test('R-thin does NOT fire on a node with Facts only', async () => {
  const f = h.validFiles();
  f['acorn/has-facts.md'] =
`- A node with a fact but nothing else.

## Facts

- 2031-01-01 (00000006) statement: a claim (code).
`;
  const r = await h.lintFiles(f);
  assert.equal(countRule(r.rules, 'R-thin'), 0);
  assertRules(r.rules, [], 'facts-only node is not thin');
});

test('R-thin does NOT fire on a node with children (a non-empty subtree dir)', async () => {
  const f = {
    'acorn.md':
`- Acorn stores key-value pairs (\`Store\`).

## Facts

- 2031-02-01 (00000001) statement: the store is a single append-only file (code).
`,
    'acorn/parent.md': `- A parent node with no facts/moves/alt but with a child.
`,
    'acorn/parent/child.md':
`- The child node.

## Facts

- 2031-01-01 (00000007) statement: a claim (code).
`,
  };
  const r = await h.lintFiles(f);
  assert.equal(countRule(r.rules, 'R-thin'), 0, `parent with a child is not thin: ${JSON.stringify(r.rules)}`);
});

test('R-thin does NOT fire on a node that has an .alt/ but no facts/moves', async () => {
  // A node whose only recorded decision is the alternative it beat.
  const f = {
    'acorn.md':
`- Root (\`Store\`).

## Facts

- 2031-02-01 (00000001) statement: append-only file (code).
`,
    'acorn/decider.md':
`- A node whose decision lives entirely in its Moves + .alt.

## Moves

- 2031-03-01 (11111111) replaced [[old-way]]: the new form beat the old on speed (code).
`,
    'acorn/decider.alt/old-way.md':
`- The old way.

## Moves

- 2031-03-01 (11111111) replaced by [[decider]]: the new form beat the old on speed (code).
`,
  };
  const r = await h.lintFiles(f);
  assert.equal(countRule(r.rules, 'R-thin'), 0, `node with .alt is not thin: ${JSON.stringify(r.rules)}`);
  assertRules(r.rules, [], 'decider with alt is fully clean');
});

test('R-thin does NOT fire on a node with Moves only', async () => {
  // A node with a 'dropped' move (no successor, no .alt needed) records a decision.
  const f = h.validFiles();
  f['acorn/dropper.md'] =
`- A node that dropped a capability.

## Moves

- 2031-05-01 (00000008) dropped: removed the legacy path with no successor (code).
`;
  const r = await h.lintFiles(f);
  assert.equal(countRule(r.rules, 'R-thin'), 0);
  assertRules(r.rules, [], 'moves-only node is not thin');
});

// =============================================================================
// R-factfile — a file under <name>.fact/ must contain no "#" headings.
// =============================================================================

test('R-factfile: baseline fact file (no headings) is clean', async () => {
  const r = await h.lintFiles(h.validFiles());
  assert.equal(countRule(r.rules, 'R-factfile'), 0);
});

test('R-factfile fires on a top-level "#" heading in a fact file', async () => {
  const f = h.validFiles();
  f['acorn/page-cache.fact/stall.md'] =
`commit: ab12cd34

# A heading the linter forbids

Under the ingest benchmark, write-through spent 71% of wall time blocked.
`;
  const r = await h.lintFiles(f);
  assertOnly(r.rules, 'R-factfile', '# heading in fact file');
});

test('R-factfile fires on a "##" sub-heading in a fact file', async () => {
  const f = h.validFiles();
  f['acorn/page-cache.fact/stall.md'] =
`commit: ab12cd34

Some prose.

## Results

Numbers here.
`;
  const r = await h.lintFiles(f);
  assertOnly(r.rules, 'R-factfile', '## heading in fact file');
});

test('R-factfile does NOT fire on a "#" that is mid-line or has no following space', async () => {
  const f = h.validFiles();
  f['acorn/page-cache.fact/stall.md'] =
`commit: ab12cd34

Issue #1234 tracked this; the value was tagged #urgent.

Markdown atx headings need a leading '# ' at column 0, which this prose has not.
`;
  const r = await h.lintFiles(f);
  assert.equal(countRule(r.rules, 'R-factfile'), 0,
    `mid-line '#' is not a heading: ${JSON.stringify(r.rules)}`);
  assertRules(r.rules, [], 'fact file with inline hashes is clean');
});

test('R-factfile: a heading on the very first line of a fact file fires', async () => {
  const f = h.validFiles();
  f['acorn/page-cache.fact/stall.md'] =
`# leading heading

commit: ab12cd34
`;
  const r = await h.lintFiles(f);
  assertOnly(r.rules, 'R-factfile', 'heading on first line of fact file');
});

// =============================================================================
// Adversarial / edge cases that cut across rules — verifying the perturbations
// we rely on stay isolated, and that wrapping / blank-line shapes parse right.
// =============================================================================

test('multi-line wrapped Moves entry still pairs verbatim (whitespace-insensitive)', async () => {
  const f = h.validFiles();
  // Winner why is wrapped across two physical lines; loser why is on one line.
  f['acorn/page-cache.md'] =
`- Reads go through a fixed-size page cache (\`PageCache\`); a page loads from disk only on a miss.

## Facts

- 2031-04-02 (ab12cd34) measurement: batching at eviction cut ingest latency 3.4x — data in [[page-cache.fact/stall]] (code).

## Moves

- 2031-04-02 (ab12cd34) replaced [[write-through]]: write-through stalled every mutation
  on disk latency; batching at eviction removed the stall (code).
`;
  const r = await h.lintFiles(f);
  assertRules(r.rules, [], 'wrapped winner why must still match the one-line loser why');
});

test('Windows-y / extra blank lines between entries do not break parsing', async () => {
  const f = h.validFiles();
  // Several blank lines between Facts entries; blocks() splits on blank lines.
  f['acorn/spacing.md'] =
`- A node with generously spaced facts.

## Facts


- 2031-01-01 (00000010) statement: first fact (code).



- 2031-01-02 (00000011) statement: second fact (code).
`;
  const r = await h.lintFiles(f);
  assertRules(r.rules, [], `extra blank lines should parse cleanly: ${JSON.stringify(r.rules)}`);
});

test('a stray un-replaced .alt member without any twin trips R-frozen AND R-pair independently', async () => {
  // Sanity that the two frozen/pair rules are genuinely distinct: an .alt member
  // with a non-terminal last move and no twin should show both.
  const f = h.validFiles();
  f['acorn/page-cache.alt/write-through.md'] =
`- Every mutation writes its page to disk before returning.

## Facts

- 2031-04-02 (ab12cd34) statement: write-through is synchronous (code).
`;
  const r = await h.lintFiles(f);
  // No Moves at all on the loser: missing twin (R-pair) AND not frozen-terminal (R-frozen).
  assertRules(r.rules, ['R-frozen', 'R-pair'], 'no-moves alt member');
});

// =============================================================================
// End-to-end via the CLI binary — exit codes and output for the relational rules.
// =============================================================================

test('CLI: lint exits 0 and reports "lint clean" on the baseline tree', async () => {
  const t = h.tmpTree(h.validFiles());
  try {
    const res = h.runCli(['lint', t.root]);
    assert.equal(res.code, 0, `stderr: ${res.stderr}`);
    assert.match(res.stdout, /lint clean: 3 nodes, 1 fact files/);
  } finally {
    t.cleanup();
  }
});

test('CLI: lint exits 1 and names [R-link] on a broken link', async () => {
  const f = h.validFiles();
  f['acorn/linker.md'] =
`- Links [[nowhere]].

## Facts

- 2031-01-01 (00000012) statement: a claim (code).
`;
  const t = h.tmpTree(f);
  try {
    const res = h.runCli(['lint', t.root]);
    assert.equal(res.code, 1, `expected violation exit; stdout=${res.stdout} stderr=${res.stderr}`);
    assert.match(res.stderr, /\[R-link\]/);
    assert.match(res.stderr, /violation\(s\):/);
  } finally {
    t.cleanup();
  }
});

test('CLI: lint exits 1 on a thin node, exits 0 with --skeleton', async () => {
  const f = h.validFiles();
  f['acorn/bare.md'] = `- A bare module-map node.
`;
  const t = h.tmpTree(f);
  try {
    const res = h.runCli(['lint', t.root]);
    assert.equal(res.code, 1);
    assert.match(res.stderr, /\[R-thin\]/);

    const res2 = h.runCli(['lint', t.root, '--skeleton']);
    assert.equal(res2.code, 0, `--skeleton should clear R-thin; stderr=${res2.stderr}`);
    assert.match(res2.stdout, /lint clean/);
  } finally {
    t.cleanup();
  }
});

test('CLI: lint names [R-factfile] for a heading in a fact file', async () => {
  const f = h.validFiles();
  f['acorn/page-cache.fact/stall.md'] =
`commit: ab12cd34

# forbidden heading
`;
  const t = h.tmpTree(f);
  try {
    const res = h.runCli(['lint', t.root]);
    assert.equal(res.code, 1);
    assert.match(res.stderr, /\[R-factfile\]/);
  } finally {
    t.cleanup();
  }
});

test('CLI: lint names [R-pair] when a re-decision why mismatches', async () => {
  const f = h.validFiles();
  f['acorn/page-cache.alt/write-through.md'] =
`- Every mutation writes its page to disk before returning.

## Moves

- 2031-04-02 (ab12cd34) replaced by [[page-cache]]: a different story entirely (code).
`;
  const t = h.tmpTree(f);
  try {
    const res = h.runCli(['lint', t.root]);
    assert.equal(res.code, 1);
    assert.match(res.stderr, /\[R-pair\]/);
  } finally {
    t.cleanup();
  }
});

test('CLI: lint names [R-frozen] for a main-tree replaced-by node', async () => {
  const f = h.validFiles();
  f['acorn/misplaced.md'] =
`- A node that should be frozen.

## Moves

- 2031-05-01 (00000099) replaced by [[page-cache]]: superseded for throughput (code).
`;
  const t = h.tmpTree(f);
  try {
    const res = h.runCli(['lint', t.root]);
    assert.equal(res.code, 1);
    assert.match(res.stderr, /\[R-frozen\]/);
  } finally {
    t.cleanup();
  }
});
