// Serialize an MCTS-Mem tree to JSON for the web viewer. Built on the same model
// (src/tree.js) as the terminal `view`/`show`, so the browser and the CLI can
// never disagree about what the tree is.

import path from 'node:path';
import { loadTree, parseEntry, blocks, relatives } from './tree.js';

// the entry's claim text, minus its "- date (hash) kind:" / "- ... verb [[x]]:"
// head and its trailing provenance tag (same derivation as view.js `claim`).
const claim = (e) =>
  e.flat
    .replace(/^- [^:]*?(?:\[\[[^\]]+\]\])?:/, '')
    .replace(/\((code|sourced|uncertain)\)\.?\s*$/, '')
    .trim();

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

function node(ctx, p) {
  const n = ctx.parsed.get(p);
  const rel = relatives(ctx, p);
  const facts = n.facts.map((b) => entry(ctx, p, b));
  const moves = n.moves.map((b) => entry(ctx, p, b));
  const provenance = { code: 0, sourced: 0, uncertain: 0 };
  for (const e of [...facts, ...moves]) if (provenance[e.provenance] != null) provenance[e.provenance]++;
  return {
    name: ctx.stem(p),
    path: ctx.logical(p),
    inAlt: p.includes('.alt' + path.sep),
    items: blocks(n.itemsText).map((b) => b.replace(/^-\s+/, '').replace(/\s+/g, ' ').trim()),
    facts,
    moves,
    factFiles: rel.factFiles.map((f) => path.basename(f, '.md')),
    counts: { facts: facts.length, moves: moves.length, alts: rel.alts.length, children: rel.children.length },
    weight: weight(facts.length, moves.length, rel.alts.length),
    provenance,
    children: rel.children.map((q) => node(ctx, q)),
    alts: rel.alts.map((q) => node(ctx, q)),
  };
}

export function treeJson(root) {
  const ctx = loadTree(root);
  const top = ctx.nodeFiles.filter((p) => path.dirname(p) === ctx.root);
  if (top.length !== 1) throw new Error(`expected exactly 1 top-level node, found ${top.length}`);
  return { root: node(ctx, top[0]) };
}
