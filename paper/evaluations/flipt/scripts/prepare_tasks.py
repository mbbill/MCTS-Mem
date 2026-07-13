#!/usr/bin/env python3
"""Snapshot Flipt rows from public SWE-bench Pro into the paper workspace."""

from __future__ import annotations

import json
from pathlib import Path

from datasets import load_dataset


ROOT = Path(__file__).resolve().parents[1]
TASKS_DIR = ROOT / "tasks"
REPO = "flipt-io/flipt"


def main() -> None:
    TASKS_DIR.mkdir(parents=True, exist_ok=True)
    dataset = load_dataset("ScaleAI/SWE-bench_Pro", split="test")
    rows = [dict(row) for row in dataset if row["repo"] == REPO]
    rows.sort(key=lambda row: row["instance_id"])

    tasks_path = TASKS_DIR / "flipt_swebench_pro_tasks.jsonl"
    tasks_path.write_text("".join(json.dumps(row, sort_keys=True) + "\n" for row in rows), encoding="utf-8")

    index = [
        {
            "instance_id": row["instance_id"],
            "repo": row["repo"],
            "base_commit": row["base_commit"],
            "dockerhub_tag": row.get("dockerhub_tag"),
            "docker_image": f"jefzda/sweap-images:{row['dockerhub_tag']}" if row.get("dockerhub_tag") else None,
        }
        for row in rows
    ]
    (TASKS_DIR / "task_index.json").write_text(json.dumps(index, indent=2), encoding="utf-8")

    metadata = {
        "dataset": "ScaleAI/SWE-bench_Pro",
        "split": "test",
        "repo": REPO,
        "task_count": len(rows),
        "tasks_path": str(tasks_path),
    }
    (TASKS_DIR / "snapshot_metadata.json").write_text(json.dumps(metadata, indent=2, sort_keys=True), encoding="utf-8")

    print(f"wrote {len(rows)} {REPO} tasks to {tasks_path}")


if __name__ == "__main__":
    main()
