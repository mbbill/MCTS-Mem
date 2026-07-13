- The current prompt's rows are blanked before reflow and left empty, relying on the shell to redraw the prompt after the resize.

## Moves

- 2024-04-12 (684d28d3) replaced by [[prompt-no-reflow]]: blanking the prompt left a visible gap until the shell redrew it, so the old prompt rows are now kept on screen unreflowed and the flicker is gone in the common case (sourced).
