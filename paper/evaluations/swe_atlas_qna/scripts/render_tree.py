#!/usr/bin/env python3
"""Render an MCTS-Mem tree dir into a single design-memory markdown document.

Main tree first (current decisions), then a 'Rejected alternatives' section
(the .alt members, so the agent sees what was tried and why it lost).

Usage: render_tree.py <tree-dir-containing-root.md-and-root/> <root-name> [> memory.md]
"""
import os, sys

tree_dir = sys.argv[1]
root = sys.argv[2] if len(sys.argv) > 2 else "kitty"


def node_title(relpath):
    # kitty/remote-control/encryption.md -> remote-control / encryption
    p = relpath[:-3]  # strip .md
    parts = [seg for seg in p.split("/") if not seg.endswith(".alt") and seg != root]
    return " / ".join(parts) if parts else root


def collect(base):
    main, alt = [], []
    for dirpath, _, files in os.walk(base):
        for f in sorted(files):
            if not f.endswith(".md"):
                continue
            full = os.path.join(dirpath, f)
            rel = os.path.relpath(full, tree_dir)
            (alt if ".alt/" in rel else main).append(rel)
    return sorted(main), sorted(alt)


out = []
# root
root_md = os.path.join(tree_dir, root + ".md")
out.append(f"## {root}\n")
out.append(open(root_md).read().strip() + "\n")

main, alt = collect(os.path.join(tree_dir, root))
out.append("\n# Current design decisions\n")
for rel in main:
    out.append(f"\n## {node_title(rel)}\n")
    out.append(open(os.path.join(tree_dir, rel)).read().strip() + "\n")

if alt:
    out.append("\n# Rejected / superseded alternatives (kept for the reasons they lost)\n")
    for rel in alt:
        # title: parent decision + losing form
        name = os.path.basename(rel)[:-3]
        parent = node_title(rel)
        out.append(f"\n## REJECTED: {parent} — {name}\n")
        out.append(open(os.path.join(tree_dir, rel)).read().strip() + "\n")

doc = "\n".join(out)
sys.stdout.write(doc)
sys.stderr.write(f"[rendered {len(main)} main + {len(alt)} alt nodes; "
                 f"{len(doc.split())} words, {len(doc)} chars]\n")
