- A single setting (`allow_remote_control`) selects one of five regimes: remote
  control off, accepted unconditionally, accepted only over a socket,
  socket-unconditional with the terminal requiring a password, or password required on
  both transports.

- The terminal and socket transports are trusted independently: any program in a kitty
  window — including one reached over SSH — can write to the terminal, whereas a
  socket is reachable only subject to filesystem permissions.

- A configured password maps to a set of allowed command-name glob patterns and/or
  custom Python predicate files; a request runs only if its command name matches a
  pattern or a predicate permits it.

- A password not present in the configuration triggers an interactive allow/deny
  prompt, and the user's choice is remembered for the lifetime of the instance.

- Remote control can also be granted to individual windows independently of the global
  setting.

## Facts

- 2022-08-15 (d027f524) statement: the formerly boolean allow_remote_control was
  widened to the enum no/yes/socket-only/socket/password, separating socket trust from
  terminal trust (code).

- 2022-08-17 (a0568334) rationale: the default was kept at no so a bug in the
  freshly-written remote-control implementation could not expose users by default, to
  be reconsidered once the implementation is battle-tested (sourced).

- 2022-08-10 (2c83b990) statement: password-based fine-grained permissions were added —
  each remote_control_password lists the actions it may run as glob patterns over
  command names, with a custom Python is_cmd_allowed predicate file as the most
  flexible form (code).
