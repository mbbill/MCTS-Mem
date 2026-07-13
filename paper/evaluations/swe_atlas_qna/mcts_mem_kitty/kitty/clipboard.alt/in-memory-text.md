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
