#!/usr/bin/env python3
"""Mine high-signal Flipt git history into retrieval records for C4.

This is a reproducible paper-side extractor. It is intentionally conservative:
it records commits that touch live source/config/API surfaces and whose subject,
body, or paths indicate durable design/history relevance. The records are not a
finished audited MCTS-Mem tree; they are the time-filtered evidence pool used to
generate the Flipt C4 condition while the full tree reduction remains auditable
under ``extraction/``.
"""

from __future__ import annotations

import argparse
from collections import Counter
import json
from pathlib import Path
import re
import subprocess
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_REPO = ROOT.parents[1] / "repos" / "flipt"

SOURCE_EXTENSIONS = {
    ".go",
    ".proto",
    ".cue",
    ".yaml",
    ".yml",
    ".json",
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".md",
}

NOISY_SUBJECT = re.compile(
    r"(?i)^(chore\(deps|chore\(deps-dev|chore: release|docs\(release\)|ci:|build\(deps|"
    r"update funding|bump |merge branch|revert \"?chore|release v|prepare release)"
)
HIGH_SIGNAL = re.compile(
    r"(?i)\b(config|schema|validation|validate|storage|git|environment|namespace|compat|backward|"
    r"legacy|deprecat|migrat|refactor|replace|switch|convert|move|remove|drop|api|proto|openapi|"
    r"evaluation|constraint|rollout|variant|ofrep|auth|token|jwt|oidc|cache|redis|database|sql|"
    r"secret|vault|signing|metrics|tracing|analytics|yaml|import|export|snapshot)\b"
)
RATIONALE = re.compile(r"(?i)\b(because|so that|in order to|to avoid|ensure|allows?|prevents?|fixes?|support|compat)\b")


def git(repo: Path, *args: str, timeout: int = 120) -> str:
    return subprocess.check_output(["git", "-C", str(repo), *args], text=True, stderr=subprocess.DEVNULL, timeout=timeout)


def iter_commits(repo: Path) -> list[dict[str, Any]]:
    raw = git(
        repo,
        "log",
        "--reverse",
        "--name-only",
        "--format=%x1e%H%x00%h%x00%cs%x00%s%x00%b%x1f",
        timeout=240,
    )
    commits: list[dict[str, Any]] = []
    for seq, chunk in enumerate([part for part in raw.split("\x1e") if part.strip()], 1):
        if "\x1f" not in chunk:
            continue
        header, names = chunk.split("\x1f", 1)
        fields = header.strip("\n").split("\x00", 4)
        if len(fields) != 5:
            continue
        full_hash, short_hash, date, subject, body = fields
        paths = [line.strip() for line in names.splitlines() if line.strip()]
        commits.append(
            {
                "seq": seq,
                "hash": full_hash,
                "short": short_hash,
                "date": date,
                "subject": subject.strip(),
                "body": body.strip(),
                "paths": paths,
            }
        )
    return commits


def source_paths(paths: list[str]) -> list[str]:
    out = []
    for path in paths:
        suffix = Path(path).suffix.lower()
        if suffix in SOURCE_EXTENSIONS and not path.startswith((".github/", "build/testing/")):
            out.append(path)
    return out


def concept_for(subject: str, paths: list[str]) -> tuple[str, list[str]]:
    text = " ".join([subject, *paths]).lower()
    if "internal/config" in text or "config/" in text or "flipt.schema" in text:
        if "environment" in text:
            return "configuration/environments", [p for p in paths if "config" in p or "environment" in p][:6]
        if "secret" in text or "vault" in text:
            return "configuration/secrets", [p for p in paths if "secret" in p or "config" in p][:6]
        return "configuration", [p for p in paths if "config" in p or "schema" in p][:6]
    if "internal/storage/git" in text or "storage/environments/git" in text or "git" in subject.lower():
        return "storage/git-native", [p for p in paths if "storage" in p or "git" in p][:6]
    if "internal/storage" in text or "snapshot" in text or "filesystem" in text:
        if "fs" in text or "snapshot" in text:
            return "storage/filesystem-snapshot", [p for p in paths if "storage" in p or "core/validation" in p][:6]
        return "storage", [p for p in paths if "storage" in p][:6]
    if "constraint" in text or "rollout" in text or "variant" in text:
        return "evaluation/constraints", [p for p in paths if "evaluation" in p or "validation" in p or "core" in p][:6]
    if "evaluation" in text or "ofrep" in text:
        return "evaluation", [p for p in paths if "evaluation" in p or "ofrep" in p][:6]
    if "auth" in text or "token" in text or "jwt" in text or "oidc" in text:
        return "server/authentication", [p for p in paths if "auth" in p or "server" in p][:6]
    if "analytics" in text or "metrics" in text or "tracing" in text or "otel" in text:
        return "server/analytics", [p for p in paths if any(x in p for x in ["analytics", "metrics", "tracing", "otel"])][:6]
    if "rpc/" in text or ".proto" in text or "openapi" in text or "sdk" in text:
        if "validation" in text or "schema" in text or "import" in text or "export" in text:
            return "apis/schema-validation", [p for p in paths if any(x in p for x in ["rpc", "core", "ext", "validation"])][:6]
        return "apis", [p for p in paths if any(x in p for x in ["rpc", "proto", "openapi", "sdk"])][:6]
    if "ui/" in text or "react" in text or "typescript" in text:
        return "ui", [p for p in paths if p.startswith("ui/")][:6]
    if "cmd/flipt" in text or "quickstart" in text or "wizard" in text:
        return "ui/cli-tui", [p for p in paths if "cmd/flipt" in p or "internal/cmd" in p][:6]
    if "server" in text or "middleware" in text or "gateway" in text:
        return "server", [p for p in paths if "server" in p or "gateway" in p][:6]
    return "flipt", paths[:6]


def kind_for(subject: str, body: str, concept: str) -> str:
    text = f"{subject}\n{body}".lower()
    if any(word in text for word in ["deprecat", "compat", "legacy", "backward"]):
        return "compatibility"
    if any(word in text for word in ["refactor", "replace", "switch", "migrat", "convert", "move "]):
        return "re-decision"
    if any(word in text for word in ["fix", "bug", "panic", "race", "nil", "regression"]):
        return "pitfall"
    if "schema" in text or "validation" in text or "validate" in text:
        return "schema"
    if "config" in concept:
        return "configuration"
    if "storage" in concept:
        return "storage"
    if "evaluation" in concept:
        return "evaluation"
    if "auth" in concept:
        return "authentication"
    return "rationale" if RATIONALE.search(text) else "statement"


def first_body_sentence(body: str) -> str:
    lines = [line.strip(" -*\t") for line in body.splitlines() if line.strip()]
    lines = [line for line in lines if not line.lower().startswith(("co-authored-by:", "signed-off-by:"))]
    if not lines:
        return ""
    joined = " ".join(lines)
    sentence = re.split(r"(?<=[.!?])\s+", joined)[0]
    return sentence[:500]


def should_record(commit: dict[str, Any]) -> tuple[bool, str]:
    subject = commit["subject"]
    paths = source_paths(commit["paths"])
    if not paths:
        return False, "no-source-paths"
    text = "\n".join([subject, commit["body"], *paths])
    if NOISY_SUBJECT.search(subject) and not HIGH_SIGNAL.search(text):
        return False, "paperwork"
    if not HIGH_SIGNAL.search(text):
        return False, "low-signal"
    docs_only = all(path.endswith((".md", ".rst", ".adoc", ".asciidoc")) for path in paths)
    if docs_only and not HIGH_SIGNAL.search(subject):
        return False, "docs-only"
    return True, "record"


def make_record(commit: dict[str, Any]) -> dict[str, Any] | None:
    ok, _ = should_record(commit)
    if not ok:
        return None
    paths = source_paths(commit["paths"])
    concept, anchors = concept_for(commit["subject"], paths)
    body_sentence = first_body_sentence(commit["body"])
    touched = ", ".join(paths[:5])
    text = commit["subject"].rstrip(".") + "."
    if body_sentence and body_sentence.lower() not in commit["subject"].lower():
        text += f" Source note: {body_sentence.rstrip('.')} ."
    if touched:
        text += f" Touched: {touched}."
    return {
        "id": f"flipt-{commit['seq']:05d}-{commit['short']}",
        "seq": commit["seq"],
        "type": "fact",
        "kind": kind_for(commit["subject"], commit["body"], concept),
        "date": commit["date"],
        "hash": commit["hash"],
        "short_hash": commit["short"],
        "provenance": "(sourced)" if commit["body"] else "(code)",
        "concept": {"name": concept, "anchors": anchors or paths[:4]},
        "text": re.sub(r"\s+", " ", text).strip(),
        "subject": commit["subject"],
        "paths": paths[:20],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path, default=DEFAULT_REPO)
    parser.add_argument("--output", type=Path, default=ROOT / "extraction" / "all-records.jsonl")
    parser.add_argument("--summary", type=Path, default=ROOT / "extraction" / "history_records_summary.json")
    args = parser.parse_args()

    commits = iter_commits(args.repo)
    records = [record for commit in commits if (record := make_record(commit)) is not None]
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text("".join(json.dumps(record, sort_keys=True) + "\n" for record in records))
    (ROOT / "extraction" / "records" / "auto-history.records.jsonl").write_text(
        "".join(json.dumps(record, sort_keys=True) + "\n" for record in records)
    )

    summary = {
        "repo": str(args.repo),
        "commit_count": len(commits),
        "record_count": len(records),
        "records_by_kind": dict(sorted(Counter(record["kind"] for record in records).items())),
        "records_by_concept": dict(sorted(Counter(record["concept"]["name"] for record in records).items())),
    }
    args.summary.write_text(json.dumps(summary, indent=2, sort_keys=True))
    print(json.dumps(summary, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
