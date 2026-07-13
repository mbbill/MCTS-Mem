import { describe, expect, it } from 'vitest';
import { confidenceChecks, provenanceBadge, verbClass } from '../src/semantics.js';

describe('provenanceBadge', () => {
  it('prioritizes uncertain, then code, then sourced', () => {
    expect(provenanceBadge({ code: 2, sourced: 1, uncertain: 1 })).toBe('?');
    expect(provenanceBadge({ code: 2, sourced: 1, uncertain: 0 })).toBe('c');
    expect(provenanceBadge({ code: 0, sourced: 1, uncertain: 0 })).toBe('s');
    expect(provenanceBadge({ code: 0, sourced: 0, uncertain: 0 })).toBeNull();
  });
});

describe('confidenceChecks', () => {
  it('maps weight classes to active checkmark count', () => {
    expect(confidenceChecks('fought-over')).toBe(3);
    expect(confidenceChecks('normal')).toBe(1);
    expect(confidenceChecks('unweighed')).toBe(0);
  });
});

describe('verbClass', () => {
  it('creates stable CSS class names for move verbs', () => {
    expect(verbClass('replaced by')).toBe('verb-replaced-by');
    expect(verbClass('dropped')).toBe('verb-dropped');
  });
});
