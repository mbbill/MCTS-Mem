- The unicode-name search splits the query on whitespace into terms, lowercases each, and matches it against the index of name-words by prefix (`marks_for_query`).

- A codepoint is returned only when it carries a word matching every term: the per-term codepoint sets are combined by intersection, not union.

## Facts

- 2023-02-14 (53e33a80) statement: combining terms by intersection is intentional — the query test asserts "horiz ell" returns only codepoints whose name has both a "horiz"-prefixed and an "ell"-prefixed word (e.g. HORIZONTAL ELLIPSIS), making a codepoint that matches just one of the terms excluded by design rather than by a bug (code).

## Moves

- 2023-02-15 (ac5298ce) dropped: the substring-containment fallback for a term that prefix-matches no indexed word: the Go port combines terms by pure set intersection and no longer filters the current candidates by substring as the Python kitten did (code).
