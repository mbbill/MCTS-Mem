# GPT-5.2 Relaxed Flipt Paired Analysis

Date: 2026-07-01.

## Source Artifacts

Run root:

```text
paper/evaluations/flipt/results/full85_three_arm_gpt52_codex_relaxed_cutoffgit_repeat1
```

Final local grade summary:

```text
paper/evaluations/flipt/results/full85_three_arm_gpt52_codex_relaxed_cutoffgit_repeat1/local_grade_reports/summary.json
```

All 255 per-condition grades are present. There are no remaining `docker_failed_no_result` rows after targeted force regrading of the earlier Docker pull failures.

## Aggregate Result

| arm | total | nonempty | resolved | status counts |
| --- | ---: | ---: | ---: | --- |
| `C0` | 85 | 84 | 7 | `empty_patch=1`, `resolved=7`, `unresolved=77` |
| `C1_git_history` | 85 | 85 | 8 | `resolved=8`, `unresolved=77` |
| `C4_git_history_mcts_mem` | 85 | 85 | 8 | `resolved=8`, `unresolved=77` |

Paired outcomes:

| comparison | first-only wins | second-only wins | both resolved | neither resolved | first-only ids | second-only ids |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| `C4_git_history_mcts_mem` vs `C1_git_history` | 2 | 2 | 6 | 75 | `dbe26396`, `f1bc91a1` | `7161f7b8`, `b2170346` |
| `C4_git_history_mcts_mem` vs `C0` | 3 | 2 | 5 | 75 | `1dceb5ed`, `dbe26396`, `f1bc91a1` | `b2170346`, `e88e9399` |
| `C1_git_history` vs `C0` | 2 | 1 | 6 | 76 | `1dceb5ed`, `7161f7b8` | `e88e9399` |

## Delta Instances

| short id | task theme | outcome | C4 memory signal | failure note |
| --- | --- | --- | --- | --- |
| `1dceb5ed` | rollout audit logs need segment operator fields | C1 and C4 resolve; C0 misses | C4 included evaluation/constraint and segment/rollout history, but C1 solved without injected memory | C0 submitted normally but failed broad build checks across auth/evaluation/storage packages. This is not a C4-specific win over raw git. |
| `7161f7b8` | default config should respect env overrides | C1-only win against C4 | C4 had directly relevant config/default/env-override facts, including default config and prior env override pitfalls | C4 failed `TestLoad/defaults` and `TestLoad/defaults_with_env_overrides` with unexpected config-load errors. Relevant memory did not prevent a bad patch. |
| `b2170346` | token audit logging support | C0 and C1 resolve; C4 misses | C4 had highly relevant audit/authentication history, including token creation/deletion audit events and audit event shape changes | C4 failed `TestChecker`: expected `true`. The miss looks behavioral rather than infrastructure. |
| `dbe26396` | polling goroutine lifecycle management in storage backends | C4-only win against both controls | C4 included adjacent storage/auth lifecycle and cleanup decisions | C0 and C1 failed to propagate `Close()` through test mocks: `snapshotStoreMock does not implement SnapshotStore (missing method Close)`. C4 appears to have handled the interface propagation. |
| `e88e9399` | add flag key to batch evaluation response | C0-only win against C1 and C4 | C4 had evaluation/history facts, including a previous request-id batch response change, but not enough to preserve the necessary protobuf/generated-code path | C1 and C4 failed compile with missing `FlagKey` fields on evaluation response types. Current-code inspection was apparently enough for C0 here. |
| `f1bc91a1` | decouple old `Evaluate` logic with an `Evaluator` interface | C4-only win against both controls | C4 had old rule/evaluation history facts from the early `markphelps/flipt` era, including segment operator and evaluator behavior changes | C0 and C1 failed compile around `Evaluator` / `NewEvaluatorStorage` API propagation. C4 handled the refactor path. |

## Interpretation

The relaxed full-corpus result is complete but not a strong positive result for MCTS-Mem. C4 ties raw cutoff git at `8/85`; paired C4-vs-C1 is exactly balanced at `2W/2L`. Against no memory, C4 is only `+1` resolved and paired `3W/2L`.

The two C4-only wins over C1 are plausible memory-aligned tasks: both require coherent propagation of internal interfaces/lifecycle behavior across older design surfaces. The two C4 losses also had relevant memory available, which is important: retrieved history can still distract or overcomplicate the patch when the required change is smaller than the historical context suggests.

There is no populated Flipt selected-slice/relevance file yet, so do not claim a memory-relevance-stratified improvement. The next evidence-producing step should be reviewer scoring or automated ranking of the 85 Flipt tasks for history/design dependence, then report C4/C1/C0 outcomes by that stratum before deciding on repeat2/repeat3.
