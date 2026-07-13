#!/usr/bin/env python3
"""Pre-pull Flipt SWE-bench Pro task images for stable generation/grading."""

from __future__ import annotations

import argparse
import concurrent.futures
import json
from pathlib import Path
import subprocess
import time


ROOT = Path(__file__).resolve().parents[1]
TASKS = ROOT / "tasks" / "flipt_swebench_pro_tasks.jsonl"


def image_exists(image: str) -> bool:
    return subprocess.run(["docker", "image", "inspect", image], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0


def pull(image: str, *, force: bool) -> dict[str, object]:
    started = time.time()
    if image_exists(image) and not force:
        return {"image": image, "status": "cached", "elapsed_seconds": 0.0}
    proc = subprocess.run(
        ["docker", "pull", "--platform", "linux/amd64", image],
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )
    return {
        "image": image,
        "status": "pulled" if proc.returncode == 0 else "failed",
        "returncode": proc.returncode,
        "elapsed_seconds": time.time() - started,
        "output_tail": proc.stdout[-4000:],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tasks", type=Path, default=TASKS)
    parser.add_argument("--workers", type=int, default=3)
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--log", type=Path, default=ROOT / "logs" / "pull_task_images.jsonl")
    args = parser.parse_args()

    rows = [json.loads(line) for line in args.tasks.read_text().splitlines() if line.strip()]
    images = sorted({f"jefzda/sweap-images:{row['dockerhub_tag']}" for row in rows})
    (ROOT / "tasks" / "docker_images.txt").write_text("\n".join(images) + "\n")
    args.log.parent.mkdir(parents=True, exist_ok=True)

    print(f"images={len(images)} workers={args.workers} log={args.log}", flush=True)
    with args.log.open("a") as log_file:
        with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
            futures = {pool.submit(pull, image, force=args.force): image for image in images}
            for future in concurrent.futures.as_completed(futures):
                result = future.result()
                log_file.write(json.dumps(result, sort_keys=True) + "\n")
                log_file.flush()
                print(f"{result['status']} {result['image']} elapsed={result['elapsed_seconds']:.1f}s", flush=True)
                if result["status"] == "failed":
                    raise SystemExit(f"docker pull failed for {result['image']}")


if __name__ == "__main__":
    main()
