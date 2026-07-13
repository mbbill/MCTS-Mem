- Decoded image pixel data is retained in process memory after loading and freed only when the image itself is removed (`load_data`).

- The total retained image data is bounded by the storage quota, which evicts the least-recently-used images when exceeded.

## Moves

- 2021-01-31 (5a182d3d) replaced by [[image-data-storage]]: the disk cache frees decoded image data from RAM after load and re-reads it from disk only when an image is displayed (code).
