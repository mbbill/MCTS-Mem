# GPT-5.2 Flipt Repeat-1 Audit

This report audits generation, local grading, wrapper-limit effects, and reference-patch oracle checks for the clean GPT-5.2 cutoff-git repeat 1.

## Result Directory Inventory
| result dir | generation artifacts | local grades |
| --- | --- | --- |
| `full85_three_arm_gpt52_codex_cutoffgit_repeat1` | `C0`=85 preds/82 nonempty/85 traj; `C1_git_history`=85 preds/81 nonempty/85 traj; `C4_git_history_mcts_mem`=85 preds/81 nonempty/85 traj | `C0`: `empty_patch=3`, `resolved=8`, `timeout=13`, `unresolved=61`; `C1_git_history`: `empty_patch=4`, `resolved=7`, `timeout=14`, `unresolved=60`; `C4_git_history_mcts_mem`: `empty_patch=4`, `patch_apply_failed=1`, `resolved=4`, `timeout=11`, `unresolved=65` |
| `full85_three_arm_gpt55_mt2048_repeat1_unguarded_exploratory_stopped49` | `C0`=49 preds/45 nonempty/49 traj; `C1_raw_git`=49 preds/45 nonempty/49 traj; `C4_mcts_mem_top8w900`=49 preds/46 nonempty/49 traj | - |
| `gpt52_codex_smoke10_c0_snapshot` | `C0`=1 preds/0 nonempty/1 traj | - |
| `gpt52_codex_smoke10_c0_snapshot_responses` | `C0`=6 preds/6 nonempty/6 traj | `C0`: `resolved=1`, `unresolved=5` |
| `oracle_reference_patch_local` | `ORACLE`=85 preds/85 nonempty/0 traj | `ORACLE`: `resolved=85` |

## Generation Configuration
| condition | model | agent limit | model kwargs | api calls | responses start/error | messages |
| --- | --- | --- | --- | --- | --- | --- |
| `C0` | `openai/claude-gpt-5.2-codex` | step=24; wall=600s | max_output=2048; temp=1.0; effort=high | min=13; median=24; max=24 | 1911/22 | min=29; median=51; max=51 |
| `C1_git_history` | `openai/claude-gpt-5.2-codex` | step=24; wall=600s | max_output=2048; temp=1.0; effort=high | min=13; median=24; max=24 | 1907/19 | min=27; median=51; max=51 |
| `C4_git_history_mcts_mem` | `openai/claude-gpt-5.2-codex` | step=24; wall=600s | max_output=2048; temp=1.0; effort=high | min=13; median=23; max=24 | 1880/19 | min=27; median=48; max=51 |

## Artifact Completeness
| condition | predictions | trajectories | grade results |
| --- | --- | --- | --- |
| `C0` | 85 | 85 | 85 |
| `C1_git_history` | 85 | 85 | 85 |
| `C4_git_history_mcts_mem` | 85 | 85 | 85 |

## Instance Set Audit
| condition | pred ids | traj ids | grade ids | extra ids | missing preds | missing trajs | missing grades | mismatches |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `C0` | 85 | 85 | 85 | 0 | 0 | 0 | 0 | - |
| `C1_git_history` | 85 | 85 | 85 | 0 | 0 | 0 | 0 | - |
| `C4_git_history_mcts_mem` | 85 | 85 | 85 | 0 | 0 | 0 | 0 | - |

## Prediction Patch Sanity
| condition | predictions | nonempty | diff patches | nonempty without diff | patch bytes |
| --- | --- | --- | --- | --- | --- |
| `C0` | 85 | 82 | 82 | 0 | min=0; median=1891; max=22140 |
| `C1_git_history` | 85 | 81 | 81 | 0 | min=0; median=1870; max=22495 |
| `C4_git_history_mcts_mem` | 85 | 81 | 81 | 0 | min=0; median=2015; max=65658 |

## Generation Exits
| condition | exit statuses | resolved by exit | total/resolved direct vs rescued |
| --- | --- | --- | --- |
| `C0` | `LimitsExceeded=43`, `Submitted=35`, `TimeExceeded=5`, `Timeout=2` | `LimitsExceeded=3`, `Submitted=5` | `direct=38/5`, `rescued=47/3` |
| `C1_git_history` | `LimitsExceeded=45`, `Submitted=35`, `TimeExceeded=3`, `Timeout=2` | `Submitted=7` | `direct=39/7`, `rescued=46/0` |
| `C4_git_history_mcts_mem` | `LimitsExceeded=37`, `Submitted=45`, `TimeExceeded=1`, `Timeout=2` | `LimitsExceeded=1`, `Submitted=3` | `direct=49/3`, `rescued=36/1` |

## Local Grade Summary
| condition | total | nonempty | resolved | statuses |
| --- | --- | --- | --- | --- |
| `C0` | 85 | 82 | 8 | `empty_patch=3`, `resolved=8`, `timeout=13`, `unresolved=61` |
| `C1_git_history` | 85 | 81 | 7 | `empty_patch=4`, `resolved=7`, `timeout=14`, `unresolved=60` |
| `C4_git_history_mcts_mem` | 85 | 81 | 4 | `empty_patch=4`, `patch_apply_failed=1`, `resolved=4`, `timeout=11`, `unresolved=65` |

## Paired Outcomes
| comparison | first-only | second-only | both | neither | first-only ids | second-only ids |
| --- | --- | --- | --- | --- | --- | --- |
| `C4_git_history_mcts_mem` vs `C1_git_history` | 0 | 3 | 4 | 78 | - | `7161f7b8`, `b2170346`, `d9665592` |
| `C4_git_history_mcts_mem` vs `C0` | 1 | 5 | 3 | 76 | `cf06f4eb` | `15b76cad`, `7161f7b8`, `b2170346`, `b4bb5e13`, `f1bc91a1` |
| `C1_git_history` vs `C0` | 2 | 3 | 5 | 75 | `cf06f4eb`, `d9665592` | `15b76cad`, `b4bb5e13`, `f1bc91a1` |

## Failure Classification
| condition | classification counts |
| --- | --- |
| `C0` | `compile_error=40`, `empty_patch=3`, `package_fail_other=12`, `resolved=8`, `test_assertion_fail=9`, `timeout=13` |
| `C1_git_history` | `compile_error=37`, `empty_patch=4`, `package_fail_other=14`, `resolved=7`, `test_assertion_fail=9`, `timeout=14` |
| `C4_git_history_mcts_mem` | `compile_error=35`, `empty_patch=4`, `other_unresolved=2`, `package_fail_other=13`, `patch_apply_failed=1`, `resolved=4`, `test_assertion_fail=15`, `timeout=11` |

## Local Grader Selector Sanity
The local grader builds `go test ./... -run <regex>` from task `fail_to_pass` names. Go gives `/` special subtest semantics, so selectors containing `/` would require extra care; this task snapshot has none.

| rows | fail_to_pass selectors | fail_to_pass rows | pass_to_pass selectors | pass_to_pass rows | selectors containing `/` | fail_to_pass per row |
| --- | --- | --- | --- | --- | --- | --- |
| 85 | 354 | 85 | 0 | 0 | 0 | min=1; median=2; max=32 |

## Wrapper-Limit Audit
| condition | no-diff read-only rejections | after-diff guidance/rejections | search rejections | history-command mentions |
| --- | --- | --- | --- | --- |
| `C0` | 83/85; median=4.0; max=14 | 71/85; median=10.0; max=20 | 1/85; max=4 | 1/85; median=0.0; max=2 |
| `C1_git_history` | 81/85; median=4.0; max=12 | 73/85; median=10.0; max=20 | 0/85; max=0 | 85/85; median=4.0; max=4 |
| `C4_git_history_mcts_mem` | 78/85; median=4.0; max=12 | 74/85; median=6.0; max=20 | 0/85; max=0 | 85/85; median=4.0; max=6 |

## Git-History Guard Audit
| condition | runner logs | check | bad |
| --- | --- | --- | --- |
| `C0` | 85 | sanitized=85 | failures=0 |
| `C1_git_history` | 85 | future_checks=85 | bad_or_missing=0 |
| `C4_git_history_mcts_mem` | 85 | future_checks=85 | bad_or_missing=0 |

## GPT-5.2 Smoke Context
| condition | predictions | nonempty | trajectories | local grades |
| --- | --- | --- | --- | --- |
| `C0` | 6 | 6 | 6 | `resolved=1`, `unresolved=5` |

## Reference-Patch Oracle
Reference patch results completed: 85/85.
Completed oracle resolved every reference patch, which is strong evidence that the local grader is operational for these tasks.

| status | count |
| --- | --- |
| `resolved` | 85 |

Oracle coverage of model timeout IDs helps distinguish grader slowness from model-patch-induced hangs or compile stalls.

| condition | model timeout ids | oracle completed | oracle statuses on completed | oracle pending |
| --- | --- | --- | --- | --- |
| `C0` | 13 | 13 | `resolved=13` | 0 |
| `C1_git_history` | 14 | 14 | `resolved=14` | 0 |
| `C4_git_history_mcts_mem` | 11 | 11 | `resolved=11` | 0 |

## Current Interpretation

The completed model run is artifact-complete, and the cutoff-git guard checks did not find future-history leakage. The suspicious result is not explained by missing artifacts, empty predictions, malformed patch extraction, or an obvious cutoff guard failure.

It should not be treated as a clean measurement of GPT-5.2 capability. The generation harness imposed a 24-step limit, a 600s wall-time limit, 2048 output tokens, and aggressive read-only command rejection after inspection or after a source diff existed. Most trajectories hit wrapper guidance/rejections, API calls are saturated near the step limit, the runner saw repeated 180s Responses API timeouts, and many final patches were rescued after non-submit exits. The reference-patch oracle now resolves all 85 tasks, so the low model score is best treated as a generation-harness validity problem rather than evidence that cutoff git history is unhelpful.

Next clean experiment should not repeat this strict harness. Use a small relaxed smoke first, then rerun the three-arm Flipt comparison only after the relaxed settings produce normal baseline behavior.

