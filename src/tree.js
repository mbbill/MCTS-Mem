// Shared model of an MCTS-Mem design tree: walk the filesystem, parse each node
// into items / Facts / Moves, and resolve [[links]]. Every other command builds
// on this. The parsing here mirrors the grammar the linter enforces.

import fs from 'node:fs';
import path from 'node:path';

export const ENTRY_HEAD =
  /^- (\d{4}-\d{2}-\d{2})( \(([0-9a-f]{8})\))? ([a-z][a-z -]*?)(:| \[\[)/;
export const PROV = /\((code|sourced|uncertain)\)\.?\s*$/;
export const MOVE_VERB =
  /^- \S+( \([0-9a-f]{8}\))? (replaced by \[\[[^\]]+\]\]:|replaced \[\[[^\]]+\]\]:|dropped:|removed:|revived:)/;
export const LINK = /\[\[([^\]]+)\]\]/g;

// split a section body into "- " entry blocks separated by blank lines
export function blocks(text) {
  const out = [];
  let cur = [];
  for (const line of (text || '').split('\n')) {
    if (line.startsWith('- ') && cur.length) {
      out.push(cur.join('\n'));
      cur = [line];
    } else if (line.trim() === '') {
      if (cur.length) { out.push(cur.join('\n')); cur = []; }
    } else if (cur.length) {
      cur.push(line);
    } else if (line.startsWith('- ')) {
      cur = [line];
    }
  }
  if (cur.length) out.push(cur.join('\n'));
  return out.filter((b) => b.trim());
}

// strip entry head + provenance, collapse whitespace and backticks → comparable why
export function normWhy(b) {
  let s = b.replace(/^- [^:]*?(?:\[\[[^\]]+\]\])?:/, '');
  s = s.trim().replace(PROV, '');
  return s.replace(/`/g, '').replace(/\s+/g, ' ').trim().replace(/\.+$/, '');
}

// parse one node file into its three parts plus the raw heading list (for R-sections)
export function parseNode(text) {
  text = text.replace(/\r\n?/g, '\n'); // normalize CRLF / lone CR so headings parse
  const headings = [];
  const sections = {};
  let itemsLines = [];
  let curName = null;
  let cur = [];
  for (const line of text.split('\n')) {
    const h = /^(#+ .*)$/.exec(line);
    if (h) {
      headings.push(h[1]);
      if (curName !== null) sections[curName] = cur.join('\n');
      const hm = /^## (.+)$/.exec(line);
      curName = hm ? hm[1].trim() : ` ${headings.length}`;
      cur = [];
    } else if (curName === null) {
      itemsLines.push(line);
    } else {
      cur.push(line);
    }
  }
  if (curName !== null) sections[curName] = cur.join('\n');
  return {
    text,
    headings,
    itemsText: itemsLines.join('\n'),
    facts: blocks(sections.Facts ?? ''),
    moves: blocks(sections.Moves ?? ''),
  };
}

// parse an entry block into structured fields (for view / uncertain)
export function parseEntry(block) {
  const flat = block.replace(/\s+/g, ' ').trim();
  const m = ENTRY_HEAD.exec(block);
  const tagM = PROV.exec(flat);
  const isMove = MOVE_VERB.test(block);
  let verb = null;
  if (isMove) {
    const vm = /(replaced by|replaced|dropped|removed|revived)/.exec(flat);
    verb = vm ? vm[1] : null;
  }
  return {
    raw: block,
    flat,
    date: m ? m[1] : null,
    hash: m ? m[3] || null : null,
    kind: m ? m[4].trim() : null,
    tag: tagM ? tagM[1] : null,
    isMove,
    verb,
  };
}

function stemOf(p) {
  return path.basename(p).slice(0, -3);
}

// logical path: relative to root, with .alt folders omitted. An .alt member
// occupies the same decision slot as the node it replaced, not a child slot:
//   silverfir/compiler.alt/fast-interpreter.md → silverfir/fast-interpreter
// Children under that alt remain below the alt member:
//   silverfir/compiler.alt/fast-interpreter/neutral-ir.md → silverfir/fast-interpreter/neutral-ir
export function logical(root, p) {
  const rel = path.relative(root, p).slice(0, -3);
  return rel
    .split(path.sep)
    .filter((seg) => !seg.endsWith('.alt'))
    .join('/');
}

// Load and parse a whole tree rooted at `root` (the dir holding the single top node).
export function loadTree(root) {
  root = path.resolve(root);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    throw new Error(`tree root not found: ${root}`);
  }
  // canonicalize symlinks so paths agree with git's `rev-parse --show-toplevel`
  // (otherwise the R-append check silently no-ops under /tmp, /var → /private, etc.)
  root = fs.realpathSync(root);
  const nodeFiles = [];
  const factFiles = [];
  const dirs = [];
  (function rec(d) {
    let ents;
    try {
      ents = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of ents) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) {
        dirs.push(full);
        rec(full);
      } else if (e.name.endsWith('.md')) {
        (path.basename(d).endsWith('.fact') ? factFiles : nodeFiles).push(full);
      }
    }
  })(root);

  const parsed = new Map();
  for (const p of nodeFiles) parsed.set(p, parseNode(fs.readFileSync(p, 'utf8')));

  const stems = new Map();
  for (const p of nodeFiles) {
    const s = stemOf(p);
    if (!stems.has(s)) stems.set(s, []);
    stems.get(s).push(p);
  }

  const ctx = { root, nodeFiles, factFiles, dirs, parsed, stems };
  ctx.stem = stemOf;
  ctx.logical = (p) => logical(root, p);
  ctx.resolve = (ref, frm) => resolve(ctx, ref, frm);
  return ctx;
}

// resolve a [[link]] target to a node (or fact) file path, or null
export function resolve(ctx, ref, frm) {
  if (ref.includes('.fact/')) {
    const tail = ref.split('/').pop() + '.md';
    const cand = ctx.factFiles.filter(
      (f) => f.endsWith(tail) || logical(ctx.root, f).endsWith(ref)
    );
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

// structural relatives of a node file p = <dir>/<name>.md
export function relatives(ctx, p) {
  const base = p.slice(0, -3); // strip .md
  const subtree = base; // <dir>/<name>/
  const altDir = base + '.alt';
  const factDir = base + '.fact';
  const childOf = (dir) =>
    ctx.nodeFiles.filter((q) => path.dirname(q) === dir).sort();
  const factsIn = (dir) =>
    fs.existsSync(dir)
      ? fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort()
      : [];
  return {
    children: childOf(subtree),
    alts: childOf(altDir),
    factFiles: factsIn(factDir).map((f) => path.join(factDir, f)),
  };
}
