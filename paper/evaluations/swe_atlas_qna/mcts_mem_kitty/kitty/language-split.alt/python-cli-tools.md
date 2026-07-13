- The command-line tools — the `kitty @` remote-control client, ssh, clipboard,
  image display, and the other non-interactive kittens — are implemented in
  Python.

- Running any such tool starts a full Python interpreter and imports the kitty
  package before the command itself executes.

## Moves

- 2022-11-14 (bbf75043) replaced by [[language-split]]: the command-line tools and the `kitty @` remote-control client ran as Python, paying ~50-70ms of interpreter startup per invocation, while a single statically compiled Go binary runs the same commands in ~5ms and ships to any UNIX-like server as one standalone file (sourced).
