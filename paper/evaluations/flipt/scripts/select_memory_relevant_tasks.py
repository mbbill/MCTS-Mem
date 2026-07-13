#!/usr/bin/env python3
"""Select Flipt SWE-bench Pro tasks where MCTS-Mem should matter.

This is a lightweight reviewer pass, not a solver run. It asks multiple LLM
reviewers to score each task for architecture/history dependence using the task
metadata and the generated C4 MCTS-Mem context, then aggregates a ranked subset.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import datetime as dt
import json
import os
from pathlib import Path
import re
import statistics
import threading
import time
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_TASKS = ROOT / "tasks" / "flipt_swebench_pro_tasks.jsonl"
DEFAULT_CONTEXTS = ROOT / "conditions" / "C4_mcts_mem_top8w900"
DEFAULT_SELECTION = ROOT / "selection"


REVIEWER_PERSONAS = [
    "architecture reviewer: prioritize ownership boundaries, lifecycle, object registry, and backend abstractions",
    "skeptical evaluator: penalize tasks where explicit requirements/tests are enough without historical memory",
    "history reviewer: prioritize rejected alternatives, durable identities, and design decisions that prevent regressions",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tasks", type=Path, default=DEFAULT_TASKS)
    parser.add_argument("--contexts-dir", type=Path, default=DEFAULT_CONTEXTS)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_SELECTION)
    parser.add_argument("--run-name", default=None)
    parser.add_argument("--model", default=os.environ.get("MODEL", "anthropic/claude-gpt-5.5"))
    parser.add_argument("--api-base", default=os.environ.get("ANTHROPIC_API_BASE"))
    parser.add_argument("--api-key", default=os.environ.get("ANTHROPIC_API_KEY", "local"))
    parser.add_argument("--reviewers", type=int, default=3)
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--ids-file", type=Path, default=None)
    parser.add_argument("--context-char-limit", type=int, default=4000)
    parser.add_argument("--max-tokens", type=int, default=1200)
    parser.add_argument("--timeout", type=int, default=120)
    parser.add_argument("--include-test-patch", action="store_true")
    parser.add_argument("--resume", action="store_true")
    parser.add_argument("--top-n", type=int, default=20)
    return parser.parse_args()


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


def short_id(instance_id: str) -> str:
    marker = "flipt-"
    if marker not in instance_id:
        return instance_id[:8]
    return instance_id.split(marker, 1)[1].split("-v", 1)[0][:8]


def compact(value: Any, *, limit: int) -> str:
    if value is None:
        text = ""
    elif isinstance(value, str):
        text = value
    else:
        text = json.dumps(value, ensure_ascii=False)
    text = text.strip()
    if len(text) <= limit:
        return text
    head = text[: limit // 2]
    tail = text[-limit // 2 :]
    return f"{head}\n... <{len(text) - limit} chars elided> ...\n{tail}"


def load_context(contexts_dir: Path, instance_id: str, limit: int) -> str:
    path = contexts_dir / f"{instance_id}.md"
    if not path.exists():
        return ""
    return compact(path.read_text(errors="replace"), limit=limit)


def score_int(value: Any, *, allow_probability: bool = False) -> int | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if allow_probability and 0 <= number <= 1:
        return max(1, min(5, round(number * 5)))
    if 1 <= number <= 5:
        return int(round(number))
    return None


def extract_json_object(text: str) -> dict[str, Any]:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    match = re.search(r"\{.*\}", text, flags=re.S)
    if not match:
        raise ValueError(f"No JSON object found in response: {text[:300]!r}")
    return json.loads(match.group(0))


def normalize_review(raw: dict[str, Any]) -> dict[str, Any]:
    fields = [
        "memory_relevance",
        "architecture_dependency",
        "history_dependency",
        "direct_test_sufficiency",
        "context_quality",
        "confidence",
    ]
    review: dict[str, Any] = {}
    for field in fields:
        value = score_int(raw.get(field), allow_probability=(field == "confidence"))
        if value is None:
            raise ValueError(f"Missing/invalid {field}: {raw.get(field)!r}")
        review[field] = value
    review["recommended_for_eval"] = bool(raw.get("recommended_for_eval"))
    for field in ["why_memory_should_help", "why_memory_might_hurt", "selection_rationale"]:
        review[field] = str(raw.get(field, "")).strip()[:1200]
    records = raw.get("likely_helpful_records", [])
    if not isinstance(records, list):
        records = [records]
    review["likely_helpful_records"] = [str(item).strip()[:300] for item in records[:6] if str(item).strip()]
    return review


def prompt_for(row: dict[str, Any], context: str, reviewer_idx: int, include_test_patch: bool) -> list[dict[str, str]]:
    persona = REVIEWER_PERSONAS[reviewer_idx % len(REVIEWER_PERSONAS)]
    system = (
        "You are selecting SWE-bench tasks for evaluating whether historical design memory helps. "
        "You are not solving the task. You must return exactly one JSON object and no markdown. "
        "Be strict: a task is memory-relevant only if architecture/history/design constraints are likely to improve solver behavior beyond the explicit task text and tests."
    )
    payload = {
        "reviewer_role": persona,
        "instance_id": row.get("instance_id"),
        "short_id": short_id(row.get("instance_id", "")),
        "issue_categories": row.get("issue_categories"),
        "issue_specificity": row.get("issue_specificity"),
        "interface": compact(row.get("interface"), limit=2400),
        "requirements": compact(row.get("requirements"), limit=3600),
        "fail_to_pass": compact(row.get("fail_to_pass"), limit=2200),
        "pass_to_pass": compact(row.get("pass_to_pass"), limit=1200),
        "selected_test_files_to_run": compact(row.get("selected_test_files_to_run"), limit=800),
        "mcts_mem_context": context,
    }
    if include_test_patch:
        payload["test_patch"] = compact(row.get("test_patch"), limit=6000)
    user = (
        "Score this task for a memory-relevance subset. Use 1-5 integer scores.\n"
        "memory_relevance: 1 direct local task, 5 memory likely decisive.\n"
        "architecture_dependency: 1 local edit, 5 ownership/lifecycle/API boundary is central.\n"
        "history_dependency: 1 no history needed, 5 rejected alternatives/design evolution likely matters.\n"
        "direct_test_sufficiency: 1 explicit info insufficient, 5 task/tests already fully specify fix.\n"
        "context_quality: 1 context irrelevant/noisy, 5 context names directly useful records/invariants.\n"
        "recommended_for_eval should be true only when memory_relevance >= 4, max(architecture_dependency, history_dependency) >= 4, direct_test_sufficiency <= 3, and context_quality >= 3.\n"
        "Return compact JSON with keys: memory_relevance, architecture_dependency, history_dependency, direct_test_sufficiency, context_quality, confidence, recommended_for_eval, likely_helpful_records, why_memory_should_help, why_memory_might_hurt, selection_rationale. Keep all prose values under 25 words. Do not reason step by step.\n\n"
        f"TASK_PACKET:\n{json.dumps(payload, ensure_ascii=False)}"
    )
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]


def call_reviewer(args: argparse.Namespace, row: dict[str, Any], reviewer_idx: int) -> dict[str, Any]:
    import litellm

    limits = []
    for limit in [args.context_char_limit, args.context_char_limit // 2, 1500, 0]:
        if limit >= 0 and limit not in limits:
            limits.append(limit)
    last_error: Exception | None = None
    last_finish_reason = None
    last_content_len = 0
    started = time.time()
    for attempt, limit in enumerate(limits):
        context = load_context(args.contexts_dir, row["instance_id"], limit) if limit else ""
        messages = prompt_for(row, context, reviewer_idx, args.include_test_patch)
        response = litellm.completion(
            model=args.model,
            messages=messages,
            max_tokens=args.max_tokens + attempt * 300,
            timeout=args.timeout,
            temperature=0.2,
            drop_params=True,
        )
        last_finish_reason = getattr(response.choices[0], "finish_reason", None)
        content = response.choices[0].message.content or ""
        last_content_len = len(content)
        try:
            review = normalize_review(extract_json_object(content))
        except Exception as exc:
            last_error = exc
            continue
        review["retry_attempt"] = attempt
        review["context_char_limit_used"] = limit
        break
    else:
        raise ValueError(
            f"No parseable review after {len(limits)} attempts; "
            f"last_finish_reason={last_finish_reason!r} last_content_len={last_content_len} "
            f"last_error={last_error!r}"
        )
    elapsed = time.time() - started
    review.update(
        {
            "instance_id": row["instance_id"],
            "short_id": short_id(row["instance_id"]),
            "reviewer": reviewer_idx,
            "reviewer_role": REVIEWER_PERSONAS[reviewer_idx % len(REVIEWER_PERSONAS)],
            "model": args.model,
            "elapsed_seconds": elapsed,
        }
    )
    return review


def review_key(instance_id: str, reviewer: int) -> str:
    return f"{instance_id}\t{reviewer}"


def load_existing_reviews(path: Path) -> dict[str, dict[str, Any]]:
    if not path.exists():
        return {}
    reviews = {}
    for line in path.read_text().splitlines():
        if not line.strip():
            continue
        item = json.loads(line)
        reviews[review_key(item["instance_id"], int(item["reviewer"]))] = item
    return reviews


def append_jsonl(path: Path, item: dict[str, Any], lock: threading.Lock) -> None:
    with lock:
        with path.open("a") as f:
            f.write(json.dumps(item, ensure_ascii=False, sort_keys=True) + "\n")


def aggregate(rows: list[dict[str, Any]], reviews: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_instance: dict[str, list[dict[str, Any]]] = {}
    for review in reviews:
        by_instance.setdefault(review["instance_id"], []).append(review)

    row_by_id = {row["instance_id"]: row for row in rows}
    ranked = []
    for instance_id, items in by_instance.items():
        if not items:
            continue
        def mean(field: str) -> float:
            return statistics.mean(item[field] for item in items)

        consensus = sum(1 for item in items if item["recommended_for_eval"])
        strong = sum(
            1
            for item in items
            if item["memory_relevance"] >= 4
            and max(item["architecture_dependency"], item["history_dependency"]) >= 4
            and item["direct_test_sufficiency"] <= 3
            and item["context_quality"] >= 3
        )
        memory_mean = mean("memory_relevance")
        arch_mean = mean("architecture_dependency")
        history_mean = mean("history_dependency")
        direct_mean = mean("direct_test_sufficiency")
        context_mean = mean("context_quality")
        aggregate_score = (
            memory_mean * 2.0
            + max(arch_mean, history_mean) * 1.5
            + context_mean
            + consensus * 0.75
            + strong * 0.5
            - direct_mean * 0.8
        )
        row = row_by_id.get(instance_id, {})
        ranked.append(
            {
                "instance_id": instance_id,
                "short_id": short_id(instance_id),
                "aggregate_score": round(aggregate_score, 3),
                "review_count": len(items),
                "recommended_consensus": consensus,
                "strong_consensus": strong,
                "means": {
                    "memory_relevance": round(memory_mean, 3),
                    "architecture_dependency": round(arch_mean, 3),
                    "history_dependency": round(history_mean, 3),
                    "direct_test_sufficiency": round(direct_mean, 3),
                    "context_quality": round(context_mean, 3),
                    "confidence": round(mean("confidence"), 3),
                },
                "issue_categories": row.get("issue_categories"),
                "issue_specificity": row.get("issue_specificity"),
                "fail_to_pass_count": len(str(row.get("fail_to_pass", "")).split("tests/")) - 1,
                "reviews": items,
            }
        )
    ranked.sort(
        key=lambda item: (
            item["strong_consensus"],
            item["recommended_consensus"],
            item["aggregate_score"],
            item["means"]["memory_relevance"],
        ),
        reverse=True,
    )
    return ranked


def write_outputs(run_dir: Path, ranked: list[dict[str, Any]], top_n: int) -> None:
    (run_dir / "memory_relevance_ranked.json").write_text(
        json.dumps(ranked, indent=2, ensure_ascii=False),
        errors="replace",
    )
    top = ranked[:top_n]
    (run_dir / f"memory_relevance_top{top_n}_instance_ids.txt").write_text(
        "\n".join(item["instance_id"] for item in top) + ("\n" if top else "")
    )
    lines = [
        f"# Top {top_n} Memory-Relevance Candidates",
        "",
        "| rank | short id | score | consensus | memory | arch | history | direct-test | context | rationale |",
        "| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
    ]
    for rank, item in enumerate(top, 1):
        means = item["means"]
        rationales = [r.get("selection_rationale", "") for r in item["reviews"] if r.get("selection_rationale")]
        rationale = rationales[0] if rationales else ""
        rationale = rationale.replace("|", "\\|").replace("\n", " ")[:220]
        lines.append(
            f"| {rank} | `{item['short_id']}` | {item['aggregate_score']:.2f} | "
            f"{item['recommended_consensus']}/{item['review_count']} | "
            f"{means['memory_relevance']:.1f} | {means['architecture_dependency']:.1f} | "
            f"{means['history_dependency']:.1f} | {means['direct_test_sufficiency']:.1f} | "
            f"{means['context_quality']:.1f} | {rationale} |"
        )
    (run_dir / f"memory_relevance_top{top_n}.md").write_text("\n".join(lines) + "\n", errors="replace")


def main() -> None:
    args = parse_args()
    if args.api_base:
        os.environ["ANTHROPIC_API_BASE"] = args.api_base
    if args.api_key:
        os.environ["ANTHROPIC_API_KEY"] = args.api_key
    os.environ.setdefault("MSWEA_COST_TRACKING", "ignore_errors")

    rows = read_jsonl(args.tasks)
    if args.ids_file:
        wanted = {line.strip() for line in args.ids_file.read_text().splitlines() if line.strip()}
        rows = [row for row in rows if row["instance_id"] in wanted]
    if args.limit is not None:
        rows = rows[: args.limit]

    run_name = args.run_name or dt.datetime.now().strftime("memory_relevance_%Y%m%d_%H%M%S")
    run_dir = args.output_dir / run_name
    run_dir.mkdir(parents=True, exist_ok=True)
    reviews_path = run_dir / "reviews.jsonl"
    errors_path = run_dir / "errors.jsonl"

    metadata = {
        "model": args.model,
        "tasks": str(args.tasks),
        "contexts_dir": str(args.contexts_dir),
        "reviewers": args.reviewers,
        "workers": args.workers,
        "include_test_patch": args.include_test_patch,
        "context_char_limit": args.context_char_limit,
        "started_at": dt.datetime.now().isoformat(),
        "task_count": len(rows),
    }
    (run_dir / "metadata.json").write_text(json.dumps(metadata, indent=2, sort_keys=True))

    existing = load_existing_reviews(reviews_path) if args.resume else {}
    work = []
    for row in rows:
        for reviewer in range(args.reviewers):
            key = review_key(row["instance_id"], reviewer)
            if key not in existing:
                work.append((row, reviewer))

    print(f"run_dir={run_dir}", flush=True)
    print(f"tasks={len(rows)} reviewers={args.reviewers} calls_remaining={len(work)}", flush=True)
    lock = threading.Lock()

    completed = 0
    if work:
        with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
            futures = {pool.submit(call_reviewer, args, row, reviewer): (row, reviewer) for row, reviewer in work}
            for future in concurrent.futures.as_completed(futures):
                row, reviewer = futures[future]
                try:
                    item = future.result()
                except Exception as exc:  # keep the run resumable
                    error = {
                        "instance_id": row["instance_id"],
                        "short_id": short_id(row["instance_id"]),
                        "reviewer": reviewer,
                        "error": repr(exc),
                        "time": dt.datetime.now().isoformat(),
                    }
                    append_jsonl(errors_path, error, lock)
                    print(f"ERR {error['short_id']} reviewer={reviewer}: {exc!r}", flush=True)
                else:
                    append_jsonl(reviews_path, item, lock)
                    completed += 1
                    print(
                        f"OK {item['short_id']} reviewer={reviewer} "
                        f"mem={item['memory_relevance']} arch={item['architecture_dependency']} "
                        f"hist={item['history_dependency']} direct={item['direct_test_sufficiency']} "
                        f"ctx={item['context_quality']} rec={item['recommended_for_eval']}"
                    , flush=True)
    all_reviews = list(load_existing_reviews(reviews_path).values())
    ranked = aggregate(rows, all_reviews)
    write_outputs(run_dir, ranked, args.top_n)
    print(f"completed_new={completed} total_reviews={len(all_reviews)} ranked={len(ranked)}", flush=True)
    print(f"ranked_json={run_dir / 'memory_relevance_ranked.json'}", flush=True)
    print(f"top_md={run_dir / f'memory_relevance_top{args.top_n}.md'}", flush=True)


if __name__ == "__main__":
    main()
