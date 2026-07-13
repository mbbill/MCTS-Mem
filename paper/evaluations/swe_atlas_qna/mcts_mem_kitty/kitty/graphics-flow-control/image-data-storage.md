- Decoded image pixel data is stored in a disk-backed cache rather than kept resident in process memory; the in-RAM load buffer is freed once the data has been written to the cache (`disk-cache`).

- The data is read back from the cache only when an image or animation frame is sent to the GPU for display.

- Frequently used cache entries may additionally be retained in RAM by the cache layer.

## Moves

- 2021-01-31 (5a182d3d) replaced [[in-ram-image-storage]]: the disk cache frees decoded image data from RAM after load and re-reads it from disk only when an image is displayed (code).
