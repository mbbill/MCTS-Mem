import { useEffect, useMemo, useRef, useState } from 'react';
import { select, zoom, zoomIdentity, zoomTransform } from 'd3';
import {
  buildLayout,
  linkPath,
  altLinkPath,
  fitTransform,
  revealTransform,
  nodesBBox,
  nodeW,
  nodeTransform,
  hasChildren,
  hasAlts,
  NODE_H,
  TEXT_PAD,
  TOGGLE,
  TOGGLE_GAP,
  ALT_W,
  ALT_H,
  ALT_GAP,
} from './layout.js';

// The current-design tree, collapsible. Two independent toggles per node:
//   [+]  on the right  → children (sub-decisions), expand to the right
//   ↩N   on the left   → alternatives (.alt/), drop in below in the same column
// Expanding only moves the view enough to reveal the clicked node + what it just
// opened; collapse never moves the view. Layout math lives in layout.js.
export default function App() {
  const [root, setRoot] = useState(null);
  const [err, setErr] = useState(null);
  const [expanded, setExpanded] = useState(() => new Set()); // children open
  const [altsOpen, setAltsOpen] = useState(() => new Set()); // alternatives open
  const svgRef = useRef(null);
  const gRef = useRef(null);
  const firstFit = useRef(true);
  const pendingReveal = useRef(null); // { path, kind } of a just-expanded node

  useEffect(() => {
    fetch('/api/tree')
      .then((r) => r.json())
      .then((d) => (d.error ? setErr(d.error) : setRoot(d.root)))
      .catch((e) => setErr(String(e)));
  }, []);

  const flip = (setter, path) =>
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  const toggleKids = (path) => {
    pendingReveal.current = expanded.has(path) ? null : { path, kind: 'kids' };
    flip(setExpanded, path);
  };
  const toggleAlts = (path) => {
    pendingReveal.current = altsOpen.has(path) ? null : { path, kind: 'alts' };
    flip(setAltsOpen, path);
  };

  const layout = useMemo(
    () => (root ? buildLayout(root, expanded, altsOpen) : null),
    [root, expanded, altsOpen]
  );

  useEffect(() => {
    if (!layout || !svgRef.current) return;
    const svg = select(svgRef.current);
    const g = select(gRef.current);
    const z = zoom()
      .scaleExtent([0.12, 2.5])
      .on('zoom', (e) => g.attr('transform', e.transform));
    svg.call(z);
    const W = svgRef.current.clientWidth;
    const H = svgRef.current.clientHeight;

    if (firstFit.current) {
      const { k, tx, ty } = fitTransform(layout.nodes, W, H);
      svg.call(z.transform, zoomIdentity.translate(tx, ty).scale(k));
      firstFit.current = false;
      return () => svg.on('.zoom', null);
    }

    const rev = pendingReveal.current;
    pendingReveal.current = null;
    if (rev) {
      const clicked = layout.nodes.find((n) => n.data.path === rev.path);
      if (clicked) {
        const revealed = rev.kind === 'alts' ? clicked.altKids : clicked.kids;
        const target = revealTransform(
          zoomTransform(svgRef.current),
          nodesBBox([clicked, ...revealed]),
          W,
          H
        );
        if (target) {
          svg
            .transition()
            .duration(280)
            .call(z.transform, zoomIdentity.translate(target.x, target.y).scale(target.k));
        }
      }
    }
    return () => svg.on('.zoom', null);
  }, [layout]);

  if (err) return <div className="state err">Failed to load tree: {err}</div>;
  if (!root) return <div className="state">Loading…</div>;

  return (
    <svg ref={svgRef} className="canvas">
      <g ref={gRef}>
        <g className="links">
          {layout.childLinks.map((l) => (
            <path
              key={`c:${l.target.data.path}`}
              className="link"
              pathLength="1"
              d={linkPath(l, layout.colWidth)}
            />
          ))}
          {layout.altLinks.map((l) => (
            <path
              key={`a:${l.target.data.path}`}
              className="link alt"
              pathLength="1"
              d={altLinkPath(l)}
            />
          ))}
        </g>
        <g className="nodes">
          {layout.nodes.map((n) => {
            const w = nodeW(n.data.name);
            const kidsOpen = expanded.has(n.data.path);
            return (
              <g key={n.data.path} className="node" style={{ transform: nodeTransform(n) }}>
                <rect x={0} y={-NODE_H / 2} width={w} height={NODE_H} rx="6" />
                <text x={TEXT_PAD} dy="0.32em">{n.data.name}</text>
                {hasChildren(n) && (
                  <g
                    className="toggle"
                    transform={`translate(${w + TOGGLE_GAP},${-TOGGLE / 2})`}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleKids(n.data.path);
                    }}
                  >
                    <rect width={TOGGLE} height={TOGGLE} rx="3" />
                    <text x={TOGGLE / 2} y={TOGGLE / 2}>{kidsOpen ? '−' : '+'}</text>
                  </g>
                )}
                {hasAlts(n) && (
                  <g
                    className="altcue"
                    transform={`translate(${-ALT_GAP - ALT_W},${-ALT_H / 2})`}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleAlts(n.data.path);
                    }}
                  >
                    <rect width={ALT_W} height={ALT_H} rx="3" />
                    <text x={ALT_W / 2} y={ALT_H / 2}>↩{n.data.alts.length}</text>
                  </g>
                )}
              </g>
            );
          })}
        </g>
      </g>
    </svg>
  );
}
