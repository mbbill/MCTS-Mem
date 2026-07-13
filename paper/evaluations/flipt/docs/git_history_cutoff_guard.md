# Git History Cutoff Guard

Date: 2026-06-28. Updated 2026-06-29.

## Finding

The generated context datasets were cutoff-correct, but the first full Flipt generation run was not shell-isolated from repository history.

- `C1_raw_git` context is built from `git rev-list <base_commit>` and injects only top matching ancestor commit messages.
- `C4_mcts_mem_top8w900` context is filtered to records whose commits are ancestors of the task `base_commit`.
- The live mini-SWE-agent container still exposed the repository `.git` directory, and `run_condition.py` previously had `looks_disallowed_search()` returning `False`.
- Trajectory audit found real live-history use, including `git log`, `git show`, `git rev-list --all`, and revision-qualified `git grep`.

Conclusion: `results/full85_three_arm_gpt55_mt2048_repeat1_unguarded_exploratory_stopped49` is exploratory only. It must not be reported as a clean paper result.

## Fix

`scripts/run_condition.py` now supports explicit git history modes before the agent starts.

For `--git-history-mode snapshot`, used by `C0`:

1. Reset and clean the checkout.
2. Remove `.git`.
3. Reinitialize a new one-commit repository containing the task snapshot.
4. Preserve the original task commit in `.git/mcts-mem-original-head` for audit only.

This preserves normal patch mechanics such as `git diff`, `git status`, and `git checkout -- path`, while removing access to live repository history. The action wrapper also rejects common history-inspection commands: `git log`, `git show`, `git rev-list`, `git blame`, `git cat-file`, `git ls-tree`, `git for-each-ref`, revision-qualified `git grep`, and commit checkout/switch commands.

For `--git-history-mode cutoff`, used by `C1_git_history` and `C4_git_history_mcts_mem`:

1. Build a host-side git bundle from `paper/repos/flipt` containing refs up to the task `base_commit`.
2. Copy the bundle into the container and replace the image `.git` directory.
3. Fetch only the cutoff ref and check out `benchmark-base` at the task base commit.
4. Verify that `git rev-list --all --not <base_commit> --count` is zero.
5. Set `MCTS_MEM_ALLOW_GIT_HISTORY=1`, so the agent may freely inspect the cutoff-limited `.git` history.

The GPT-5.2 prompt in `configs/mild_swebench_gpt52_git.yaml` states that cutoff-limited `.git` history may be inspected when available, while later history must not be available.

## Clean Run

The completed GPT-5.2 clean repeat-1 full-corpus run writes to:

```text
paper/evaluations/flipt/results/full85_three_arm_gpt52_codex_cutoffgit_repeat1
```

Run command:

```bash
paper/evaluations/flipt/scripts/run_gpt52_full85_three_arm_by_instance_repeat1.sh
```

The repeat-1 audit confirmed the guard behavior across the completed run: all 85 C0 runner logs contain git-history sanitization, and all 85 C1/C4 runner logs report cutoff checks with no future commits visible. Final local targeted grading resolved C0=8/85, C1=7/85, and C4=4/85 after force-regrading a transient Rosetta compiler crash, but `docs/gpt52_repeat1_audit.md` treats those scores as a strict-harness diagnostic rather than a clean capability result. The reference-patch oracle resolves 85/85 tasks, and the low model scores are not explained by a cutoff-history guard failure.
