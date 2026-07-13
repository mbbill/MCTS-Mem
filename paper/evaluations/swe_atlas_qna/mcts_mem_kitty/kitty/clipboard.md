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
