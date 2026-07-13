- kitty enables shell integration by editing the user's shell rc files (e.g. ~/.zshrc, ~/.bashrc) in place to source its integration script, creating the rc file when absent and rewriting it atomically while preserving the original's stat attributes.

## Moves

- 2021-11-27 (f6e0eb40) replaced by [[shell-integration]]: load the integration through env vars that redirect the shell's own startup, so the normal startup files are still sourced and kitty never modifies the user's dotfiles (sourced).
