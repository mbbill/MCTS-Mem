// Serialize an MCTS-Mem tree to JSON for the web viewer. The initial /api/tree is
// structural-only and built from directory/file names for fast startup; /api/node
// parses just the clicked Markdown node for Items/Facts/Moves.

import fs from 'node:fs';
import path from 'node:path';
import { parseNode, parseEntry, blocks, logical } from './tree.js';

// the entry's claim text, minus its "- date (hash) kind:" / "- ... verb [[x]]:"
// head and its trailing provenance tag (same derivation as view.js `claim`).
const claim = (e) =>
  e.flat
    .replace(/^- [^:]*?(?:\[\[[^\]]+\]\])?:/, '')
    .replace(/\((code|sourced|uncertain)\)\.?\s*$/, '')
    .trim();

function stemOf(p) {
  return path.basename(p).slice(0, -3);
}

function loadIndex(root) {
  root = path.resolve(root);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) throw new Error(`tree root not found: ${root}`);
  root = fs.realpathSync(root);
  const nodeFiles = [];
  const factFiles = [];
  const dirs = [];
  (function rec(d) {
    let ents;
    try { ents = fs.readdirSync(d, { withFileTypes: true }); }
    catch { return; }
    for (const e of ents) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) { dirs.push(full); rec(full); }
      else if (e.name.endsWith('.md')) (path.basename(d).endsWith('.fact') ? factFiles : nodeFiles).push(full);
    }
  })(root);
  const stems = new Map();
  for (const p of nodeFiles) {
    const s = stemOf(p);
    if (!stems.has(s)) stems.set(s, []);
    stems.get(s).push(p);
  }
  const ctx = { root, nodeFiles, factFiles, dirs, stems };
  ctx.stem = stemOf;
  ctx.logical = (p) => logical(root, p);
  ctx.resolve = (ref, frm) => resolve(ctx, ref, frm);
  return ctx;
}

function resolve(ctx, ref, frm) {
  if (ref.includes('.fact/')) {
    const tail = ref.split('/').pop() + '.md';
    const cand = ctx.factFiles.filter((f) => f.endsWith(tail) || ctx.logical(f).endsWith(ref));
    return cand[0] ?? null;
  }
  const name = ref.split('/').pop();
  const cands = ctx.stems.get(name) ?? [];
  if (cands.length === 1) return cands[0];
  const near = cands.filter(
    (c) =>
      path.dirname(c).startsWith(path.dirname(frm)) ||
      path.dirname(frm).startsWith(path.dirname(c).replace('.alt', ''))
  );
  return near.length === 1 ? near[0] : cands[0] ?? null;
}

function childrenOf(ctx, dir) {
  return ctx.nodeFiles.filter((q) => path.dirname(q) === dir).sort();
}

function relatives(ctx, p) {
  const base = p.slice(0, -3);
  const factDir = base + '.fact';
  const factFiles = fs.existsSync(factDir)
    ? fs.readdirSync(factDir).filter((f) => f.endsWith('.md')).sort().map((f) => path.join(factDir, f))
    : [];
  return { children: childrenOf(ctx, base), alts: childrenOf(ctx, base + '.alt'), factFiles };
}

function entry(ctx, from, block) {
  const e = parseEntry(block);
  const out = {
    date: e.date,
    hash: e.hash,
    kind: e.kind,
    verb: e.verb,
    isMove: e.isMove,
    provenance: e.tag,
    text: claim(e),
  };
  if (e.isMove) {
    const m = /\[\[([^\]]+)\]\]/.exec(block);
    if (m) {
      out.targetName = m[1].split('/').pop();
      const r = ctx.resolve(m[1], from);
      out.target = r ? ctx.logical(r) : null; // logical path for in-app navigation
    }
  }
  return out;
}

// confidence signal, matching view.js: thick with facts = fought over; no signal
// at all = nobody weighed it, reconsider freely.
const weight = (f, m, a) =>
  f >= 5 ? 'fought-over' : f === 0 && m === 0 && a === 0 ? 'unweighed' : 'normal';

function lightMeta(p) {
  const n = parseNode(fs.readFileSync(p, 'utf8'));
  const provenance = { code: 0, sourced: 0, uncertain: 0 };
  for (const b of [...n.facts, ...n.moves]) {
    const e = parseEntry(b);
    if (provenance[e.tag] != null) provenance[e.tag]++;
  }
  return { facts: n.facts.length, moves: n.moves.length, provenance };
}

function summary(ctx, p) {
  const rel = relatives(ctx, p);
  const meta = lightMeta(p);
  return {
    name: ctx.stem(p),
    path: ctx.logical(p),
    inAlt: p.includes('.alt' + path.sep),
    counts: { facts: meta.facts, moves: meta.moves, alts: rel.alts.length, children: rel.children.length },
    weight: weight(meta.facts, meta.moves, rel.alts.length),
    provenance: meta.provenance,
    children: rel.children.map((q) => summary(ctx, q)),
    alts: rel.alts.map((q) => summary(ctx, q)),
  };
}

function details(ctx, p) {
  const n = parseNode(fs.readFileSync(p, 'utf8'));
  const rel = relatives(ctx, p);
  const facts = n.facts.map((b) => entry(ctx, p, b));
  const moves = n.moves.map((b) => entry(ctx, p, b));
  const provenance = { code: 0, sourced: 0, uncertain: 0 };
  for (const e of [...facts, ...moves]) if (provenance[e.provenance] != null) provenance[e.provenance]++;
  return {
    name: ctx.stem(p),
    path: ctx.logical(p),
    inAlt: p.includes('.alt' + path.sep),
    items: blocks(n.itemsText).map((b) => b.replace(/^\-\s+/, '').replace(/\s+/g, ' ').trim()),
    facts,
    moves,
    factFiles: rel.factFiles.map((f) => path.basename(f, '.md')),
    counts: { facts: facts.length, moves: moves.length, alts: rel.alts.length, children: rel.children.length },
    weight: weight(facts.length, moves.length, rel.alts.length),
    provenance,
  };
}

function topNode(ctx) {
  const top = ctx.nodeFiles.filter((p) => path.dirname(p) === ctx.root);
  if (top.length !== 1) throw new Error(`expected exactly 1 top-level node, found ${top.length}`);
  return top[0];
}

function byLogicalPath(ctx, logicalPath) {
  return ctx.nodeFiles.find((p) => ctx.logical(p) === logicalPath) || null;
}

export function treeJson(root) {
  const ctx = loadIndex(root);
  return { root: summary(ctx, topNode(ctx)) };
}

export function nodeJson(root, logicalPath) {
  const ctx = loadIndex(root);
  const p = byLogicalPath(ctx, logicalPath);
  if (!p) throw new Error(`node not found: ${logicalPath}`);
  return { node: details(ctx, p) };
}
