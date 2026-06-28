# Lynx MCTS-Mem Benchmark Run — 2026-06-28
Source benchmark: `../lynx_mcts_mem_benchmark_50/`

## Status
- Completed cases: 50 / 50
- Workflow produced 49 cases; case 48 completed manually in `case_48_manual_result.json`.
- Combined results: `combined_results.json`
- Raw workflow output: `raw_workflow_output.json`

## Summary
- caseCount: 50
- codeOnlyTotal: 434.1
- mctsAwareTotal: 479.2
- maxTotal: 496
- codeOnlyAveragePct: 87.52
- mctsAwareAveragePct: 96.61
- averageGapPct: 9.09

## Binary all-or-nothing score

SWE-Atlas-style binary guard: a case receives credit only when the answer gets full rubric score; otherwise it receives 0 for that case. Scores below are weighted by each case's max score.

- codeOnlyPerfectCases: 10 / 50
- mctsAwarePerfectCases: 32 / 50
- codeOnlyBinaryTotal: 95 / 496 = 19.15%
- mctsAwareBinaryTotal: 320 / 496 = 64.52%
- binaryLift: +225 / 496 = +45.36pp
- mctsOnlyPerfectCases: 24 cases — 1, 3, 5, 6, 11, 12, 14, 17, 19, 20, 23, 25, 27, 29, 31, 34, 35, 36, 37, 38, 44, 45, 46, 48
- codeOnlyOnlyPerfectCases: 2 cases — 21, 49
- bothPerfectCases: 8 cases — 2, 4, 8, 9, 22, 24, 47, 50
- neitherPerfectCases: 16 cases — 7, 10, 13, 15, 16, 18, 26, 28, 30, 32, 33, 39, 40, 41, 42, 43

Interpretation: partial-credit scoring shows code-only often recovers implementation mechanics, but the binary guard exposes missed decision facts/rejected alternatives sharply: MCTS-aware rises from 32 perfect cases vs 10 for code-only.

## Notable cases
- Largest MCTS lift: case 27 +3/10 (+30.0pp), covering WebGL texture format/state policy where code-only missed extension-gated validation and intrinsic video dimensions.
- Next largest lift: case 33 +2.5/10 (+25.0pp), where MCTS supplied rejected DisplayList/call-site fork history for Clay graphics backend abstraction.
- Strong +2/10 or equivalent lifts: cases 11, 12, 17, 29, 31, 35, 38, and 46 each gained +20.0pp from design-tree/history evidence.
- Other meaningful MCTS gains: cases 1, 5, 14, and 32 gained +15.0pp to +16.7pp by adding measured rationale, rejected alternatives, threading, or backend-gate context.
- Code-only was already complete or tied in cases 2, 4, 7, 8, 9, 18, 22, 24, 47, and 50.
- Code-only was very close within 0.5 points in cases 10, 15, 21, 28, 30, 40, 41, and 43.
- MCTS underperformed code-only in case 49 (-1/5, -20.0pp), case 39 (-1/10, -10.0pp), and case 21 (-0.5/10, -5.0pp).
- Weighted totals: code-only 434.1/496 = 87.52%; MCTS-aware 479.2/496 = 96.61%; net lift +45.1 points = +9.09pp.
- Unweighted per-case averages: code-only 87.59%; MCTS-aware 96.46%; average per-case lift +8.87pp.
- Case 48 was completed manually after workflow scoring failed; code-only 4/5, MCTS-aware 5/5.

## Per-case table

| ID | Title | Code-only | MCTS-aware | Max | Gap |
|---:|---|---:|---:|---:|---:|
| 1 | DevTool DOM compression as CDP contract and scheduling boundary | 10 | 12 | 12 | 2 |
| 2 | Fiber Lepus chunks as keyed TemplateBundle sections | 12 | 12 | 12 | 0 |
| 3 | RTS debugging through MTS/Lepus inspector hooks | 9 | 10 | 10 | 1 |
| 4 | WhiteBoard delegate split for session storage | 12 | 12 | 12 | 0 |
| 5 | lynx.requireModule two-level cache and failure policy | 10 | 12 | 12 | 2 |
| 6 | Android Service registry and @Keep | 10 | 11 | 11 | 1 |
| 7 | LynxTrailHub external settings boundary | 10 | 10 | 11 | 0 |
| 8 | Shell actors, mediators, operation queues, and rebinding | 10 | 10 | 10 | 0 |
| 9 | JS inspector manager decoupling | 11 | 11 | 11 | 0 |
| 10 | Recycled TemplateBundle greedy decode boundary | 8 | 8.5 | 10 | 0.5 |
| 11 | Darwin service protocols replace side-effect registration and host-library coupling | 8 | 10 | 10 | 2 |
| 12 | Typed host resource contract, not consumer-private byte glue | 8 | 10 | 10 | 2 |
| 13 | C++ service_api per-service lazy registry | 9 | 9.8 | 10 | 0.8 |
| 14 | PerformanceEntry stream model through PerformanceController | 8.5 | 10 | 10 | 1.5 |
| 15 | Timing freshness is pipeline-scoped | 8 | 8.4 | 10 | 0.4 |
| 16 | Clay service actor/owner/lifecycle model | 8.6 | 9.5 | 10 | 0.9 |
| 17 | View-scoped CDP event routing | 8 | 10 | 10 | 2 |
| 18 | WhiteBoard DevTool JSON-string value contract | 9.5 | 9.5 | 10 | 0 |
| 19 | Element inspection live attributes and thread-aware snapshots | 9 | 10 | 10 | 1 |
| 20 | Runtime communication uses explicit ContextProxy/MessageEvent | 9 | 10 | 10 | 1 |
| 21 | Centralized animation ticking and page FPS policy | 10 | 9.5 | 10 | -0.5 |
| 22 | Stable keyframe animator identity and custom-property sampling | 10 | 10 | 10 | 0 |
| 23 | CSS transition eligibility, canonical values, and list semantics | 9 | 10 | 10 | 1 |
| 24 | Optional lazy Krypton adoption boundary | 10 | 10 | 10 | 0 |
| 25 | Canvas surface lifecycle and GPU-thread ownership | 9 | 10 | 10 | 1 |
| 26 | Selective generated WebGL command buffering | 8 | 9 | 10 | 1 |
| 27 | Explicit WebGL texture format and state policy | 7 | 10 | 10 | 3 |
| 28 | Host-injected media texture pipeline | 9 | 9.5 | 10 | 0.5 |
| 29 | Krypton resource-loading boundary and URL redirection | 8 | 10 | 10 | 2 |
| 30 | Audio graph lifecycle and weak ownership | 8.5 | 9 | 10 | 0.5 |
| 31 | Dynamic audio decode and adaptive resampling | 8 | 10 | 10 | 2 |
| 32 | Backend abstraction, Skity, RenderKit, and WebGPU gates | 8 | 9.5 | 10 | 1.5 |
| 33 | Clay graphics backend abstraction | 7 | 9.5 | 10 | 2.5 |
| 34 | RenderKit retained rendering pipeline | 9 | 10 | 10 | 1 |
| 35 | SharedImage and external surface ownership | 8 | 10 | 10 | 2 |
| 36 | Clay frame scheduling and image upload readiness | 9 | 10 | 10 | 1 |
| 37 | Pixel domains and transform-aware hit testing | 9 | 10 | 10 | 1 |
| 38 | Runtime Clay/RenderKit backend boundary | 8 | 10 | 10 | 2 |
| 39 | Clay component vocabulary and type registration | 7 | 6 | 10 | -1 |
| 40 | Clay text and markdown backend contract | 8.5 | 9 | 10 | 0.5 |
| 41 | Event dispatch must survive listener and target mutation | 9 | 9.5 | 10 | 0.5 |
| 42 | Non-UI touch targets and platform target-tree hit testing | 8.5 | 9.5 | 10 | 1 |
| 43 | Event payload compatibility and input anti-echo | 9 | 9.5 | 10 | 0.5 |
| 44 | Gesture arena, NewGesture lifecycle, event-through, and consume-slide | 9 | 10 | 10 | 1 |
| 45 | Decoupled list core and operation-id guarded async batch rendering | 9 | 10 | 10 | 1 |
| 46 | List identity, reuse lifecycle, and data-version compatibility | 8 | 10 | 10 | 2 |
| 47 | Renderer lifecycle placeholders options queued painting | 10 | 10 | 10 | 0 |
| 48 | Owned Starlight not Yoga | 4 | 5 | 5 | 1 |
| 49 | CSS property IDs typed values ordered declarations | 5 | 4 | 5 | -1 |
| 50 | Grammar-aware CSS parsing and compatibility strictness | 5 | 5 | 5 | 0 |
