import { describe, expect, it } from 'vitest';
import { selectedNode, entryText, counts, pathTo } from '../src/details.js';

describe('selectedNode', () => {
  it('returns the visible node matching a logical path', () => {
    const nodes = [{ data: { path: 'a' } }, { data: { path: 'a/b' } }];
    expect(selectedNode(nodes, 'a/b')).toBe(nodes[1]);
  });

  it('returns null when the selected path is no longer visible', () => {
    expect(selectedNode([{ data: { path: 'a' } }], 'a/missing')).toBeNull();
  });
});

describe('entryText', () => {
  it('strips the leading bullet marker and preserves continuation lines', () => {
    expect(entryText('- First line\n  continuation')).toBe('First line\n  continuation');
  });

  it('formats structured fact entries from /api/tree', () => {
    expect(
      entryText({
        date: '2031-01-01',
        hash: '00000001',
        kind: 'rationale',
        provenance: 'code',
        text: 'the store is append-only',
      })
    ).toBe('2031-01-01 (00000001) rationale: the store is append-only (code)');
  });

  it('formats structured move entries from /api/tree', () => {
    expect(
      entryText({
        date: '2031-04-02',
        hash: 'ab12cd34',
        verb: 'replaced',
        isMove: true,
        targetName: 'write-through',
        provenance: 'code',
        text: 'batching at eviction removed the stall',
      })
    ).toBe('2031-04-02 (ab12cd34) replaced [[write-through]]: batching at eviction removed the stall (code)');
  });

  it('handles empty values', () => {
    expect(entryText(null)).toBe('');
  });
});

describe('counts', () => {
  it('counts detail sections and structural children/alts', () => {
    const n = {
      data: {
        items: ['a', 'b'],
        facts: ['f'],
        moves: [],
        children: [{ name: 'c' }],
        alts: [{ name: 'old' }, { name: 'older' }],
      },
    };
    expect(counts(n)).toEqual({ items: 2, facts: 1, moves: 0, children: 1, alts: 2 });
  });

  it('uses structural counts before lazy details are loaded', () => {
    const n = { data: { counts: { facts: 3, moves: 2, children: 1, alts: 4 } } };
    expect(counts(n)).toEqual({ items: 0, facts: 3, moves: 2, children: 1, alts: 4 });
  });
});

describe('pathTo', () => {
  const tree = {
    path: 'root',
    children: [
      { path: 'root/a', children: [{ path: 'root/a/deep', children: [], alts: [] }], alts: [] },
    ],
    alts: [
      { path: 'root/old', children: [{ path: 'root/old/child', children: [], alts: [] }], alts: [] },
    ],
  };

  it('returns child-edge ancestors needed to reveal a child target', () => {
    expect(pathTo(tree, 'root/a/deep')).toEqual([
      { parentPath: 'root', edge: 'children', nodePath: 'root/a' },
      { parentPath: 'root/a', edge: 'children', nodePath: 'root/a/deep' },
    ]);
  });

  it('returns alt-edge ancestors needed to reveal an alt target', () => {
    expect(pathTo(tree, 'root/old/child')).toEqual([
      { parentPath: 'root', edge: 'alts', nodePath: 'root/old' },
      { parentPath: 'root/old', edge: 'children', nodePath: 'root/old/child' },
    ]);
  });

  it('returns null for a missing target', () => {
    expect(pathTo(tree, 'root/missing')).toBeNull();
  });
});
