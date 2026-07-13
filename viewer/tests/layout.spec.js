import { describe, expect, it } from 'vitest';
import {
  nodeW,
  nodeTransform,
  buildLayout,
  linkPath,
  altLinkPath,
  fitTransform,
  nodesBBox,
  revealTransform,
  NODE_H,
  SPINE_PAD,
  TOGGLE,
  TOGGLE_GAP,
  ALT_INDENT,
  ALT_GAP,
  ALT_W,
} from '../src/layout.js';

// A small tree in the shape /api/tree returns: { name, path, children, alts }.
const tree = {
  name: 'root',
  path: 'root',
  children: [
    {
      name: 'aa',
      path: 'root/aa',
      children: [
        { name: 'a-very-long-child-name', path: 'root/aa/long', children: [] },
        { name: 'x', path: 'root/aa/x', children: [] },
      ],
      alts: [{ name: 'aa-alt', path: 'root/aa/aa-alt', children: [], alts: [] }],
    },
    { name: 'b', path: 'root/b', children: [] },
  ],
};
const KIDS = new Set(['root', 'root/aa']); // every node's children expanded
const byName = (r) => r.nodes.map((n) => n.data.name);
const node = (r, name) => r.nodes.find((n) => n.data.name === name);

describe('nodeW', () => {
  it('has a floor width', () => {
    expect(nodeW('a')).toBe(56);
  });
  it('grows with name length', () => {
    expect(nodeW('a-very-long-child-name')).toBeGreaterThan(nodeW('x'));
  });
});

describe('nodeTransform', () => {
  it('positions a node group at (y, x) via a CSS translate (so it can transition)', () => {
    expect(nodeTransform({ y: 120, x: -40 })).toBe('translate(120px, -40px)');
  });
});

describe('buildLayout — collapse / expand', () => {
  it('is collapsed by default: only the root is laid out', () => {
    const r = buildLayout(tree, new Set());
    expect(r.nodes).toHaveLength(1);
    expect(r.nodes[0].data.name).toBe('root');
  });

  it('expanding a node reveals exactly its direct children, not grandchildren', () => {
    const r = buildLayout(tree, new Set(['root']));
    expect(byName(r)).toContain('aa');
    expect(byName(r)).toContain('b');
    expect(byName(r)).not.toContain('a-very-long-child-name'); // aa's children stay hidden
  });

  it('expanding a deep node does not shift a shallower column', () => {
    const closed = buildLayout(tree, new Set(['root']));
    const open = buildLayout(tree, new Set(['root', 'root/aa']));
    const col1 = (r) => r.nodes.filter((n) => n.col === 1).map((n) => n.y);
    expect(col1(open)).toEqual(col1(closed));
  });
});

describe('buildLayout — geometry', () => {
  it('lays out left-right: root at col 0 / y 0, deeper columns to the right', () => {
    const r = buildLayout(tree, KIDS);
    expect(node(r, 'root').col).toBe(0);
    expect(node(r, 'root').y).toBe(0);
    expect(node(r, 'aa').y).toBeGreaterThan(0);
  });

  it('left-aligns every node in a column to one left edge (node.y)', () => {
    const r = buildLayout(tree, KIDS);
    const byCol = {};
    for (const n of r.nodes) (byCol[n.col] ||= []).push(n.y);
    for (const ys of Object.values(byCol)) expect(new Set(ys).size).toBe(1);
  });

  it('colWidth records the widest box per column', () => {
    const { colWidth } = buildLayout(tree, KIDS);
    expect(colWidth[2]).toBe(nodeW('a-very-long-child-name')); // leaves, no toggle
  });

  it('colWidth reserves room for the children toggle', () => {
    const { colWidth } = buildLayout(tree, KIDS);
    expect(colWidth[1]).toBe(nodeW('aa') + TOGGLE_GAP + TOGGLE); // aa has a toggle; b does not
  });
});

describe('buildLayout — alternatives', () => {
  it('hides alts until opened', () => {
    const r = buildLayout(tree, new Set(['root'])); // children open, alts closed
    expect(byName(r)).not.toContain('aa-alt');
    expect(r.altLinks).toHaveLength(0);
  });

  it("drops a node's alts into the same column, below and indented one step", () => {
    const r = buildLayout(tree, new Set(['root']), new Set(['root/aa']));
    const aa = node(r, 'aa');
    const alt = node(r, 'aa-alt');
    expect(alt).toBeTruthy();
    expect(alt.col).toBe(aa.col); // same column
    expect(alt.x).toBeGreaterThan(aa.x); // below
    expect(alt.y).toBe(aa.y + ALT_INDENT); // indented right of the parent (subordinate)
  });

  it('alts are independent of children: opening alts does not open children', () => {
    const r = buildLayout(tree, new Set(['root']), new Set(['root/aa']));
    expect(byName(r)).toContain('aa-alt');
    expect(byName(r)).not.toContain('a-very-long-child-name'); // aa's children stay closed
    expect(byName(r)).not.toContain('x');
  });

  it('records an alt link from the node to each alternative', () => {
    const r = buildLayout(tree, new Set(['root']), new Set(['root/aa']));
    expect(r.altLinks).toHaveLength(1);
    expect(r.altLinks[0].source.data.name).toBe('aa');
    expect(r.altLinks[0].target.data.name).toBe('aa-alt');
  });

  it('marks rendered alternatives as isAlt so the UI can style them differently', () => {
    const r = buildLayout(tree, new Set(['root']), new Set(['root/aa']));
    expect(node(r, 'root').isAlt).toBe(false);
    expect(node(r, 'aa').isAlt).toBe(false);
    expect(node(r, 'aa-alt').isAlt).toBe(true);
  });
});

describe('linkPath (child elbow)', () => {
  it('uses orthogonal H/V runs with rounded (Q) corners, never an S-curve', () => {
    const r = buildLayout(tree, KIDS);
    const d = linkPath(r.childLinks[0], r.colWidth);
    expect(d).toMatch(/H/);
    expect(d).toMatch(/V/);
    expect(d).toMatch(/Q/);
    expect(d).not.toMatch(/[CcSsTtAa]/);
  });

  it("starts at the parent's toggle and enters the child's left edge", () => {
    const r = buildLayout(tree, KIDS);
    const l = r.childLinks[0];
    const d = linkPath(l, r.colWidth);
    const toggleRight = l.source.y + nodeW(l.source.data.name) + TOGGLE_GAP + TOGGLE;
    expect(d.startsWith(`M${toggleRight},`)).toBe(true);
    expect(d.endsWith(`H${l.target.y}`)).toBe(true);
  });

  it('falls back to a straight horizontal when the child is level with the parent', () => {
    const single = { name: 'p', path: 'p', children: [{ name: 'only', path: 'p/only', children: [] }] };
    const r = buildLayout(single, new Set(['p']));
    const d = linkPath(r.childLinks[0], r.colWidth);
    expect(d).toMatch(/^M[\d.-]+,[\d.-]+H[\d.-]+$/);
    expect(d).not.toMatch(/[VQ]/);
  });

  it('places every spine past the widest box in its column (no line cuts text)', () => {
    const r = buildLayout(tree, KIDS);
    const byCol = {};
    for (const n of r.nodes) (byCol[n.col] ||= []).push(n);
    for (const l of r.childLinks) {
      const gx = l.source.colBase + r.colWidth[l.source.col] + SPINE_PAD; // spine x used in linkPath
      const colRight = Math.max(
        ...byCol[l.source.col].map(
          (n) => n.y + nodeW(n.data.name) + (n.data.children?.length ? TOGGLE_GAP + TOGGLE : 0)
        )
      );
      expect(gx).toBeGreaterThanOrEqual(colRight);
    }
  });

  it('leaves a roomy horizontal run from the spine into the box', () => {
    const r = buildLayout(tree, KIDS);
    const l = r.childLinks.find((x) => x.target.data.name === 'b'); // leaf, no ↩ cue
    const gx = l.source.colBase + r.colWidth[l.source.col] + SPINE_PAD;
    expect(l.target.y - gx).toBeGreaterThanOrEqual(40);
  });
});

describe('altLinkPath (down-left elbow into the alt)', () => {
  it('drops down then turns right into the alt, never an S-curve', () => {
    const r = buildLayout(tree, new Set(['root']), new Set(['root/aa']));
    const l = r.altLinks[0];
    const d = altLinkPath(l);
    expect(d).toMatch(/^M/);
    expect(d).toMatch(/V/); // descends
    expect(d).toMatch(/Q/); // rounded corner
    expect(d.endsWith(`H${l.target.y}`)).toBe(true); // into the alt's left edge (it has no ↩ cue)
    expect(d).not.toMatch(/[CcSsTtAa]/);
  });

  it("starts directly under the parent's ↩ cue", () => {
    const r = buildLayout(tree, new Set(['root']), new Set(['root/aa']));
    const l = r.altLinks[0];
    const d = altLinkPath(l);
    expect(d.startsWith(`M${l.source.y - ALT_GAP - ALT_W / 2},`)).toBe(true);
  });
});

describe('fitTransform', () => {
  it('fits the visible tree into the viewport at a capped, positive scale', () => {
    const r = buildLayout(tree, KIDS);
    const { k, tx, ty } = fitTransform(r.nodes, 800, 600);
    expect(k).toBeGreaterThan(0);
    expect(k).toBeLessThanOrEqual(1.2);
    expect(Number.isFinite(tx)).toBe(true);
    expect(Number.isFinite(ty)).toBe(true);
  });
});

describe('nodesBBox', () => {
  it('bounds the boxes (width and height) of the given nodes', () => {
    const b = nodesBBox([
      { y: 10, x: 0, data: { name: 'ab' } }, // leaf → width = nodeW('ab')
      { y: 100, x: 50, data: { name: 'c' } },
    ]);
    expect(b.minX).toBe(10);
    expect(b.maxX).toBe(100 + nodeW('c'));
    expect(b.minY).toBe(-NODE_H / 2);
    expect(b.maxY).toBe(50 + NODE_H / 2);
  });
});

describe('revealTransform', () => {
  const VW = 800;
  const VH = 600;

  it('returns null when the region is already fully in view (no move)', () => {
    const r = revealTransform({ k: 1, x: 0, y: 0 }, { minX: 100, maxX: 300, minY: 100, maxY: 300 }, VW, VH);
    expect(r).toBeNull();
  });

  it('pans minimally at the same scale when the region fits but is off-screen', () => {
    const r = revealTransform({ k: 1, x: 0, y: 0 }, { minX: 700, maxX: 900, minY: 100, maxY: 300 }, VW, VH);
    expect(r).not.toBeNull();
    expect(r.k).toBe(1);
    expect(r.x).toBeLessThan(0);
    expect(r.y).toBe(0);
  });

  it('zooms out only enough to fit, and centers, when the region is too big', () => {
    const r = revealTransform({ k: 1, x: 0, y: 0 }, { minX: 0, maxX: 2000, minY: 0, maxY: 1500 }, VW, VH);
    expect(r.k).toBeLessThan(1);
    expect(r.k).toBeGreaterThan(0);
    expect(Number.isFinite(r.x)).toBe(true);
    expect(Number.isFinite(r.y)).toBe(true);
  });

  it('never zooms in even if the region is tiny', () => {
    const r = revealTransform({ k: 0.5, x: 0, y: 0 }, { minX: 390, maxX: 410, minY: 290, maxY: 310 }, VW, VH);
    expect(r).toBeNull();
  });
});
