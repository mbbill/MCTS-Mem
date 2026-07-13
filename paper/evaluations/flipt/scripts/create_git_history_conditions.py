#!/usr/bin/env python3
"""Create Flipt condition datasets for live cutoff-git baselines.

This script intentionally writes new condition names only. It does not modify
the earlier GPT-5.5 `C1_raw_git`/`C4_mcts_mem_top8w900` datasets or results.
"""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]

GIT_HISTORY_NOTE = """# Cutoff git-history access

This benchmark container includes a `.git` history reconstructed only from commits reachable from this task's `base_commit`. You may inspect that local history with normal git commands such as `git log`, `git show`, `git blame`, and revision-qualified `git grep` when it helps. No post-cutoff commits are present.
"""


def load_jsonl(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


def write_jsonl(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("".join(json.dumps(row, sort_keys=True) + "\n" for row in rows))


def main() -> None:
    c0_rows = load_jsonl(ROOT / "datasets" / "C0.jsonl")
    c4_rows = load_jsonl(ROOT / "datasets" / "C4_mcts_mem_top8w900.jsonl")
    c4_by_id = {row["instance_id"]: row for row in c4_rows}

    out_conditions = ROOT / "conditions"
    for condition in ["C1_git_history", "C4_git_history_mcts_mem"]:
        directory = out_conditions / condition
        directory.mkdir(parents=True, exist_ok=True)
        for old in directory.glob("*.md"):
            old.unlink()

    c1_rows: list[dict] = []
    c4_git_rows: list[dict] = []
    index: list[dict] = []

    for row in c0_rows:
        instance_id = row["instance_id"]
        original_problem = row["problem_statement"]

        c1_context = GIT_HISTORY_NOTE.strip() + "\n"
        (out_conditions / "C1_git_history" / f"{instance_id}.md").write_text(c1_context)
        c1_row = dict(row)
        c1_row["problem_statement"] = c1_context + "\n---\n\n" + original_problem
        c1_rows.append(c1_row)

        c4_existing = c4_by_id[instance_id]["problem_statement"]
        marker = "\n\n---\n\n"
        mcts_context = c4_existing.split(marker, 1)[0] if marker in c4_existing else ""
        c4_context = GIT_HISTORY_NOTE.strip() + "\n\n" + mcts_context.strip() + "\n"
        (out_conditions / "C4_git_history_mcts_mem" / f"{instance_id}.md").write_text(c4_context)
        c4_row = dict(row)
        c4_row["problem_statement"] = c4_context + "\n---\n\n" + original_problem
        c4_git_rows.append(c4_row)

        index.append(
            {
                "instance_id": instance_id,
                "C1_git_history_context_words": len(c1_context.split()),
                "C4_git_history_mcts_mem_context_words": len(c4_context.split()),
            }
        )

    write_jsonl(ROOT / "datasets" / "C1_git_history.jsonl", c1_rows)
    write_jsonl(ROOT / "datasets" / "C4_git_history_mcts_mem.jsonl", c4_git_rows)
    (ROOT / "conditions" / "git_history_context_index.json").write_text(json.dumps(index, indent=2, sort_keys=True))
    print(f"generated C1_git_history and C4_git_history_mcts_mem for {len(c0_rows)} tasks")


if __name__ == "__main__":
    main()
