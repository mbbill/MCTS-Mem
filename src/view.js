// Explore an MCTS-Mem tree from the terminal: render the decision tree with
// confidence signals (fact density, alternatives), and show a single node.

import fs from 'node:fs';
import path from 'node:path';
import { loadTree, parseEntry, relatives } from './tree.js';

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code, s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const dim = (s) => c('2', s);
const bold = (s) => c('1', s);
const cyan = (s) => c('36', s);
const yellow = (s) => c('33', s);

function build(ctx, p) {
  const rel = relatives(ctx, p);
  const node = ctx.parsed.get(p);
  return {
    p,
    name: ctx.stem(p),
    facts: node.facts.length,
    moves: node.moves.length,
    altCount: rel.alts.length,
    children: rel.children.map((q) => build(ctx, q)),
    alts: rel.alts.map((q) => build(ctx, q)),
  };
}

function annot(n) {
  const bits = [];
  if (n.facts) bits.push(dim(`${n.facts}f`));
  if (n.moves) bits.push(dim(`${n.moves}m`));
  if (n.altCount) bits.push(dim(`↩${n.altCount}`));
  return bits.length ? '  ' + bits.join(' ') : '';
}

// name styled by confidence signal: thick with facts = fought over; no signal = reconsider freely
function label(n, rejected) {
  let name = n.name;
  if (rejected) return dim('✗ ' + name);
  if (n.facts >= 5) name = bold(name);
  else if (n.facts === 0 && n.moves === 0 && n.altCount === 0) name = dim(name);
  return name + annot(n);
}

function renderTree(ctx, { alt = false, depth = Infinity } = {}) {
  const top = ctx.nodeFiles.filter((p) => path.dirname(p) === ctx.root);
  if (top.length !== 1) {
    console.log(yellow(`(tree has ${top.length} top-level nodes; expected 1 — run \`mcts-mem lint\`)`));
    if (!top.length) return;
  }
  const root = build(ctx, top[0]);
  console.log(label(root, false));
  const walk = (n, prefix, d) => {
    if (d <= 0) return;
    const kids = [
      ...n.children.map((k) => [k, false]),
      ...(alt ? n.alts.map((k) => [k, true]) : []),
    ];
    kids.forEach(([k, rej], i) => {
      const last = i === kids.length - 1;
      console.log(prefix + dim(last ? '└─ ' : '├─ ') + label(k, rej));
      walk(k, prefix + (last ? '   ' : dim('│') + '  '), d - 1);
    });
  };
  walk(root, '', depth);
  console.log();
  console.log(dim('legend: ') + bold('bold') + dim(' = fought over (≥5 facts) · ') +
    dim('dim') + dim(' = unweighed, reconsider freely · Nf facts · Nm moves · ↩N alternatives'));
  if (!alt) console.log(dim('        pass --alt to walk the rejected alternatives'));
}

function findNode(ctx, query) {
  const q = query.replace(/\.md$/, '');
  const exact = ctx.nodeFiles.filter((p) => ctx.stem(p) === q);
  if (exact.length === 1) return exact[0];
  const byLogical = ctx.nodeFiles.filter((p) => ctx.logical(p) === q || ctx.logical(p).endsWith('/' + q));
  const pool = exact.length ? exact : byLogical;
  return pool.length === 1 ? pool[0] : pool;
}

function showNode(ctx, query) {
  const found = findNode(ctx, query);
  if (Array.isArray(found)) {
    if (!found.length) { console.log(yellow(`no node matches "${query}"`)); return 1; }
    console.log(yellow(`"${query}" is ambiguous — ${found.length} matches:`));
    for (const p of found) console.log('  ' + ctx.logical(p));
    return 1;
  }
  const p = found;
  const node = ctx.parsed.get(p);
  const rel = relatives(ctx, p);
  const inAlt = p.includes('.alt' + path.sep);

  console.log(bold(ctx.logical(p)) + (inAlt ? '  ' + dim('(superseded / rejected — in .alt/)') : ''));
  console.log();
  // Items
  const items = node.itemsText.trim();
  if (items) console.log(items);
  // Facts
  if (node.facts.length) {
    console.log('\n' + cyan('## Facts'));
    for (const b of node.facts) {
      const e = parseEntry(b);
      console.log('  ' + dim(`${e.date || ''} ${e.hash ? '(' + e.hash + ')' : ''}`.trim()) +
        ` ${e.kind || ''}` + (e.tag ? ' ' + tagColor(e.tag) : ''));
      console.log('    ' + claim(e));
    }
  }
  // Moves
  if (node.moves.length) {
    console.log('\n' + cyan('## Moves'));
    for (const b of node.moves) {
      const e = parseEntry(b);
      console.log('  ' + dim(`${e.date || ''} ${e.hash ? '(' + e.hash + ')' : ''}`.trim()) +
        ` ${e.verb || ''}` + (e.tag ? ' ' + tagColor(e.tag) : ''));
      console.log('    ' + claim(e));
    }
  }
  // relatives
  if (rel.children.length) {
    console.log('\n' + cyan('sub-decisions:'));
    for (const q of rel.children) console.log('  ' + ctx.stem(q));
  }
  if (rel.alts.length) {
    console.log('\n' + cyan('alternatives (rejected / superseded):'));
    for (const q of rel.alts) console.log('  ' + dim('✗ ') + ctx.stem(q));
  }
  if (rel.factFiles.length) {
    console.log('\n' + cyan('graduated evidence (.fact/):'));
    for (const f of rel.factFiles) console.log('  ' + path.basename(f));
  }
  return 0;
}

function tagColor(tag) {
  if (tag === 'code') return c('32', '(code)');
  if (tag === 'sourced') return c('34', '(sourced)');
  if (tag === 'uncertain') return c('33', '(uncertain)');
  return `(${tag})`;
}

// the entry text minus its "- date (hash) kind:" / "- ... verb:" head and trailing tag
function claim(e) {
  let s = e.flat.replace(/^- [^:]*?(?:\[\[[^\]]+\]\])?:/, '').trim();
  s = s.replace(/\((code|sourced|uncertain)\)\.?\s*$/, '').trim();
  return s;
}

export function view(root, opts) {
  return renderTree(loadTree(root), opts);
}
export function show(root, query) {
  return showNode(loadTree(root), query);
}
