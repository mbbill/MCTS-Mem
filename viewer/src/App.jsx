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
import DetailsPane from './DetailsPane.jsx';
import { pathTo, selectedNode } from './details.js';
import { paneRect } from './pane.js';
import { confidenceChecks, provenanceBadge } from './semantics.js';

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
  const [selectedPath, setSelectedPath] = useState(null);
  const [detailsByPath, setDetailsByPath] = useState(() => new Map());
  const [detailsErr, setDetailsErr] = useState(null);
  const [savedPaneRect, setSavedPaneRect] = useState(null);
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

  const navigateTo = (targetPath) => {
    const route = root ? pathTo(root, targetPath) : null;
    if (!route) return;
    const childParents = route.filter((s) => s.edge === 'children').map((s) => s.parentPath);
    const altParents = route.filter((s) => s.edge === 'alts').map((s) => s.parentPath);
    if (childParents.length) setExpanded((prev) => new Set([...prev, ...childParents]));
    if (altParents.length) setAltsOpen((prev) => new Set([...prev, ...altParents]));
    pendingReveal.current = { path: targetPath, kind: 'node' };
    setSelectedPath(targetPath);
  };

  const layout = useMemo(
    () => (root ? buildLayout(root, expanded, altsOpen) : null),
    [root, expanded, altsOpen]
  );

  useEffect(() => {
    if (!selectedPath || detailsByPath.has(selectedPath)) return;
    let cancelled = false;
    setDetailsErr(null);
    fetch(`/api/node?path=${encodeURIComponent(selectedPath)}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.error) setDetailsErr(d.error);
        else setDetailsByPath((prev) => new Map(prev).set(selectedPath, d.node));
      })
      .catch((e) => !cancelled && setDetailsErr(String(e)));
    return () => { cancelled = true; };
  }, [selectedPath, detailsByPath]);

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
        const revealed = rev.kind === 'alts' ? clicked.altKids : rev.kind === 'kids' ? clicked.kids : [];
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

  const nodes = layout.nodes;
  const selected = selectedNode(nodes, selectedPath);
  const selectedDetails = selectedPath ? detailsByPath.get(selectedPath) : null;
  const currentPaneRect = selected ? paneRect(savedPaneRect, window.innerWidth, window.innerHeight) : null;

  return (
    <>
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
          {nodes.map((n) => {
            const w = nodeW(n.data.name);
            const kidsOpen = expanded.has(n.data.path);
            const prov = provenanceBadge(n.data.provenance);
            const checks = confidenceChecks(n.data.weight);
            return (
              <g
                key={n.data.path}
                className={`node${n.isAlt ? ' alt-node' : ''}${selectedPath === n.data.path ? ' selected' : ''}`}
                style={{ transform: nodeTransform(n) }}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedPath(n.data.path);
                }}
              >
                <rect x={0} y={-NODE_H / 2} width={w} height={NODE_H} rx="6" />
                <text x={TEXT_PAD} dy="0.32em">{n.data.name}</text>
                {prov && <text className={`prov-badge ${prov === '?' ? 'uncertain' : ''}`} x={-5} y={-NODE_H / 2 - 2}>{prov}</text>}
                <g className="confidence" transform={`translate(${prov ? 10 : -3},${-NODE_H / 2 - 3})`}>
                  {[0, 1, 2].map((i) => (
                    <text key={i} className={i < checks ? 'on' : 'off'} x={i * 5} y={0}>✓</text>
                  ))}
                </g>
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
      {selected && (
        <DetailsPane
          node={{ ...selected, data: { ...selected.data, ...(selectedDetails || {}) } }}
          rect={currentPaneRect}
          onRectChange={setSavedPaneRect}
          loading={!selectedDetails && !detailsErr}
          error={detailsErr}
          onClose={() => setSelectedPath(null)}
          onNavigate={navigateTo}
        />
      )}
    </>
  );
}
