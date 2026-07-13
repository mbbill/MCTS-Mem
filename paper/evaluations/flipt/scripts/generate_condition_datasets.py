#!/usr/bin/env python3
"""Generate Flipt SWE-bench Pro condition datasets.

Conditions:
- C0: no memory
- C1_raw_git: top matching pre-cutoff git commit messages
- C4_mcts_mem_top8w900: top matching pre-cutoff MCTS-Mem records, when extraction records exist

This script is intentionally rooted at ``paper/evaluations/flipt`` so the Flipt
evaluation can be moved or archived without depending on files outside ``paper/``.
"""

from __future__ import annotations

import argparse
from collections import Counter
import json
import math
from pathlib import Path
import re
import subprocess
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
TASKS_PATH = ROOT / "tasks" / "flipt_swebench_pro_tasks.jsonl"
DEFAULT_REPO = ROOT.parents[1] / "repos" / "flipt"
DEFAULT_RECORDS = ROOT / "extraction" / "all-records.jsonl"

STOP = set(
    """
    a an the and or but if then else when while for to of in on by with without from into over under
    after before as is are was were be been being this that these those it its at not no yes can cannot
    should would could may might must do does did done use uses using used add added remove removed fix fixed
    support supports make made issue error bug fails failure test tests flipt feature flag flags server client api
    """.split()
)
WORD = re.compile(r"[A-Za-z_][A-Za-z0-9_./:-]{2,}")


def run_git(repo: Path, *args: str, timeout: int = 30) -> str:
    return subprocess.check_output(
        ["git", "-C", str(repo), *args],
        text=True,
        stderr=subprocess.DEVNULL,
        timeout=timeout,
    )


def toks(text: str) -> list[str]:
    return [word.lower() for word in WORD.findall(text or "") if word.lower() not in STOP]


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
    return text[: limit // 2] + f"\n... <{len(text) - limit} chars elided> ...\n" + text[-limit // 2 :]


def trim_words(text: str, max_words: int) -> str:
    parts = re.findall(r"\S+\s*", text)
    if len(parts) <= max_words:
        return text.strip()
    return "".join(parts[:max_words]).rstrip()


def load_jsonl(path: Path) -> list[dict[str, Any]]:
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


def task_text(row: dict[str, Any]) -> str:
    return "\n".join(
        str(row.get(key, ""))
        for key in [
            "problem_statement",
            "requirements",
            "interface",
            "issue_categories",
            "issue_specificity",
            "fail_to_pass",
            "selected_test_files_to_run",
        ]
    )


def record_text(record: dict[str, Any]) -> str:
    parts: list[str] = []
    for key in ["id", "type", "kind", "date", "hash", "provenance", "item", "text", "why"]:
        if record.get(key):
            parts.append(str(record[key]))
    for key in ["concept", "old", "new"]:
        value = record.get(key)
        if isinstance(value, dict):
            parts.append(str(value.get("name", "")))
            parts.extend(str(anchor) for anchor in value.get("anchors", []) if isinstance(anchor, str))
    if isinstance(record.get("frozen_items"), list):
        parts.extend(str(item) for item in record["frozen_items"])
    return " ".join(parts)


def make_condition_row(task: dict[str, Any], context: str) -> dict[str, Any]:
    row = dict(task)
    original = task.get("problem_statement", "")
    row["problem_statement"] = context.strip() + "\n\n---\n\n" + original if context.strip() else original
    tag = row.get("dockerhub_tag")
    if tag and not row.get("docker_image"):
        row["docker_image"] = f"jefzda/sweap-images:{tag}"
    return row


def idf_scorer(docs: dict[str, set[str]]):
    df: Counter[str] = Counter()
    for tokens in docs.values():
        df.update(tokens)
    corpus_size = max(1, len(docs))

    def score(query_tokens: list[str], doc_id: str) -> float:
        tokens = docs.get(doc_id, set())
        return sum(1 + math.log(corpus_size / (1 + df[token])) for token in query_tokens if token in tokens)

    return score


def load_commit_docs(repo: Path) -> tuple[dict[str, str], dict[str, set[str]]]:
    raw = run_git(repo, "log", "--format=%H%x00%h%x00%cs%x00%s%x00%b%x00END%x00", timeout=120)
    commit_docs: dict[str, str] = {}
    token_docs: dict[str, set[str]] = {}
    for chunk in raw.split("\x00END\x00"):
        fields = chunk.strip("\x00\n").split("\x00")
        if len(fields) < 5:
            continue
        full_hash, short_hash, date, subject, body = fields[:5]
        text = f"{short_hash} {date}\n{subject}\n{body}".strip()
        commit_docs[full_hash] = text
        token_docs[full_hash] = set(toks(text))
    return commit_docs, token_docs


def ancestor_list(repo: Path, base_commit: str) -> list[str]:
    try:
        return run_git(repo, "rev-list", base_commit, timeout=60).splitlines()
    except subprocess.SubprocessError as exc:
        raise RuntimeError(f"Could not read ancestors for {base_commit}") from exc


def render_raw_git(commit_hashes: list[str], commit_docs: dict[str, str], max_commits: int) -> str:
    out = [
        "# Raw git-history context (time-correct)",
        "Top matching ancestor commit messages; no MCTS-Mem distillation.",
    ]
    for commit_hash in commit_hashes[:max_commits]:
        text = compact(commit_docs.get(commit_hash, ""), limit=1400)
        if text:
            out.extend(["", "```", text, "```"])
    return "\n".join(out).strip() + "\n"


def render_mcts(records: list[dict[str, Any]]) -> str:
    out = [
        "# MCTS-Mem context (time-correct)",
        "Only records whose commits are ancestors of this task base_commit are included.",
        "",
        "Use this as design memory, not as generic background:",
        "- Read relevant facts before editing so you preserve existing invariants.",
        "- Treat re-decisions and rejected alternatives as warnings about approaches already replaced.",
        "- Do not reintroduce a rejected form unless the task clearly invalidates the recorded reason it lost.",
        "- If a record is irrelevant to the files you touch, ignore it.",
    ]
    transitions = [record for record in records if record.get("type") == "transition"]
    facts = [record for record in records if record.get("type") == "fact"]
    births = [record for record in records if record.get("type") == "birth"]
    if transitions:
        out.append("\n## Re-decisions and rejected alternatives")
        for record in transitions:
            old = (record.get("old") or {}).get("name", "previous form") if isinstance(record.get("old"), dict) else "previous form"
            new = (record.get("new") or {}).get("name", "current form") if isinstance(record.get("new"), dict) else "current form"
            out.append(
                f"- {record.get('date')} ({record.get('hash')}) {record.get('provenance')}: "
                f"replaced `{old}` with `{new}`. Why: {record.get('why', '')}"
            )
            if record.get("frozen_items"):
                out.append("  Rejected form: " + "; ".join(map(str, record.get("frozen_items", [])[:4])))
    if facts:
        out.append("\n## Facts")
        for record in facts:
            concept = (record.get("concept") or {}).get("name", "") if isinstance(record.get("concept"), dict) else ""
            out.append(
                f"- {record.get('date')} ({record.get('hash')}) {record.get('provenance')} "
                f"{record.get('kind', 'fact')} [{concept}]: {record.get('text', '')}"
            )
    if births:
        out.append("\n## Durable identities")
        for record in births:
            concept = (record.get("concept") or {}).get("name", "") if isinstance(record.get("concept"), dict) else ""
            out.append(f"- {record.get('date')} ({record.get('hash')}) {concept}: {record.get('item', '')}")
    return "\n".join(out).strip() + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", type=Path, default=ROOT)
    parser.add_argument("--repo", type=Path, default=DEFAULT_REPO)
    parser.add_argument("--tasks", type=Path, default=TASKS_PATH)
    parser.add_argument("--records", type=Path, default=DEFAULT_RECORDS)
    parser.add_argument("--top-raw-commits", type=int, default=8)
    parser.add_argument("--top-records", type=int, default=8)
    parser.add_argument("--raw-max-words", type=int, default=900)
    parser.add_argument("--mcts-max-words", type=int, default=900)
    parser.add_argument("--include-mcts", action="store_true")
    args = parser.parse_args()

    base = args.base.resolve()
    repo = args.repo.resolve()
    tasks = load_jsonl(args.tasks)
    commit_docs, commit_token_docs = load_commit_docs(repo)
    score_commit = idf_scorer(commit_token_docs)

    records: list[dict[str, Any]] = []
    record_by_id: dict[str, dict[str, Any]] = {}
    record_token_docs: dict[str, set[str]] = {}
    score_record = None
    if args.include_mcts:
        if not args.records.exists():
            raise SystemExit(f"--include-mcts requested but records file does not exist: {args.records}")
        records = load_jsonl(args.records)
        record_by_id = {record["id"]: record for record in records}
        record_token_docs = {record["id"]: set(toks(record_text(record))) for record in records}
        score_record = idf_scorer(record_token_docs)

    condition_names = ["C0", "C1_raw_git"] + (["C4_mcts_mem_top8w900"] if args.include_mcts else [])
    for condition in condition_names:
        directory = base / "conditions" / condition
        directory.mkdir(parents=True, exist_ok=True)
        for old in directory.glob("*.md"):
            old.unlink()
    (base / "datasets").mkdir(parents=True, exist_ok=True)
    (base / "cutoffs").mkdir(parents=True, exist_ok=True)

    dataset_rows = {condition: [] for condition in condition_names}
    index = []
    for task in tasks:
        instance_id = task["instance_id"]
        query_tokens = toks(task_text(task))
        ancestor_hashes = ancestor_list(repo, task["base_commit"])
        ancestors = set(ancestor_hashes)

        ranked_commits = sorted(
            ((score_commit(query_tokens, commit_hash), commit_hash) for commit_hash in ancestors if commit_hash in commit_docs),
            reverse=True,
        )
        raw_commits = [commit_hash for commit_score, commit_hash in ranked_commits if commit_score > 0][: args.top_raw_commits]
        if len(raw_commits) < args.top_raw_commits:
            raw_commits.extend(
                commit_hash
                for commit_hash in commit_docs
                if commit_hash in ancestors and commit_hash not in set(raw_commits)
            )
            raw_commits = raw_commits[: args.top_raw_commits]

        allowed_record_ids: list[str] = []
        selected_records: list[dict[str, Any]] = []
        if args.include_mcts and score_record is not None:
            allowed_record_ids = [
                record_id
                for record_id, record in record_by_id.items()
                if record.get("hash") in ancestors or not record.get("hash")
            ]
            ranked_records = sorted(
                ((score_record(query_tokens, record_id), record_id) for record_id in allowed_record_ids),
                reverse=True,
            )
            selected_records = [
                record_by_id[record_id]
                for record_score, record_id in ranked_records
                if record_score > 0 and record_id in record_by_id
            ][: args.top_records]
            if len(selected_records) < args.top_records:
                selected_ids = {record["id"] for record in selected_records}
                selected_records.extend(
                    record_by_id[record_id]
                    for record_id in allowed_record_ids
                    if record_id in record_by_id and record_id not in selected_ids
                )
                selected_records = selected_records[: args.top_records]

        cutoff = {
            "instance_id": instance_id,
            "base_commit": task["base_commit"],
            "allowed_commit_count": len(ancestors),
            "allowed_commit_hashes": ancestor_hashes,
            "allowed_record_ids": allowed_record_ids,
        }
        (base / "cutoffs" / f"{instance_id}.json").write_text(json.dumps(cutoff, indent=2, sort_keys=True))

        contexts = {
            "C0": "",
            "C1_raw_git": trim_words(render_raw_git(raw_commits, commit_docs, args.top_raw_commits), args.raw_max_words) + "\n",
        }
        if args.include_mcts:
            contexts["C4_mcts_mem_top8w900"] = trim_words(render_mcts(selected_records), args.mcts_max_words) + "\n"

        for condition, context in contexts.items():
            (base / "conditions" / condition / f"{instance_id}.md").write_text(context)
            dataset_rows[condition].append(make_condition_row(task, context))
        index.append(
            {
                "instance_id": instance_id,
                "raw_commit_count": len(raw_commits),
                "raw_commit_hashes": raw_commits,
                "selected_record_count": len(selected_records),
                "top_record_ids": [record["id"] for record in selected_records],
            }
        )

    for condition, rows in dataset_rows.items():
        (base / "datasets" / f"{condition}.jsonl").write_text(
            "".join(json.dumps(row, sort_keys=True) + "\n" for row in rows)
        )
    (base / "conditions" / "context_index.json").write_text(json.dumps(index, indent=2, sort_keys=True))
    print(f"generated {', '.join(condition_names)} datasets for {len(tasks)} Flipt tasks")


if __name__ == "__main__":
    main()
