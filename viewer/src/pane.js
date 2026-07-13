export const MIN_W = 300;
export const MIN_H = 220;
export const EDGE = 8;

export function defaultRect(viewportW, viewportH) {
  const w = Math.min(420, viewportW - 32);
  const h = viewportH - 32;
  return clampRect({ x: viewportW - w - 16, y: 16, w, h }, viewportW, viewportH);
}

export function paneRect(saved, viewportW, viewportH) {
  return saved ? clampRect(saved, viewportW, viewportH) : defaultRect(viewportW, viewportH);
}

export function clampRect(r, viewportW, viewportH) {
  const w = Math.min(Math.max(r.w, MIN_W), Math.max(MIN_W, viewportW));
  const h = Math.min(Math.max(r.h, MIN_H), Math.max(MIN_H, viewportH));
  const x = Math.min(Math.max(r.x, 0), Math.max(0, viewportW - w));
  const y = Math.min(Math.max(r.y, 0), Math.max(0, viewportH - h));
  return { x, y, w, h };
}

export function moveRect(start, dx, dy, viewportW, viewportH) {
  return clampRect({ ...start, x: start.x + dx, y: start.y + dy }, viewportW, viewportH);
}

export function resizeRect(start, handle, dx, dy, viewportW, viewportH) {
  let { x, y, w, h } = start;
  if (handle.includes('e')) w += dx;
  if (handle.includes('s')) h += dy;
  if (handle.includes('w')) { x += dx; w -= dx; }
  if (handle.includes('n')) { y += dy; h -= dy; }

  if (w < MIN_W) {
    if (handle.includes('w')) x -= MIN_W - w;
    w = MIN_W;
  }
  if (h < MIN_H) {
    if (handle.includes('n')) y -= MIN_H - h;
    h = MIN_H;
  }

  // Keep the dragged opposite edge stable when possible, but clamp to viewport.
  return clampRect({ x, y, w, h }, viewportW, viewportH);
}
