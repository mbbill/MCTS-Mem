#!/usr/bin/env python3
"""Summarize a harbor SWE-Atlas QnA job into per-task and aggregate scores.

For each trial it reports:
  - reward         binary pass (all scored must-have rubrics pass)  [headline]
  - agg_score      fraction of ALL scored rubrics passed            [item recall]
  - mh_recall      fraction of scored MUST-HAVE rubrics passed
  - errored        trial raised before verification (e.g. env failure)

Sources, in order of preference, per trial:
  1) the in-container judge artifact evaluation_results.json (richest), else
  2) result.json -> verifier_result.rewards (harbor's reward dict).

Usage: python3 scripts/parse_results.py <job-results-dir> [--label C0]
"""
import json, os, sys, glob
from collections import defaultdict

WS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MANIFEST = os.path.join(WS, "tasks", "qna_tasks.jsonl")


def load_manifest():
    m = {}
    if os.path.exists(MANIFEST):
        for r in map(json.loads, open(MANIFEST)):
            m[r["task_id"]] = r
    return m


def find_eval_results(trial_dir):
    hits = glob.glob(os.path.join(trial_dir, "**", "evaluation_results.json"), recursive=True)
    return hits[0] if hits else None


def trial_id_from_path(p):
    # task path basename, e.g. /.../data/qa/task-XXXX -> task-XXXX
    return os.path.basename(p.rstrip("/"))


def main():
    if len(sys.argv) < 2:
        print(__doc__); sys.exit(1)
    job_dir = sys.argv[1]
    label = sys.argv[sys.argv.index("--label") + 1] if "--label" in sys.argv else os.path.basename(job_dir.rstrip("/"))
    man = load_manifest()

    rows = []
    for rj in glob.glob(os.path.join(job_dir, "**", "result.json"), recursive=True):
        # skip the job-level result.json (no task_id field)
        d = json.load(open(rj))
        if not isinstance(d, dict) or "task_id" not in d:
            continue
        tdir = os.path.dirname(rj)
        tid = trial_id_from_path(d.get("task_id", {}).get("path", ""))
        meta = man.get(tid, {})
        row = {"task_id": tid, "category": meta.get("category"), "errored": False,
               "reward": None, "agg_score": None, "mh_recall": None, "note": ""}

        if d.get("exception_info"):
            row["errored"] = True
            row["note"] = d["exception_info"].get("exception_type", "error")

        er_path = find_eval_results(tdir)
        if er_path:
            er = json.load(open(er_path))
            row["reward"] = int(er.get("reward", 0))
            row["agg_score"] = er.get("agg_score")
            nm = er.get("num_scored_must_have") or 0
            mh_pass = sum(1 for r in er.get("rubric_scores", [])
                          if r.get("importance") == "must have" and str(r.get("score", {}).get("score")) == "1")
            row["mh_recall"] = (mh_pass / nm) if nm else None
        elif d.get("verifier_result"):
            rew = d["verifier_result"].get("rewards")
            if isinstance(rew, dict):
                # take the first numeric value as the reward
                for v in rew.values():
                    if isinstance(v, (int, float)):
                        row["reward"] = int(v); break
        rows.append(row)

    rows.sort(key=lambda r: (r["category"] or "", r["task_id"]))
    graded = [r for r in rows if r["reward"] is not None]
    errored = [r for r in rows if r["errored"]]
    passed = [r for r in graded if r["reward"] == 1]

    def mean(xs):
        xs = [x for x in xs if x is not None]
        return sum(xs) / len(xs) if xs else float("nan")

    print(f"\n=== {label} === ({len(rows)} trials, {len(graded)} graded, {len(errored)} errored)")
    print(f"{'task_id':40s} {'cat':28s} {'pass':>4} {'agg':>5} {'mh':>5} note")
    for r in rows:
        agg = f"{r['agg_score']:.2f}" if r['agg_score'] is not None else "  -"
        mh = f"{r['mh_recall']:.2f}" if r['mh_recall'] is not None else "  -"
        pa = "-" if r["reward"] is None else r["reward"]
        print(f"{r['task_id']:40s} {(r['category'] or '')[:28]:28s} {str(pa):>4} {agg:>5} {mh:>5} {r['note']}")

    print(f"\nPASS RATE (binary):   {len(passed)}/{len(graded)}"
          + (f" = {len(passed)/len(graded):.3f}" if graded else ""))
    print(f"MEAN agg_score:       {mean([r['agg_score'] for r in graded]):.3f}  (all-rubric item recall)")
    print(f"MEAN must-have recall:{mean([r['mh_recall'] for r in graded]):.3f}")

    # per-category
    bycat = defaultdict(list)
    for r in graded:
        bycat[r["category"]].append(r)
    print("\nby category:")
    for cat, rs in sorted(bycat.items()):
        p = sum(1 for r in rs if r["reward"] == 1)
        print(f"  {str(cat)[:28]:28s} pass {p}/{len(rs)}  agg {mean([r['agg_score'] for r in rs]):.3f}")

    os.makedirs(job_dir, exist_ok=True)
    out = os.path.join(job_dir, "qna_summary.json")
    with open(out, "w") as f:
        json.dump({"label": label, "rows": rows,
                   "pass_rate": (len(passed) / len(graded)) if graded else None,
                   "n_graded": len(graded), "n_errored": len(errored),
                   "mean_agg_score": mean([r['agg_score'] for r in graded]),
                   "mean_mh_recall": mean([r['mh_recall'] for r in graded])}, f, indent=2)
    print(f"\nwrote {out}")


if __name__ == "__main__":
    main()
