- Rendering uses OpenGL directly with no GUI toolkit; windowing, input, and the
  GL context come from a bundled GLFW fork rather than the system GLFW
  (kitty/glfw.c).

- The GLFW backend is chosen at runtime — cocoa on macOS, otherwise wayland or
  x11 by display detection — and loaded as a per-backend shared library via
  dlopen; a single install carries both the X11 and the Wayland backend and
  picks one at launch.

- The GL context is requested as a forward-compatible core profile at a fixed
  minimum OpenGL version — 3.3 on macOS, 3.1 elsewhere — and startup aborts with
  a fatal error if the driver cannot provide it.

- No depth or stencil buffer is requested, since the cell grid is drawn as flat
  2D layers.

- GL function pointers are loaded with the GLAD loader after context creation,
  and the required ARB_texture_storage extension is verified.

- An sRGB-capable framebuffer is requested for correct blending, except on
  Wayland.

- A hidden temporary window is created first to read the monitor DPI, ahead of
  the real window.

## Facts

- 2024-06-24 rationale: kitty deliberately depends on no large, complex UI
  toolkit, using only OpenGL to render everything — `docs/overview.rst`
  (sourced).

- 2017-12-14 (433640de) rationale: on macOS the context enables Cocoa graphics
  switching so kitty can run on the low-power GPU of dual-GPU machines (sourced).

- 2024-03-19 (69c0eaaf) pitfall: sRGB framebuffers are not requested on Wayland
  because doing so prevents kitty starting on Wayland+NVIDIA and trips a mesa
  sRGB-surface bug (issues 7021, 7174) (sourced).

- 2024-06-24 statement: the bundled GLFW exposes kitty-specific window hints not
  present in upstream GLFW — background blur, Wayland background color, and IME
  and selection callbacks (code).

- 2024-06-24 pitfall: the real window's size is taken from the hidden temp
  window's DPI to avoid creating it then resizing, which would fire a resize
  event and its associated processing (code).
