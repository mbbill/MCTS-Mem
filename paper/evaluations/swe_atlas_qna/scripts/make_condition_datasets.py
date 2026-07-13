#!/usr/bin/env python3
"""Generate per-condition kitty QnA dataset dirs for harbor.

Each condition is a dir of 26 task copies with:
  - task.toml docker_image pointed at the condition image
  - instruction.md augmented with the condition's prompt

  C0  no .git, no augmentation            -> image kitty_c0
  C1  past-only .git + git-explore nudge   -> image kitty_c1
  C4  no .git + MCTS-Mem memory + nudge     -> image kitty_c0, memory from --memory-file

Usage:
  make_condition_datasets.py C0
  make_condition_datasets.py C1
  make_condition_datasets.py C4 --memory-file path/to/rendered_tree.md
"""
import os, re, sys, shutil, argparse

ATLAS_QA = "/Users/bytedance/Dev/SWE-Atlas/data/qa"
WS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NAMES = os.path.join(WS, "tasks", "kitty_qna_task_names.txt")
IMG = {
    "C0": "ghcr.io/scaleapi/swe-atlas:swe_atlas_QnA_kovidgoyal_kitty_c0",
    "C1": "ghcr.io/scaleapi/swe-atlas:swe_atlas_QnA_kovidgoyal_kitty_c1",
    "C4": "ghcr.io/scaleapi/swe-atlas:swe_atlas_QnA_kovidgoyal_kitty_c0",
}

GIT_NUDGE = (
    "Note: The repository at /app includes its git history up to the current commit. "
    "You may explore it with git (for example `git log`, `git log -p <path>`, "
    "`git show <commit>`, `git log -S<string>`) to see how and why the code reached its "
    "current design while forming your answer."
)

MEM_HEADER = (
    "# Design memory (MCTS-Mem)\n"
    "Below is a distilled, machine-checked record of this project's design decisions, "
    "recovered from its history up to the current commit: the decisions that hold, the "
    "alternatives that were tried and dropped, and the dated facts behind each. Use it as "
    "design memory while answering — read the relevant decisions and their rationale before "
    "explaining how/why the code works. It does not replace reading the code at /app.\n"
)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("condition", choices=["C0", "C1", "C4"])
    ap.add_argument("--memory-file", help="rendered MCTS-Mem tree (required for C4)")
    args = ap.parse_args()
    cond = args.condition
    names = [n for n in open(NAMES).read().split() if n.strip()]
    mem = ""
    if cond == "C4":
        if not args.memory_file:
            sys.exit("C4 requires --memory-file")
        mem = open(args.memory_file).read()

    out = os.path.join(WS, "conditions", cond)
    shutil.rmtree(out, ignore_errors=True)
    os.makedirs(out, exist_ok=True)
    for n in names:
        src, dst = os.path.join(ATLAS_QA, n), os.path.join(out, n)
        shutil.copytree(src, dst)
        # task.toml -> condition image
        tp = os.path.join(dst, "task.toml")
        t = open(tp).read()
        t = re.sub(r'docker_image = "[^"]*"', f'docker_image = "{IMG[cond]}"', t)
        open(tp, "w").write(t)
        # instruction.md augmentation
        ip = os.path.join(dst, "instruction.md")
        instr = open(ip).read()
        if cond == "C1":
            instr = instr.rstrip() + "\n\n" + GIT_NUDGE + "\n"
        elif cond == "C4":
            # C4 uses the no-git image; inject the whole distilled tree, no git nudge.
            instr = MEM_HEADER + "\n" + mem.rstrip() + "\n\n---\n\n" + instr
        open(ip, "w").write(instr)
    print(f"{cond}: wrote {len(names)} task dirs -> {out}  (image {IMG[cond]})")


if __name__ == "__main__":
    main()
