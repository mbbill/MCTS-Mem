#!/usr/bin/env python3
"""Rank SWE-bench Pro repos by explicit history/design relevance signals.

This is a lightweight screening pass for choosing a better MCTS-Mem evaluation
repo than qutebrowser. It intentionally uses transparent keyword/tag signals
instead of model judgment so the first-pass ranking is reproducible.
"""

from __future__ import annotations

import argparse
import ast
import json
import re
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

from datasets import load_dataset


CORE_PATTERNS = {
    "migration": r"\bmigrat(?:e|ion|ed|ing)\b",
    "legacy": r"\blegacy\b",
    "deprecation": r"\bdeprecat(?:e|ed|ion|ing)\b",
    "compat": r"\bbackward(?:s)?[- ]compat\b|\bcompatibilit(?:y|ies)\b",
    "regression": r"\bregression\b|\bregress(?:ed|ion)?\b",
    "upgrade": r"\bupgrad(?:e|ed|ing)\b|\bdowngrad(?:e|ed|ing)\b",
    "schema": r"\bschema\b",
}

SUPPORT_PATTERNS = {
    "version": r"\bversion(?:ed|ing)?\b",
    "refactor": r"\brefactor(?:ing|ed)?\b",
    "rename_move": r"\brenam(?:e|ed|ing)\b|\bmoved?\b|\brelocat(?:e|ed|ion)\b",
    "api": r"\bAPI\b|\binterface\b",
    "config": r"\bconfig(?:uration)?\b|\bsettings?\b",
    "database": r"\bdatabase\b|\bsql\b|\bdb\b",
    "state": r"\bstate\b|\blifecycle\b|\binvariant\b|\bownership\b",
    "serialization": r"\bserializ(?:e|ed|ation)|deserializ(?:e|ed|ation)\b",
}

STRICT_SPECS = {"compatibility_bug", "regression_bug"}
REFACTOR_SPECS = {"refactoring_enh", "technical_debt_enh"}


def parse_list(value: str) -> list[str]:
    try:
        parsed = ast.literal_eval(value) if value else []
    except Exception:
        return []
    if isinstance(parsed, list):
        return [str(item) for item in parsed]
    return [str(parsed)]


def title_for(row: dict[str, Any]) -> str:
    ignored = {"title", "description", "problem", "summary"}
    statement = row.get("problem_statement", "").replace("\\n", "\n")
    for line in statement.splitlines():
        clean = " ".join(line.strip(' #"').split())
        if clean.lower().startswith("title:"):
            clean = clean[len("title:") :].strip()
        if clean and clean.lower() not in ignored:
            return clean[:140]
    return ""


def score_row(row: dict[str, Any]) -> dict[str, Any]:
    text = "\n".join(
        [
            row.get("problem_statement", ""),
            row.get("requirements", ""),
            row.get("interface", ""),
            row.get("fail_to_pass", ""),
            row.get("pass_to_pass", ""),
            row.get("selected_test_files_to_run", ""),
        ]
    )
    core_hits = [name for name, pattern in CORE_PATTERNS.items() if re.search(pattern, text, re.I)]
    support_hits = [name for name, pattern in SUPPORT_PATTERNS.items() if re.search(pattern, text, re.I)]
    specs = parse_list(row.get("issue_specificity", ""))

    core_history = bool(core_hits) or any(spec in STRICT_SPECS for spec in specs)
    design_history = core_history and (
        len(core_hits) >= 2
        or any(spec in (STRICT_SPECS | REFACTOR_SPECS) for spec in specs)
        or any(
            hit in support_hits
            for hit in ["refactor", "rename_move", "api", "config", "database", "state", "serialization"]
        )
    )
    score = (
        4.0 * len(core_hits)
        + 1.5 * len(support_hits)
        + 4.0 * sum(spec in STRICT_SPECS for spec in specs)
        + 2.0 * sum(spec in REFACTOR_SPECS for spec in specs)
    )

    instance_id = row.get("instance_id", "")
    hashes = re.findall(r"[0-9a-f]{8,40}", instance_id)
    short_id = hashes[0][:8] if hashes else instance_id[-8:]
    return {
        "instance_id": instance_id,
        "short_id": short_id,
        "title": title_for(row),
        "score": score,
        "core_hits": core_hits,
        "support_hits": support_hits,
        "issue_specificity": specs,
        "issue_categories": parse_list(row.get("issue_categories", "")),
        "core_history": core_history,
        "design_history": design_history,
    }


def build_report() -> dict[str, Any]:
    dataset = load_dataset("ScaleAI/SWE-bench_Pro", split="test")
    repos: dict[str, dict[str, Any]] = defaultdict(
        lambda: {
            "task_count": 0,
            "core_history_count": 0,
            "design_history_count": 0,
            "weighted_score_total": 0.0,
            "term_counts": Counter(),
            "examples": [],
        }
    )

    for raw_row in dataset:
        row = dict(raw_row)
        scored = score_row(row)
        repo = repos[row["repo"]]
        repo["task_count"] += 1
        repo["core_history_count"] += int(scored["core_history"])
        repo["design_history_count"] += int(scored["design_history"])
        repo["weighted_score_total"] += scored["score"]
        repo["term_counts"].update(scored["core_hits"] + scored["support_hits"])
        if scored["design_history"]:
            repo["examples"].append(scored)

    ranking = []
    for repo_name, info in repos.items():
        task_count = info["task_count"]
        examples = sorted(info["examples"], key=lambda item: item["score"], reverse=True)
        ranking.append(
            {
                "repo": repo_name,
                "task_count": task_count,
                "core_history_count": info["core_history_count"],
                "design_history_count": info["design_history_count"],
                "design_history_rate": info["design_history_count"] / task_count,
                "avg_weighted_score": info["weighted_score_total"] / task_count,
                "top_terms": info["term_counts"].most_common(10),
                "top_examples": examples[:8],
            }
        )

    ranking.sort(
        key=lambda item: (
            item["design_history_count"],
            item["avg_weighted_score"],
            item["design_history_rate"],
        ),
        reverse=True,
    )
    return {
        "dataset": "ScaleAI/SWE-bench_Pro",
        "split": "test",
        "task_count": len(dataset),
        "repo_count": len(ranking),
        "scoring": {
            "core_patterns": sorted(CORE_PATTERNS),
            "support_patterns": sorted(SUPPORT_PATTERNS),
            "strict_issue_specificity": sorted(STRICT_SPECS),
            "refactor_issue_specificity": sorted(REFACTOR_SPECS),
            "design_history_definition": (
                "core history signal or compat/regression tag, plus either >=2 core signals, "
                "a strict/refactor issue tag, or supporting design evidence such as API/config/database/state."
            ),
        },
        "ranking": ranking,
    }


def write_markdown(report: dict[str, Any], path: Path) -> None:
    lines = [
        "# SWE-bench Pro History-Relevance Repo Screen",
        "",
        "Last updated: 2026-06-27",
        "",
        "Scope: public `ScaleAI/SWE-bench_Pro` `test` split, 731 tasks across 11 repositories.",
        "",
        "Goal: find a SWE-bench Pro repository whose tasks are more likely to need durable repo-history/design memory than qutebrowser's pooled task set.",
        "",
        "## Method",
        "",
        "A task is counted as design/history-related when it has an explicit history signal or a compatibility/regression tag, plus supporting design evidence.",
        "",
        "Core history signals: migration, legacy, deprecation, compatibility, regression, upgrade/downgrade, schema.",
        "",
        "Supporting design signals: version, refactor, rename/move, API/interface, config/settings, database/SQL, state/lifecycle/invariant/ownership, serialization.",
        "",
        "Issue tags used as priors: `compatibility_bug`, `regression_bug`, `refactoring_enh`, `technical_debt_enh`.",
        "",
        "This is a screening heuristic, not a final task-selection label. It should be followed by manual audit or a reviewer-scored selection pass before spending generation budget.",
        "",
        "## Ranking",
        "",
        "| rank | repo | tasks | design/history tasks | rate | avg score | readout |",
        "| ---: | --- | ---: | ---: | ---: | ---: | --- |",
    ]
    readouts = {
        "ansible/ansible": "highest absolute count; many compatibility/deprecation/legacy tasks; large repo/harness cost",
        "flipt-io/flipt": "near-top absolute count; strong config/schema/database compatibility cluster; likely most practical next target",
        "qutebrowser/qutebrowser": "scores high, but repeat1 showed pooled dilution; keep as baseline/prototype, not main proof",
        "gravitational/teleport": "upgrade/cluster compatibility tasks; potentially strong but operationally heavier",
        "element-hq/element-web": "high rate of UI/state/refactor history signals; frontend stack may add noise",
        "future-architect/vuls": "version/security database and legacy scan-result tasks; promising specialized option",
        "tutao/tutanota": "highest small-repo rate, but only 20 tasks; useful as supplemental slice, not main corpus",
    }
    for index, item in enumerate(report["ranking"], start=1):
        lines.append(
            "| {rank} | `{repo}` | {tasks} | {design} | {rate:.2f} | {avg:.1f} | {readout} |".format(
                rank=index,
                repo=item["repo"],
                tasks=item["task_count"],
                design=item["design_history_count"],
                rate=item["design_history_rate"],
                avg=item["avg_weighted_score"],
                readout=readouts.get(item["repo"], "screened candidate"),
            )
        )

    lines.extend(
        [
            "",
            "## Recommendation",
            "",
            "If the next experiment must stay inside SWE-bench Pro, use `flipt-io/flipt` or `ansible/ansible` rather than qutebrowser as the next MCTS-Mem target.",
            "",
            "- `ansible/ansible` has the most absolute history/design-related tasks by this screen: 44 of 96. It is the best answer to 'which repo contains the most history-related tests?' However, it is a large and mature Python project, so mining/build cost and harness runtime may be high.",
            "- `flipt-io/flipt` is the best practical next target: 42 of 85 tasks, a high rate, and many config/schema/database/API compatibility tasks. It should provide a cleaner MCTS-Mem signal than qutebrowser while remaining more tractable than Ansible.",
            "- `qutebrowser/qutebrowser` should be treated as a harness/prototype repo and a dilution result. It scores high on textual history signals, but the full79 C4-vs-C1 result was only +1, so its pooled corpus is not the strongest proof setting.",
            "",
            "Suggested next step: run the same memory-relevance reviewer selection pass on `flipt-io/flipt` and `ansible/ansible`, then choose the repo with the larger high-confidence selected slice before spending on full C0/C1/C4 generation.",
            "",
            "## Top Examples",
            "",
        ]
    )
    for item in report["ranking"][:6]:
        lines.extend([f"### `{item['repo']}`", ""])
        lines.append("Top screened tasks:")
        lines.append("")
        for example in item["top_examples"][:5]:
            core = ",".join(example["core_hits"])
            support = ",".join(example["support_hits"][:4])
            specs = ",".join(example["issue_specificity"][:3])
            lines.append(
                f"- `{example['short_id']}` score={example['score']:.1f}; core={core or '-'}; support={support or '-'}; specs={specs or '-'}; {example['title']}"
            )
        lines.append("")

    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--json", type=Path, default=Path("paper/evaluations/swebench_history_repo_screen.json"))
    parser.add_argument("--md", type=Path, default=Path("paper/evaluations/swebench_history_repo_screen.md"))
    args = parser.parse_args()

    report = build_report()
    args.json.parent.mkdir(parents=True, exist_ok=True)
    args.md.parent.mkdir(parents=True, exist_ok=True)
    args.json.write_text(json.dumps(report, indent=2), encoding="utf-8")
    write_markdown(report, args.md)

    for item in report["ranking"]:
        print(
            f"{item['repo']:32s} tasks={item['task_count']:3d} "
            f"design={item['design_history_count']:3d} "
            f"rate={item['design_history_rate']:.2f} "
            f"avg={item['avg_weighted_score']:.1f}"
        )


if __name__ == "__main__":
    main()
