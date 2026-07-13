# qutebrowser MCTS-Mem Evaluation Record

Last updated: 2026-06-27

This is the current paper-side source of truth for the qutebrowser SWE-bench Pro evaluation. Keep this file current when new runs, grading fixes, or interpretation changes land.

## Current Claim State

The strongest current paper-scale result is one clean 79-task three-arm repeat:

| condition | resolved | nonempty predictions | role |
| --- | ---: | ---: | --- |
| C0 | 24/79 | 73/79 | no-memory baseline |
| C1_raw_git | 30/79 | 71/79 | raw pre-cutoff git-history context control |
| C4_mcts_mem_top8w900 | 31/79 | 69/79 | trimmed MCTS-Mem context: top 8 records, max 900 words |

Interpretation:

- C4 improves over no memory in this repeat: `31/79` vs `24/79` (+7 absolute; paired 10 C4 wins / 3 C4 losses).
- C4 only narrowly improves over raw git: `31/79` vs `30/79` (+1 absolute; paired 6 C4 wins / 5 C4 losses). Treat this as weak/noisy unless paired/bootstrap, stratified, or repeat evidence strengthens it.
- The selected top-12 slice remains positive for C4 against both controls (`C0=2/12`, `C1=1/12`, `C4=4/12`), but it is selected-slice evidence, not the pooled headline.
- C4 produced more empty patches than both controls (`10` vs C0 `6`, C1 `8`), so generation reliability/control-loop cost must be reported as a caveat.
- The raw-git control is strong on the pooled full corpus. Do not claim that raw git cannot explain MCTS-Mem gains globally; that statement is only supported on the selected top-12 slice.

## Conditions

The current paper arms are:

| ID | Memory slot | Purpose |
| --- | --- | --- |
| C0 | empty | no-memory baseline |
| C1_raw_git | raw pre-cutoff git commits/diffs | same source material, no MCTS-Mem distillation |
| C4_mcts_mem_top8w900 | rendered MCTS-Mem records, top 8, max 900 words | current trimmed memory condition |

Dropped from the current evaluation budget:

- C2a / format-only / flattened-memory ablation.
- no-`.alt` ablation.
- CommitDistill-style regex-unit baseline.
- C5 / ReasoningBank-style trajectory memory baseline.

Do not reintroduce these unless a new question requires them. The current open question is robustness of the three-arm C0/C1/C4 result.

## Full79 Repeat1

Paper-side summary archive:

```text
/Users/bytedance/Dev/MCTS-Mem/paper/evaluations/qutebrowser/artifacts/full79_three_arm_gpt55_mt2048_repeat1/local_grade_reports
```

Generation settings:

```text
ANTHROPIC_API_KEY=local
ANTHROPIC_API_BASE=http://127.0.0.1:8787
MSWEA_AFTER_DIFF_WARN_ACTIONS=2
MSWEA_AFTER_DIFF_REJECT_ACTIONS=3
model=anthropic/claude-gpt-5.5
--include-test-context
config=eval/mcts_mem_swebench_pro_qutebrowser/configs/mild_swebench.yaml
agent.max_consecutive_format_errors=4
agent.step_limit=24
agent.wall_time_limit_seconds=600
model.model_kwargs.timeout=180
model.model_kwargs.max_tokens=2048
```

Generation ran concurrently across the three conditions, with one worker per condition.

Generation summary:

| condition | predictions | nonempty | submitted | limits exceeded | repeated format | time exceeded |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| C0 | 79 | 73 | 49 | 15 | 15 | 0 |
| C1_raw_git | 79 | 71 | 44 | 16 | 19 | 0 |
| C4_mcts_mem_top8w900 | 79 | 69 | 47 | 18 | 13 | 1 |

Local grading command:

```bash
.venv-mcts-eval/bin/python eval/mcts_mem_swebench_pro_qutebrowser/scripts/grade_predictions_local.py \
  --results-dir eval/mcts_mem_swebench_pro_qutebrowser/results/full79_three_arm_gpt55_mt2048_repeat1 \
  --conditions C0 C1_raw_git C4_mcts_mem_top8w900 \
  --workers 1 \
  --timeout-seconds 2400 \
  --timeout-per-chunk 300 \
  --chunk-size 80 \
  --force
```

Grading was serial with `--workers 1`; keep qutebrowser grading serial unless the Docker/Colima/QEMU load behavior has been revalidated.

Grade artifacts:

```text
/Users/bytedance/Dev/MCTS-Mem/paper/evaluations/qutebrowser/artifacts/full79_three_arm_gpt55_mt2048_repeat1/local_grade_reports/summary.json
/Users/bytedance/Dev/MCTS-Mem/paper/evaluations/qutebrowser/artifacts/full79_three_arm_gpt55_mt2048_repeat1/local_grade_reports/C0.summary.json
/Users/bytedance/Dev/MCTS-Mem/paper/evaluations/qutebrowser/artifacts/full79_three_arm_gpt55_mt2048_repeat1/local_grade_reports/C1_raw_git.summary.json
/Users/bytedance/Dev/MCTS-Mem/paper/evaluations/qutebrowser/artifacts/full79_three_arm_gpt55_mt2048_repeat1/local_grade_reports/C4_mcts_mem_top8w900.summary.json
```

Final grading summary:

| condition | total | nonempty | resolved | status counts |
| --- | ---: | ---: | ---: | --- |
| C0 | 79 | 73 | 24 | `empty_patch=6`, `resolved=24`, `unresolved=49` |
| C1_raw_git | 79 | 71 | 30 | `empty_patch=8`, `resolved=30`, `unresolved=40`, `test_environment_failed=1` |
| C4_mcts_mem_top8w900 | 79 | 69 | 31 | `empty_patch=10`, `resolved=31`, `unresolved=37`, `test_environment_failed=1` |

Paired resolved-count deltas:

| comparison | C4 wins | C4 losses | net |
| --- | ---: | ---: | ---: |
| C4_mcts_mem_top8w900 vs C0 | 10 | 3 | +7 |
| C4_mcts_mem_top8w900 vs C1_raw_git | 6 | 5 | +1 |

Short IDs for paired differences:

| comparison | C4-only resolved | control-only resolved |
| --- | --- | --- |
| C4 vs C0 | `1a9e74bf`, `3fd8e129`, `7f9713b2`, `99029144`, `a84ecfb8`, `bedc9f7f`, `cc360cd4`, `de4a1c1a`, `ebfe9b7a`, `f8e7fea0` | `66cfa15c`, `8d05f028`, `8f46ba3f` |
| C4 vs C1 | `46e6839e`, `7f9713b2`, `99029144`, `a84ecfb8`, `cf06f4e3`, `de4a1c1a` | `0d2afd58`, `2e961080`, `44e64199`, `5fdc83e5`, `8d05f028` |

## Selected Memory-Relevance Slice

Selection protocol: all 79 qutebrowser tasks were scored by a 3-reviewer memory-relevance pass, then the highest-ranked tasks were evaluated with C0, C1_raw_git, and C4_mcts_mem_top8w900. Contexts follow the per-task ancestor cutoff protocol.

Clean selected C0-vs-C4 progression:

| selected slice | C0 no memory | C4 trimmed MCTS-Mem | memory-only wins |
| --- | ---: | ---: | --- |
| top 6 memory-relevance tasks | 1/6 | 3/6 | `1943fa07`, `46e6839e` |
| top 10 memory-relevance tasks | 1/10 | 3/10 | `1943fa07`, `46e6839e` |
| top 12 memory-relevance tasks | 2/12 | 4/12 | `1943fa07`, `46e6839e` |

Three-arm selected top-12 result:

| condition | resolved | resolved short IDs | notes |
| --- | ---: | --- | --- |
| C0 no memory | 2/12 | `ed19d7f5`, `0aa57e4f` | no-memory floor |
| C1_raw_git | 1/12 | `ed19d7f5` | 9/12 nonempty; raw git did not recover the memory-only wins on this slice |
| C4_mcts_mem_top8w900 | 4/12 | `ed19d7f5`, `1943fa07`, `46e6839e`, `0aa57e4f` | beats both controls on this selected slice |

Concrete selected-slice memory-only wins:

- `1943fa07`: memory condition moved pinned-tab ownership/lifecycle toward `AbstractTab.set_pinned`; C0 missed the ownership boundary.
- `46e6839e`: memory condition replaced `pkg_resources` version parsing with a Qt-native helper and passed the selected version/utility tests; C0 produced an invalid rescued diff/import failure.

Selected-slice artifact pointers:

```text
/Users/bytedance/Dev/MCTS-Mem/paper/evaluations/qutebrowser/artifacts/selected_top12/local_grade_reports/baseline_c0_memory_top6_gpt55_testctx_guarded_mt2048_rescue.summary.json
/Users/bytedance/Dev/MCTS-Mem/paper/evaluations/qutebrowser/artifacts/selected_top12/local_grade_reports/c4_top6.C4_mcts_mem_top8w900.summary.json
/Users/bytedance/Dev/MCTS-Mem/paper/evaluations/qutebrowser/artifacts/selected_top12/local_grade_reports/baseline_c0_memory_rank7_10_gpt55_testctx_guarded_mt2048_rescue_retry1.summary.json
/Users/bytedance/Dev/MCTS-Mem/paper/evaluations/qutebrowser/artifacts/selected_top12/local_grade_reports/c4_rank7_10.C4_mcts_mem_top8w900.summary.json
/Users/bytedance/Dev/MCTS-Mem/paper/evaluations/qutebrowser/artifacts/selected_top12/local_grade_reports/baseline_c0_memory_rank11_12_gpt55_testctx_guarded_mt2048_rescue.summary.json
/Users/bytedance/Dev/MCTS-Mem/paper/evaluations/qutebrowser/artifacts/selected_top12/local_grade_reports/c4_rank11_12.C4_mcts_mem_top8w900.summary.json
/Users/bytedance/Dev/MCTS-Mem/paper/evaluations/qutebrowser/artifacts/selected_top12/local_grade_reports/c1_raw_git_memory_top12_gpt55_testctx_guarded_mt2048_rescue_retry1.summary.json
```

Important selected-slice caveat: ranks 7-12 added one overlap win and no new memory-only wins. Do not imply monotonic gains as the slice expands.

## Non-Citable Or Superseded Artifacts

Do not cite these as model-quality evidence:

- `results/full_app1024/`: failed/suspect harness trial. It was dominated by empty patches, Docker startup failures, and proxy/tool-call failures. The low `2/79` numbers are not valid GPT-5.5 or MCTS-Mem performance numbers.
- `results/c1_raw_git_memory_top12_gpt55_testctx_guarded_mt2048_rescue/`: auth-failure attempt. It wrote 12 empty predictions because `ANTHROPIC_API_KEY` was unset for the local proxy. Use `results/c1_raw_git_memory_top12_gpt55_testctx_guarded_mt2048_rescue_retry1/` instead.
- First rank 7-10 generation directories without `_retry1`: affected by proxy/empty-patch failures. Use the retry directories listed above.

## Current Next Work

1. Treat qutebrowser as a harness/prototype repo and dilution result, not the default main proof benchmark.
2. Use `paper/evaluations/swebench_history_repo_screen.md` to select a better SWE-bench Pro target. The current screen points to `ansible/ansible` as the absolute-count winner and `flipt-io/flipt` as the likely best practical next target.
3. Analyze full79 paired C4-vs-C0 and C4-vs-C1 wins/losses by task category and memory-relevance score only if it helps refine the next repo/task selection.
4. Inspect C4 empty-patch and control-loop failures if qutebrowser is repeated, since C4 had the weakest nonempty prediction rate.
5. If repeating qutebrowser, keep the same three arms (`C0`, `C1_raw_git`, `C4_mcts_mem_top8w900`) and do not add C2a unless the research question changes.
