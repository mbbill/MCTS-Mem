#!/usr/bin/env python3
"""Write fixed commit windows for the Flipt MCTS-Mem history sweep."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import subprocess


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_REPO = ROOT.parents[1] / "repos" / "flipt"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path, default=DEFAULT_REPO)
    parser.add_argument("--output", type=Path, default=ROOT / "extraction" / "history_windows.json")
    parser.add_argument("--window-size", type=int, default=15)
    args = parser.parse_args()

    raw = subprocess.check_output(
        ["git", "-C", str(args.repo), "log", "--reverse", "--format=%H%x09%h%x09%cs%x09%s"],
        text=True,
    )
    commits = []
    for seq, line in enumerate(raw.splitlines(), 1):
        full_hash, short_hash, date, subject = line.split("\t", 3)
        commits.append({"seq": seq, "hash": full_hash, "short": short_hash, "date": date, "subject": subject})

    windows = []
    for start in range(0, len(commits), args.window_size):
        chunk = commits[start : start + args.window_size]
        windows.append(
            {
                "window": f"win-{len(windows) + 1:04d}",
                "seq_start": chunk[0]["seq"],
                "seq_end": chunk[-1]["seq"],
                "commit_count": len(chunk),
                "first_hash": chunk[0]["hash"],
                "last_hash": chunk[-1]["hash"],
                "first_date": chunk[0]["date"],
                "last_date": chunk[-1]["date"],
                "commits": chunk,
            }
        )

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps({"window_size": args.window_size, "commit_count": len(commits), "windows": windows}, indent=2))
    print(f"wrote {len(windows)} windows for {len(commits)} commits to {args.output}")


if __name__ == "__main__":
    main()
