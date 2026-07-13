import { describe, expect, it } from 'vitest';
import { defaultRect, paneRect, clampRect, moveRect, resizeRect, MIN_W, MIN_H } from '../src/pane.js';

describe('defaultRect', () => {
  it('starts as a right-side floating window inside the viewport', () => {
    expect(defaultRect(1000, 700)).toEqual({ x: 564, y: 16, w: 420, h: 668 });
  });
});

describe('paneRect', () => {
  it('reuses a saved rectangle instead of resetting to the default', () => {
    expect(paneRect({ x: 40, y: 50, w: 500, h: 300 }, 1000, 700)).toEqual({
      x: 40,
      y: 50,
      w: 500,
      h: 300,
    });
  });

  it('falls back to the default rectangle when no saved rectangle exists', () => {
    expect(paneRect(null, 1000, 700)).toEqual(defaultRect(1000, 700));
  });
});

describe('clampRect', () => {
  it('enforces min size and keeps the pane inside the viewport', () => {
    expect(clampRect({ x: -10, y: 999, w: 10, h: 10 }, 800, 600)).toEqual({
      x: 0,
      y: 380,
      w: MIN_W,
      h: MIN_H,
    });
  });
});

describe('moveRect', () => {
  it('moves by delta and clamps to the viewport', () => {
    expect(moveRect({ x: 700, y: 20, w: 200, h: 200 }, 100, 0, 800, 600)).toEqual({
      x: 500,
      y: 20,
      w: MIN_W,
      h: 220,
    });
  });
});

describe('resizeRect', () => {
  it('resizes from the east edge', () => {
    expect(resizeRect({ x: 100, y: 100, w: 320, h: 240 }, 'e', 80, 0, 1000, 800)).toEqual({
      x: 100,
      y: 100,
      w: 400,
      h: 240,
    });
  });

  it('resizes from the west edge while keeping the opposite edge stable', () => {
    expect(resizeRect({ x: 100, y: 100, w: 400, h: 240 }, 'w', 50, 0, 1000, 800)).toEqual({
      x: 150,
      y: 100,
      w: 350,
      h: 240,
    });
  });

  it('resizes from a corner and respects min size', () => {
    expect(resizeRect({ x: 100, y: 100, w: 320, h: 240 }, 'nw', 1000, 1000, 1000, 800)).toEqual({
      x: 120,
      y: 120,
      w: MIN_W,
      h: MIN_H,
    });
  });
});
