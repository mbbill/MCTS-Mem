import { useEffect, useRef } from 'react';
import { counts, entryText } from './details.js';
import { moveRect, resizeRect } from './pane.js';
import { verbClass } from './semantics.js';

const HANDLES = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];

function MoveEntry({ entry, onNavigate }) {
  if (!entry || typeof entry !== 'object') return entryText(entry);
  const stamp = [entry.date, entry.hash ? `(${entry.hash})` : null].filter(Boolean).join(' ');
  const body = entry.text || entry.flat || entry.raw || '';
  const prov = entry.provenance ? ` (${entry.provenance})` : '';
  return (
    <>
      {stamp}{' '}
      <span className={`move-verb ${verbClass(entry.verb)}`}>{entry.verb}</span>{' '}
      {entry.target ? (
        <button className="entry-link" onClick={() => onNavigate(entry.target)}>
          [[{entry.targetName}]]
        </button>
      ) : null}
      : {body}{prov}
    </>
  );
}

function Section({ title, entries, onNavigate }) {
  if (!entries?.length) return null;
  return (
    <section className="details-section">
      <h3>{title}</h3>
      <ul>
        {entries.map((e, i) => (
          <li key={i}>{e?.isMove ? <MoveEntry entry={e} onNavigate={onNavigate} /> : entryText(e)}</li>
        ))}
      </ul>
    </section>
  );
}

export default function DetailsPane({
  node,
  rect,
  onRectChange,
  loading = false,
  error = null,
  onClose,
  onNavigate = () => {},
}) {
  const c = counts(node);
  const drag = useRef(null);

  useEffect(() => {
    const onResize = () => onRectChange(resizeRect(rect, '', 0, 0, window.innerWidth, window.innerHeight));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [onRectChange, rect]);

  useEffect(() => {
    const onMove = (e) => {
      if (!drag.current) return;
      const d = drag.current;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      onRectChange(
        d.type === 'move'
          ? moveRect(d.rect, dx, dy, window.innerWidth, window.innerHeight)
          : resizeRect(d.rect, d.handle, dx, dy, window.innerWidth, window.innerHeight)
      );
    };
    const onUp = () => { drag.current = null; };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [onRectChange]);

  const startMove = (e) => {
    if (e.target.closest('button')) return;
    e.preventDefault();
    e.stopPropagation();
    drag.current = { type: 'move', x: e.clientX, y: e.clientY, rect };
  };
  const startResize = (handle) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    drag.current = { type: 'resize', handle, x: e.clientX, y: e.clientY, rect };
  };

  return (
    <aside
      className="details-pane"
      aria-label="Node details"
      style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
    >
      {HANDLES.map((h) => (
        <div key={h} className={`resize-handle ${h}`} onPointerDown={startResize(h)} />
      ))}
      <div className="details-head" onPointerDown={startMove} title="Drag to move">
        <div>
          <h2>{node.data.name}</h2>
          <div className="details-badges">
            {node.isAlt && <span className="badge alt">alt</span>}
            <span className="badge">items {c.items}</span>
            <span className="badge">facts {c.facts}</span>
            <span className="badge">moves {c.moves}</span>
            <span className="badge">children {c.children}</span>
            <span className="badge">alts {c.alts}</span>
          </div>
        </div>
        <button className="details-close" onClick={onClose} aria-label="Close details">
          ×
        </button>
      </div>
      <div className="details-body">
        <div className="details-path">{node.data.path}</div>
        {loading && <div className="details-empty">Loading details…</div>}
        {error && <div className="details-error">Failed to load details: {error}</div>}
        {!loading && !error && (
          <>
            <Section title="Items" entries={node.data.items} onNavigate={onNavigate} />
            <Section title="Facts" entries={node.data.facts} onNavigate={onNavigate} />
            <Section title="Moves" entries={node.data.moves} onNavigate={onNavigate} />
            {!c.items && !c.facts && !c.moves && <div className="details-empty">No details recorded.</div>}
          </>
        )}
      </div>
    </aside>
  );
}
