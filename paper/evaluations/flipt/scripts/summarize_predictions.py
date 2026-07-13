#!/usr/bin/env python3
"""Summarize mini-SWE-agent prediction outputs before official grading."""
from __future__ import annotations
import argparse, json
from pathlib import Path

NON_CONDITION_DIRS = {"bundles", "ids", "local_grade_reports", "supervisor_logs"}

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('results_dir')
    args=ap.parse_args()
    root=Path(args.results_dir)
    rows=[]
    for cond_dir in sorted([p for p in root.iterdir() if p.is_dir() and p.name not in NON_CONDITION_DIRS]):
        preds=cond_dir/'preds.json'
        data=json.loads(preds.read_text()) if preds.exists() else {}
        trajs=list(cond_dir.glob('*/*.traj.json'))
        exits={}
        for t in trajs:
            try:
                info=json.loads(t.read_text()).get('info',{})
                exits[info.get('exit_status','unknown')]=exits.get(info.get('exit_status','unknown'),0)+1
            except Exception:
                exits['bad-traj']=exits.get('bad-traj',0)+1
        nonempty=sum(1 for p in data.values() if (p.get('model_patch') or '').strip())
        rows.append({'condition':cond_dir.name,'predictions':len(data),'nonempty_patches':nonempty,'trajectories':len(trajs),'exit_statuses':exits})
    print(json.dumps(rows, indent=2))
    (root/'summary.json').write_text(json.dumps(rows, indent=2))
if __name__=='__main__': main()
