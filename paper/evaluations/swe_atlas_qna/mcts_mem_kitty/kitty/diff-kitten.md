- The diff kitten compares two directory trees by pairing their entries on each entry's path relative to its root (`collect_files`); a name present in both trees is reported as a change when the contents differ.

- A file present on only one side is reported as a rename of an unpaired file on the other side only when their contents are byte-identical; with no identical counterpart it becomes a standalone add or removal.

- Rename candidates are found by matching the content hash of each removed file against the added files, then confirmed by a full byte comparison before pairing.

- Two paired files whose contents are identical but whose file modes differ are reported as a change.

## Facts

- 2023-03-27 (e4d936b5) rationale: rename detection deliberately uses exact content identity rather than git-style similarity scoring; no commit or doc records why that trade-off was chosen over a similarity threshold (uncertain).
