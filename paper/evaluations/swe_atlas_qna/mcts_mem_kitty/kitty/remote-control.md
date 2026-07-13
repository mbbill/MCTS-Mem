- A remote-control command is a single JSON object carrying a command name, the
  sending client's kitty version, and an optional command-specific payload.

- The JSON object travels wrapped in a DCS escape envelope (`@kitty-cmd`), and the
  same envelope is used on every transport.

- A command reaches a running instance over one of two transports: the process's
  controlling terminal (the default) or a UNIX/TCP socket the instance was told to
  listen on.

- Each command name resolves to its own module, loaded on demand; the set of
  available commands is exactly the set of those modules.

- A command from a client whose major/minor version exceeds the receiving
  instance's is refused.

- Commands that need user interaction before they can answer are carried as
  asynchronous requests tagged with a caller-chosen id; commands sending more data
  than fits one message split their payload into a stream of chunks.

- Acceptance of a command is decided by a separate authorization layer (see
  [[permissions]]); a command that carries a password is encrypted end-to-end
  before transport (see [[encryption]]).

## Facts

- 2018-01-07 (f3cb68ee) statement: the first remote-control implementation had only
  one transport — the client wrote the DCS `@kitty-cmd` envelope to its controlling
  terminal, and the screen's DCS parser routed the `@`-prefixed payload to a command
  handler (code).

- 2018-01-07 (f3cb68ee) rationale: the controlling-terminal transport is the default
  as it needs no socket and reaches any program running inside a kitty window, even
  across an SSH connection where the command rides the existing terminal byte stream
  (sourced).

- 2018-03-03 (15f07f57) statement: a second transport — a UNIX/TCP socket selected by
  `--to` / `--listen-on` — was added alongside the terminal path, carrying the
  identical DCS envelope (code).

- 2018-03-03 (15f07f57) rationale: the socket transport exists to control kitty from
  programs or scripts that are not running inside a kitty window, which the
  controlling-terminal transport cannot reach (sourced).

- 2022-08-31 (364533b1) statement: a single peer socket message is capped at 64 KiB,
  so a command sending more (such as setting a background image) streams its payload
  as chunks sharing a stream_id, reassembled into a buffer capped at 128 MiB before the
  command runs (code).
