# Doc-only/source-only Fact Audit

This audit identifies benchmark answer/rubric content that may depend on MCTS-Mem facts distilled from design docs, RFCs, author notes, or issue/oncall context rather than code, comments, tests, or git history.

Goal: make `paper/lynx_qa_bench_code_git_fair/` a fair comparison between:

- code-only agents with code + tests + comments + git history; and
- MCTS-aware agents with structured decision memory + code verification.

For the fair variant, do not require exact doc-only/source-only facts unless the same fact is recoverable from code comments, tests, or commit messages.

## Recommended edits before using this variant

1. **Case 1 — DevTool DOM compression**
   - Remove/weaken exact measurements: `1.4 MB -> 64 KB / ~72 ms` and `73%–78% transfer-time savings`.
   - Rubric: replace measured motivation with large-payload/performance motivation observable from thresholded compression behavior.

2. **Case 5 — `lynx.requireModule` caches**
   - Weaken: `ResourceLoader/Gecko already cache and another layer adds memory/platform cost` unless backed by commit/comment evidence.
   - Rubric: make rejected ResourceLoader cache credit optional or evidence-dependent.

3. **Case 8 — Shell actors/rebinding**
   - Weaken named VSyncMonitor/Engine-switch pitfall.
   - Rubric: accept general runner rebinding/topology safety instead of requiring the specific pitfall.

4. **Case 13 — C++ service API**
   - Replace `the C++ LynxService RFC choosing...` with `the live C++ service_api uses...`.
   - Do not require RFC knowledge.

5. **Case 14 — PerformanceEntry stream**
   - Weaken `setup/update callbacks could not express SSR, ReactLynx3 hydrate, or future entry types` if not code/git recoverable.
   - Keep `PerformanceEntry`/`PerformanceController` mechanics.

6. **Case 15 — Timing freshness**
   - Remove/weaken exact pitfalls: actual-FMP miscounts from container creation and missing `extra_timing`.
   - Rubric: use stale/reload/pipeline-freshness failure modes.

7. **Case 19 — Element inspection**
   - Remove/weaken `long-list debugging was slow` unless code/git-backed.
   - Keep non-interference and TASM/UI executor boundary rationale.

8. **Case 20 — Runtime communication**
   - Remove/weaken NoDiff-specific history and `DevTool lacked a framework-facing path` unless code/git-backed.
   - Keep `ContextProxy`/`MessageEvent` explicit communication channel.

9. **Case 24 — Optional/lazy Krypton**
   - Remove/weaken exact `~16 ms` unused canvas startup cost.
   - Rubric: require lazy optional subsystem and dependency rationale, not exact timing.

10. **Case 28 — Media texture pipeline**
    - Weaken named beauty-camera/IOSurface and RGBA→NV12/YUV replacement history if not code/git recoverable.
    - Keep avoidance of CPU readback/conversion and host texture-source architecture.

11. **Case 30 — Audio graph lifecycle**
    - Remove/weaken `old module reckless lifecycle caused memory errors/OOMs` and exact OOM claim if not code/git-backed.
    - Keep raw pointer/callback lifetime and weak ownership model.

12. **Case 31 — Audio decode/resampling**
    - Replace `measured pitfalls` framing with code-observable unnecessary resampler/copy avoidance.

13. **Case 33 — Clay graphics backend**
    - Weaken `package-size pressure` if not code/git recoverable.
    - Keep Skity/backend-dependency rationale.

14. **Case 36 — Clay frame scheduling**
    - Remove/weaken `fast-scroll jank` and `invisible list items` if not code/git-backed.
    - Keep scheduler-mediated upload readiness.

15. **Case 38 — Runtime Clay/RenderKit backend**
    - Weaken `optional Clay AAR loading, APK-size reduction` if not code/git-backed.
    - Keep runtime/per-view optional backend selection.

16. **Case 40 — Clay text/markdown**
    - Weaken combined regression list: package size, glyph-position correctness, hit testing, truncation, emoji/UTF-16 mapping.
    - Keep backend-selectable paragraph APIs and geometry APIs.

17. **Case 44 — Gesture arena/NewGesture**
    - Weaken exact disabled NewGesture off-UI-thread lifecycle incident if not code/git-backed.
    - Keep arena arbitration, event-through, consume-slide, and lifecycle correctness.

18. **Case 46 — List identity/reuse**
    - Weaken exact incident list: crashes, mis-anchoring, invisible images, old reused items visible.
    - Keep stable unique `item-key` and readiness correctness.

19. **Case 50 — CSS parsing**
    - Remove/weaken exact compatibility failure list: escaped keyframes, bare `0`, `calc()` spacing, CSS Color 4 rgba, unsupported encode failures.
    - Rubric: require grammar cases visible in parser/tokenizer behavior rather than exact incident list.
