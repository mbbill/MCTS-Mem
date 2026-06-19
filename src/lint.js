// Linter for an MCTS-Mem design tree — the executable form of the grammar the
// skills specify. A faithful port of the rule set: structure, entry form,
// provenance, verbatim move pairs, append-only, "not a module map", etc.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  loadTree,
  parseNode,
  blocks,
  normWhy,
  ENTRY_HEAD,
  PROV,
  MOVE_VERB,
  LINK,
} from './tree.js';

export function lint(root, opts = {}) {
  const { skeleton = false } = opts;
  const ctx = loadTree(root);
  const display = (p) => path.relative(path.dirname(ctx.root), p);
  const errors = [];
  const err = (rule, p, msg) => errors.push({ rule, path: display(p), msg });

  // ---------- R-root ----------
  const top = ctx.nodeFiles.filter((p) => path.dirname(p) === ctx.root);
  if (top.length !== 1) {
    err('R-root', ctx.root, `expected exactly 1 top-level node, found ${top.length}: ` +
      top.map((t) => path.basename(t)).join(', '));
  }

  // ---------- R-orphan / R-empty ----------
  for (const d of ctx.dirs) {
    const name = path.basename(d);
    const base = name.endsWith('.fact') ? name.slice(0, -5)
      : name.endsWith('.alt') ? name.slice(0, -4) : name;
    const sibling = path.join(path.dirname(d), base + '.md');
    if (!fs.existsSync(sibling)) err('R-orphan', d, `directory has no sibling ${base}.md`);
    if ((name.endsWith('.alt') || name.endsWith('.fact')) &&
        !fs.readdirSync(d).some((f) => f.endsWith('.md'))) {
      err('R-empty', d, 'empty structure directory');
    }
  }

  // ---------- per-node grammar ----------
  for (const p of ctx.nodeFiles) {
    const node = ctx.parsed.get(p);
    const text = node.text;

    // R-title
    const first = text.split('\n').find((l) => l.trim()) || '';
    if (first.startsWith('#')) err('R-title', p, 'file starts with a heading; items come first, no titles');

    // R-sections
    const allowed = ['## Facts', '## Moves'];
    const seq = node.headings;
    const bad = seq.filter((h) => !allowed.includes(h));
    if (bad.length) err('R-sections', p, `unexpected heading(s): ${JSON.stringify(bad)}`);
    const order = allowed.filter((h) => seq.includes(h));
    if (JSON.stringify(seq) !== JSON.stringify(order)) err('R-sections', p, `sections out of order: ${JSON.stringify(seq)}`);

    // R-items / R-tail
    for (const para of node.itemsText.trim().split(/\n\s*\n/)) {
      if (!para) continue;
      if (!para.startsWith('- ')) {
        err('R-items', p, `non-item content in items section: ${JSON.stringify(para.split('\n')[0].slice(0, 60))}`);
      }
      const flat = para.replace(/\s+/g, ' ');
      const m = /(^|[ ,;(])(so|so that|because|thus|hence|since|therefore)[ ,]/i.exec(flat);
      if (para.startsWith('- ') && m && m[2].toLowerCase() !== 'since') {
        err('R-tail', p, `item has a rationale tail (${JSON.stringify(m[1].trim())}); move the why to Facts/Moves: ${JSON.stringify(flat.slice(0, 70))}`);
      }
    }

    // R-entry / R-prov / R-verb / R-join over Facts + Moves
    for (const [kind, list] of [['Facts', node.facts], ['Moves', node.moves]]) {
      for (const b of list) {
        if (!ENTRY_HEAD.test(b)) err('R-entry', p, `${kind} entry malformed head: ${JSON.stringify(b.split('\n')[0].slice(0, 70))}`);
        if (!PROV.test(b)) err('R-prov', p, `${kind} entry missing provenance tag: ${JSON.stringify(b.split('\n')[0].slice(0, 70))}`);
        if (kind === 'Moves' && !MOVE_VERB.test(b)) err('R-verb', p, `Moves entry has no boundary verb: ${JSON.stringify(b.split('\n')[0].slice(0, 70))}`);
        if (/\b(which is why|that is why|the reason|hence|therefore)\b/i.test(b.replace(/\s+/g, ' '))) {
          err('R-join', p, `${kind} entry chains two claims (atomize it): ${JSON.stringify(b.split('\n')[0].slice(0, 70))}`);
        }
      }
    }

    // R-redundant: a rationale fact must not share a commit with a Moves entry on this node
    const moveHashes = new Set();
    for (const b of node.moves) { const m = ENTRY_HEAD.exec(b); if (m && m[3]) moveHashes.add(m[3]); }
    for (const b of node.facts) {
      const m = ENTRY_HEAD.exec(b);
      if (m && m[4].trim() === 'rationale' && m[3] && moveHashes.has(m[3])) {
        err('R-redundant', p, `rationale fact shares commit ${m[3]} with a move on this node; the move already records the why`);
      }
    }

    // R-meta: the tree never references its own construction
    for (const w of ['ledger', 'batch report', 'design tree', 'extraction run', 'deferred until']) {
      if (text.toLowerCase().includes(w)) err('R-meta', p, `workflow-metadata vocabulary in tree: ${JSON.stringify(w)}`);
    }
  }

  // ---------- R-link ----------
  for (const p of ctx.nodeFiles) {
    const text = ctx.parsed.get(p).text.replace(/`[^`]*`/g, '');
    for (const m of text.matchAll(LINK)) {
      if (ctx.resolve(m[1], p) === null) err('R-link', p, `unresolvable link [[${m[1]}]]`);
    }
  }

  // ---------- R-pair: replaced <-> replaced by, verbatim why ----------
  // The twin is matched by identity (it points back to the winner) and the why
  // must be verbatim — NOT by hash: each side records its own commit, which may
  // differ (only the <why> is required identical).
  for (const p of ctx.nodeFiles) {
    for (const b of ctx.parsed.get(p).moves) {
      const m = /^- \S+( \([0-9a-f]{8}\))? replaced \[\[([^\]]+)\]\]:/.exec(b);
      if (!m) continue;
      const loserRef = m[2];
      const loser = ctx.resolve(loserRef, p);
      if (loser === null) continue; // R-link already fired
      // the loser must carry a 'replaced by' move with the SAME why; the two
      // sides' dates/hashes may differ, so match on the verbatim why, not the hash
      const twins = (ctx.parsed.get(loser)?.moves ?? []).filter((tb) =>
        /^- \S+( \([0-9a-f]{8}\))? replaced by \[\[/.test(tb));
      if (!twins.length) err('R-pair', p, `replaced [[${loserRef}]] has no 'replaced by' twin in ${path.basename(loser)}`);
      else if (!twins.some((tb) => normWhy(tb) === normWhy(b))) err('R-pair', p, `why differs from twin in ${path.basename(loser)}`);
    }
  }

  // ---------- R-frozen ----------
  for (const p of ctx.nodeFiles) {
    const inAltMember = path.basename(path.dirname(p)).endsWith('.alt');
    const inAltSubtree = p.includes('.alt' + path.sep);
    const mv = ctx.parsed.get(p).moves;
    const last = mv.length ? mv[mv.length - 1] : '';
    if (inAltMember && !/(replaced by \[\[|removed:)/.test(last)) {
      err('R-frozen', p, ".alt member's Moves must end in 'replaced by'/'removed'");
    }
    if (!inAltSubtree && /replaced by \[\[/.test(last) && !last.includes('revived')) {
      err('R-frozen', p, "main-tree node ends 'replaced by' (should it be in .alt/?)");
    }
  }

  // ---------- R-thin (skipped under --skeleton) ----------
  if (!skeleton) {
    for (const p of ctx.nodeFiles) {
      const base = p.slice(0, -3);
      const hasMd = (dir) => fs.existsSync(dir) && fs.readdirSync(dir).some((f) => f.endsWith('.md'));
      const node = ctx.parsed.get(p);
      if (!(hasMd(base + '.alt') || hasMd(base) || node.facts.length || node.moves.length)) {
        err('R-thin', p, 'node has no .alt/, no Facts, no Moves, and no children — it asserts a ' +
          'component without recording a decision (module-map node); fold it into its parent, or ' +
          'record the decision (alternative, rationale fact)');
      }
    }
  }

  // ---------- R-factfile ----------
  for (const p of ctx.factFiles) {
    if (/^#+ /m.test(fs.readFileSync(p, 'utf8'))) err('R-factfile', p, 'fact file contains headings');
  }

  // ---------- R-append: Facts/Moves are append-only vs git HEAD ----------
  // A deliberate, bulk rewrite of committed history (a sanctioned migration) is
  // handled by committing it — once committed, HEAD is the new baseline and this
  // passes; there is no flag to switch the integrity check off.
  {
    const git = (...a) => execFileSync('git', a, { cwd: ctx.root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    let repoRoot = null;
    try { repoRoot = git('rev-parse', '--show-toplevel').trim(); } catch { /* not a git repo */ }
    if (repoRoot) {
      const treeEntries = new Set();
      for (const p of ctx.nodeFiles) {
        const n = ctx.parsed.get(p);
        for (const b of [...n.facts, ...n.moves]) treeEntries.add(b.replace(/\s+/g, ' '));
      }
      for (const p of ctx.nodeFiles) {
        const rel = path.relative(repoRoot, p);
        let old;
        try { old = git('show', `HEAD:${rel}`); } catch { continue; } // new file
        const on = parseNode(old);
        const oldEntries = [...on.facts, ...on.moves].map((b) => b.replace(/\s+/g, ' '));
        const gone = oldEntries.filter((e) => !treeEntries.has(e));
        if (gone.length) err('R-append', p, `${gone.length} committed Facts/Moves entr${gone.length === 1 ? 'y' : 'ies'} edited or removed`);
      }
    }
  }

  return { errors, nodeCount: ctx.nodeFiles.length, factCount: ctx.factFiles.length };
}
