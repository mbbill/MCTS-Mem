- Total in-use image data is bounded by a per-buffer storage quota; when adding an image pushes usage over the quota, unreferenced images are dropped first, then the least-recently-used images are evicted until usage is back under the limit (`apply_storage_quota`).

- Animation frame data is held in the disk cache under a separate quota five times the base image quota.

- An image transmitted in chunks is accumulated in a growing RAM buffer until the terminating chunk arrives, and a single transmission is rejected once its accumulated data would exceed roughly 400 MB.

- Graphics command responses carry no dedicated throttle of their own; they are queued into the same per-window child write buffer as all other terminal output, and that buffer is what bounds output backpressure.

- A client can suppress responses with the quiet key: level 1 drops success responses, level 2 drops all responses.

## Facts

- 2021-01-31 rationale: the image storage quota guards against denial-of-service by image floods and is sized to still allow a few full-screen images (320 MB per buffer), per `docs/graphics-protocol.rst` (sourced).

- 2017-09-15 (32a11d9d) statement: graphics responses share the per-window child write buffer, which grows on demand and silently drops further data once it would exceed 100 MB (code).

- 2020-12-03 (23420adf) rationale: response suppression via the quiet key lets limited clients such as shell scripts avoid having to read and process the terminal's replies (sourced).
