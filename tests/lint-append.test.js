// R-append: the append-only-vs-HEAD git check.
//
// R-append (src/lint.js) compares each current node file against `HEAD:<rel>`
// and flags any committed Facts/Moves entry whose whitespace-collapsed text no
// longer appears ANYWHERE in the current tree (the check is tree-global). It is
// skipped when the tree is not in a git repo, and a file absent from HEAD (a
// brand-new node) is never checked. A deliberate bulk rewrite is handled by
// committing it (HEAD becomes the new baseline) — there is no suppression flag.
//
// These tests build a committed tmp tree, perturb exactly one thing, and assert
// both that R-append fires on the bad edit AND that it does not false-positive
// on benign motion (relocation, new entry, whitespace re-wrap, new file).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as h from './helpers.js';

// Relative specifier (not an absolute path) so the ESM loader accepts it on
// Windows too — an absolute `D:\...` path is read as a URL scheme and rejected.
const { lint } = await import('../src/lint.js');

// --- local helpers -----------------------------------------------------------

// validFiles() with one extra/overridden file, committed into a git repo.
// Returns { files, t, root } where `root` is the SYMLINK-RESOLVED tree root so
// that path.relative(gitToplevel, nodeFile) is a valid in-repo path. (On macOS
// os.tmpdir() lives under /var which git reports as /private/var — see the
// "symlinked root" bug test below for why this matters.)
function committed(extra = {}) {
  const files = { ...h.validFiles(), ...extra };
  const t = h.tmpTree(files);
  h.gitInitCommit(t.dir);
  return { files, t, root: fs.realpathSync(t.root) };
}

// Lint a (possibly mutated) committed tree at its resolved root; return rule list.
function rulesOf(root, opts) {
  const r = lint(root, opts);
  return r.errors.map((e) => e.rule);
}

// Assert R-append is present and that NO unrelated rule fired (only the rules in
// `also` are tolerated alongside it). Keeps each perturbation surgical.
function assertOnlyAppend(rules, also = []) {
  assert.ok(rules.includes('R-append'), `expected R-append, got ${JSON.stringify(rules)}`);
  const allowed = new Set(['R-append', ...also]);
  const extra = rules.filter((r) => !allowed.has(r));
  assert.deepEqual(extra, [], `unexpected extra rules: ${JSON.stringify(extra)}`);
}

const FACT_LINE =
  '- 2031-02-01 (00000001) statement: the store is a single append-only file on disk (code).';

// --- 0. baseline -------------------------------------------------------------

test('committed unperturbed tree lints fully clean (R-append included)', () => {
  const { t, root } = committed();
  try {
    assert.deepEqual(rulesOf(root, {}), []);
  } finally {
    t.cleanup();
  }
});

test('a non-git tree skips R-append even when an entry is edited', () => {
  // No gitInitCommit: lint should find no git toplevel and skip the check.
  const files = h.validFiles();
  const t = h.tmpTree(files);
  try {
    t.write('acorn.md', files['acorn.md'].replace('disk (code)', 'SSD (code)'));
    assert.ok(!rulesOf(t.root, {}).includes('R-append'));
  } finally {
    t.cleanup();
  }
});

// --- 1. editing a committed entry fires R-append -----------------------------

test('(1) editing a committed Facts entry text fires R-append', () => {
  const { files, t, root } = committed();
  try {
    t.write('acorn.md', files['acorn.md'].replace('disk (code)', 'SSD (code)'));
    assertOnlyAppend(rulesOf(root, {}));
  } finally {
    t.cleanup();
  }
});

test('(1b) editing a committed Moves entry why fires R-append', () => {
  // Changing only the winner's why also desyncs the verbatim twin, so R-pair is
  // an expected companion here — but R-append must fire for the edited entry.
  const { files, t, root } = committed();
  try {
    t.write(
      'acorn/page-cache.md',
      files['acorn/page-cache.md'].replace('removed the stall (code).', 'removed the stall entirely (code).'),
    );
    assertOnlyAppend(rulesOf(root, {}), ['R-pair']);
  } finally {
    t.cleanup();
  }
});

test('(1c) the message names the count and the file', () => {
  const { files, t, root } = committed();
  try {
    t.write('acorn.md', files['acorn.md'].replace('disk (code)', 'SSD (code)'));
    const r = lint(root, {});
    const e = r.errors.find((x) => x.rule === 'R-append');
    assert.ok(e, 'expected an R-append error object');
    assert.match(e.msg, /1 committed Facts\/Moves entry edited or removed/);
    assert.equal(path.basename(e.path), 'acorn.md');
  } finally {
    t.cleanup();
  }
});

// --- 2. deleting a committed entry fires R-append ----------------------------

test('(2) deleting a committed Facts entry (file stays) fires R-append', () => {
  const { files, t, root } = committed();
  try {
    // Strip the one Facts entry from acorn.md, leaving an (empty) Facts section.
    const edited = files['acorn.md'].replace(FACT_LINE + '\n', '');
    t.write('acorn.md', edited);
    assertOnlyAppend(rulesOf(root, {}));
  } finally {
    t.cleanup();
  }
});

test('(2b) deleting a committed Moves entry fires R-append', () => {
  // Remove the loser-side "replaced by" twin from the .alt member. Emptying its
  // only Moves entry cascades into several expected companions: R-pair (the
  // winner's twin is now missing), R-frozen (the .alt member no longer ends in
  // replaced-by/removed), and R-thin (the member now records no decision at all).
  // The deleted committed Moves entry must still trip R-append.
  const { files, t, root } = committed();
  try {
    const wt = files['acorn/page-cache.alt/write-through.md'].replace(
      /## Moves[\s\S]*$/,
      '## Moves\n',
    );
    t.write('acorn/page-cache.alt/write-through.md', wt);
    assertOnlyAppend(rulesOf(root, {}), ['R-pair', 'R-frozen', 'R-empty', 'R-thin']);
  } finally {
    t.cleanup();
  }
});

// --- 3. a sanctioned rewrite is handled by committing it (no suppression flag) -

test('(3) editing a committed entry fires R-append; re-committing clears it', () => {
  const { files, t, root } = committed();
  try {
    t.write('acorn.md', files['acorn.md'].replace('disk (code)', 'SSD (code)'));
    // before re-commit the edit looks like a silent rewrite → R-append fires
    assert.ok(rulesOf(root, {}).includes('R-append'));
    // committing the migration makes HEAD the new baseline → plain lint is clean
    h.gitInitCommit(t.dir, 'migrate');
    assert.deepEqual(rulesOf(root, {}), []);
  } finally {
    t.cleanup();
  }
});

test('(3b) via runCli: edit → exit 1 (R-append); re-commit → exit 0 clean', () => {
  const { files, t, root } = committed();
  try {
    t.write('acorn.md', files['acorn.md'].replace('disk (code)', 'SSD (code)'));
    const bad = h.runCli(['lint', root]);
    assert.equal(bad.code, 1);
    assert.match(bad.stderr, /\[R-append\]/);

    h.gitInitCommit(t.dir, 'migrate');
    const ok = h.runCli(['lint', root]);
    assert.equal(ok.code, 0);
    assert.match(ok.stdout, /lint clean/);
  } finally {
    t.cleanup();
  }
});

// --- 4. a brand-new node file not in HEAD is NOT flagged ---------------------

test('(4) a brand-new node file absent from HEAD is not flagged by R-append', () => {
  const { t, root } = committed();
  try {
    // page-cache gains a child node never committed; its entries are not in HEAD.
    t.write(
      'acorn/page-cache/sub.md',
      '- A finer sub-decision under the page cache (`Sub`).\n\n' +
        '## Facts\n\n- 2031-05-01 (deadbeef) statement: the sub-node holds nothing committed yet (code).\n',
    );
    assert.ok(!rulesOf(root, {}).includes('R-append'));
  } finally {
    t.cleanup();
  }
});

// --- 5. relocating an entry verbatim to a DIFFERENT file is NOT flagged ------

test('(5) relocating a committed Facts entry verbatim to a sibling node is not flagged (tree-global)', () => {
  const { files, t, root } = committed();
  try {
    // Remove the fact from acorn.md ...
    t.write('acorn.md', files['acorn.md'].replace(FACT_LINE + '\n', ''));
    // ... and paste it verbatim into page-cache.md's Facts section.
    const pc = files['acorn/page-cache.md'].replace(
      '- 2031-04-02 (ab12cd34) measurement:',
      FACT_LINE + '\n\n- 2031-04-02 (ab12cd34) measurement:',
    );
    t.write('acorn/page-cache.md', pc);
    assert.ok(!rulesOf(root, {}).includes('R-append'),
      'verbatim relocation to another file must not trip append-only');
  } finally {
    t.cleanup();
  }
});

test('(5b) relocating a committed entry verbatim into an .alt member is not flagged', () => {
  const { files, t, root } = committed();
  try {
    const measure =
      '- 2031-04-02 (ab12cd34) measurement: batching at eviction cut ingest latency 3.4x — data in [[page-cache.fact/stall]] (code).';
    // Drop the measurement from the live page-cache node ...
    t.write('acorn/page-cache.md', files['acorn/page-cache.md'].replace(measure + '\n\n', ''));
    // ... and move it verbatim into the rejected write-through alt's Facts.
    const wt = files['acorn/page-cache.alt/write-through.md'].replace(
      '## Moves',
      '## Facts\n\n' + measure + '\n\n## Moves',
    );
    t.write('acorn/page-cache.alt/write-through.md', wt);
    assert.ok(!rulesOf(root, {}).includes('R-append'));
  } finally {
    t.cleanup();
  }
});

test('(5c) but relocating with a one-word change DOES fire (it is no longer verbatim)', () => {
  const { files, t, root } = committed();
  try {
    t.write('acorn.md', files['acorn.md'].replace(FACT_LINE + '\n', ''));
    const altered = FACT_LINE.replace('append-only', 'log-structured');
    const pc = files['acorn/page-cache.md'].replace(
      '- 2031-04-02 (ab12cd34) measurement:',
      altered + '\n\n- 2031-04-02 (ab12cd34) measurement:',
    );
    t.write('acorn/page-cache.md', pc);
    // The original committed text now appears nowhere -> append-only fires.
    assertOnlyAppend(rulesOf(root, {}));
  } finally {
    t.cleanup();
  }
});

// --- 6. adding a NEW entry to an existing file is fine -----------------------

test('(6) appending a new Facts entry to a committed file does not fire R-append', () => {
  const { files, t, root } = committed();
  try {
    const pc = files['acorn/page-cache.md'].replace(
      '## Moves',
      '- 2031-06-01 (11112222) pitfall: cache thrash under random reads (code).\n\n## Moves',
    );
    t.write('acorn/page-cache.md', pc);
    assert.deepEqual(rulesOf(root, {}), []);
  } finally {
    t.cleanup();
  }
});

// --- adversarial: whitespace / wrapping normalization ------------------------

test('re-wrapping a committed one-line entry across two lines (same words) is not flagged', () => {
  const { files, t, root } = committed();
  try {
    const rewrapped = files['acorn.md'].replace(
      FACT_LINE,
      '- 2031-02-01 (00000001) statement: the store is a single\n  append-only file on disk (code).',
    );
    t.write('acorn.md', rewrapped);
    // Whitespace-collapse makes the two forms identical -> no append-only flag.
    assert.deepEqual(rulesOf(root, {}), []);
  } finally {
    t.cleanup();
  }
});

test('editing one wrapped line of a committed multi-line entry fires R-append', () => {
  const wrapped = {
    'acorn.md':
`- Acorn stores key-value pairs, one value per key (\`Store\`).

## Facts

- 2031-02-01 (00000001) statement: the store is a single
  append-only file on disk that survives restart (code).
`,
  };
  const { t, root } = committed(wrapped);
  try {
    assert.deepEqual(rulesOf(root, {}), []); // baseline of the wrapped tree
    t.write('acorn.md', wrapped['acorn.md'].replace('survives restart', 'survives reboot'));
    assertOnlyAppend(rulesOf(root, {}));
  } finally {
    t.cleanup();
  }
});

test('a "Windows-y" whitespace-only blank line between committed entries lints clean', () => {
  // The separator line carries a stray trailing space — common from editors.
  const acorn =
`- Acorn stores key-value pairs, one value per key (\`Store\`).

## Facts

- 2031-02-01 (00000001) statement: the store is a single append-only file on disk (code).
${' '}
- 2031-02-02 (00000002) statement: each key maps to exactly one value (code).
`;
  const { t, root } = committed({ 'acorn.md': acorn });
  try {
    assert.deepEqual(rulesOf(root, {}), []);
  } finally {
    t.cleanup();
  }
});

// --- adversarial: em-dash + backtick whys -----------------------------------

test('em-dash + backtick committed entry: identical re-write clean, word change fires', () => {
  const acorn =
`- Acorn stores key-value pairs, one value per key (\`Store\`).

## Facts

- 2031-02-01 (00000001) measurement: \`Store\` ingest — 3.4x faster after eviction batching (code).
`;
  const { t, root } = committed({ 'acorn.md': acorn });
  try {
    assert.deepEqual(rulesOf(root, {}), []);
    // Rewrite byte-for-byte -> still clean (entry text unchanged).
    t.write('acorn.md', acorn);
    assert.deepEqual(rulesOf(root, {}), []);
    // Change a number inside the em-dash/backtick entry -> append-only fires.
    t.write('acorn.md', acorn.replace('3.4x', '4.4x'));
    assertOnlyAppend(rulesOf(root, {}));
  } finally {
    t.cleanup();
  }
});

// --- adversarial: hashes (8-hex, missing) -----------------------------------

test('editing a committed entry that carries NO hash still fires R-append', () => {
  const acorn =
`- Acorn stores key-value pairs, one value per key (\`Store\`).

## Facts

- 2031-02-01 statement: the store is append-only by design (sourced).
`;
  const { t, root } = committed({ 'acorn.md': acorn });
  try {
    assert.deepEqual(rulesOf(root, {}), []); // hashless entry is valid form
    t.write('acorn.md', acorn.replace('by design', 'on purpose'));
    assertOnlyAppend(rulesOf(root, {}));
  } finally {
    t.cleanup();
  }
});

test('changing only the 8-hex hash of a committed entry fires R-append (the head changed)', () => {
  const { files, t, root } = committed();
  try {
    t.write('acorn.md', files['acorn.md'].replace('(00000001)', '(0000beef)'));
    assertOnlyAppend(rulesOf(root, {}));
  } finally {
    t.cleanup();
  }
});

// --- end-to-end via runCli ---------------------------------------------------

test('runCli lint exits 1 and prints [R-append] when a committed entry is edited', () => {
  const { files, t, root } = committed();
  try {
    t.write('acorn.md', files['acorn.md'].replace('disk (code)', 'SSD (code)'));
    const res = h.runCli(['lint', root]);
    assert.equal(res.code, 1);
    assert.match(res.stderr, /violation/);
    assert.match(res.stderr, /\[R-append\] .*acorn\.md/);
  } finally {
    t.cleanup();
  }
});

test('runCli lint exits 0 for verbatim relocation and for a new file', () => {
  const { files, t, root } = committed();
  try {
    // verbatim relocation acorn.md -> page-cache.md
    t.write('acorn.md', files['acorn.md'].replace(FACT_LINE + '\n', ''));
    t.write(
      'acorn/page-cache.md',
      files['acorn/page-cache.md'].replace(
        '- 2031-04-02 (ab12cd34) measurement:',
        FACT_LINE + '\n\n- 2031-04-02 (ab12cd34) measurement:',
      ),
    );
    const res = h.runCli(['lint', root]);
    assert.equal(res.code, 0);
    assert.match(res.stdout, /lint clean/);
  } finally {
    t.cleanup();
  }
});

// --- bug documentation: these assert CORRECT behavior and currently FAIL -----

test('BUG: R-append should fire when the tree root is reached via a symlinked path', () => {
  // helpers.tmpTree() roots the tree under os.tmpdir() (/var/... on macOS), but
  // git rev-parse --show-toplevel canonicalizes to /private/var/.... lint() runs
  // path.relative(gitToplevel, nodeFile) without canonicalizing the tree root, so
  // the relative path is a bogus ../../.. chain, every `git show HEAD:<rel>` fails,
  // and R-append is silently skipped for the ENTIRE tree. An edit to a committed
  // entry MUST still be caught regardless of how the root path was spelled.
  const { files, t } = committed(); // note: use the UNRESOLVED t.root below
  try {
    t.write('acorn.md', files['acorn.md'].replace('disk (code)', 'SSD (code)'));
    const rules = lint(t.root, {}).errors.map((e) => e.rule); // symlinked /var root
    assert.ok(rules.includes('R-append'),
      'append-only silently disabled when the tree lives under a symlinked path');
  } finally {
    t.cleanup();
  }
});

test('BUG: re-encoding a committed file as CRLF (no word changes) must not fire R-append', () => {
  // The entry text is byte-identical except for line endings; whitespace-collapse
  // should make old and new compare equal. But parseNode splits on \n only, so a
  // CRLF "## Facts\r" heading is mis-parsed (named "Facts\r"), the Facts section
  // vanishes, its entries read as "gone", and R-append false-positives (alongside
  // R-items). A tree authored on Windows/CRLF is thus unverifiable.
  const { files, t, root } = committed();
  try {
    t.write('acorn.md', files['acorn.md'].replace(/\n/g, '\r\n'));
    assert.ok(!rulesOf(root, {}).includes('R-append'),
      'CRLF re-encoding of an unchanged entry must not be read as an append-only violation');
  } finally {
    t.cleanup();
  }
});
