- kitty injects shell integration into supported shells (bash, zsh, fish) without the user editing any rc file, by setting environment variables that redirect each shell's own startup to kitty's integration scripts, which then source the user's real startup files (`modify_shell_environ`).

- Integration runs only for interactive shells and can be disabled or narrowed (e.g. no-rc, no-cursor, no-prompt-mark) through the shell_integration option, passed to the shell in KITTY_SHELL_INTEGRATION.

- The integration scripts emit OSC 133 command-boundary marks: `A` at each prompt start, `C` at the start of command output (carrying the command line), and `D` when a command finishes (carrying its exit status).

- kitty parses these marks per line into prompt/output-boundary attributes and records the last command's line and exit status, enabling prompt-aware scrollback jumps, command-output selection, and command-finished notifications (`shell_prompt_marking`).

## Facts

- 2021-10-27 statement: each shell is hooked through its own native startup mechanism so no dotfile is rewritten — zsh via ZDOTDIR, bash via ENV plus an injected `--posix`, fish via XDG_DATA_DIRS (code).

- 2021-10-27 (d3a3f998) rationale: the fish hook exploits fish loading scripts from XDG_DATA_DIRS on startup, which is less intrusive than adding symlinks under ~/.config/fish (sourced).

- 2024-06-24 statement: kitty does not emit the OSC 133 `B` (prompt-end) mark, delimiting the typed command from cursor position instead (code).

- 2024-06-24 statement: an OSC 133 `D` exit status drives a "command finished with status" desktop notification for commands that ran longer than a threshold, surfacing a non-zero exit to the user (code).

## Moves

- 2021-11-27 (f6e0eb40) replaced [[rc-file-modification]]: load the integration through env vars that redirect the shell's own startup, so the normal startup files are still sourced and kitty never modifies the user's dotfiles (sourced).
