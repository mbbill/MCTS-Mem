#!/bin/bash
# Build pollution-controlled per-condition kitty images:
#   kitty_c0 : no .git (true no-history baseline)
#   kitty_c1 : .git truncated to ancestors of the task base_commit (past-only)
# C4 reuses kitty_c0 (memory injected via the prompt, not the image).
#
# The official image's .git leaks ~1yr of FUTURE commits (master @ 2025-06-27),
# so we must strip/truncate it for a valid temporal-cutoff experiment.
set -euo pipefail
BASE=ghcr.io/scaleapi/swe-atlas:swe_atlas_QnA_kovidgoyal_kitty_1.0
C0=ghcr.io/scaleapi/swe-atlas:swe_atlas_QnA_kovidgoyal_kitty_c0
C1=ghcr.io/scaleapi/swe-atlas:swe_atlas_QnA_kovidgoyal_kitty_c1
BASECOMMIT=815df1e210e0a9ab4622f5c7f2d6891d7dbeddf1
WORK=/private/tmp/claude-501/-Users-bytedance-Dev-MCTS-Mem/7ac62a40-12dd-46d0-b2a2-f1f40581151c/scratchpad/kitty_git
rm -rf "$WORK"; mkdir -p "$WORK"

echo "=== 1. extract image /app/.git ==="
cid=$(docker create "$BASE" true)
docker cp "$cid:/app/.git" "$WORK/dotgit_trunc"
docker rm "$cid" >/dev/null

echo "=== 2. truncate to ancestors of $BASECOMMIT (host-native git) ==="
G="git --git-dir=$WORK/dotgit_trunc"
$G update-ref refs/heads/base "$BASECOMMIT"
$G symbolic-ref HEAD refs/heads/base
$G for-each-ref --format='%(refname)' | grep -vx 'refs/heads/base' | while read -r r; do $G update-ref -d "$r" || true; done
$G config --remove-section remote.origin 2>/dev/null || true
$G reflog expire --all --expire=now 2>/dev/null || true
$G gc --prune=now 2>&1 | tail -1
echo "newest commit after truncation: $($G log --all --format=%ci | sort | tail -1)  (expect 2024-06-24)"
echo "reachable commit count: $($G rev-list --all --count)  (expect 14146)"
du -sh "$WORK/dotgit_trunc"

echo "=== 3a. build kitty_c0 (no .git) ==="
docker build --platform linux/amd64 -t "$C0" - <<EOF 2>&1 | tail -2
FROM $BASE
RUN rm -rf /app/.git
EOF

echo "=== 3b. build kitty_c1 (truncated past-only .git) ==="
cd "$WORK"
cat > Dockerfile.c1 <<EOF
FROM $BASE
RUN rm -rf /app/.git
COPY dotgit_trunc /app/.git
EOF
docker build --platform linux/amd64 -t "$C1" -f Dockerfile.c1 . 2>&1 | tail -2

echo "=== 4. verify ==="
echo "-- C0: .git absent? --"; docker run --rm "$C0" sh -c '[ -d /app/.git ] && echo "PRESENT(bad)" || echo "ABSENT(good)"' 2>/dev/null
echo "-- C1: past-only git? --"; docker run --rm "$C1" sh -c 'cd /app; echo HEAD=$(git rev-parse --short HEAD); echo newest_all=$(git log --all --format=%ci | sort | tail -1); echo future=$(git log --all --since=2024-06-25 --oneline | wc -l)' 2>/dev/null
