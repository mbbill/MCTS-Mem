#!/usr/bin/env python3
"""Grade Flipt SWE-bench Pro predictions with task-provided Docker images.

Flipt rows in SWE-bench Pro expose Go test names in ``fail_to_pass``. This
local grader replays each row's ``before_repo_set_cmd``, applies the model
patch, then runs targeted ``go test ./... -run`` chunks inside the task image.
It is a paper-side sanity grader; the official harness remains the authority.
"""

from __future__ import annotations

import argparse
import ast
import concurrent.futures
import json
from pathlib import Path
import re
import shutil
import subprocess
import time
from typing import Any


ROOT = Path(__file__).resolve().parents[1]

# Some Flipt SWE-bench Pro tests intentionally contact BadSSL to exercise TLS
# failure behavior. The local Docker DNS path can fail before TLS on this host,
# so pin the known BadSSL endpoint and let the test observe the certificate error.
BADSSL_ADD_HOST = "self-signed.badssl.com:104.154.89.105"

CONTAINER_GRADER = r'''
from __future__ import annotations

import ast
import json
from pathlib import Path
import re
import subprocess
import time


ROOT = Path("/grader")
APP = Path("/app")


def parse_list(value):
    if isinstance(value, list):
        return value
    if value in (None, ""):
        return []
    try:
        return json.loads(value)
    except Exception:
        parsed = ast.literal_eval(value)
    if not isinstance(parsed, list):
        raise TypeError(f"Expected list-like value, got {type(parsed).__name__}")
    return parsed


def run_command(name, argv, *, shell=False, timeout=None):
    started = time.time()
    proc = subprocess.run(
        argv,
        cwd=APP,
        shell=shell,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        timeout=timeout,
    )
    elapsed = time.time() - started
    log_path = ROOT / f"{name}.log"
    command_text = argv if isinstance(argv, str) else " ".join(argv)
    log_path.write_text(
        f"$ {command_text}\n"
        f"returncode={proc.returncode} elapsed={elapsed:.3f}s\n\n"
        f"{proc.stdout}",
        errors="replace",
    )
    return {
        "name": name,
        "returncode": proc.returncode,
        "elapsed_seconds": elapsed,
        "log": str(log_path),
    }


def run_setup(meta):
    setup_results = []
    for idx, line in enumerate(meta["before_repo_set_cmd"].splitlines()):
        line = line.strip()
        if not line:
            continue
        result = run_command(f"setup_{idx:02d}", line, shell=True, timeout=180)
        setup_results.append(result)
        if result["returncode"] != 0:
            return False, setup_results
    return True, setup_results


def go_test_pattern(selectors):
    escaped = [re.escape(selector) for selector in selectors if selector]
    if not escaped:
        return "^$"
    return "^(" + "|".join(escaped) + ")$"


def run_go_tests(label, selectors, *, timeout_per_chunk, chunk_size):
    chunks = [selectors[i:i + chunk_size] for i in range(0, len(selectors), chunk_size)]
    results = []
    for idx, chunk in enumerate(chunks):
        argv = ["go", "test", "./...", "-run", go_test_pattern(chunk), "-count=1"]
        result = run_command(f"go_test_{label}_{idx:03d}", argv, timeout=timeout_per_chunk)
        result["selector_count"] = len(chunk)
        results.append(result)
    return {
        "selector_count": len(selectors),
        "chunk_count": len(chunks),
        "passed": all(result["returncode"] == 0 for result in results),
        "chunks": results,
    }


def main():
    meta = json.loads((ROOT / "meta.json").read_text())
    fail_to_pass = parse_list(meta["fail_to_pass"])
    pass_to_pass = parse_list(meta["pass_to_pass"])
    started = time.time()
    report = {
        "instance_id": meta["instance_id"],
        "docker_image": meta["docker_image"],
        "status": "started",
        "resolved": False,
        "fail_to_pass": {"selector_count": len(fail_to_pass)},
        "pass_to_pass": {"selector_count": len(pass_to_pass)},
    }

    try:
        setup_ok, setup_results = run_setup(meta)
        report["setup"] = {"passed": setup_ok, "commands": setup_results}
        if not setup_ok:
            report["status"] = "setup_failed"
            return

        go_check = run_command("preflight_go", ["go", "version"], timeout=60)
        report["preflight_go"] = go_check
        if go_check["returncode"] != 0:
            report["status"] = "test_environment_failed"
            return

        patch_path = ROOT / "model.patch"
        check = run_command("patch_check", ["git", "apply", "--check", str(patch_path)], timeout=120)
        report["patch_check"] = check
        if check["returncode"] != 0:
            report["status"] = "patch_apply_failed"
            return

        apply_result = run_command("patch_apply", ["git", "apply", str(patch_path)], timeout=120)
        report["patch_apply"] = apply_result
        if apply_result["returncode"] != 0:
            report["status"] = "patch_apply_failed"
            return

        report["fail_to_pass"] = run_go_tests(
            "fail_to_pass",
            fail_to_pass,
            timeout_per_chunk=meta["timeout_per_chunk"],
            chunk_size=meta["chunk_size"],
        )
        report["pass_to_pass"] = run_go_tests(
            "pass_to_pass",
            pass_to_pass,
            timeout_per_chunk=meta["timeout_per_chunk"],
            chunk_size=meta["chunk_size"],
        ) if pass_to_pass else {"selector_count": 0, "chunk_count": 0, "passed": True, "chunks": []}
        report["resolved"] = report["fail_to_pass"]["passed"] and report["pass_to_pass"]["passed"]
        report["status"] = "resolved" if report["resolved"] else "unresolved"
    except subprocess.TimeoutExpired as exc:
        report["status"] = "timeout"
        report["timeout_command"] = exc.cmd if isinstance(exc.cmd, str) else " ".join(exc.cmd)
    except Exception as exc:
        report["status"] = "grader_exception"
        report["exception"] = repr(exc)
    finally:
        report["elapsed_seconds"] = time.time() - started
        (ROOT / "result.json").write_text(json.dumps(report, indent=2), errors="replace")


if __name__ == "__main__":
    main()
'''


def parse_list(value: Any) -> list[str]:
    if isinstance(value, list):
        return value
    if value in (None, ""):
        return []
    try:
        parsed = json.loads(value)
    except Exception:
        parsed = ast.literal_eval(value)
    if not isinstance(parsed, list):
        raise TypeError(f"Expected list-like value, got {type(parsed).__name__}")
    return parsed


def load_jsonl(path: Path) -> dict[str, dict[str, Any]]:
    rows: dict[str, dict[str, Any]] = {}
    for line in path.read_text().splitlines():
        if not line.strip():
            continue
        row = json.loads(line)
        if row.get("dockerhub_tag") and not row.get("docker_image"):
            row["docker_image"] = f"jefzda/sweap-images:{row['dockerhub_tag']}"
        rows[row["instance_id"]] = row
    return rows


def load_predictions(path: Path) -> dict[str, dict[str, Any]]:
    data = json.loads(path.read_text())
    if isinstance(data, list):
        return {row["instance_id"]: row for row in data}
    return data


def docker_run_for_instance(
    *,
    condition: str,
    task: dict[str, Any],
    prediction: dict[str, Any],
    run_dir: Path,
    timeout_seconds: int,
    timeout_per_chunk: int,
    chunk_size: int,
    force: bool,
) -> dict[str, Any]:
    result_path = run_dir / "result.json"
    if result_path.exists() and not force:
        result = json.loads(result_path.read_text())
        result["condition"] = condition
        result["cached"] = True
        return result

    if run_dir.exists() and force:
        shutil.rmtree(run_dir)
    run_dir.mkdir(parents=True, exist_ok=True)

    model_patch = prediction.get("model_patch") or ""
    if not model_patch.strip():
        result = {
            "condition": condition,
            "instance_id": task["instance_id"],
            "docker_image": task["docker_image"],
            "status": "empty_patch",
            "resolved": False,
            "fail_to_pass": {"selector_count": len(parse_list(task["fail_to_pass"]))},
            "pass_to_pass": {"selector_count": len(parse_list(task["pass_to_pass"]))},
            "elapsed_seconds": 0.0,
        }
        result_path.write_text(json.dumps(result, indent=2))
        return result

    (run_dir / "model.patch").write_text(model_patch)
    (run_dir / "container_grade_one.py").write_text(CONTAINER_GRADER)
    go_build_cache = run_dir.parent.parent / "_go_build_cache"
    go_build_cache.mkdir(parents=True, exist_ok=True)
    meta = {
        "instance_id": task["instance_id"],
        "docker_image": task["docker_image"],
        "before_repo_set_cmd": task["before_repo_set_cmd"],
        "fail_to_pass": task["fail_to_pass"],
        "pass_to_pass": task["pass_to_pass"],
        "timeout_per_chunk": timeout_per_chunk,
        "chunk_size": chunk_size,
    }
    (run_dir / "meta.json").write_text(json.dumps(meta, indent=2))

    cmd = [
        "docker",
        "run",
        "--rm",
        "--platform",
        "linux/amd64",
        "--add-host",
        BADSSL_ADD_HOST,
        "--entrypoint",
        "",
        "-v",
        f"{run_dir}:/grader",
        "-v",
        f"{go_build_cache}:/root/.cache/go-build",
        "-w",
        "/app",
        task["docker_image"],
        "python",
        "/grader/container_grade_one.py",
    ]
    started = time.time()
    try:
        proc = subprocess.run(
            cmd,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            timeout=timeout_seconds,
        )
        (run_dir / "docker.log").write_text(proc.stdout, errors="replace")
        if result_path.exists():
            result = json.loads(result_path.read_text())
        else:
            result = {
                "instance_id": task["instance_id"],
                "docker_image": task["docker_image"],
                "status": "docker_failed_no_result",
                "resolved": False,
            }
        result["docker_returncode"] = proc.returncode
    except subprocess.TimeoutExpired as exc:
        output = exc.stdout or ""
        if isinstance(output, bytes):
            output = output.decode(errors="replace")
        (run_dir / "docker.log").write_text(output, errors="replace")
        result = {
            "instance_id": task["instance_id"],
            "docker_image": task["docker_image"],
            "status": "docker_timeout",
            "resolved": False,
        }
    result["condition"] = condition
    result["elapsed_seconds"] = result.get("elapsed_seconds", time.time() - started)
    result_path.write_text(json.dumps(result, indent=2))
    return result


def remove_docker_image(image: str) -> None:
    subprocess.run(
        ["docker", "rmi", image],
        text=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=False,
    )


def ensure_docker_image(image: str, report_root: Path, *, attempts: int = 3) -> bool:
    """Pre-pull a task image once before fanning out condition graders."""
    if subprocess.run(["docker", "image", "inspect", image], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0:
        return True

    log_dir = report_root / "image_pull_logs"
    log_dir.mkdir(parents=True, exist_ok=True)
    safe_name = re.sub(r"[^A-Za-z0-9_.-]+", "_", image).strip("_")
    log_path = log_dir / f"{safe_name}.log"
    chunks = []
    for attempt in range(1, attempts + 1):
        print(f"Pulling Docker image {image} (attempt {attempt}/{attempts})", flush=True)
        started = time.time()
        try:
            proc = subprocess.run(
                ["docker", "pull", image],
                text=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                timeout=1800,
            )
            output = proc.stdout or ""
            returncode = proc.returncode
        except subprocess.TimeoutExpired as exc:
            output = exc.stdout or ""
            if isinstance(output, bytes):
                output = output.decode(errors="replace")
            returncode = 124
        elapsed = time.time() - started
        chunks.append(f"attempt={attempt} returncode={returncode} elapsed={elapsed:.3f}s\n{output}")
        log_path.write_text("\n\n".join(chunks), errors="replace")
        if returncode == 0:
            return True
        time.sleep(10)

    print(f"Warning: pre-pull failed for {image}; docker run will attempt it directly", flush=True)
    return False


def summarize(condition: str, results: list[dict[str, Any]]) -> dict[str, Any]:
    status_counts: dict[str, int] = {}
    for result in results:
        status = result.get("status", "unknown")
        status_counts[status] = status_counts.get(status, 0) + 1
    resolved = sorted(result["instance_id"] for result in results if result.get("resolved"))
    return {
        "condition": condition,
        "total_predictions": len(results),
        "nonempty_predictions": sum(1 for result in results if result.get("status") != "empty_patch"),
        "resolved": len(resolved),
        "resolved_ids": resolved,
        "status_counts": dict(sorted(status_counts.items())),
        "results": sorted(results, key=lambda result: result["instance_id"]),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-dir", type=Path, default=ROOT)
    parser.add_argument("--results-dir", type=Path, required=True)
    parser.add_argument("--conditions", nargs="+", default=["C0", "C1_raw_git", "C4_mcts_mem_top8w900"])
    parser.add_argument("--workers", type=int, default=1)
    parser.add_argument("--timeout-seconds", type=int, default=2400)
    parser.add_argument("--timeout-per-chunk", type=int, default=600)
    parser.add_argument("--chunk-size", type=int, default=12)
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--instance-id", action="append", help="Restrict grading to one or more instance IDs.")
    parser.add_argument(
        "--by-instance",
        action="store_true",
        help="Grade all requested conditions for one instance before moving to the next instance.",
    )
    parser.add_argument(
        "--remove-images-after-instance",
        action="store_true",
        help="After by-instance grading, remove the task Docker image before moving on.",
    )
    args = parser.parse_args()
    args.base_dir = args.base_dir.resolve()
    args.results_dir = args.results_dir.resolve()

    tasks = load_jsonl(args.base_dir / "tasks/flipt_swebench_pro_tasks.jsonl")
    report_root = args.results_dir / "local_grade_reports"
    report_root.mkdir(parents=True, exist_ok=True)

    predictions_by_condition = {
        condition: load_predictions(args.results_dir / condition / "preds.json")
        for condition in args.conditions
    }
    requested_ids = set(args.instance_id or [])

    all_summaries = []
    if args.by_instance:
        condition_results_by_name: dict[str, list[dict[str, Any]]] = {condition: [] for condition in args.conditions}
        ordered_ids = [instance_id for instance_id in tasks if not requested_ids or instance_id in requested_ids]
        for index, instance_id in enumerate(ordered_ids, start=1):
            task = tasks[instance_id]
            pending = [condition for condition in args.conditions if instance_id in predictions_by_condition[condition]]
            if not pending:
                continue
            print(f"Grading instance {index}/{len(ordered_ids)} {instance_id} ({len(pending)} conditions)")
            try:
                jobs = []
                for condition in pending:
                    prediction = predictions_by_condition[condition][instance_id]
                    run_dir = report_root / condition / instance_id
                    jobs.append((condition, task, prediction, run_dir))

                needs_docker = any(args.force or not (run_dir / "result.json").exists() for _, _, _, run_dir in jobs)
                if needs_docker:
                    ensure_docker_image(task["docker_image"], report_root)

                max_workers = max(1, min(args.workers, len(jobs)))
                if max_workers == 1:
                    results = [
                        docker_run_for_instance(
                            condition=condition,
                            task=task,
                            prediction=prediction,
                            run_dir=run_dir,
                            timeout_seconds=args.timeout_seconds,
                            timeout_per_chunk=args.timeout_per_chunk,
                            chunk_size=args.chunk_size,
                            force=args.force,
                        )
                        for condition, task, prediction, run_dir in jobs
                    ]
                else:
                    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as pool:
                        futures = [
                            pool.submit(
                                docker_run_for_instance,
                                condition=condition,
                                task=task,
                                prediction=prediction,
                                run_dir=run_dir,
                                timeout_seconds=args.timeout_seconds,
                                timeout_per_chunk=args.timeout_per_chunk,
                                chunk_size=args.chunk_size,
                                force=args.force,
                            )
                            for condition, task, prediction, run_dir in jobs
                        ]
                        results = [future.result() for future in concurrent.futures.as_completed(futures)]

                for result in results:
                    condition_results_by_name[result["condition"]].append(result)
                    print(f"{result['condition']} {result['instance_id']} {result.get('status')} resolved={result.get('resolved')}")
            finally:
                if args.remove_images_after_instance:
                    remove_docker_image(task["docker_image"])

        for condition in args.conditions:
            summary = summarize(condition, condition_results_by_name[condition])
            (report_root / f"{condition}.summary.json").write_text(json.dumps(summary, indent=2))
            all_summaries.append(summary)
    else:
        for condition in args.conditions:
            predictions = predictions_by_condition[condition]
            items = []
            for instance_id, prediction in sorted(predictions.items()):
                if requested_ids and instance_id not in requested_ids:
                    continue
                if instance_id not in tasks:
                    raise KeyError(f"Prediction {instance_id} not found in task file")
                run_dir = report_root / condition / instance_id
                items.append((condition, tasks[instance_id], prediction, run_dir))

            print(f"Grading {condition}: {len(items)} predictions")
            condition_results = []
            with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
                futures = [
                    pool.submit(
                        docker_run_for_instance,
                        condition=condition,
                        task=task,
                        prediction=prediction,
                        run_dir=run_dir,
                        timeout_seconds=args.timeout_seconds,
                        timeout_per_chunk=args.timeout_per_chunk,
                        chunk_size=args.chunk_size,
                        force=args.force,
                    )
                    for condition, task, prediction, run_dir in items
                ]
                for future in concurrent.futures.as_completed(futures):
                    result = future.result()
                    condition_results.append(result)
                    print(f"{condition} {result['instance_id']} {result.get('status')} resolved={result.get('resolved')}")

            summary = summarize(condition, condition_results)
            (report_root / f"{condition}.summary.json").write_text(json.dumps(summary, indent=2))
            all_summaries.append(summary)

    aggregate = {"generated_at_epoch": time.time(), "conditions": all_summaries}
    (report_root / "summary.json").write_text(json.dumps(aggregate, indent=2))
    print(json.dumps({s["condition"]: {"total": s["total_predictions"], "nonempty": s["nonempty_predictions"], "resolved": s["resolved"], "status_counts": s["status_counts"]} for s in all_summaries}, indent=2))


if __name__ == "__main__":
    main()
