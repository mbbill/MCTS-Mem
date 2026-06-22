// Pure layout logic for the tree viewer — kept out of the React component so it
// can be unit-tested. Custom tidy layout (d3.tree can't do alts): every visible
// node gets a column (depth via "child" edges), an indent (depth via "alt" edges
// within a column), and a breadth (a running cursor).
//   - children expand to the RIGHT (column + 1, indent reset), node centered;
//   - alternatives (.alt/) expand straight DOWN in the SAME column, indented one
//     step right of their parent so they read as subordinate, and everything
//     below reflows. Alts use the exact same node/link components.

export const CHAR = 7.3; // monospace char width at 12.5px
export const NODE_H = 26;
export const TEXT_PAD = 11; // left/right padding inside a box
export const ROW = 42; // vertical step between rows
export const COL_PAD = 80; // gap between columns (roomy horizontal connector runs)
export const SPINE_PAD = 22; // child spine offset past a column's right edge
export const CORNER = 8; // elbow corner radius
export const TOGGLE = 14; // size of the [+]/[−] children toggle
export const TOGGLE_GAP = 6; // gap between a node box and its children toggle
export const ALT_W = 19; // width of the ↩ alternatives cue
export const ALT_H = 14; // height of the ↩ cue
export const ALT_GAP = 5; // gap between a node box and its ↩ cue
export const ALT_INDENT = 30; // how far an alt is indented right of its parent

export const nodeW = (name) => Math.max(56, name.length * CHAR + 2 * TEXT_PAD);
export const nodeTransform = (n) => `translate(${n.y}px, ${n.x}px)`;
export const hasChildren = (n) => !!(n.data.children && n.data.children.length);
export const hasAlts = (n) => !!(n.data.alts && n.data.alts.length);

// rightmost extent of a node (box + children toggle) — relative to its own left edge
const rightExtent = (n) => nodeW(n.data.name) + (hasChildren(n) ? TOGGLE_GAP + TOGGLE : 0);
// leftmost extent of a node (box left edge minus the ↩ cue) — for fitting
const leftExtent = (n) => n.y - (hasAlts(n) ? ALT_GAP + ALT_W : 0);
// where a connector should terminate on a node: at its ↩ cue if it has one, else the box
const targetLeft = (n) => (hasAlts(n) ? n.y - ALT_GAP - ALT_W : n.y);

export function buildLayout(root, expanded = new Set(), altsOpen = new Set()) {
  const nodes = [];
  const childLinks = [];
  const altLinks = [];
  let cursor = 0;

  function place(data, col, indent, isAlt) {
    const node = { data, col, indent, isAlt, kids: [], altKids: [] };
    const kids = expanded.has(data.path) && data.children ? data.children : [];
    const alts = altsOpen.has(data.path) && data.alts ? data.alts : [];

    if (kids.length === 0) {
      node.x = cursor + ROW / 2; // a row of its own
      cursor += ROW;
    } else {
      node.kids = kids.map((c) => place(c, col + 1, 0, false)); // children right, indent reset
      node.x = (node.kids[0].x + node.kids[node.kids.length - 1].x) / 2; // centered on them
      for (const c of node.kids) childLinks.push({ source: node, target: c });
    }
    nodes.push(node);

    for (const a of alts) {
      const altNode = place(a, col, indent + 1, true); // alts below, indented one step
      node.altKids.push(altNode);
      altLinks.push({ source: node, target: altNode });
    }
    return node;
  }
  place(root, 0, 0, false);

  // per-column width (deepest indent + box + toggle), then cumulative left-edge x
  // so a wide box deep in the tree never shifts a shallower column.
  const colWidth = {};
  for (const n of nodes) {
    colWidth[n.col] = Math.max(colWidth[n.col] || 0, n.indent * ALT_INDENT + rightExtent(n));
  }
  const maxCol = Math.max(...Object.keys(colWidth).map(Number));
  const colX = [0];
  for (let c = 1; c <= maxCol; c++) colX[c] = colX[c - 1] + colWidth[c - 1] + COL_PAD;
  for (const n of nodes) {
    n.colBase = colX[n.col]; // the column's left edge (shared by the whole column)
    n.y = colX[n.col] + n.indent * ALT_INDENT; // this node's left edge, indented
  }

  return { nodes, childLinks, altLinks, colWidth };
}

// child connector: rounded elbow from the parent's children toggle, down a shared
// spine past the column's widest box, into the child's left edge (or its ↩ cue).
export function linkPath(l, colWidth) {
  const sx = l.source.y + nodeW(l.source.data.name) + TOGGLE_GAP + TOGGLE;
  const tx = targetLeft(l.target);
  const sy = l.source.x;
  const ty = l.target.x;
  const gx = l.source.colBase + colWidth[l.source.col] + SPINE_PAD;
  if (Math.abs(ty - sy) < 0.5) return `M${sx},${sy}H${tx}`;
  const dir = ty > sy ? 1 : -1;
  const r = Math.min(CORNER, Math.abs(ty - sy) / 2, gx - sx, tx - gx);
  return (
    `M${sx},${sy}H${gx - r}Q${gx},${sy} ${gx},${sy + dir * r}` +
    `V${ty - dir * r}Q${gx},${ty} ${gx + r},${ty}H${tx}`
  );
}

// alt connector: drop a spine from directly under the parent's ↩ cue, then a
// rounded turn right into the (indented) alternative's left edge (or its own cue).
export function altLinkPath(l) {
  const x0 = l.source.y - ALT_GAP - ALT_W / 2; // under the ↩ cue
  const sy = l.source.x + ALT_H / 2; // from the cue's bottom
  const ty = l.target.x; // alt row
  const tx = targetLeft(l.target); // indented alt's left edge (or its ↩ cue)
  const r = Math.min(CORNER, (ty - sy) / 2, tx - x0 - 1);
  return `M${x0},${sy}V${ty - r}Q${x0},${ty} ${x0 + r},${ty}H${tx}`;
}

export function nodesBBox(nodes) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, leftExtent(n));
    maxX = Math.max(maxX, n.y + rightExtent(n));
    minY = Math.min(minY, n.x - NODE_H / 2);
    maxY = Math.max(maxY, n.x + NODE_H / 2);
  }
  return { minX, maxX, minY, maxY };
}

// fit the whole visible tree into a W×H viewport — used once, on first paint.
export function fitTransform(nodes, W, H) {
  const { minX, maxX, minY, maxY } = nodesBBox(nodes);
  const k = Math.min(W / (maxX - minX), H / (maxY - minY), 1.2) * 0.94;
  const tx = 40 - k * minX;
  const ty = H / 2 - k * (minY + maxY) / 2;
  return { k, tx, ty };
}

// Minimal transform to bring `bbox` into view from the current transform `t`:
// null if already on-screen; keep scale + pan least if it fits; else zoom OUT
// just enough and center. Never zooms in.
export function revealTransform(t, bbox, vw, vh, margin = 28, minK = 0.12) {
  const { minX, maxX, minY, maxY } = bbox;
  const fitK = Math.min((vw - 2 * margin) / (maxX - minX), (vh - 2 * margin) / (maxY - minY));
  const k = Math.max(minK, Math.min(t.k, fitK));
  if (k === t.k) {
    let x = t.x;
    let y = t.y;
    if (k * minX + x < margin) x = margin - k * minX;
    else if (k * maxX + x > vw - margin) x = vw - margin - k * maxX;
    if (k * minY + y < margin) y = margin - k * minY;
    else if (k * maxY + y > vh - margin) y = vh - margin - k * maxY;
    if (x === t.x && y === t.y) return null;
    return { k, x, y };
  }
  return { k, x: vw / 2 - k * (minX + maxX) / 2, y: vh / 2 - k * (minY + maxY) / 2 };
}
