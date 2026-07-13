#!/usr/bin/env python3
"""Extract the SWE-Atlas Codebase QnA task manifest from scaleapi/SWE-Atlas.

Pulls every `data/qa/task-*/task.toml`, parses the source repository, base
commit, category, and language, and writes:
  - tasks/qna_tasks.jsonl   one row per QnA task
  - docs/repo_distribution.json   per-repo / per-category aggregates

Reproducible: reads the live GitHub tree, no auth needed (public repo).
Run from paper/evaluations/swe_atlas_qna/:  python3 scripts/extract_qna_tasks.py
"""
import json, re, os, sys, urllib.request, concurrent.futures
from collections import Counter, defaultdict

RAW = "https://raw.githubusercontent.com/scaleapi/SWE-Atlas/main/"
TREE = "https://api.github.com/repos/scaleapi/SWE-Atlas/git/trees/main?recursive=1"
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "mcts-mem-eval"})
    return urllib.request.urlopen(req, timeout=60).read().decode("utf-8", "replace")


def field(txt, key):
    m = re.search(rf'^{key}\s*=\s*"([^"]*)"', txt, re.M)
    return m.group(1) if m else None


def main():
    tree = json.loads(get(TREE))
    tomls = [t["path"] for t in tree["tree"]
             if re.match(r"data/qa/task-[^/]+/task\.toml$", t["path"])]
    print(f"QnA task.toml files: {len(tomls)}")

    def fetch(p):
        txt = get(RAW + p)
        task_id = p.split("/")[2]
        return {
            "task_id": task_id,
            "subset": "qa",
            "repository": (field(txt, "repository") or "").lower(),
            "base_commit": field(txt, "base_commit"),
            "category": field(txt, "category"),
            "language": field(txt, "language"),
            "docker_image": field(txt, "docker_image"),
            "toml_path": p,
        }

    with concurrent.futures.ThreadPoolExecutor(max_workers=32) as ex:
        rows = list(ex.map(fetch, tomls))
    rows.sort(key=lambda r: (r["repository"], r["task_id"]))

    os.makedirs(os.path.join(HERE, "tasks"), exist_ok=True)
    os.makedirs(os.path.join(HERE, "docs"), exist_ok=True)
    with open(os.path.join(HERE, "tasks", "qna_tasks.jsonl"), "w") as f:
        for r in rows:
            f.write(json.dumps(r) + "\n")

    per_repo = Counter(r["repository"] for r in rows)
    per_cat = Counter(r["category"] for r in rows)
    per_lang = Counter(r["language"] for r in rows)
    repo_cat = defaultdict(Counter)
    repo_has_base = defaultdict(lambda: [0, 0])
    for r in rows:
        repo_cat[r["repository"]][r["category"]] += 1
        repo_has_base[r["repository"]][0] += 1
        repo_has_base[r["repository"]][1] += 1 if r["base_commit"] else 0

    agg = {
        "total_qna_tasks": len(rows),
        "distinct_repos": len(per_repo),
        "per_repo": dict(per_repo.most_common()),
        "per_category": dict(per_cat.most_common()),
        "per_language": dict(per_lang.most_common()),
        "per_repo_category": {k: dict(v.most_common()) for k, v in repo_cat.items()},
        "per_repo_base_commit_coverage": {k: f"{v[1]}/{v[0]}" for k, v in repo_has_base.items()},
    }
    with open(os.path.join(HERE, "docs", "repo_distribution.json"), "w") as f:
        json.dump(agg, f, indent=2)

    print(f"total={len(rows)}  repos={len(per_repo)}")
    print("\nper repo (QnA tasks):")
    cum = 0
    for repo, c in per_repo.most_common():
        cum += c
        print(f"  {c:3d}  ({cum:3d} cum)  {repo}")
    print("\nper category:")
    for cat, c in per_cat.most_common():
        print(f"  {c:3d}  {cat}")
    print("\nper language:", dict(per_lang.most_common()))
    miss = [r["task_id"] for r in rows if not r["base_commit"]]
    print(f"\ntasks missing base_commit: {len(miss)}")


if __name__ == "__main__":
    main()
