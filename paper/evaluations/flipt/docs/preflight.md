# Flipt Preflight Notes

Date: 2026-06-27.

Flipt is a better practical next target than qutebrowser because the public SWE-bench Pro task text clusters around configuration, schema, storage, API compatibility, and environment routing. Those are the kinds of changes where history and rejected design context should plausibly matter.

## Task Snapshot

- Source: `ScaleAI/SWE-bench_Pro`, filtered to `repo == "flipt-io/flipt"`.
- Rows: 85.
- Repo language in rows: Go.
- Base-commit years: 2019: 2, 2020: 4, 2021: 1, 2022: 11, 2023: 36, 2024: 26, 2025: 5.
- `pass_to_pass` is empty for all rows; local grading therefore focuses on `fail_to_pass` selectors.

## Strong Signals

Issue categories:

| category | tasks |
| --- | ---: |
| `back_end_knowledge` | 81 |
| `api_knowledge` | 44 |
| `devops_knowledge` | 43 |
| `infrastructure_knowledge` | 20 |
| `security_knowledge` | 15 |
| `authentication_authorization_knowledge` | 13 |
| `database_knowledge` | 10 |

Keyword screen over problem statements, requirements, and public interface text:

| signal | tasks |
| --- | ---: |
| config | 71 |
| auth | 28 |
| yaml | 24 |
| storage | 23 |
| schema | 21 |
| environment | 20 |
| namespace | 17 |
| compatibility | 17 |
| api | 17 |
| git | 16 |
| evaluation | 14 |
| cache | 13 |
| database | 13 |
| constraint | 11 |

Most repeated failing test names:

| test | rows |
| --- | ---: |
| `TestLoad` | 33 |
| `TestJSONSchema` | 11 |
| `TestServeHTTP` | 8 |
| `TestImport` | 5 |
| `TestLogEncoding` | 5 |
| `TestValidate` | 5 |
| `TestExport` | 4 |
| `TestCacheBackend` | 4 |

## Initial Design Areas To Mine

- Configuration loading, validation, defaults, deprecations, and generated schema alignment.
- Git-native and filesystem storage for environments, including ref/directory routing and namespace boundaries.
- Import/export and CUE/JSON schema compatibility across historical file formats.
- Evaluation semantics for constraints, variants, rollouts, and OFREP/client compatibility.
- Authn/authz method composition and token/metadata handling.
- Optional integrations: analytics, tracing, metrics, Redis/cache, database drivers, and secret providers.

## Evaluation Implication

The raw-git condition should be a strong control for Flipt because many task requirements mention historical compatibility directly. The useful paper signal is not just `C4 > C0`; it is whether the distilled MCTS-Mem context beats or de-noises raw pre-cutoff commit context on reviewer-selected history/design tasks.
