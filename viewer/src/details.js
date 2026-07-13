// Pure details-pane helpers kept outside React for unit tests.

export function selectedNode(nodes, path) {
  return nodes.find((n) => n.data.path === path) || null;
}

export function entryText(entry) {
  if (!entry) return '';
  if (typeof entry === 'object') {
    const stamp = [entry.date, entry.hash ? `(${entry.hash})` : null].filter(Boolean).join(' ');
    const head = entry.isMove
      ? [entry.verb, entry.targetName ? `[[${entry.targetName}]]` : null].filter(Boolean).join(' ')
      : entry.kind;
    const prefix = [stamp, head].filter(Boolean).join(' ');
    const body = entry.text || entry.flat || entry.raw || '';
    const prov = entry.provenance ? ` (${entry.provenance})` : '';
    return [prefix, body].filter(Boolean).join(': ') + prov;
  }
  return String(entry).replace(/^-\s*/, '').trimEnd();
}

export function counts(n) {
  return {
    items: n.data.items?.length || 0,
    facts: n.data.facts?.length ?? n.data.counts?.facts ?? 0,
    moves: n.data.moves?.length ?? n.data.counts?.moves ?? 0,
    children: n.data.children?.length ?? n.data.counts?.children ?? 0,
    alts: n.data.alts?.length ?? n.data.counts?.alts ?? 0,
  };
}

export function pathTo(root, targetPath) {
  const out = [];
  function walk(n) {
    if (n.path === targetPath) return true;
    for (const c of n.children || []) {
      if (walk(c)) { out.unshift({ parentPath: n.path, edge: 'children', nodePath: c.path }); return true; }
    }
    for (const a of n.alts || []) {
      if (walk(a)) { out.unshift({ parentPath: n.path, edge: 'alts', nodePath: a.path }); return true; }
    }
    return false;
  }
  return walk(root) ? out : null;
}
