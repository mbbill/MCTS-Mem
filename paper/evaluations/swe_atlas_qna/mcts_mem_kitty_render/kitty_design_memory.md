## kitty

- kitty is a GPU-accelerated terminal emulator that renders all of its output through OpenGL and depends on no external UI toolkit.

- Capability beyond the core terminal — ssh, diff, file transfer, font selection, clipboard, and remote control — is delivered as separate programs ("kittens") that drive or extend a running kitty instance rather than living in the core.

- Configuration is a single human-editable file.

## Facts

- 2024-06-24 rationale: kitty's stated design philosophy is to stay simple, modular, and hackable — split across C for performance-sensitive parts, Python for UI extensibility, and Go for the command-line kittens, using only OpenGL for rendering and no large UI toolkit, with a single human-editable config file for reproducibility; recorded in `docs/overview.rst` (sourced).


# Current design decisions


## child-monitor

- One dedicated I/O thread is the sole reader and writer of every child's PTY master fd; terminal-output parsing and rendering run on a separate main thread (`io_loop`).

- A single `poll()` call watches all child fds together with one wakeup fd and one signal-delivery fd; that one call is how the thread multiplexes every child.

- The I/O thread and the main thread share state only through per-`Screen` input and output buffers guarded by locks; neither thread touches fds owned by the other.

- The live child array is mutated only on the I/O thread, which drains add and remove queues populated by the main thread.

- A child's death is reaped on the I/O thread with non-blocking `waitpid`; the main thread then flushes the child's last buffered output and, by default, closes the window.

## Facts

- 2022-06-13 (5f13946b) statement: the six handled signals (SIGINT, SIGHUP, SIGTERM, SIGCHLD, SIGUSR1, SIGUSR2) are masked process-wide and delivered to the I/O thread as readable events on a dedicated fd its `poll()` watches, so signal handling needs no async-signal-safe shared state (code).

- 2022-06-13 (5f13946b) rationale: kitty uses its own signal-to-fd implementation rather than Python's signalfd because Python's returns only signal numbers, not the full siginfo struct (sourced).

- 2024-05-14 (6be75ce1) pitfall: reaped pids are copied into a local array and the children lock is released before the Python death callback runs, because that callback can re-enter code that takes the same lock and deadlock (sourced).

- 2024-02-25 (6205fb32) statement: to parse without holding the children lock, the main thread snapshots the child list and bumps each `Screen`'s refcount under the lock, then parses each child with the lock released (code).


## child-monitor / read-loop

- The I/O thread reads a ready child's PTY output directly into a fixed, pre-allocated buffer shared with that child's VT parser; no buffer is allocated per read (`read_bytes`).

- A child's fd is polled for input only while its parser buffer has free space; a fast producer is thereby throttled by parsing and render progress rather than by unbounded memory growth.

- A read of zero bytes, or a hard error other than EINTR/EAGAIN, marks the child dead.

## Facts

- 2024-02-25 (6205fb32) rationale: the shared read buffer was moved out of `Screen` into the VT parser during a parser rewrite for speed, so `read_bytes` now requests its write region from the parser and commits the byte count back instead of touching a `Screen` field (sourced).

- 2024-02-25 (6205fb32) statement: buffered child output is held unparsed until input_delay has elapsed since it arrived, the parser buffer is within ~16 KB of its 1 MB limit, or a flush is forced — so a lone keystroke echo is coalesced for a few ms while bulk output such as `yes` is drained the moment the buffer fills (code).

- 2024-02-25 (34164dc3) pitfall: a `read()` error must still commit a zero-length write to the parser, otherwise the write region handed out by the parser is left dangling and the next read aborts (code).

- 2024-02-25 (fd7d0f87) pitfall: the main loop re-arms its input_delay timer only when input was read or input is still pending; the earlier unconditional arm made the event loop wake every input_delay seconds even when completely idle (code).


## child-monitor / spawn

- Each child is started by `fork()` into a freshly opened PTY; the parent keeps the master fd while the slave becomes the child's stdin, stdout, and stderr (`spawn`).

- In the forked child, before exec, kitty restores inherited signal handlers and the signal mask to defaults, calls `setsid()`, and makes the slave PTY its controlling terminal.

- On exec failure the child execs kitty's hold kitten rather than exiting; the user is shown the failure message instead of a window that silently vanishes.

- The PTY master is opened in blocking mode and switched to non-blocking in the parent after the fork.

## Facts

- 2023-09-24 (68b861b1) rationale: on macOS the default shell is launched through `/usr/bin/login` so that `getlogin()` returns the correct user (sourced).

- 2024-06-24 statement: the child establishes the controlling terminal with an explicit ioctl after opening the slave by name, because on BSD a plain open() does not make it the controlling terminal (code).


## child-monitor / spawn / ready-sync

- After setting up its fds, the forked child blocks until kitty signals that the window's `Screen` object exists; no child output is produced before kitty can parse it.

- Readiness is signalled over a dedicated pipe — the child waits on the read end and the parent closes the write end once the screen is set up (`wait_for_terminal_ready`).

## Moves

- 2018-08-04 (eb2ec183) replaced [[sigwinch-ready]]: a pipe is simpler and more robust since there is no longer a race between the installation of the signal handler and the dispatch of the signal (sourced).


## child-monitor / wakeup-coalescing

- The I/O thread does not wake the main render thread on every chunk of child output; it wakes it at most once per input_delay, coalescing a burst of small reads into a single render tick.

- While a wakeup is being held back, the I/O thread shortens its next poll timeout to the remaining input_delay, keeping the deferred wakeup bounded.

## Moves

- 2018-10-23 (40b355e5) replaced [[wakeup-per-chunk]]: processing wakeup events is very expensive on platforms such as Cocoa, so debounce main-loop wakeups by input_delay instead of waking on every chunk of child output (sourced).


## choose-fonts-kitten

- The choose-fonts kitten is an interactive subcommand that walks the user from picking a font family, through tuning its bold/italic faces, to a final confirmation pane (`final_pane`).

- The chosen family and its resolved face settings are carried into the confirmation pane, which presents distinct actions: apply them to kitty's config, print them to STDOUT, return to selection, or quit.

- Applying writes the chosen font settings into the user's kitty.conf and then requests running kitty instances to reload their configuration.

## Facts

- 2024-05-18 (815df1e2) statement: a confirmed selection is persisted by patching the user's kitty.conf, writing the font settings inside a managed "# BEGIN_KITTY_FONTS / # END_KITTY_FONTS" block that is replaced in place on a re-run (code).

- 2024-05-18 (815df1e2) statement: patching first comments out any conflicting font_family, bold_font, italic_font or bold_italic_font lines already in kitty.conf and writes a .bak backup before atomically rewriting the file (code).

- 2024-05-18 (815df1e2) statement: the kitten persists nothing of its own between runs — an applied selection survives a restart only because it now lives in kitty.conf, the file kitty reads at startup (code).

- 2024-05-18 (815df1e2) statement: after a successful patch the kitten asks kitty to reload its config live, scoped by the --reload-in option to the parent instance (the default), all instances, or none (code).


## clipboard

- The system clipboard and the primary selection are each modelled as a map from MIME
  type to its bytes, backed by a temporary file (`Tempfile`) that begins in memory and
  rolls over to disk once it grows large.

- Two escape-code protocols access them: the legacy OSC 52 (plain text only) and
  kitty's OSC 5522 extension, which carries arbitrary MIME types, chunked payloads,
  per-type read/write status codes, and an optional request id for multiplexers.

- Reads and writes are each gated by a per-direction permission in the
  clipboard-control setting; a read may additionally require an interactive permission
  prompt.

- A write request may declare MIME aliases, exposing a single transmitted copy on the
  clipboard under several MIME types.

- A request that only lists the MIME types available on the clipboard is answered
  without any permission prompt.

## Facts

- 2022-12-01 (fdd42d5f) statement: clipboard data is buffered in a temp file that
  starts as an in-memory buffer and rolls over to a real on-disk file once it passes
  16 MiB, with the total bounded by the clipboard_max_size option (code).

- 2022-12-01 (fdd42d5f) statement: OSC 5522 splits each MIME type's data into roughly
  4 KiB chunks sent sequentially per type, and reports per-type status codes
  (OK/DATA/DONE plus ENOSYS/EPERM/EBUSY/EIO/EINVAL) so clients can distinguish
  unavailable, denied, busy, and malformed conditions (code).

- 2022-11-28 (3ee9f723) statement: the legacy OSC 52 path was reimplemented on top of
  the new clipboard manager rather than removed, so plain-text OSC 52 clients keep
  working unchanged (code).

- 2022-12-03 (6422b323) rationale: MIME aliasing lets a client transmit one copy of the
  data and expose it under several MIME types, saving bandwidth versus sending each
  type separately (sourced).

- 2022-12-01 rationale: a read that only lists the available MIME types is allowed
  without a prompt, to avoid presenting the user a double permission prompt — one for
  listing the types and another for the data itself (sourced).

## Moves

- 2022-11-28 (a8725d63) replaced [[in-memory-text]]: the single UTF-8 text string held
  only one text/plain selection and could carry neither arbitrary MIME types such as
  images or rich text nor large payloads spilled to disk (code).


## diff-kitten

- The diff kitten compares two directory trees by pairing their entries on each entry's path relative to its root (`collect_files`); a name present in both trees is reported as a change when the contents differ.

- A file present on only one side is reported as a rename of an unpaired file on the other side only when their contents are byte-identical; with no identical counterpart it becomes a standalone add or removal.

- Rename candidates are found by matching the content hash of each removed file against the added files, then confirmed by a full byte comparison before pairing.

- Two paired files whose contents are identical but whose file modes differ are reported as a change.

## Facts

- 2023-03-27 (e4d936b5) rationale: rename detection deliberately uses exact content identity rather than git-style similarity scoring; no commit or doc records why that trade-off was chosen over a similarity threshold (uncertain).


## diff-kitten / caching

- A file's contents pass through a chain of per-path memoizing caches — raw bytes, then sanitized split lines, then syntax-highlighted lines — each computed at most once per run (`highlighted_lines_cache`).

- The diff is painted immediately using the plain split lines; syntax highlighting of all changed text files runs on a background goroutine and replaces the plain lines once it completes.

- Cached highlighted lines are used for a file only while their count equals that file's plain-line count; otherwise the plain lines are shown.

## Facts

- 2023-03-21 (c2e549b7) rationale: highlighting was made asynchronous and run in parallel across files specifically to keep the initial diff paint from blocking on per-file syntax highlighting (code).

- 2023-03-23 (9c188096) pitfall: highlighting a file can yield a different number of lines than the plain split, and rendering indexes the plain and highlighted lines in lockstep, so the highlighted cache is honored only when the two line counts match (code).


## file-transfer

- File transfer runs as bi-directional "sessions" carried over the terminal escape-code
  channel: a stream of `key=value` commands wrapped in one OSC code (`FILE_TRANSFER_CODE`,
  5113), with binary fields base64-encoded and key names abbreviated to two or three
  letters.

- A session is either a send (peer to terminal) or a receive (terminal to peer); it
  transmits file metadata first — recursing into directories and preserving symlinks,
  hardlinks, permissions and mtimes — then the file data in chunks of at most 4096 bytes,
  then a finish that commits.

- Each regular file is transferred either whole ("simple") or as an rsync-style binary
  delta ("rsync"), and may additionally be zlib-compressed.

- For an rsync transfer the side that already holds the file sends a block signature and
  the other side returns only the changed blocks.

- No data touches the filesystem until the user approves the session in the receiving
  terminal, unless a pre-shared password authorizes it without a prompt
  ([[confirmation-bypass]]).

- When applying an rsync delta the patched output is built in a temporary file in the
  destination directory and atomically renamed over the original; a simple whole-file write
  goes straight to the destination, truncating it.

## Facts

- 2021-08-19 (37735b96) rationale: the protocol exists for situations where the TTY is the
  only convenient pipe between two machines, such as nested SSH sessions or a serial line
  (sourced).

- 2021-08-19 (37735b96) statement: because every byte is base64-encoded over the TTY, the
  protocol is documented as never competitive with direct file-transfer mechanisms
  (sourced).

- 2021-10-01 (cfeeec95) rationale: rsync delta transfer was added to make repeated
  transfers of large, slightly-changed files fast, identifying blocks by an XXH3 strong
  hash plus the rsync rolling weak hash with block size near the square root of the file
  size (sourced).


## file-transfer / confirmation-bypass

- Every transfer session must be approved interactively in the receiving terminal before
  any data moves.

- The prompt is skipped when the start command carries a `bypass` field holding a
  pre-shared password the terminal can independently reconstruct (`check_bypass`).

- Two bypass wire-forms are accepted: `sha256:` carrying a hash of `request_id;password`,
  and `kitty-1:` carrying the password encrypted to the terminal's public key; kitty's own
  kittens send the encrypted form.

- The encrypted form reuses kitty's public-key scheme ([[encryption]]) and embeds a
  timestamp, leaving the password neither exposed on the wire nor replayable outside a
  five-minute window.

## Facts

- 2021-09-13 (38a5e38f) statement: the original bypass transmits a SHA-256 hash of
  `request_id;password` in the bypass field rather than the password itself (code).

- 2021-09-13 (38a5e38f) rationale: the spec warns this hash does not actually hide the
  password and that a slower hash function would only add session-start latency,
  restricting plain hashing to trusted contexts (sourced).

- 2023-06-30 (aa86b98e) rationale: the `kitty-1` encrypted bypass was added alongside the
  hash precisely because the hash leaks the password and can be replayed; encrypting to the
  terminal's key with a timestamp closes both gaps (sourced).


## grapheme-cells

- A cell holds one base codepoint plus up to three combining marks; the marks are stored as 2-byte table indices, not as codepoints, and are expanded back to codepoints when the cell's text is read (`cc_idx`).

- A multi-codepoint grapheme — a base with combining marks, an emoji with a variation selector, or a ZWJ emoji sequence — settles into a single base cell carrying its marks, and a state query rebuilds the grapheme by emitting the base codepoint followed by each stored mark in order.

- Display width — zero, one, or two — lives in the cell's GPU attributes and is computed from the base codepoint when it is placed; a width-two character occupies two cells, the second a null placeholder with no base codepoint.

- A combining mark directed at the null trailing cell of a wide character is redirected onto that character's base cell, and a mark may not attach to an otherwise empty cell.

- A variation selector settles a base's width: an emoji-presentation selector on a default-text emoji widens its cell to two and relocates the character when it sits at the right margin, while a text-presentation selector narrows an emoji to width one.

## Facts

- 2018-05-27 (8dea5b3e) measurement: splitting the cell into a CPU half (base codepoint, combining marks, hyperlink) and a GPU half (colors, sprite, attributes) cut the data uploaded to the GPU per draw by about 30% and left room for CPU-only grapheme data such as more combining marks (sourced).

- 2022-04-28 (2b3be147) rationale: the per-cell combining-mark slots were raised from two to three to use padding already present in the CPU cell, at no extra memory cost (sourced).

- 2018-02-06 (9c874f66) statement: an emoji-presentation variation selector arriving after its base mutates the already-placed cell's width from one to two, so a cell's width can change after its base codepoint is stored (code).


## grapheme-cells / combining-mark-storage

- Combining marks are stored as 2-byte indices into a process-wide table that interns each distinct mark codepoint; a mark of any codepoint value occupies two bytes in the cell and is recovered through the table when read (`mark_for_codepoint`).

## Facts

- 2018-01-18 (32632264) statement: the intern table maps each mark codepoint to a 2-byte id and back, which is what lets a mark be held in two bytes regardless of its codepoint value (code).

## Moves

- 2018-01-18 (80301d46) replaced [[direct-codepoint-cc]]: storing the mark codepoint directly in two bytes could not represent marks above the basic plane, so marks are now held as indices into a table that can intern any codepoint (sourced).


## graphics-flow-control

- Total in-use image data is bounded by a per-buffer storage quota; when adding an image pushes usage over the quota, unreferenced images are dropped first, then the least-recently-used images are evicted until usage is back under the limit (`apply_storage_quota`).

- Animation frame data is held in the disk cache under a separate quota five times the base image quota.

- An image transmitted in chunks is accumulated in a growing RAM buffer until the terminating chunk arrives, and a single transmission is rejected once its accumulated data would exceed roughly 400 MB.

- Graphics command responses carry no dedicated throttle of their own; they are queued into the same per-window child write buffer as all other terminal output, and that buffer is what bounds output backpressure.

- A client can suppress responses with the quiet key: level 1 drops success responses, level 2 drops all responses.

## Facts

- 2021-01-31 rationale: the image storage quota guards against denial-of-service by image floods and is sized to still allow a few full-screen images (320 MB per buffer), per `docs/graphics-protocol.rst` (sourced).

- 2017-09-15 (32a11d9d) statement: graphics responses share the per-window child write buffer, which grows on demand and silently drops further data once it would exceed 100 MB (code).

- 2020-12-03 (23420adf) rationale: response suppression via the quiet key lets limited clients such as shell scripts avoid having to read and process the terminal's replies (sourced).


## graphics-flow-control / image-data-storage

- Decoded image pixel data is stored in a disk-backed cache rather than kept resident in process memory; the in-RAM load buffer is freed once the data has been written to the cache (`disk-cache`).

- The data is read back from the cache only when an image or animation frame is sent to the GPU for display.

- Frequently used cache entries may additionally be retained in RAM by the cache layer.

## Moves

- 2021-01-31 (5a182d3d) replaced [[in-ram-image-storage]]: the disk cache frees decoded image data from RAM after load and re-reads it from disk only when an image is displayed (code).


## input-event-loop

- Everything a child writes is interpreted by a single per-window state-machine parser that turns the raw byte stream into an ordered sequence of screen operations: runs of printable text, C0/C1 control codes, and escape / CSI / OSC / DCS / APC sequences (`parse_worker`).

- The parser consumes raw bytes directly rather than a pre-decoded codepoint stream; UTF-8 decoding and scanning for runs of printable text happen inside the parse loop and are accelerated with SIMD vector instructions.

- A child's output is parsed in arrival order on a single thread; screen mutations are applied in the exact order the child emitted them. This parser is the point at which a child's raw bursts of bytes become the single ordered stream the rest of the terminal reacts to.

- An in-progress escape, CSI, OSC or DCS sequence is accumulated in a bounded buffer; a sequence that grows past the cap is rejected rather than buffered without limit.

## Facts

- 2024-03-12 measurement: per the 0.33.0 changelog, the rewritten byte/SIMD parser is about 2x faster in benchmarks and 10-50% faster on real workloads than the previous parser and lowers CPU energy use; a `kitten __benchmark__` was added to measure terminal throughput (sourced).

- 2024-02-25 (4caf8a6b) pitfall: the byte-parser rewrite initially dropped support for the legacy alternate (G0/G1) character-set designation escape codes, which had to be restored the same day (code).

## Moves

- 2024-02-25 (5f809bf2) replaced [[codepoint-parser]]: parsing the raw byte stream with SIMD vector instructions processes data in parallel for roughly a 2x throughput speedup over dispatching pre-decoded codepoints one at a time (sourced).


## keyboard-protocol

- kitty defines its own opt-in, backward-compatible keyboard reporting protocol layered over the traditional terminal key encodings. By default the terminal emits the legacy escape codes; an application receives the richer encoding only after requesting it.

- A key event that produces text is delivered to the application as raw UTF-8 bytes; only an event that produces no text is encoded as an escape code.

- Richer reporting is decomposed into independent progressive-enhancement flag bits, each adding exactly one capability over the legacy baseline: disambiguate escape codes, report event types, report alternate keys, report all keys as CSI u escape codes, and report associated text.

- The full encoding packs one CSI sequence carrying the key's unicode keycode (and optional shifted and base-layout alternate keycodes), the active modifiers, the event type (press / repeat / release), and optionally the event's text as codepoints (`encode_glfw_key_event`).

- Legacy mode (no flags set) preserves the traditional codes: C0 bytes for ctrl+letter, an ESC prefix for alt, SS3 sequences for the cursor and F1-F4 keys in application-cursor mode, and the bare bytes 0x0d / 0x7f / 0x09 for Enter / Backspace / Tab.

## Facts

- 2021-01-16 (a30ea2b7) rationale: the protocol is based on the fixterms proposal but exists because that proposal had defects it corrects — no way to disambiguate Esc, mis-encoded shifted keys, alt/ctrl+letter codes that collide with other escape codes, no way to carry both shifted and unshifted keys for robust shortcut matching, and no alternate-layout key — per docs/keyboard-protocol.rst (sourced).

- 2021-01-16 (a30ea2b7) rationale: legacy escape codes stay the default because a vast body of existing terminal programs expect them and are not likely to ever be updated, leaving the richer encoding to be requested rather than imposed — per docs/keyboard-protocol.rst (sourced).

- 2021-01-16 (a30ea2b7) rationale: the disambiguate flag in particular fixes legacy codes that overlap with control codes — Esc emitting 0x1b, the start of an escape sequence, and alt/ctrl+letter emitting CSI-like bytes — by reporting those keys as CSI u sequences instead, per docs/keyboard-protocol.rst (sourced).

- 2021-01-17 (d45d553e) rationale: in legacy mode, when a non-US layout key is pressed with ctrl/alt and is not itself ASCII, the encoder falls back to the base-layout English key so that ctrl-based shortcuts still reach the program running in the terminal (sourced).

- 2022-12-24 (cd92d50a) pitfall: encoding the F3 key as a CSI sequence ending in R was removed from the protocol because it collides with the Cursor Position Report reply, which is also a CSI sequence ending in R (sourced).

- 2024-02-18 (b2391553) pitfall: the legacy special-case codes for Enter, Tab and Backspace are press-only; they must suppress release events when "report all keys as escape codes" is off, which they failed to do, emitting spurious release bytes (code).

- 2024-06-24 statement: before a key event is encoded for the child it is first offered to kitty's own shortcut and keyboard-mode dispatch via dispatch_possible_special_key; only an event not consumed as a shortcut is encoded and written to the child (code).


## keyboard-protocol / flag-stack

- The progressive-enhancement flags are not a single value but a stack: an application pushes a new flag set (CSI > flags u) and later pops back to the previous set (CSI < number u), in addition to outright setting (CSI = flags ; mode u) and querying (CSI ? u) the current set.

- The main screen and the alternate screen each keep their own independent flag stack; switching screen buffer switches which stack is current. Flags an application sets on the alternate screen neither affect the main screen nor survive its return to the main screen (`screen_push_key_encoding_flags`).

- The current flags are the top entry of the active stack; the stack has a fixed maximum depth, pushing onto a full stack evicts its oldest entry, and a pop that empties the stack resets all flags.

- Resetting the terminal clears both stacks.

## Facts

- 2021-01-16 (a30ea2b7) rationale: terminals must keep separate flag stacks for the main and alternate screens so that a full-screen application which enables flags on entering the alternate screen has them automatically restored when it exits, without having to track and undo them itself — per docs/keyboard-protocol.rst (sourced).

- 2021-01-16 (a30ea2b7) rationale: the stack depth is bounded and the oldest entry evicted when full specifically to prevent a denial-of-service from an application that pushes without ever popping — per docs/keyboard-protocol.rst (sourced).

- 2021-01-16 (a30ea2b7) statement: each stack holds 8 entries; a slot stores the 7-bit flag value plus a high "occupied" bit, and the current flags are read from the highest occupied slot (code).


## language-split

- The codebase is split across three languages with fixed roles: C for the
  performance-critical terminal core (screen model, escape parsing, PTY, GPU
  rendering), Python for high-level control, configuration, and UI
  orchestration, and Go for the standalone command-line tools.

- The C core is built into Python C-extension modules that the interpreter
  loads at runtime, not a free-standing C program (`fast_data_types`).

- The Go tools build into a single statically-linked `kitten` executable that
  runs on its own, with no Python interpreter in the process.

- One declarative option/config definition is the single source of truth from
  which the Python, the C, and the Go config parsers are all generated.

## Facts

- 2024-06-24 statement: the project states it is written in a mix of C for
  performance-sensitive parts, Python for extensibility and UI flexibility, and
  Go for the command-line kittens, depending on no large UI toolkit and using
  only OpenGL for rendering — `docs/overview.rst` (sourced).

- 2024-06-24 rationale: child-program interaction runs in a separate thread from
  rendering and the byte stream is parsed with vector CPU instructions, the
  workloads that put the terminal core in C — `docs/performance.rst` (sourced).

- 2017-09-15 (d4991424) statement: kitty runs a single Python thread and sets the
  interpreter thread-switch interval effectively to infinity, so Python is the
  serial control layer while the C core owns the concurrency (code).

## Moves

- 2022-11-14 (bbf75043) replaced [[python-cli-tools]]: the command-line tools and the `kitty @` remote-control client ran as Python, paying ~50-70ms of interpreter startup per invocation, while a single statically compiled Go binary runs the same commands in ~5ms and ships to any UNIX-like server as one standalone file (sourced).


## language-split / launcher

- The `kitty` program is a compiled C binary that embeds the CPython interpreter
  in-process and runs kitty's Python entry point from inside itself — it is not a
  `python kitty/main.py` invocation (kitty/launcher/main.c).

- The launcher pins interpreter pre-initialization before any Python runs: UTF-8
  mode, C-locale coercion, isolated mode, and a fixed bytecode optimization
  level, and sets the interpreter's executable to the kitty binary rather than
  python.

- Before initializing Python, the launcher inspects argv and, for remote-control
  (`@`) and wrapped-kitten invocations, directly execs the Go `kitten` binary
  rather than entering Python.

- A few common quick commands are parsed and answered in C with no interpreter
  started at all: version reporting, single-instance message passing, and the
  macOS `+open` path.

- The same launcher supports a frozen build that embeds a bundled Python home
  and pre-built extension modules.

## Facts

- 2024-06-24 statement: the embedded interpreter is driven through the CPython
  C-API rather than spawning a child python process, which lets the launcher own
  locale, isolation, argv, and the on-PATH name of the executable (code).

- 2024-06-23 (b5cf999d) measurement: answering `kitty --single-instance` in C —
  "No longer pay the overhead of starting the Python interpreter just to write a
  message to the single instance socket" — cut second-instance startup from 70ms
  to 3ms, ~25x (sourced).

- 2024-06-22 (581db0ab) measurement: answering `kitty --version` in C returns in
  ~3ms, reported as 1.23x faster than alacritty's (sourced).

- 2023-01-31 measurement: delegating to the Go `kitten` binary made `kitty @`
  remote-control commands ~10x faster, ~50ms down to ~5ms versus the prior
  Python client — `docs/changelog.rst` 0.27.0 (sourced).


## remote-control

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


## remote-control / encryption

- When a remote-control command carries a password, the whole JSON command is
  encrypted before it leaves the client; only the ciphertext, the initialization
  vector, the authentication tag, and the sender's public key travel in the clear.

- The symmetric key is derived by elliptic-curve Diffie–Hellman over Curve25519 and a
  single SHA-256 hash of the shared secret; the command is sealed with AES-256-GCM
  authenticated encryption.

- The receiving instance publishes its public key to child processes through an
  environment variable (`KITTY_PUBLIC_KEY`) that also carries the encryption protocol
  version.

- Every encrypted command includes a timestamp, and one whose timestamp is more than
  five minutes from the receiver's clock is discarded.

- An async-cancellation request is accepted even when unencrypted and
  unauthenticated.

## Facts

- 2022-08-03 (fd6bc55d) rationale: public-key crypto was built directly on OpenSSL
  rather than taking on a new dependency, as Python — already a kitty dependency —
  itself links OpenSSL (sourced).

- 2022-08-09 (2aee746d) statement: encryption is applied only when a password is in
  use; a command sent without a password travels as clear JSON (code).

- 2022-08-09 (2aee746d) rationale: a five-minute timestamp acceptance window serves as
  a nonce to minimise replay attacks, at the cost of requiring the two machines'
  clocks to roughly agree (sourced).

- 2022-09-01 (73259210) rationale: async-cancellation is exempt from authentication as
  it is emitted automatically on error or timeout and must never trigger a user
  permission prompt; a forged cancel can at most deny another request its result
  (sourced).


## remote-control / permissions

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


## screen-reflow

- On a window resize the on-screen text is re-wrapped to the new width by a single pass that copies cells from the old buffer into a fresh buffer of the new size, starting a new destination row only when the row fills or a hard line break is reached (`rewrap_inner`).

- The reflow unit is the logical line — a run of cells spanning the soft-wrap boundaries the old width imposed — and only a hard line break ends one; blank cells trailing a hard break are dropped.

- The visible buffer and the scrollback history are re-wrapped by the same code; rows that overflow the top of the visible buffer during reflow spill into scrollback, and growing the window can pull rows back from scrollback to refill the freed rows.

- The cursor and saved-cursor positions are carried through the pass itself rather than reconstructed afterward.

- The current shell prompt is exempted from reflow.

## Facts

- 2016-11-20 (5dccb919) statement: the rewrap pass is one macro template instantiated for both the visible LineBuf and the scrollback HistoryBuf, and the visible buffer's overflowing rows are appended to history as the pass produces them (code).


## screen-reflow / continuation-tracking

- Whether a displayed row continues onto the next row is recorded on the row's last cell, as a per-cell flag set when that cell is the soft-wrap point (`next_char_was_wrapped`).

- Reflow reads this last-cell flag to decide whether a source row continues the current logical line or starts a new one; the per-line continued attribute is derived from the previous row's last-cell flag on demand.

## Moves

- 2022-12-26 (68cf9f75) replaced [[per-line-continued-attr]]: tracking wrap on the line's last cell lets a newline leave the line's wrap status unchanged, matching other terminal emulators and as required by the fish shell (sourced).


## screen-reflow / cursor-tracking

- Cursor positions are followed through the reflow as the copy proceeds: each tracked position is updated to its destination coordinates at the moment its source cell is copied.

- The pass tracks an arbitrary set of positions at once; the active cursor and the saved cursor are both followed in a single reflow (`TrackCursor`).

- A tracked position past the trimmed end of its source line is clamped to the last real cell of that line before copying.

## Facts

- 2021-06-03 (c60a941d) statement: tracking was generalized from a single position to a null-terminated array of positions so the saved-cursor position is carried through reflow alongside the active cursor (code).

- 2022-10-31 (16b32261) pitfall: the destination column is advanced by one only when the source column is greater than zero, so a cursor resting at column 0 is not pushed to column 1 by reflow (code).

## Moves

- 2018-02-02 (2ee9844c) replaced [[heuristic-cursor-positioning]]: positioning the cursor by heuristic after a resize misplaced it, so the position is now followed during reflow and read off directly (sourced).


## screen-reflow / prompt-no-reflow

- The block from the current prompt's start down through the cursor is not re-wrapped: those rows are copied aside, blanked in place before the reflow, and the saved copy is written back unchanged after the resize.

- This applies only when the shell has announced that it redraws its own prompts; otherwise the prompt reflows like ordinary content.

- A placeholder character is written into the blanked prompt rows at or above the cursor.

## Facts

- 2021-08-18 (196200d0) rationale: the prompt is exempted because the shell redraws it after the resize and is thrown off if the cursor's vertical offset from the prompt's first line changes, as seen with zsh right-side prompts (sourced).

- 2024-04-12 (684d28d3) statement: restoring the old prompt adds copying work to every resize, accepted in exchange for steadier visuals (sourced).

## Moves

- 2024-04-12 (684d28d3) replaced [[blank-and-redraw-prompt]]: blanking the prompt left a visible gap until the shell redrew it, so the old prompt rows are now kept on screen unreflowed and the flicker is gone in the common case (sourced).


## scrollback

- The scrollback is a fixed-capacity ring of history lines indexed in reverse, where line 0 is the most recently scrolled-off line and the highest index is the oldest line still retained (`HistoryBuf`).

- Lines are stored in fixed-size segments of 2048 lines; a segment is allocated only when a line falling in it is first written, and the number of segments is capped at the configured line total. Under sustained output the buffer carves new segments until it is full, then reuses the slots as a ring.

- Each segment is a single allocation holding that segment's CPU cells, GPU cells, and per-line attributes one after another.

- When the buffer is full, pushing a new line first serializes the oldest line into the [[pager-history]] ring, then overwrites that slot and advances the ring's start.

- Clearing the scrollback frees every segment except the first, returning the high-water-mark memory rather than retaining it.

- Changing the configured number of lines is done by allocating a fresh buffer and rewrapping the retained lines into it, not by resizing the existing storage in place.

## Facts

- 2021-04-10 (63e5be6f) rationale: segment memory is taken from libc `malloc`/`calloc` rather than the Python object allocator, which is not optimized for allocations this large (sourced).

## Moves

- 2018-05-03 (3f316c39) replaced [[preallocated-history-buffer]]: pre-allocating the whole configured buffer at startup consumed too much memory at very large scrollback sizes (sourced).


## scrollback / pager-history

- A secondary ring buffer (`pagerhist`) retains the raw text of lines after they are evicted from the full main buffer, extending what the scrollback pager can show beyond the main buffer's line count.

- Each retained line is stored as its SGR/ANSI-formatted text, UTF-8 encoded, prefixed with an attribute-reset sequence and terminated by a carriage return, plus a line feed unless the line was wrapped.

- The backing store is bounded by a configured maximum size; it starts at up to 1 MB and grows in steps of at least 1 MB until that maximum, after which it overwrites its oldest bytes.

- The buffer is retained across a window resize, and its contents are rewrapped to the new width when the column count changes.

- It is emptied and shrunk back to its initial size whenever the main scrollback is cleared.

## Facts

- 2020-09-21 (b5007ba2) rationale: text is stored UTF-8 encoded rather than as 4-byte UCS-4 code points, cutting the storage requirement about 4x at the cost of encoding CPU (sourced).


## search-parser

- The unicode-name search splits the query on whitespace into terms, lowercases each, and matches it against the index of name-words by prefix (`marks_for_query`).

- A codepoint is returned only when it carries a word matching every term: the per-term codepoint sets are combined by intersection, not union.

## Facts

- 2023-02-14 (53e33a80) statement: combining terms by intersection is intentional — the query test asserts "horiz ell" returns only codepoints whose name has both a "horiz"-prefixed and an "ell"-prefixed word (e.g. HORIZONTAL ELLIPSIS), making a codepoint that matches just one of the terms excluded by design rather than by a bug (code).

## Moves

- 2023-02-15 (ac5298ce) dropped: the substring-containment fallback for a term that prefix-matches no indexed word: the Go port combines terms by pure set intersection and no longer filters the current candidates by substring as the Python kitten did (code).


## shell-integration

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


## ssh-kitten

- The ssh kitten is a thin wrapper around the system ssh program (`kitten ssh`): it
  forwards ssh's own arguments and hostname syntax, then sets the remote session up
  to mirror the local shell.

- It has ssh run a generated bootstrap script on the remote — POSIX sh by default,
  optionally Python — wrapped as `interpreter -c unwrap-script escaped-script` to
  survive whatever login shell the remote account uses.

- The bootstrap installs, from one gzip-compressed tar archive delivered over the TTY,
  kitty's terminfo, the shell-integration tree, any configured copied files and
  environment, and on demand the kitten binary, then execs the login shell with shell
  integration enabled.

- Per-host setup is driven by `ssh.conf` and `--kitten` overrides matched on
  hostname/username, with each hostname block reset to defaults rather than inheriting
  from an earlier match.

- How the archive and its credentials reach the remote is [[data-passing]]; connection
  setup is shared across sessions to one host via [[connection-sharing]].

- It can forward kitty's remote-control socket to a host, off by default and meant only
  for hosts the user explicitly trusts.

## Facts

- 2022-03-04 (fe27ee2d) rationale: the remote interpreter defaults to POSIX sh but can be
  set to Python; Python is recommended for BSD hosts whose default shells are too
  crippled to run the sh bootstrap reliably (sourced).

- 2023-08-04 (1f9852d7) statement: remote-control forwarding tunnels the socket named by
  KITTY_LISTEN_ON through an ssh ControlMaster, requires [[connection-sharing]], and
  refuses abstract UNIX sockets because OpenSSH cannot forward them (code).

- 2023-08-04 (1f9852d7) rationale: forwarding is opt-in per host and documented as
  dangerous, granting any software on the remote full access to the local computer
  (sourced).

## Moves

- 2022-02-23 (ddb87535) replaced [[inline-terminfo-script]]: a script baked into the ssh
  command line can carry only the terminfo, while remote shell integration, arbitrary
  copied files and an on-demand kitten binary need an out-of-band channel, met by a
  bootstrap script that pulls a tar archive over the TTY (sourced).


## ssh-kitten / connection-sharing

- Within one kitty instance, every session to a given server rides one shared ssh
  connection set up with `ControlMaster=auto`; only the first session pays connection and
  authentication latency.

- The kitten starts or reuses the master with a ControlPath under the runtime dir,
  ControlPersist, and keep-alive pings, and kitty tears every master down when it exits.

- A `close_shared_ssh_connections` action drops all active shared connections on demand.

## Facts

- 2022-03-09 (577de9f7) rationale: connections are shared to cut startup latency for later
  sessions and to require the password only once, using ssh ControlMasters that kitty
  cleans up on quit (sourced).

- 2022-03-10 (31d9db7e) rationale: the control sockets are kept under XDG_RUNTIME_DIR,
  which the OS auto-cleans on reboot (sourced).

- 2022-03-10 (f2d6ba87) pitfall: a long runtime-dir path is swapped for a short
  `/tmp/kssh-rdir-<uid>` symlink, keeping the ControlPath socket under the ~104-byte path
  limit OpenSSH and macOS impose on UNIX sockets (code).


## ssh-kitten / data-passing

- The remote bootstrap reads its whole setup payload — the gzip tar archive of terminfo,
  shell integration, copied files and env — as base64 lines arriving over the TTY.

- kitty hands that payload back only to a requester presenting a one-time password that
  matches a copy the kitten left in process-owned, mode-0600 POSIX shared memory
  (`kitty/shm.py`), along with the per-window request id `KITTY_PID-KITTY_WINDOW_ID`; the
  shared-memory object is owner-checked and unlinked on first read.

- When ssh can be kept from touching the terminal before the connection is up, the kitten
  pushes the data request itself with no wait; otherwise the remote script emits the
  request and one extra round-trip is paid.

- A live shared master ([[connection-sharing]]) likewise lets the kitten push the request
  without waiting.

## Facts

- 2022-03-10 (20962d98) statement: the payload and one-time password moved from an on-disk
  tmpfile in the cache dir to POSIX shared memory, unlinked immediately after it is
  written (code).

- 2022-03-10 (20962d98) rationale: no commit or doc records why shared memory was chosen
  over the tmpfile; the likeliest motive is keeping the sensitive env and credential blob
  off disk, but that reading is a guess (uncertain).

- 2022-03-13 (2b06ca5e) rationale: pushing the data request from the local side instead of
  waiting for the remote to ask removes one round-trip from connection setup (sourced).

- 2022-03-15 (5099dd6a) rationale: the push is taken only when ssh will not use the
  terminal before the connection — via kitty's own askpass or an OpenSSH new enough for
  SSH_ASKPASS_REQUIRE — otherwise the remote must request the data and pay the round-trip
  (sourced).

- 2022-03-13 (74f0057e) pitfall: the archive is streamed back in lines of at most 254
  bytes, fitting under the 255-byte TTY input-queue cap macOS enforces in canonical mode
  (code).


## startup-init

- Startup runs a fixed sequence: resolve configuration, set up process
  environment and locale, mask signals process-wide, initialize the
  windowing/GPU backend, then create the first OS window and enter the
  render/IO loop (kitty/main.py).

- Configuration is resolved first, before any window, GPU, or font work; the
  resolved options are the inputs to backend selection, font setup, and window
  creation.

- Configuration comes from a single human-editable file, kitty.conf, located by
  checking KITTY_CONFIG_DIRECTORY then the XDG/platform config directories; when
  no such file exists the built-in defaults are used unchanged.

- Signals are masked process-wide before the display backend is initialized, and
  only kitty's main thread handles them.

- GPU context creation ([[gpu-context]]) and font setup ([[font-setup]]) each
  happen once, up front, and the entry point is reached only after the embedded
  interpreter is already running ([[launcher]]).

## Facts

- 2024-06-24 statement: the configuration is intentionally a single
  human-editable file for easy reproducibility and source control —
  `docs/overview.rst` (sourced).

- 2022-12-07 (9cb0e4d0) pitfall: handled signals are blocked early, before GLFW
  is initialized, because the graphics libraries may start threads behind
  kitty's back that must default to having those signals blocked (issue 4636)
  (sourced).

- 2024-06-24 pitfall: font data must be freed before glfw/freetype/fontconfig/
  opengl are finalized, so font teardown is ordered ahead of backend
  finalization on shutdown (code).


## startup-init / font-setup

- The font system is split by platform: CoreText does font listing, matching,
  and rasterization on macOS, while fontconfig (matching) plus FreeType
  (rasterization) do them on Linux/BSD.

- A platform-independent C core sits above both backends and owns cell metrics,
  the per-glyph alpha-mask cache, fallback selection, and HarfBuzz shaping
  (kitty/fonts.c).

- Only monospace, freely scalable (non-bitmap) fonts are usable, since every
  cell in the grid is the same fixed size and glyphs are cached as resizable
  alpha masks.

- The configured families for regular, bold, italic, and bold-italic, plus
  per-Unicode-range symbol maps, are resolved into concrete faces at startup
  before the first window is shown.

- A glyph absent from the selected faces triggers an on-demand fallback-face
  lookup, and the result is memoized for reuse.

## Facts

- 2024-06-24 rationale: kitty caches alpha masks of each rendered glyph on the
  GPU and renders them in parallel, which makes it a strictly cell-based display
  usable only with monospace, non-bitmap fonts — `docs/faq.rst` (sourced).

- 2024-06-24 statement: the macOS-vs-Linux font backend is selected at
  import time from the platform, choosing the CoreText or the
  fontconfig/FreeType module (code).


## startup-init / gpu-context

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


# Rejected / superseded alternatives (kept for the reasons they lost)


## REJECTED: child-monitor / spawn / sigwinch-ready — sigwinch-ready

- The forked child waits for kitty's screen-ready notification by installing a SIGWINCH handler and `sigsuspend()`-ing until the signal is delivered.

## Moves

- 2018-08-04 (eb2ec183) replaced by [[ready-sync]]: a pipe is simpler and more robust since there is no longer a race between the installation of the signal handler and the dispatch of the signal (sourced).


## REJECTED: child-monitor / wakeup-per-chunk — wakeup-per-chunk

- The I/O thread wakes the main render thread once per loop iteration whenever any child output was read, with no rate limiting.

## Moves

- 2018-10-23 (40b355e5) replaced by [[wakeup-coalescing]]: processing wakeup events is very expensive on platforms such as Cocoa, so debounce main-loop wakeups by input_delay instead of waking on every chunk of child output (sourced).


## REJECTED: in-memory-text — in-memory-text

- The clipboard holds a single value: the selection text decoded as one UTF-8 string.

- OSC 52 is parsed inline in the window — the base64 payload is decoded to text and
  stored, or the stored text is base64-encoded back to the program on a read.

- Only text/plain is supported; there is no notion of MIME type.

- An over-long chunked paste is accumulated in memory and discarded wholesale once it
  exceeds the clipboard_max_size option.

## Moves

- 2022-11-28 (a8725d63) replaced by [[clipboard]]: the single UTF-8 text string held
  only one text/plain selection and could carry neither arbitrary MIME types such as
  images or rich text nor large payloads spilled to disk (code).


## REJECTED: grapheme-cells / direct-codepoint-cc — direct-codepoint-cc

- Each combining mark is stored as its raw codepoint in a 2-byte cell field, limiting stored marks to the basic multilingual plane.

## Moves

- 2018-01-18 (80301d46) replaced by [[combining-mark-storage]]: storing the mark codepoint directly in two bytes could not represent marks above the basic plane, so marks are now held as indices into a table that can intern any codepoint (sourced).


## REJECTED: graphics-flow-control / in-ram-image-storage — in-ram-image-storage

- Decoded image pixel data is retained in process memory after loading and freed only when the image itself is removed (`load_data`).

- The total retained image data is bounded by the storage quota, which evicts the least-recently-used images when exceeded.

## Moves

- 2021-01-31 (5a182d3d) replaced by [[image-data-storage]]: the disk cache frees decoded image data from RAM after load and re-reads it from disk only when an image is displayed (code).


## REJECTED: codepoint-parser — codepoint-parser

- A child's output is first decoded from bytes into a UTF-32 codepoint stream, which the parser then dispatches one codepoint at a time through mode-based handlers (normal / escape / CSI / OSC) (`dispatch_normal_mode_char`).

- CSI and OSC sequences are accumulated as buffers of decoded codepoints (uint32_t) and converted to integer parameters per sequence.

## Moves

- 2024-02-25 (b083ad90) replaced by [[input-event-loop]]: parsing the raw byte stream with SIMD vector instructions processes data in parallel for roughly a 2x throughput speedup over dispatching pre-decoded codepoints one at a time (sourced).


## REJECTED: python-cli-tools — python-cli-tools

- The command-line tools — the `kitty @` remote-control client, ssh, clipboard,
  image display, and the other non-interactive kittens — are implemented in
  Python.

- Running any such tool starts a full Python interpreter and imports the kitty
  package before the command itself executes.

## Moves

- 2022-11-14 (bbf75043) replaced by [[language-split]]: the command-line tools and the `kitty @` remote-control client ran as Python, paying ~50-70ms of interpreter startup per invocation, while a single statically compiled Go binary runs the same commands in ~5ms and ships to any UNIX-like server as one standalone file (sourced).


## REJECTED: screen-reflow / per-line-continued-attr — per-line-continued-attr

- Whether a row continues onto the next is stored as one per-line attribute bit, set when the row soft-wraps and cleared at a hard break.

- Reflow reads this per-line bit to decide logical-line membership.

## Moves

- 2022-12-26 (68cf9f75) replaced by [[continuation-tracking]]: tracking wrap on the line's last cell lets a newline leave the line's wrap status unchanged, matching other terminal emulators and as required by the fish shell (sourced).


## REJECTED: screen-reflow / heuristic-cursor-positioning — heuristic-cursor-positioning

- After the buffer is re-wrapped, the cursor is repositioned by heuristic from its old coordinates rather than followed through the wrap.

## Moves

- 2018-02-02 (2ee9844c) replaced by [[cursor-tracking]]: positioning the cursor by heuristic after a resize misplaced it, so the position is now followed during reflow and read off directly (sourced).


## REJECTED: screen-reflow / blank-and-redraw-prompt — blank-and-redraw-prompt

- The current prompt's rows are blanked before reflow and left empty, relying on the shell to redraw the prompt after the resize.

## Moves

- 2024-04-12 (684d28d3) replaced by [[prompt-no-reflow]]: blanking the prompt left a visible gap until the shell redrew it, so the old prompt rows are now kept on screen unreflowed and the flicker is gone in the common case (sourced).


## REJECTED: preallocated-history-buffer — preallocated-history-buffer

- The scrollback lines are held in one contiguous buffer sized for the full configured line count at construction time, with a parallel array of per-line attributes.

- The configured number of lines is changed in place by allocating a new buffer of the requested size and copying the retained lines across (`change_num_of_lines`).

## Moves

- 2018-05-03 (3f316c39) replaced by [[scrollback]]: pre-allocating the whole configured buffer at startup consumed too much memory at very large scrollback sizes (sourced).


## REJECTED: rc-file-modification — rc-file-modification

- kitty enables shell integration by editing the user's shell rc files (e.g. ~/.zshrc, ~/.bashrc) in place to source its integration script, creating the rc file when absent and rewriting it atomically while preserving the original's stat attributes.

## Moves

- 2021-11-27 (f6e0eb40) replaced by [[shell-integration]]: load the integration through env vars that redirect the shell's own startup, so the normal startup files are still sourced and kitty never modifies the user's dotfiles (sourced).


## REJECTED: inline-terminfo-script — inline-terminfo-script

- The kitten passes ssh a single inline /bin/sh script as the remote command; the script
  carries kitty's terminfo embedded in its own text.

- On the remote the script compiles that terminfo into `~/.terminfo` with `tic`, then
  execs the user's login shell — it does no other setup.

- All payload travels inside the ssh command line itself; nothing is requested back over
  the TTY and no archive, shell integration, file copy, env, or credential exchange
  exists.

## Moves

- 2022-02-23 (ddb87535) replaced by [[ssh-kitten]]: a script baked into the ssh command
  line can carry only the terminfo, while remote shell integration, arbitrary copied
  files and an on-demand kitten binary need an out-of-band channel, met by a bootstrap
  script that pulls a tar archive over the TTY (sourced).
