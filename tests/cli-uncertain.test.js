// End-to-end + rule-level tests for the mcts-mem dispatcher (src/cli.js) and the
// `uncertain` command (src/uncertain.js), plus the lint exit-code surface and a
// hard adversarial sweep over the lint rules each command leans on.
//
// Strategy: start from a known-clean tree (helpers.validFiles()), perturb exactly
// ONE thing, and assert BOTH that the intended rule fires AND that no unrelated
// rule false-positives. End-to-end behavior (exit codes, output) goes through
// runCli(); precise rule assertions go through lintFiles().

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as h from './helpers.js';
import pkg from '../package.json' with { type: 'json' };

// ---- small helpers -------------------------------------------------------

// Assert a single rule fired and nothing else did.
function onlyRule(rules, rule) {
  assert.ok(rules.includes(rule), `expected ${rule} to fire, got ${JSON.stringify(rules)}`);
  assert.deepEqual(
    rules.filter((r) => r !== rule),
    [],
    `expected ONLY ${rule}, but other rules fired: ${JSON.stringify(rules)}`,
  );
}

// Assert the clean baseline really is clean (guards against a broken validFiles()).
async function assertBaselineClean() {
  const { rules } = await h.lintFiles(h.validFiles());
  assert.deepEqual(rules, [], `validFiles() baseline should lint clean, got ${JSON.stringify(rules)}`);
}

// Build a tree, run an uncertain query, return its CLI result + auto-cleanup.
function withUncertain(files, fn) {
  const t = h.tmpTree(files);
  try {
    return fn(t, h.runCli(['uncertain', t.root]));
  } finally {
    t.cleanup();
  }
}

// ============================================================================
// 0. Baseline sanity
// ============================================================================

test('baseline: validFiles() lints fully clean (3 nodes, 1 fact file)', async () => {
  const r = await h.lintFiles(h.validFiles());
  assert.deepEqual(r.rules, []);
  assert.equal(r.nodeCount, 3);
  assert.equal(r.factCount, 1);
});

// ============================================================================
// 1. Dispatcher (cli.js run())
// ============================================================================

test('dispatch: no args prints usage on stdout, exit 0', () => {
  const r = h.runCli([]);
  assert.equal(r.code, 0);
  assert.match(r.stdout, /^mcts-mem — work with an MCTS-Mem design tree/);
  assert.match(r.stdout, /commands:/);
  assert.equal(r.stderr, '');
});

test('dispatch: "help" prints usage, exit 0', () => {
  const r = h.runCli(['help']);
  assert.equal(r.code, 0);
  assert.match(r.stdout, /^mcts-mem — work with an MCTS-Mem design tree/);
});

test('dispatch: "--help" prints usage, exit 0', () => {
  const r = h.runCli(['--help']);
  assert.equal(r.code, 0);
  assert.match(r.stdout, /^mcts-mem — work with an MCTS-Mem design tree/);
});

test('dispatch: "-h" prints usage, exit 0', () => {
  const r = h.runCli(['-h']);
  assert.equal(r.code, 0);
  assert.match(r.stdout, /^mcts-mem — work with an MCTS-Mem design tree/);
});

test('dispatch: "--version" prints a version string, exit 0', () => {
  const r = h.runCli(['--version']);
  assert.equal(r.code, 0);
  assert.match(r.stdout.trim(), /^\d+\.\d+\.\d+$/);
  assert.equal(r.stdout.trim(), pkg.version);
});

test('dispatch: "-v" also prints version, exit 0', () => {
  const r = h.runCli(['-v']);
  assert.equal(r.code, 0);
  assert.match(r.stdout.trim(), /^\d+\.\d+\.\d+$/);
});

test('dispatch: unknown command exits 2 and prints help (with reason on stderr)', () => {
  const r = h.runCli(['frobnicate']);
  assert.equal(r.code, 2);
  assert.match(r.stderr, /unknown command: frobnicate/);
  // help is still emitted on stdout so the user sees the valid commands
  assert.match(r.stdout, /^mcts-mem — work with an MCTS-Mem design tree/);
});

test('dispatch: an option-looking unknown command (--bogus) is treated as command, exit 2', () => {
  // argv[0] is the command; --bogus is not help/version/-h, so it falls through to default.
  const r = h.runCli(['--bogus']);
  assert.equal(r.code, 2);
  assert.match(r.stderr, /unknown command: --bogus/);
});

test('dispatch: "show" with no node arg exits 2 with a needs-a-node message', () => {
  const r = h.runCli(['show']);
  assert.equal(r.code, 2);
  assert.match(r.stderr, /show: needs a <node> name or logical path/);
  assert.equal(r.stdout, '');
});

// ============================================================================
// 2. lint exit codes + output surface (end-to-end via runCli)
// ============================================================================

test('lint: clean tree exits 0 and reports node/fact counts', () => {
  const t = h.tmpTree(h.validFiles());
  try {
    const r = h.runCli(['lint', t.root]);
    assert.equal(r.code, 0);
    assert.match(r.stdout, /lint clean: 3 nodes, 1 fact files/);
    assert.equal(r.stderr, '');
  } finally {
    t.cleanup();
  }
});

test('lint: a tree with a violation exits 1 and prints [R-...] lines to stderr', () => {
  const v = h.validFiles();
  // single, well-isolated perturbation: a Facts entry with no provenance tag.
  v['acorn.md'] =
    '- Acorn stores pairs (`Store`).\n\n## Facts\n\n- 2031-02-01 (00000001) statement: claim with no tag here.\n';
  const t = h.tmpTree(v);
  try {
    const r = h.runCli(['lint', t.root]);
    assert.equal(r.code, 1);
    assert.match(r.stderr, /violation\(s\):/);
    assert.match(r.stderr, /\[R-prov\]/);
    // exit-1 errors go to stderr, not stdout
    assert.doesNotMatch(r.stdout, /lint clean/);
  } finally {
    t.cleanup();
  }
});

test('lint: every reported violation line is shaped "[R-...] <path>: <msg>"', () => {
  const v = h.validFiles();
  v['acorn.md'] =
    '- Acorn stores pairs (`Store`).\n\n## Facts\n\n- 2031-02-01 (00000001) statement: claim with no tag here.\n';
  const t = h.tmpTree(v);
  try {
    const r = h.runCli(['lint', t.root]);
    const lines = r.stderr.split('\n').filter((l) => l.trim().startsWith('['));
    assert.ok(lines.length >= 1);
    for (const l of lines) assert.match(l, /^\s*\[R-[a-z]+\] .+: .+/);
  } finally {
    t.cleanup();
  }
});

// ----- flag parsing -------------------------------------------------------

test('lint --skeleton: still clean on a clean tree, exit 0', () => {
  const t = h.tmpTree(h.validFiles());
  try {
    const r = h.runCli(['lint', t.root, '--skeleton']);
    assert.equal(r.code, 0);
    assert.match(r.stdout, /lint clean/);
  } finally {
    t.cleanup();
  }
});

test('lint --skeleton: suppresses the R-thin "module-map node" check', async () => {
  await assertBaselineClean();
  const v = h.validFiles();
  // a child node that records no decision (no facts/moves/alts/children) → R-thin
  v['acorn/bare.md'] = '- A component with no recorded decision (`Bare`).\n';
  onlyRule((await h.lintFiles(v)).rules, 'R-thin');
  // --skeleton lets the pre-prune skeleton through
  assert.deepEqual((await h.lintFiles(v, { skeleton: true })).rules, []);
});

test('lint: a clean tree exits 0 with "lint clean"', () => {
  const t = h.tmpTree(h.validFiles());
  try {
    const r = h.runCli(['lint', t.root]);
    assert.equal(r.code, 0);
    assert.match(r.stdout, /lint clean/);
  } finally {
    t.cleanup();
  }
});

test('view --alt --depth N: parses both flags, renders, exit 0', () => {
  const t = h.tmpTree(h.validFiles());
  try {
    const r = h.runCli(['view', t.root, '--alt', '--depth', '1']);
    assert.equal(r.code, 0);
    assert.match(r.stdout, /legend:/);
    // depth=1 still shows the legend block; --alt removes the "pass --alt" hint
    assert.doesNotMatch(r.stdout, /pass --alt/);
  } finally {
    t.cleanup();
  }
});

test('view (no --alt): prints the "pass --alt" hint', () => {
  const t = h.tmpTree(h.validFiles());
  try {
    const r = h.runCli(['view', t.root]);
    assert.equal(r.code, 0);
    assert.match(r.stdout, /pass --alt to walk the rejected alternatives/);
  } finally {
    t.cleanup();
  }
});

// ============================================================================
// 3. uncertain command (uncertain.js)
// ============================================================================

test('uncertain: clean tree prints the "no open uncertainties" line, exit 0', () => {
  withUncertain(h.validFiles(), (_t, r) => {
    assert.equal(r.code, 0);
    assert.match(r.stdout, /no open uncertainties — every recorded why is backed by code or a source\./);
    // none of the node logical paths should be printed as a header
    assert.doesNotMatch(r.stdout, /^acorn$/m);
  });
});

test('uncertain: one (uncertain) fact is listed under its node path with a singular count line', () => {
  const v = h.validFiles();
  v['acorn.md'] +=
    '- 2031-03-01 (deadbeef) rationale: chosen as the baseline; no commit records why (uncertain).\n';
  withUncertain(v, (_t, r) => {
    assert.equal(r.code, 0);
    // node header = logical path of the root node
    assert.match(r.stdout, /^acorn$/m);
    // the claim is stripped of its "- date (hash) kind:" head and the trailing tag
    assert.match(r.stdout, /\(deadbeef\) chosen as the baseline; no commit records why/);
    assert.doesNotMatch(r.stdout, /\(uncertain\)/); // tag is stripped from the claim
    assert.doesNotMatch(r.stdout, /rationale:/); // kind+colon head is stripped
    // singular count + the resolve-by guidance
    assert.match(r.stdout, /^1 uncertain entry: /m);
    assert.match(r.stdout, /never by guessing\.$/m);
    assert.doesNotMatch(r.stdout, /no open uncertainties/);
  });
});

test('uncertain: two entries across two nodes → both paths listed, plural count', () => {
  const v = h.validFiles();
  v['acorn.md'] += '- 2031-03-01 (deadbeef) rationale: root why unknown (uncertain).\n';
  // an uncertain Moves entry on a child — uncertain scans Facts AND Moves
  v['acorn/page-cache.md'] += '\n- 2031-05-01 (cafe0000) dropped: some-cap: why is lost (uncertain).\n';
  withUncertain(v, (_t, r) => {
    assert.equal(r.code, 0);
    assert.match(r.stdout, /^acorn$/m); // root logical path
    assert.match(r.stdout, /^acorn\/page-cache$/m); // child logical path (no .alt anywhere here)
    assert.match(r.stdout, /\(deadbeef\) root why unknown/);
    // the Moves head ("- date (hash) dropped:") is stripped up to the first colon,
    // leaving the remaining "some-cap: why is lost"
    assert.match(r.stdout, /\(cafe0000\) some-cap: why is lost/);
    assert.match(r.stdout, /^2 uncertain entries: /m);
  });
});

test('uncertain: an (uncertain) entry inside an .alt member is reported under its .alt-stripped logical path', () => {
  const v = h.validFiles();
  // the .alt member already ends in "replaced by" (frozen); add an uncertain fact to it.
  v['acorn/page-cache.alt/write-through.md'] =
    `- Every mutation writes its page to disk before returning.

## Facts

- 2031-04-01 (00000abc) rationale: why this was originally chosen is lost (uncertain).

## Moves

- 2031-04-02 (ab12cd34) replaced by [[page-cache]]: write-through stalled every mutation on disk latency; batching at eviction removed the stall (code).
`;
  withUncertain(v, (_t, r) => {
    assert.equal(r.code, 0);
    // logical() strips the .alt segment: page-cache.alt/write-through → page-cache/write-through
    assert.match(r.stdout, /^acorn\/page-cache\/write-through$/m);
    assert.match(r.stdout, /\(00000abc\) why this was originally chosen is lost/);
    assert.match(r.stdout, /^1 uncertain entry: /m);
  });
});

test('uncertain: (code)/(sourced) entries are NOT listed (only the uncertain tag qualifies)', () => {
  const v = h.validFiles();
  // baseline validFiles has only (code) facts/moves → must stay "no open uncertainties"
  withUncertain(v, (_t, r) => {
    assert.match(r.stdout, /no open uncertainties/);
  });
  // add a (sourced) fact: still no uncertainties
  const v2 = h.validFiles();
  v2['acorn.md'] += '- 2031-03-01 statement: a human said so on record (sourced).\n';
  withUncertain(v2, (_t, r) => {
    assert.match(r.stdout, /no open uncertainties/);
    assert.doesNotMatch(r.stdout, /a human said so/);
  });
});

test('uncertain: a multi-line wrapped (uncertain) entry is flattened into one claim line', () => {
  const v = h.validFiles();
  v['acorn.md'] +=
    '- 2031-03-01 (deadbeef) rationale: this why wraps\n  across two physical lines but is one entry (uncertain).\n';
  withUncertain(v, (_t, r) => {
    assert.equal(r.code, 0);
    assert.match(r.stdout, /\(deadbeef\) this why wraps across two physical lines but is one entry/);
    // the wrap must not leak a stray newline mid-claim
    assert.doesNotMatch(r.stdout, /this why wraps\n/);
  });
});

test('uncertain: em-dashes and backticks in the why are preserved in the listed claim', () => {
  const v = h.validFiles();
  v['acorn.md'] +=
    '- 2031-03-01 (deadbeef) rationale: the `Store` shape — a guess, not on record (uncertain).\n';
  withUncertain(v, (_t, r) => {
    assert.equal(r.code, 0);
    assert.match(r.stdout, /the `Store` shape — a guess, not on record/);
  });
});

test('uncertain: missing tree root errors out (exit 1) with a clear message, no crash', () => {
  const r = h.runCli(['uncertain', '/tmp/mm-definitely-missing-' + Date.now()]);
  assert.equal(r.code, 1);
  assert.match(r.stderr, /mcts-mem uncertain: tree root not found:/);
});

// ============================================================================
// 4. Rule sweep — each rule must FIRE on the bad input AND NOT fire on good.
//    One perturbation per test, asserted with onlyRule().
// ============================================================================

// ----- R-root -------------------------------------------------------------

test('R-root: exactly one top-level node (two → fires; one → clean)', async () => {
  await assertBaselineClean();
  const v = h.validFiles();
  v['second.md'] =
    '- A rival top-level node (`X`).\n\n## Facts\n\n- 2031-02-01 (00000001) statement: x (code).\n';
  onlyRule((await h.lintFiles(v)).rules, 'R-root');
});

// ----- R-orphan / R-empty -------------------------------------------------

test('R-orphan: a structure dir without a sibling .md fires', async () => {
  const v = h.validFiles();
  // ghost.alt/ has no ghost.md sibling. Its member is self-contained (frozen, removed).
  v['acorn/ghost.alt/member.md'] =
    '- frozen member (`G`).\n\n## Moves\n\n- 2031-04-02 (ab12cd34) removed: gone with no successor (code).\n';
  onlyRule((await h.lintFiles(v)).rules, 'R-orphan');
});

test('R-empty: a .alt/.fact dir with a sibling but no .md inside fires', async () => {
  const v = h.validFiles();
  // acorn.fact/ exists (sibling acorn.md exists) but holds only a non-md file
  v['acorn.fact/placeholder.txt'] = 'not markdown';
  onlyRule((await h.lintFiles(v)).rules, 'R-empty');
});

// ----- R-title ------------------------------------------------------------

test('R-title: a leading "#" heading fires (and R-sections piggybacks because it is a stray heading)', async () => {
  await assertBaselineClean();
  const v = h.validFiles();
  v['acorn.md'] =
    '# Acorn\n\n- Acorn stores pairs (`Store`).\n\n## Facts\n\n- 2031-02-01 (00000001) statement: x (code).\n';
  const { rules } = await h.lintFiles(v);
  assert.ok(rules.includes('R-title'));
  // a top-level title is, by construction, also a heading the section rule rejects;
  // assert the title rule fired and the only collateral is R-sections.
  assert.deepEqual(
    [...new Set(rules)].filter((r) => r !== 'R-title' && r !== 'R-sections'),
    [],
    `unexpected extra rules: ${JSON.stringify(rules)}`,
  );
});

// ----- R-sections ---------------------------------------------------------

test('R-sections: an unexpected heading (not ## Facts/## Moves) fires alone', async () => {
  await assertBaselineClean();
  const v = h.validFiles();
  v['acorn.md'] =
    '- Acorn stores pairs (`Store`).\n\n## Notes\n\nfree prose here\n\n## Facts\n\n- 2031-02-01 (00000001) statement: x (code).\n';
  onlyRule((await h.lintFiles(v)).rules, 'R-sections');
});

test('R-sections: Moves-before-Facts (out of order) fires alone', async () => {
  await assertBaselineClean();
  const v = h.validFiles();
  // a node with both sections but in the wrong order. Keep the move paired/frozen-valid
  // by making it a self-contained "dropped" (no twin needed, not in .alt).
  v['acorn/page-cache.md'] =
    `- Reads go through a fixed-size page cache (\`PageCache\`).

## Moves

- 2031-04-02 (ab12cd34) dropped: prefetch: it never paid off (code).

## Facts

- 2031-04-02 (99999999) measurement: cache hit rate is 94% (code).
`;
  onlyRule((await h.lintFiles(v)).rules, 'R-sections');
});

// ----- R-items ------------------------------------------------------------

test('R-items: non-bullet prose in the items section fires', async () => {
  await assertBaselineClean();
  const v = h.validFiles();
  v['acorn.md'] =
    'Acorn is a key-value store.\n\n## Facts\n\n- 2031-02-01 (00000001) statement: x (code).\n';
  onlyRule((await h.lintFiles(v)).rules, 'R-items');
});

// ----- R-tail (items: rationale tails) ------------------------------------

test('R-tail: an item with a "because" rationale tail fires', async () => {
  await assertBaselineClean();
  const v = h.validFiles();
  v['acorn.md'] =
    '- Acorn uses one file because disk seeks are cheap (`Store`).\n\n## Facts\n\n- 2031-02-01 (00000001) statement: x (code).\n';
  onlyRule((await h.lintFiles(v)).rules, 'R-tail');
});

test('R-tail: "so that" rationale tail fires', async () => {
  const v = h.validFiles();
  v['acorn.md'] =
    '- Acorn batches writes so that ingest is fast (`Store`).\n\n## Facts\n\n- 2031-02-01 (00000001) statement: x (code).\n';
  onlyRule((await h.lintFiles(v)).rules, 'R-tail');
});

test('R-tail: "since" is ALLOWED in an item (temporal sense), no false positive', async () => {
  const v = h.validFiles();
  v['acorn.md'] =
    '- Acorn has used one file since the first release (`Store`).\n\n## Facts\n\n- 2031-02-01 (00000001) statement: x (code).\n';
  assert.deepEqual((await h.lintFiles(v)).rules, []);
});

test('R-tail: a "because" buried inside a backtick code span on an item still fires (flat scan, by design)', async () => {
  // R-tail scans the flat item text, not link-stripped text; a literal "because"
  // even inside a code span is a tail per the implemented rule.
  const v = h.validFiles();
  v['acorn.md'] =
    '- Acorn keeps `x because y` invariant (`Store`).\n\n## Facts\n\n- 2031-02-01 (00000001) statement: x (code).\n';
  onlyRule((await h.lintFiles(v)).rules, 'R-tail');
});

test('R-tail: "since" does not get rewritten by another tail word in the same item', async () => {
  // "since" matches first; the rule explicitly exempts since. No tail should fire.
  const v = h.validFiles();
  v['acorn.md'] =
    '- Acorn has run since 2031 across every release (`Store`).\n\n## Facts\n\n- 2031-02-01 (00000001) statement: x (code).\n';
  assert.deepEqual((await h.lintFiles(v)).rules, []);
});

// ----- R-entry ------------------------------------------------------------

test('R-entry: a 7-hex (non-8) hash makes the entry head malformed', async () => {
  await assertBaselineClean();
  const v = h.validFiles();
  v['acorn.md'] =
    '- Acorn stores pairs (`Store`).\n\n## Facts\n\n- 2031-02-01 (0000001) statement: x (code).\n';
  onlyRule((await h.lintFiles(v)).rules, 'R-entry');
});

test('R-entry: a 9-hex hash makes the entry head malformed', async () => {
  const v = h.validFiles();
  v['acorn.md'] =
    '- Acorn stores pairs (`Store`).\n\n## Facts\n\n- 2031-02-01 (000000001) statement: x (code).\n';
  onlyRule((await h.lintFiles(v)).rules, 'R-entry');
});

test('R-entry: an undated entry (no YYYY-MM-DD) is malformed', async () => {
  const v = h.validFiles();
  v['acorn.md'] =
    '- Acorn stores pairs (`Store`).\n\n## Facts\n\n- statement: undated claim (code).\n';
  // missing date breaks the head; provenance still present, so only R-entry.
  onlyRule((await h.lintFiles(v)).rules, 'R-entry');
});

test('R-entry: a NO-hash but otherwise-valid general statement is clean (hash is optional)', async () => {
  const v = h.validFiles();
  v['acorn.md'] =
    '- Acorn stores pairs (`Store`).\n\n## Facts\n\n- 2031-02-01 statement: a general claim, tied to no single commit (sourced).\n';
  assert.deepEqual((await h.lintFiles(v)).rules, []);
});

test('R-entry: an 8-hex hash with valid form is clean', async () => {
  const v = h.validFiles();
  v['acorn.md'] =
    '- Acorn stores pairs (`Store`).\n\n## Facts\n\n- 2031-02-01 (0a1b2c3d) statement: anchored to a commit (code).\n';
  assert.deepEqual((await h.lintFiles(v)).rules, []);
});

// ----- R-prov -------------------------------------------------------------

test('R-prov: a Facts entry with no (code)/(sourced)/(uncertain) tag fires', async () => {
  await assertBaselineClean();
  const v = h.validFiles();
  v['acorn.md'] =
    '- Acorn stores pairs (`Store`).\n\n## Facts\n\n- 2031-02-01 (00000001) statement: claim with no tag.\n';
  onlyRule((await h.lintFiles(v)).rules, 'R-prov');
});

test('R-prov: an invalid tag word like (inferred) fires (only three tags are legal)', async () => {
  const v = h.validFiles();
  v['acorn.md'] =
    '- Acorn stores pairs (`Store`).\n\n## Facts\n\n- 2031-02-01 (00000001) statement: claim (inferred).\n';
  onlyRule((await h.lintFiles(v)).rules, 'R-prov');
});

test('R-prov: a trailing "." after the tag is tolerated (provenance still recognized)', async () => {
  const v = h.validFiles();
  v['acorn.md'] =
    '- Acorn stores pairs (`Store`).\n\n## Facts\n\n- 2031-02-01 (00000001) statement: claim ends with a dot (code).\n';
  assert.deepEqual((await h.lintFiles(v)).rules, []);
});

test('R-prov: all three legal tags are accepted', async () => {
  for (const tag of ['code', 'sourced', 'uncertain']) {
    const v = h.validFiles();
    v['acorn.md'] =
      `- Acorn stores pairs (\`Store\`).\n\n## Facts\n\n- 2031-02-01 (00000001) statement: claim (${tag}).\n`;
    assert.deepEqual((await h.lintFiles(v)).rules, [], `tag (${tag}) should be legal`);
  }
});

// ----- R-verb -------------------------------------------------------------

test('R-verb: a Moves entry with no boundary verb fires', async () => {
  await assertBaselineClean();
  // Isolate R-verb: drop the .alt pair partner (so no R-pair), keep the fact file
  // link intact, and give page-cache a Moves entry whose label is not a boundary
  // verb. ab12cd34 is shared only by a *measurement* fact (not rationale) → no
  // R-redundant; the fact-file link still resolves → no R-link.
  const v = h.validFiles();
  delete v['acorn/page-cache.alt/write-through.md'];
  v['acorn/page-cache.md'] =
    `- Reads go through a fixed-size page cache (\`PageCache\`).

## Facts

- 2031-04-02 (ab12cd34) measurement: batching at eviction cut ingest latency 3.4x — data in [[page-cache.fact/stall]] (code).

## Moves

- 2031-04-02 (ab12cd34) noticed: this move line has no boundary verb (code).
`;
  onlyRule((await h.lintFiles(v)).rules, 'R-verb');
});

// ----- R-join -------------------------------------------------------------

test('R-join: an entry chaining two claims ("which is why") fires', async () => {
  await assertBaselineClean();
  const v = h.validFiles();
  v['acorn.md'] =
    '- Acorn stores pairs (`Store`).\n\n## Facts\n\n- 2031-02-01 (00000001) measurement: disk is slow which is why we cache (code).\n';
  onlyRule((await h.lintFiles(v)).rules, 'R-join');
});

test('R-join: "therefore" also trips the chain detector', async () => {
  const v = h.validFiles();
  v['acorn.md'] =
    '- Acorn stores pairs (`Store`).\n\n## Facts\n\n- 2031-02-01 (00000001) measurement: latency was high therefore we batched (code).\n';
  onlyRule((await h.lintFiles(v)).rules, 'R-join');
});

// ----- R-redundant --------------------------------------------------------

test('R-redundant: a rationale fact sharing a commit with a Move on the same node fires', async () => {
  await assertBaselineClean();
  const v = h.validFiles();
  // page-cache has a move at (ab12cd34); add a rationale fact with the SAME hash.
  v['acorn/page-cache.md'] = v['acorn/page-cache.md'].replace(
    '## Moves',
    '- 2031-04-02 (ab12cd34) rationale: same commit as the move, the why is duplicated (code).\n\n## Moves',
  );
  onlyRule((await h.lintFiles(v)).rules, 'R-redundant');
});

test('R-redundant: a rationale fact at a DIFFERENT commit than the move is clean', async () => {
  const v = h.validFiles();
  v['acorn/page-cache.md'] = v['acorn/page-cache.md'].replace(
    '## Moves',
    '- 2031-04-02 (99999999) rationale: distinct commit, no overlap (code).\n\n## Moves',
  );
  assert.deepEqual((await h.lintFiles(v)).rules, []);
});

test('R-redundant: a non-rationale (measurement) fact sharing the move commit is clean', async () => {
  const v = h.validFiles();
  v['acorn/page-cache.md'] = v['acorn/page-cache.md'].replace(
    '## Moves',
    '- 2031-04-02 (ab12cd34) measurement: same commit but it is evidence, not a why (code).\n\n## Moves',
  );
  assert.deepEqual((await h.lintFiles(v)).rules, []);
});

// ----- R-meta -------------------------------------------------------------

test('R-meta: workflow-metadata vocabulary ("ledger") in the tree fires', async () => {
  await assertBaselineClean();
  const v = h.validFiles();
  v['acorn.md'] =
    '- Acorn stores pairs; logged in the ledger (`Store`).\n\n## Facts\n\n- 2031-02-01 (00000001) statement: x (code).\n';
  onlyRule((await h.lintFiles(v)).rules, 'R-meta');
});

test('R-meta: "design tree" self-reference fires', async () => {
  const v = h.validFiles();
  v['acorn.md'] =
    '- Acorn stores pairs (`Store`).\n\n## Facts\n\n- 2031-02-01 (00000001) statement: added to the design tree (code).\n';
  onlyRule((await h.lintFiles(v)).rules, 'R-meta');
});

// ----- R-link -------------------------------------------------------------

test('R-link: an unresolvable [[link]] fires', async () => {
  await assertBaselineClean();
  const v = h.validFiles();
  v['acorn.md'] =
    '- Acorn stores pairs; see [[no-such-node]] (`Store`).\n\n## Facts\n\n- 2031-02-01 (00000001) statement: x (code).\n';
  onlyRule((await h.lintFiles(v)).rules, 'R-link');
});

test('R-link: a [[link]]-looking token inside a backtick code span is NOT a link (no false positive)', async () => {
  // code spans are stripped before scanning for links, so `[[ghost]]` is literal text.
  const v = h.validFiles();
  v['acorn.md'] =
    '- Acorn stores pairs; the literal `[[ghost]]` is code, not a link (`Store`).\n\n## Facts\n\n- 2031-02-01 (00000001) statement: x (code).\n';
  assert.deepEqual((await h.lintFiles(v)).rules, []);
});

test('R-link: a resolvable [[page-cache]] link is clean', async () => {
  const v = h.validFiles();
  v['acorn.md'] =
    '- Acorn stores pairs; see [[page-cache]] (`Store`).\n\n## Facts\n\n- 2031-02-01 (00000001) statement: x (code).\n';
  assert.deepEqual((await h.lintFiles(v)).rules, []);
});

// ----- R-pair -------------------------------------------------------------

test('R-pair: a winner whose why differs from its .alt twin fires', async () => {
  await assertBaselineClean();
  const v = h.validFiles();
  v['acorn/page-cache.md'] = v['acorn/page-cache.md'].replace(
    'write-through stalled every mutation on disk latency; batching at eviction removed the stall (code).',
    'an entirely different rationale on the winner side (code).',
  );
  onlyRule((await h.lintFiles(v)).rules, 'R-pair');
});

test('R-pair: a "replaced" with no "replaced by" twin in the loser fires', async () => {
  const v = h.validFiles();
  // strip the twin's "replaced by" line so the pairing is broken.
  v['acorn/page-cache.alt/write-through.md'] =
    '- Every mutation writes its page to disk before returning.\n';
  // that also makes the .alt member have no frozen-ending Moves → R-frozen.
  // R-frozen only fires when the member HAS a moves section ending wrong; with no
  // Moves at all (last === ''), it does fire. So allow R-frozen alongside R-pair.
  const rules = (await h.lintFiles(v)).rules;
  assert.ok(rules.includes('R-pair'), `expected R-pair, got ${JSON.stringify(rules)}`);
});

test('R-pair: em-dash + backtick differences in the why do NOT break the pair (normalized)', async () => {
  // normWhy() collapses whitespace and strips backticks, so cosmetic differences
  // in the verbatim why are tolerated as long as the normalized text matches.
  const v = h.validFiles();
  const base = 'write-through stalled every mutation on disk latency; batching at eviction removed the stall';
  v['acorn/page-cache.md'] = v['acorn/page-cache.md'].replace(
    base + ' (code).',
    'write-through stalled — `every` mutation on disk latency; batching at eviction removed the stall (code).',
  );
  v['acorn/page-cache.alt/write-through.md'] = v['acorn/page-cache.alt/write-through.md'].replace(
    base + ' (code).',
    'write-through stalled —  every    mutation on disk latency; batching at eviction removed the stall (code).',
  );
  assert.deepEqual((await h.lintFiles(v)).rules, []);
});

// ----- R-frozen -----------------------------------------------------------

test('R-frozen: an .alt member whose LAST move is not "replaced by"/"removed" fires', async () => {
  await assertBaselineClean();
  const v = h.validFiles();
  // append a trailing, non-frozen "dropped" line AFTER the proper "replaced by",
  // so the pairing stays intact (R-pair clean) but the last move is non-frozen.
  v['acorn/page-cache.alt/write-through.md'] +=
    '- 2031-04-03 (ab12cd34) dropped: leftover: a trailing non-frozen move (code).\n';
  onlyRule((await h.lintFiles(v)).rules, 'R-frozen');
});

test('R-frozen: a main-tree node ending in "replaced by" fires (should it be in .alt/?)', async () => {
  await assertBaselineClean();
  const v = h.validFiles();
  // give the live page-cache node a "replaced by" as its last move — wrong for a
  // main-tree node. Point it at the existing acorn node so the link resolves and a
  // matching twin exists (acorn gets the verbatim "replaced [[page-cache]]" mirror).
  v['acorn/page-cache.md'] +=
    '- 2031-06-01 (12340000) replaced by [[acorn]]: page-cache folded up into acorn (code).\n';
  v['acorn.md'] +=
    '\n## Moves\n\n- 2031-06-01 (12340000) replaced [[page-cache]]: page-cache folded up into acorn (code).\n';
  onlyRule((await h.lintFiles(v)).rules, 'R-frozen');
});

// ----- R-thin -------------------------------------------------------------

test('R-thin: a node with no .alt, no Facts, no Moves, and no children fires', async () => {
  await assertBaselineClean();
  const v = h.validFiles();
  v['acorn/bare.md'] = '- A bare component, no decision recorded (`Bare`).\n';
  onlyRule((await h.lintFiles(v)).rules, 'R-thin');
});

test('R-thin: a node with only an empty Facts section still counts as thin', async () => {
  const v = h.validFiles();
  // a node whose ## Facts section is present but empty → facts.length === 0
  v['acorn/hollow.md'] = '- A hollow node (`Hollow`).\n\n## Facts\n';
  onlyRule((await h.lintFiles(v)).rules, 'R-thin');
});

// ----- R-factfile ---------------------------------------------------------

test('R-factfile: a heading inside a .fact/ file fires', async () => {
  await assertBaselineClean();
  const v = h.validFiles();
  v['acorn/page-cache.fact/stall.md'] =
    'commit: ab12cd34\n\n# Diagnosis\n\nthe write-through stall body.\n';
  onlyRule((await h.lintFiles(v)).rules, 'R-factfile');
});

test('R-factfile: pure-prose fact file (no headings) is clean', async () => {
  const v = h.validFiles();
  v['acorn/page-cache.fact/stall.md'] =
    'commit: ab12cd34\n\nPlain prose, no headings whatsoever, just a long diagnosis.\n';
  assert.deepEqual((await h.lintFiles(v)).rules, []);
});

// ----- R-append (git) -----------------------------------------------------

test('R-append: editing a committed Facts/Moves entry fires (canonical-path repo)', () => {
  // Use the realpath of the tree root so git's --show-toplevel and the resolved
  // root agree (on macOS, /var is a symlink to /private/var; passing the
  // non-canonical path would make path.relative produce a broken rel and the
  // check would silently skip — see notes).
  const t = h.tmpTree(h.validFiles());
  try {
    h.gitInitCommit(t.dir);
    const realRoot = fs.realpathSync(t.root);
    // mutate a committed Facts entry's text (an append-only violation)
    const p = t.root + '/acorn.md';
    const c = fs
      .readFileSync(p, 'utf8')
      .replace('the store is a single append-only file on disk', 'EDITED: the store layout changed');
    fs.writeFileSync(p, c);

    const r = h.runCli(['lint', realRoot]);
    assert.equal(r.code, 1);
    assert.match(r.stderr, /\[R-append\]/);

    // committing the edit makes it the new baseline → plain lint is clean again
    h.gitInitCommit(t.dir, 'migrate');
    const r2 = h.runCli(['lint', realRoot]);
    assert.equal(r2.code, 0);
    assert.match(r2.stdout, /lint clean/);
  } finally {
    t.cleanup();
  }
});

test('R-append: appending a NEW Facts entry (true append-only) stays clean', () => {
  const t = h.tmpTree(h.validFiles());
  try {
    h.gitInitCommit(t.dir);
    const realRoot = fs.realpathSync(t.root);
    const p = t.root + '/acorn.md';
    fs.writeFileSync(
      p,
      fs.readFileSync(p, 'utf8') + '- 2031-09-09 (5a5a5a5a) measurement: new appended evidence (code).\n',
    );
    const r = h.runCli(['lint', realRoot]);
    assert.equal(r.code, 0);
    assert.match(r.stdout, /lint clean/);
  } finally {
    t.cleanup();
  }
});

// ============================================================================
// 5. Windows-y / whitespace edge cases
// ============================================================================

test('edge: a trailing blank line / extra blank paragraphs in items do not trip R-items', async () => {
  const v = h.validFiles();
  v['acorn.md'] =
    '- Acorn stores pairs (`Store`).\n\n\n\n## Facts\n\n- 2031-02-01 (00000001) statement: x (code).\n\n\n';
  assert.deepEqual((await h.lintFiles(v)).rules, []);
});

test('edge: an item that itself wraps across lines (continuation indented) is one item, clean', async () => {
  const v = h.validFiles();
  v['acorn.md'] =
    '- Acorn stores key-value pairs and keeps them\n  in a single on-disk structure (`Store`).\n\n## Facts\n\n- 2031-02-01 (00000001) statement: x (code).\n';
  assert.deepEqual((await h.lintFiles(v)).rules, []);
});
