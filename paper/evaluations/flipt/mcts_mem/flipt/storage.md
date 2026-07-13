- Storage is exposed through environment-scoped repositories, with filesystem and Git implementations behind shared storage interfaces (`storage.Store`).

- A storage environment carries both the data view used for reads and the update path used for writes.

