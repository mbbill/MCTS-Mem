// List every (uncertain) entry — the worklist of decisions whose *why* is not
// yet backed by the code or any source. Resolve these by finding a source,
// asking a human, or accepting they are lost; never by guessing.

import { loadTree, parseEntry } from './tree.js';

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code, s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const dim = (s) => c('2', s);
const bold = (s) => c('1', s);

export function uncertain(root) {
  const ctx = loadTree(root);
  let n = 0;
  for (const p of ctx.nodeFiles) {
    const node = ctx.parsed.get(p);
    const hits = [...node.facts, ...node.moves]
      .map(parseEntry)
      .filter((e) => e.tag === 'uncertain');
    if (!hits.length) continue;
    console.log(bold(ctx.logical(p)));
    for (const e of hits) {
      n++;
      const claim = e.flat
        .replace(/^- [^:]*?(?:\[\[[^\]]+\]\])?:/, '')
        .replace(/\(uncertain\)\.?\s*$/, '')
        .trim();
      console.log('  ' + dim(`${e.date || ''} ${e.hash ? '(' + e.hash + ')' : ''}`.trim()) + ` ${claim}`);
    }
  }
  console.log();
  console.log(n === 0
    ? 'no open uncertainties — every recorded why is backed by code or a source.'
    : dim(`${n} uncertain ${n === 1 ? 'entry' : 'entries'}: each is a real decision whose why is unbacked. ` +
        'Resolve by finding a source, asking a human, or accepting it is lost — never by guessing.'));
  return 0;
}
