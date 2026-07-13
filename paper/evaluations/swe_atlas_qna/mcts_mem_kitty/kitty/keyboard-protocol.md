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
