# SWE-bench Pro History-Relevance Repo Screen

Last updated: 2026-06-27

Scope: public `ScaleAI/SWE-bench_Pro` `test` split, 731 tasks across 11 repositories.

Goal: find a SWE-bench Pro repository whose tasks are more likely to need durable repo-history/design memory than qutebrowser's pooled task set.

## Method

A task is counted as design/history-related when it has an explicit history signal or a compatibility/regression tag, plus supporting design evidence.

Core history signals: migration, legacy, deprecation, compatibility, regression, upgrade/downgrade, schema.

Supporting design signals: version, refactor, rename/move, API/interface, config/settings, database/SQL, state/lifecycle/invariant/ownership, serialization.

Issue tags used as priors: `compatibility_bug`, `regression_bug`, `refactoring_enh`, `technical_debt_enh`.

This is a screening heuristic, not a final task-selection label. It should be followed by manual audit or a reviewer-scored selection pass before spending generation budget.

## Ranking

| rank | repo | tasks | design/history tasks | rate | avg score | readout |
| ---: | --- | ---: | ---: | ---: | ---: | --- |
| 1 | `ansible/ansible` | 96 | 44 | 0.46 | 5.8 | highest absolute count; many compatibility/deprecation/legacy tasks; large repo/harness cost |
| 2 | `flipt-io/flipt` | 85 | 42 | 0.49 | 6.3 | near-top absolute count; strong config/schema/database compatibility cluster; likely most practical next target |
| 3 | `qutebrowser/qutebrowser` | 79 | 34 | 0.43 | 5.6 | scores high, but repeat1 showed pooled dilution; keep as baseline/prototype, not main proof |
| 4 | `gravitational/teleport` | 76 | 26 | 0.34 | 4.9 | upgrade/cluster compatibility tasks; potentially strong but operationally heavier |
| 5 | `element-hq/element-web` | 56 | 22 | 0.39 | 6.9 | high rate of UI/state/refactor history signals; frontend stack may add noise |
| 6 | `future-architect/vuls` | 62 | 20 | 0.32 | 4.3 | version/security database and legacy scan-result tasks; promising specialized option |
| 7 | `internetarchive/openlibrary` | 91 | 17 | 0.19 | 3.2 | screened candidate |
| 8 | `protonmail/webclients` | 65 | 15 | 0.23 | 4.5 | screened candidate |
| 9 | `navidrome/navidrome` | 57 | 13 | 0.23 | 4.8 | screened candidate |
| 10 | `NodeBB/NodeBB` | 44 | 12 | 0.27 | 7.1 | screened candidate |
| 11 | `tutao/tutanota` | 20 | 11 | 0.55 | 7.2 | highest small-repo rate, but only 20 tasks; useful as supplemental slice, not main corpus |

## Recommendation

If the next experiment must stay inside SWE-bench Pro, use `flipt-io/flipt` or `ansible/ansible` rather than qutebrowser as the next MCTS-Mem target.

- `ansible/ansible` has the most absolute history/design-related tasks by this screen: 44 of 96. It is the best answer to 'which repo contains the most history-related tests?' However, it is a large and mature Python project, so mining/build cost and harness runtime may be high.
- `flipt-io/flipt` is the best practical next target: 42 of 85 tasks, a high rate, and many config/schema/database/API compatibility tasks. It should provide a cleaner MCTS-Mem signal than qutebrowser while remaining more tractable than Ansible.
- `qutebrowser/qutebrowser` should be treated as a harness/prototype repo and a dilution result. It scores high on textual history signals, but the full79 C4-vs-C1 result was only +1, so its pooled corpus is not the strongest proof setting.

Suggested next step: run the same memory-relevance reviewer selection pass on `flipt-io/flipt` and `ansible/ansible`, then choose the repo with the larger high-confidence selected slice before spending on full C0/C1/C4 generation.

## Top Examples

### `ansible/ansible`

Top screened tasks:

- `6cc97447` score=19.5; core=legacy,deprecation,compat; support=config; specs=compatibility_bug,edge_case_bug,code_quality_enh; ansible-core: Inconsistent behavior with unset values, deprecations, `None` overrides in templar, legacy YAML constructors, lookup messages,
- `395e5e20` score=19.0; core=migration,legacy,deprecation,compat; support=version,state; specs=core_feat; Standardize `PlayIterator` state representation with a public type and preserve backward compatibility
- `ed6581e4` score=19.0; core=legacy,deprecation,compat; support=version,config; specs=compatibility_bug,dev_ops_enh; check finder type before passing path ### Summary When I try to load an Ansible collection module using the collection loader on Python 3, i
- `f327e65d` score=16.0; core=legacy,compat; support=-; specs=technical_debt_enh,refactoring_enh,compatibility_bug; Collection Name Validation Accepts Python Keywords
- `c616e54a` score=15.5; core=legacy,deprecation; support=version; specs=major_bug,integration_bug,regression_bug; `module_common` fails to resolve `module_utils` from collections (redirects, package `__init__` relative imports) and shows confusing errors

### `flipt-io/flipt`

Top screened tasks:

- `af7a0be4` score=20.5; core=legacy,deprecation,compat,schema; support=config,state,serialization; specs=dev_ops_enh; Inconsistent tracing configuration caused by reliance on `tracing.jaeger.enabled`
- `9f8127f2` score=16.5; core=migration,compat,schema; support=api,config,database; specs=core_feat,integration_feat; **Feature request: Support `CockroachDB` as a first-class database backend**
- `b4bb5e13` score=15.0; core=compat,schema; support=version,config; specs=compatibility_bug,integration_bug; OCI manifest version not configurable, causing incompatibility with AWS ECR and other registries
- `b433bd05` score=15.0; core=legacy,deprecation,schema; support=config,serialization; specs=integration_feat; Missing OTLP exporter support for tracing
- `756f00f7` score=14.0; core=deprecation; support=version,refactor,config,database; specs=refactoring_enh,code_quality_enh,scalability_enh; Configuration refactoring to separate warnings from Config and deprecate ui.enabled

### `qutebrowser/qutebrowser`

Top screened tasks:

- `8d05f028` score=23.0; core=migration,legacy,schema; support=api,config; specs=edge_case_bug,data_bug,compatibility_bug; Configuration Migration Crashes When Settings Have Invalid Data Structures
- `fcfa069a` score=17.0; core=migration,compat,schema; support=version,database; specs=core_feat,technical_debt_enh; Add major/minor user version infrastructure.
- `394bfaed` score=15.0; core=legacy,compat; support=version,config; specs=refactoring_enh,code_quality_enh,technical_debt_enh; Refactor QtWebEngine version detection to use multiple sources including ELF parsing
- `5fdc83e5` score=14.5; core=migration,legacy; support=api,config,serialization; specs=code_quality_enh,refactoring_enh; **Title:**
- `233cb1cc` score=12.5; core=migration,legacy; support=version,api,config; specs=ui_ux_feat,customization_feat,integration_feat; Add `overlay` option for `scrolling.bar` and gate it by platform/Qt

### `gravitational/teleport`

Top screened tasks:

- `b5d8169f` score=17.0; core=migration,legacy,upgrade; support=version,api; specs=code_quality_enh,refactoring_enh,security_enh; OSS users lose connection to leaf clusters after root cluster upgrade to Teleport 6.0
- `53814a2d` score=15.0; core=migration,upgrade; support=version,database; specs=major_bug,regression_bug,integration_bug; Unable to connect to databases in trusted clusters due to missing Database CA
- `c782838c` score=14.0; core=migration,legacy; support=version,api,config,state; specs=minor_bug,integration_bug; `ClusterConfig` caching issues with Pre-v7 Remote Clusters.
- `4d0117b5` score=13.5; core=migration,legacy,compat; support=serialization; specs=integration_feat,security_feat,performance_feat; DynamoDB Event Fields Stored as JSON Strings Prevent Efficient Field-Level Queries
- `0415e422` score=13.5; core=legacy,compat; support=config; specs=major_bug,compatibility_bug,customization_feat; Multi-Device U2F Authentication Restricted to Single Token Selection

### `element-hq/element-web`

Top screened tasks:

- `d06cf09b` score=24.0; core=migration,legacy,compat,upgrade; support=version,api,config,state; specs=ui_ux_enh,code_quality_enh,refactoring_enh; Legacy ReactDOM.render usage in secondary trees causes maintenance overhead and prevents adoption of modern APIs
- `b7fea97b` score=17.0; core=migration,legacy; support=config,state; specs=regression_bug,refactoring_enh,code_quality_enh; Inconsistent Button Container Styling Across Encryption Settings Panels
- `ad26925b` score=16.5; core=deprecation; support=version,refactor,rename_move,api; specs=code_quality_enh,refactoring_enh,ui_ux_enh; Refactor Pill component logic
- `44b98896` score=16.0; core=migration,legacy; support=version,rename_move,config,state; specs=code_quality_enh,refactoring_enh; Integration Manager settings placement and behavior inconsistencies
- `9a31cd0f` score=15.5; core=compat,upgrade; support=version,rename_move,api,config; specs=core_feat,ui_ux_feat,localization_feat; Issue Title: Allow setting room join rule to "knock" ## What would you like to do? Add a feature-flagged “Ask to join” (Knock) join rule to 

### `future-architect/vuls`

Top screened tasks:

- `3f8de026` score=19.0; core=legacy,schema; support=version,config; specs=regression_bug,major_bug,compatibility_bug; `vuls report` fails to parse legacy scan results due to incompatible `listenPorts` field format
- `139f3a81` score=17.5; core=legacy,upgrade; support=version,refactor,api,config; specs=code_quality_enh,technical_debt_enh,scalability_enh; Upgrade Vuls library scanning to Trivy 0.30.x, expand package-manager support (PNPM & .NET deps), and align imports/APIs with trivy/pkg/fana
- `d576b6c6` score=11.0; core=compat; support=version,api; specs=technical_debt_enh,refactoring_enh,code_quality_enh; oval.major(\"\") must return an empty string for empty input
- `5af1a227` score=9.5; core=legacy; support=version; specs=compatibility_bug,edge_case_bug; Issue Title: Incorrect detection of running kernel package versions when multiple variants are installed
- `e52fa8d6` score=8.5; core=schema; support=version,config,database; specs=core_feat; Schema version mismatches in the Vuls2 database are not handled explicitly.

