- Startup runs a fixed sequence: resolve configuration, set up process
  environment and locale, mask signals process-wide, initialize the
  windowing/GPU backend, then create the first OS window and enter the
  render/IO loop (kitty/main.py).

- Configuration is resolved first, before any window, GPU, or font work; the
  resolved options are the inputs to backend selection, font setup, and window
  creation.

- Configuration comes from a single human-editable file, kitty.conf, located by
  checking KITTY_CONFIG_DIRECTORY then the XDG/platform config directories; when
  no such file exists the built-in defaults are used unchanged.

- Signals are masked process-wide before the display backend is initialized, and
  only kitty's main thread handles them.

- GPU context creation ([[gpu-context]]) and font setup ([[font-setup]]) each
  happen once, up front, and the entry point is reached only after the embedded
  interpreter is already running ([[launcher]]).

## Facts

- 2024-06-24 statement: the configuration is intentionally a single
  human-editable file for easy reproducibility and source control —
  `docs/overview.rst` (sourced).

- 2022-12-07 (9cb0e4d0) pitfall: handled signals are blocked early, before GLFW
  is initialized, because the graphics libraries may start threads behind
  kitty's back that must default to having those signals blocked (issue 4636)
  (sourced).

- 2024-06-24 pitfall: font data must be freed before glfw/freetype/fontconfig/
  opengl are finalized, so font teardown is ordered ahead of backend
  finalization on shutdown (code).
