- The font system is split by platform: CoreText does font listing, matching,
  and rasterization on macOS, while fontconfig (matching) plus FreeType
  (rasterization) do them on Linux/BSD.

- A platform-independent C core sits above both backends and owns cell metrics,
  the per-glyph alpha-mask cache, fallback selection, and HarfBuzz shaping
  (kitty/fonts.c).

- Only monospace, freely scalable (non-bitmap) fonts are usable, since every
  cell in the grid is the same fixed size and glyphs are cached as resizable
  alpha masks.

- The configured families for regular, bold, italic, and bold-italic, plus
  per-Unicode-range symbol maps, are resolved into concrete faces at startup
  before the first window is shown.

- A glyph absent from the selected faces triggers an on-demand fallback-face
  lookup, and the result is memoized for reuse.

## Facts

- 2024-06-24 rationale: kitty caches alpha masks of each rendered glyph on the
  GPU and renders them in parallel, which makes it a strictly cell-based display
  usable only with monospace, non-bitmap fonts — `docs/faq.rst` (sourced).

- 2024-06-24 statement: the macOS-vs-Linux font backend is selected at
  import time from the platform, choosing the CoreText or the
  fontconfig/FreeType module (code).
