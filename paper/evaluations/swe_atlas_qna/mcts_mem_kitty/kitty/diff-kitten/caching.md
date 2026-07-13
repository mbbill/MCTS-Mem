- A file's contents pass through a chain of per-path memoizing caches — raw bytes, then sanitized split lines, then syntax-highlighted lines — each computed at most once per run (`highlighted_lines_cache`).

- The diff is painted immediately using the plain split lines; syntax highlighting of all changed text files runs on a background goroutine and replaces the plain lines once it completes.

- Cached highlighted lines are used for a file only while their count equals that file's plain-line count; otherwise the plain lines are shown.

## Facts

- 2023-03-21 (c2e549b7) rationale: highlighting was made asynchronous and run in parallel across files specifically to keep the initial diff paint from blocking on per-file syntax highlighting (code).

- 2023-03-23 (9c188096) pitfall: highlighting a file can yield a different number of lines than the plain split, and rendering indexes the plain and highlighted lines in lockstep, so the highlighted cache is honored only when the two line counts match (code).
