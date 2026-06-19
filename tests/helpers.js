// Shared, read-only test harness for the mcts-mem CLI. Test files import this;
// none of them should modify it. Build throwaway trees in the OS temp dir, run
// the CLI as a subprocess or call modules directly, and assert.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.join(here, '..');
export const BIN = path.join(ROOT_DIR, 'bin', 'mcts-mem.js');

// Write { "<relpath>": "<content>" } into a fresh tmp dir under a root subdir.
// Returns { dir, root, write, rm, cleanup }. `root` is the tree root to pass to the CLI.
export function tmpTree(files = {}, { rootName = 'mcts_mem' } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-test-'));
  const root = path.join(dir, rootName);
  const write = (rel, content) => {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  };
  const rm = (rel) => fs.rmSync(path.join(root, rel), { recursive: true, force: true });
  for (const [rel, content] of Object.entries(files)) write(rel, content);
  return { dir, root, write, rm, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

// Run the CLI binary; never throws. Returns { code, stdout, stderr }.
export function runCli(args, { cwd } = {}) {
  try {
    const stdout = execFileSync('node', [BIN, ...args], {
      cwd, encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' },
    });
    return { code: 0, stdout, stderr: '' };
  } catch (e) {
    return {
      code: typeof e.status === 'number' ? e.status : 1,
      stdout: e.stdout ? e.stdout.toString() : '',
      stderr: e.stderr ? e.stderr.toString() : '',
    };
  }
}

// git helpers (for the R-append check, which compares the working tree to HEAD)
export function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
}
export function gitInitCommit(dir, msg = 'init') {
  git(dir, 'init', '-q');
  git(dir, 'config', 'user.email', 'test@test');
  git(dir, 'config', 'user.name', 'test');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', msg);
}

// A minimal tree that lints fully clean (in a non-git tmp dir, R-append is skipped).
// Exercises: root, a child with facts+moves, an .alt member (paired move, frozen),
// and a .fact/ file + link. Return a fresh copy so callers can mutate one rule.
export function validFiles() {
  return {
    'acorn.md':
`- Acorn stores key-value pairs, one value per key (\`Store\`).

## Facts

- 2031-02-01 (00000001) statement: the store is a single append-only file on disk (code).
`,
    'acorn/page-cache.md':
`- Reads go through a fixed-size page cache (\`PageCache\`); a page loads from disk only on a miss.

## Facts

- 2031-04-02 (ab12cd34) measurement: batching at eviction cut ingest latency 3.4x — data in [[page-cache.fact/stall]] (code).

## Moves

- 2031-04-02 (ab12cd34) replaced [[write-through]]: write-through stalled every mutation on disk latency; batching at eviction removed the stall (code).
`,
    'acorn/page-cache.alt/write-through.md':
`- Every mutation writes its page to disk before returning.

## Moves

- 2031-04-02 (ab12cd34) replaced by [[page-cache]]: write-through stalled every mutation on disk latency; batching at eviction removed the stall (code).
`,
    'acorn/page-cache.fact/stall.md':
`commit: ab12cd34

Under the ingest benchmark, write-through spent 71% of wall time blocked on synchronous page writes.
`,
  };
}

// Convenience: lint a files-map directly (programmatic), auto-cleanup.
export async function lintFiles(files, opts) {
  const t = tmpTree(files);
  const { lint } = await import(path.join(ROOT_DIR, 'src', 'lint.js'));
  try {
    const r = lint(t.root, opts);
    return { ...r, rules: r.errors.map((e) => e.rule) };
  } finally {
    t.cleanup();
  }
}
