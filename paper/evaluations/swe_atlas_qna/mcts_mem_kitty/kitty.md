- kitty is a GPU-accelerated terminal emulator that renders all of its output through OpenGL and depends on no external UI toolkit.

- Capability beyond the core terminal — ssh, diff, file transfer, font selection, clipboard, and remote control — is delivered as separate programs ("kittens") that drive or extend a running kitty instance rather than living in the core.

- Configuration is a single human-editable file.

## Facts

- 2024-06-24 rationale: kitty's stated design philosophy is to stay simple, modular, and hackable — split across C for performance-sensitive parts, Python for UI extensibility, and Go for the command-line kittens, using only OpenGL for rendering and no large UI toolkit, with a single human-editable config file for reproducibility; recorded in `docs/overview.rst` (sourced).
