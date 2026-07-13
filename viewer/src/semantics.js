export function provenanceBadge(provenance = {}) {
  if (provenance.uncertain > 0) return '?';
  if (provenance.code > 0) return 'c';
  if (provenance.sourced > 0) return 's';
  return null;
}

export function confidenceChecks(weight) {
  if (weight === 'fought-over') return 3;
  if (weight === 'normal') return 1;
  return 0;
}

export function verbClass(verb = '') {
  return `verb-${verb.replace(/\s+/g, '-') || 'unknown'}`;
}
