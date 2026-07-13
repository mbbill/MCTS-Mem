- The block from the current prompt's start down through the cursor is not re-wrapped: those rows are copied aside, blanked in place before the reflow, and the saved copy is written back unchanged after the resize.

- This applies only when the shell has announced that it redraws its own prompts; otherwise the prompt reflows like ordinary content.

- A placeholder character is written into the blanked prompt rows at or above the cursor.

## Facts

- 2021-08-18 (196200d0) rationale: the prompt is exempted because the shell redraws it after the resize and is thrown off if the cursor's vertical offset from the prompt's first line changes, as seen with zsh right-side prompts (sourced).

- 2024-04-12 (684d28d3) statement: restoring the old prompt adds copying work to every resize, accepted in exchange for steadier visuals (sourced).

## Moves

- 2024-04-12 (684d28d3) replaced [[blank-and-redraw-prompt]]: blanking the prompt left a visible gap until the shell redrew it, so the old prompt rows are now kept on screen unreflowed and the flicker is gone in the common case (sourced).
