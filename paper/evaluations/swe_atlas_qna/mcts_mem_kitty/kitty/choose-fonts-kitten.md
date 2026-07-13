- The choose-fonts kitten is an interactive subcommand that walks the user from picking a font family, through tuning its bold/italic faces, to a final confirmation pane (`final_pane`).

- The chosen family and its resolved face settings are carried into the confirmation pane, which presents distinct actions: apply them to kitty's config, print them to STDOUT, return to selection, or quit.

- Applying writes the chosen font settings into the user's kitty.conf and then requests running kitty instances to reload their configuration.

## Facts

- 2024-05-18 (815df1e2) statement: a confirmed selection is persisted by patching the user's kitty.conf, writing the font settings inside a managed "# BEGIN_KITTY_FONTS / # END_KITTY_FONTS" block that is replaced in place on a re-run (code).

- 2024-05-18 (815df1e2) statement: patching first comments out any conflicting font_family, bold_font, italic_font or bold_italic_font lines already in kitty.conf and writes a .bak backup before atomically rewriting the file (code).

- 2024-05-18 (815df1e2) statement: the kitten persists nothing of its own between runs — an applied selection survives a restart only because it now lives in kitty.conf, the file kitty reads at startup (code).

- 2024-05-18 (815df1e2) statement: after a successful patch the kitten asks kitty to reload its config live, scoped by the --reload-in option to the parent instance (the default), all instances, or none (code).
