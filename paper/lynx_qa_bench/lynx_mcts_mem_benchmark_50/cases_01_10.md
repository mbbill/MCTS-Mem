# Cases 1–10 — Core MCTS-Mem Benchmark Cases

## Case 1 — DevTool DOM compression as CDP contract and scheduling boundary

**Question:** Why does `DOM.enable` accept `useCompression` and `compressionThreshold`, and why are large `DOM.getDocument`/`describeNode` responses compressed on the devtool thread instead of just returning ordinary JSON from the TASM thread?

**Canonical correct answer:** `DOM.enable` carries `useCompression` and `compressionThreshold` because DOM payload compression is a CDP-level negotiated behavior, not an unconditional internal transport change. Ordinary clients must still receive normal JSON, while clients that opt in can receive a compressed response shape for large DOM payloads. TASM owns safe access to Element/TASM state, so `getDocument`/`describeNode` first build DOM JSON there. Once serialized, Lynx moves expensive zlib/base64 compression to the DevTool thread. MCTS-Mem records measured motivation: a Douyin mall `getDocument` response was about 1.4 MB uncompressed and 64 KB compressed at about 72 ms compression cost; newer Shoots-Lynx facts also record 73%–78% transfer-time savings.

**Rubric, 12 pts:** 2 opt-in CDP negotiation; 2 ordinary JSON compatibility; 2 TASM vs DevTool thread split; 2 threshold/large-payload compressed response; 3 measured motivation; 1 distinguishes wire contract from generic optimization.

**Example A — code-only, 9/12:** “`DOM.enable` stores compression flags; TASM builds DOM JSON; large payloads are compressed/base64-encoded on DevTool thread to avoid blocking TASM and keep uncompressed JSON default.” **Grade note:** strong mechanics; missing measured history and full wire-contract framing.

**Example B — MCTS-aware, 12/12:** “`DOM.enable` negotiates a non-default compressed response. TASM builds Element JSON; compression moves to DevTool thread because MCTS records 1.4 MB → 64 KB / ~72 ms and 73%–78% transfer-time savings. Compatibility keeps normal JSON default.”

**Evidence:** MCTS `mcts_mem/lynx/devtool/cdp-wire.md`, `mcts_mem/lynx/inspector/dom-element-inspection-model.md`; code `lynx/devtool/lynx_devtool/agent/inspector_tasm_executor.cc`, `lynx/devtool/lynx_devtool/agent/lynx_devtool_mediator.cc`.

**Common misses:** payload-size-only answer; ignores compatibility; omits measurement; says TASM cannot serialize DOM.

---

## Case 2 — Fiber Lepus chunks as keyed TemplateBundle sections

**Question:** Why are Fiber Lepus worklet chunks stored as keyed sections inside the template bundle and optionally decoded lazily/asynchronously, instead of embedding or executing raw Relax/Lepus bytes directly at use sites?

**Canonical correct answer:** Fiber Lepus worklet chunks are template artifacts, so Lynx stores them inside the TemplateBundle as keyed routed sections rather than scattering raw bytes at use sites. The key is the logical Lepus file path used by `__LoadLepusChunk`, giving stable identity for runtime lookup and debug information. Keeping chunks in the bundle lets them share section routing, random access, typed payload/length representation, SDK and compile-option compatibility checks, and lazy/asynchronous decode. MCTS-Mem records rejected alternatives: flat sequential sections, generic custom-section Lepus serialization, and raw Relax/RASM byte execution. Those bypass bundle integrity, compatibility, payload typing, and reusable decode scheduling.

**Rubric, 12 pts:** 2 bundle-owned artifact; 2 logical-path/`__LoadLepusChunk`; 2 routed/random/typed sections; 2 compatibility/integrity; 2 debug identity/decode boundary; 2 rejected alternatives.

**Example A — code-only, 8/12:** “`lepusChunk` entries are path-keyed; encoder writes `LEPUS_CHUNK` and routes; runtime requests by key; lazy decode supports demand loading.” **Grade note:** good mechanics; weak on rejected alternatives and bundle-boundary rationale.

**Example B — MCTS-aware, 12/12:** “Keyed Lepus chunks are a TemplateBundle wire-format decision. MCTS says path-keyed chunks support `__LoadLepusChunk`, routing, compatibility, debug identity, and lazy decode, while flat sections, generic custom sections, and raw Relax/RASM bytes lost.”

**Evidence:** MCTS `mcts_mem/lynx/template-bundle/wire-format.md`, related `.alt/` files, `mcts_mem/lynx/template-bundle/relax-rasm-codec.md`; code `template_binary.h`, `meta_factory.cc`, `template_binary_writer.cc`.

**Common misses:** treats as encoder convenience; misses raw Relax/RASM alternative; ignores path identity.

---

## Case 3 — RTS debugging through MTS/Lepus inspector hooks

**Question:** Why is RTS debugging modeled as an `RTSInspectorManager` selected through MTS/Lepus inspector hooks instead of direct RTSVMWrapper source APIs?

**Canonical correct answer:** RTS is treated as one MTS/Lepus execution backend for debugging. The live design selects an `RTSInspectorManager` through the same MTS/Lepus inspector observer path used by other Lepus-like contexts, so RTS debugging participates in common inspector lifecycle, target routing, observer takeover, connection-gated activation, and debug-info policy. MCTS-Mem records the rejected alternative: direct `RTSVMWrapper` source APIs. That exposed RTS-specific source handling at the wrong layer and bypassed the MTS/Lepus inspector boundary. RTS-specific details remain inside the RTS manager while runtime and DevTool see the common inspector abstraction.

**Rubric, 10 pts:** 2 RTS as MTS/Lepus backend; 2 common observer lifecycle; 2 target routing/connection/debug-info; 2 rejected direct RTSVMWrapper; 2 RTS-specific isolation.

**Example A — code-only, 7/10:** “`MTSRuntime::InitInspector()` asks an observer; `JSDebugHelper` picks RTS manager for RTS context.” **Grade note:** right mechanism; missing historical direct API alternative and shared DevTool policy.

**Example B — MCTS-aware, 10/10:** “MCTS says direct `RTSVMWrapper` source APIs were superseded. RTS is integrated through MTS/Lepus observer lifecycle, target routing, connection gating, and debug-info policy, with RTS details isolated in `RTSInspectorManager`.”

**Evidence:** MCTS `mcts_mem/lynx/inspector/lepus-mts-debug-contract.md`; code `mts_runtime.cc`, `js_debug_helper.cc`, `rts_inspector_manager_factory.cc`.

**Common misses:** “factory pattern” only; treats RTS unrelated to MTS; omits historical alternative.

---

## Case 4 — WhiteBoard delegate split for session storage

**Question:** Why is WhiteBoard session storage routed through WhiteBoardDelegate subclasses for TASM and runtime instead of letting the WhiteBoard own TemplateAssembler callbacks or a single TASM-only listener path?

**Canonical correct answer:** WhiteBoard is the shared-data store and listener registry; it deliberately does not own execution-plane callback policy. Session-storage callbacks run in different environments: TASM/LynxView, runtime-standalone, Relax, and JS/runtime paths have different owners, threads, event contexts, and callback removal. `WhiteBoardDelegate` keeps common shared-data APIs while each execution plane owns invocation and teardown. MCTS-Mem records three rejected shapes: direct `TemplateAssembler` coupling, a single TASM-oriented delegate/listener path, and TASM/Lepus-specific listener coupling. Runtime-standalone SessionStorage and Relax StorageApi reuse forced the shared-data core to remain plane-neutral.

**Rubric, 12 pts:** 2 WhiteBoard owns data not callbacks; 2 execution planes differ; 2 delegate as boundary; 2 direct TemplateAssembler rejected; 2 single TASM/TASM-Lepus rejected; 2 runtime/Relax pressure.

**Example A — code-only, 8/12:** “WhiteBoard stores data/listeners; delegate handles callback invocation for TASM/runtime.” **Grade note:** good mechanics; misses full rejected history and Relax pressure.

**Example B — MCTS-aware, 12/12:** “MCTS says TemplateAssembler coupling, single TASM delegate, and TASM/Lepus listener coupling were superseded. WhiteBoard remains shared-data core; delegates own execution-plane callbacks for TASM, runtime-standalone, JS, and Relax.”

**Evidence:** MCTS `mcts_mem/lynx/shared-data.md` and three `shared-data.alt/*` files; code `lynx_white_board.h/.cc`, `white_board_delegate.h/.cc`, `white_board_runtime_delegate.cc`, `white_board_tasm_delegate.cc`.

**Common misses:** equates TASM access with ownership; ignores Relax/runtime; treats listeners as one type.

---

## Case 5 — `lynx.requireModule` two-level cache and failure policy

**Question:** Why does `lynx.requireModule` use both a per-LynxView exports cache and a LynxGroup-level factory/loadScript cache, and why are failed loads or thrown factories deliberately not cached?

**Canonical correct answer:** The caches store different phases with different lifetimes. The per-LynxView cache stores final `exports`, preserving module singleton semantics within one LynxView and dying with it. The LynxGroup-level cache stores reusable fetch/evaluate artifacts such as loaded script or evaluated factory, letting multiple LynxViews in the same group avoid repeated ResourceLoader requests and JS-engine evaluation while still executing factories with view-specific injected variables. Failed loads/evaluation/factories are not cached because caching them would poison later `requireModule` calls; this matches Node-style failed-module behavior. MCTS-Mem also records that Lynx skipped an extra ResourceLoader cache because ResourceLoader/Gecko already cache and another layer adds memory/platform cost.

**Rubric, 12 pts:** 2 exports vs factory cache; 2 LynxView vs LynxGroup lifetime; 2 fetch/evaluate/execute phases; 2 failure not cached; 2 Node-style/poisoned entry; 2 rejected ResourceLoader cache.

**Example A — code-only, 9/12:** “Per-view cache stores exports; group cache stores script/factory; failures are not cached because writes happen after success.” **Grade note:** good mechanics; missing phase model, Node-style rationale, rejected ResourceLoader cache.

**Example B — MCTS-aware, 12/12:** “MCTS frames this as ResourceLoader fetch, JS evaluate to factory, and view-specific factory execution. Per-view exports cache and group factory cache match those lifetimes. Failures are not cached to avoid poisoned entries, and a Lynx-owned ResourceLoader cache was rejected.”

**Evidence:** MCTS `mcts_mem/lynx/runtime.md`, `mcts_mem/lynx/runtime/js-app-surface.md`; code `lynx/js_libraries/lynx-core/src/lynx/lynx.ts`.

**Common misses:** conflates exports/factory; treats failure policy as accident; adds ResourceLoader cache.

---

## Case 6 — Android Service registry and `@Keep`

**Question:** Why do Android services use `IServiceProvider` plus `LynxServiceCenter` registration, and why are both service interfaces and AutoService providers annotated with `@Keep`?

**Canonical correct answer:** Android services use `IServiceProvider` and `LynxServiceCenter` to make host/platform services optional, interface-keyed, centrally initialized, and package-sensitive instead of hard-linking concrete implementations into core. Each implementation returns a stable lookup key, usually an `ILynx*Service` interface, via `getServiceClass()`. `LynxServiceCenter` registers instances, initializes them once, and lets consumers retrieve services by API interface. This supports separately integrated modules, generated/autolinked providers, reflection-loaded implementations, and lite/full package variants. Both providers and service interfaces need `@Keep` because Android shrinking can remove/rename SPI/reflection/generated classes, and interfaces are registry keys and ABI-facing contracts. MCTS-Mem records these as shrinker pitfalls.

**Rubric, 11 pts:** 2 interface-keyed lookup; 2 central lifecycle; 2 optional/injected boundary; 2 provider `@Keep`; 2 interface `@Keep`; 1 historical shrinker pitfall.

**Example A — code-only, 8/11:** “Services implement `IServiceProvider`; `LynxServiceCenter` registers by class key; `@Keep` protects reflection/generation from R8.” **Grade note:** good mechanics; misses hard-linked-to-service-center decision and recorded interface/provider pitfall.

**Example B — MCTS-aware, 11/11:** “MCTS says services moved from hard-linked/ad-hoc APIs to optional protocol/service-center lookup with explicit identities and lifecycle. Android must keep both AutoService providers and SPI-facing interfaces because they are lookup keys and shrinker-sensitive.”

**Evidence:** MCTS `mcts_mem/lynx/services/service-registry.md`, `mcts_mem/lynx/platform-bindings/platform-service-injection-boundary.md`; code `IServiceProvider.java`, `LynxServiceCenter.java`, `LynxLibraryProcessor.java`, `LynxLibraryRegistry.java`, proguard rules.

**Common misses:** `@Keep` only for implementations; service center as just a map; ignores package/lite optionality.

---

## Case 7 — `LynxTrailHub` external settings boundary

**Question:** Why did LynxEnv move external trail/settings reads behind `LynxTrailHub` and platform service implementations instead of directly choosing Android or Darwin settings providers with platform macros?

**Canonical correct answer:** `LynxEnv` moved external trail/settings access behind `LynxTrailHub` because environment values became a service-backed, source-prioritized, cached policy boundary rather than a compile-time platform branch in core. The old design made `LynxEnv` choose Android/Darwin providers with macros, coupling core runtime environment lookup to platform settings implementations. The new design lets platform services inject settings/trail sources while `LynxEnv` follows a common lookup path with explicit accepted keys, cache precedence, and per-page/instance-scoped settings identity in the host layer before exposing values to C++ `LynxEnv`. The rejected alternative is direct platform-macro external trail lookup inside `LynxEnv`.

**Rubric, 11 pts:** 2 old macro provider selection; 2 `LynxTrailHub` service lookup; 2 source/cache/key policy; 2 dependency inversion; 2 rejected macro alternative; 1 per-page/instance settings identity.

**Example A — code-only, 9/11:** “Old `LynxEnv` used macros; refactor introduced `LynxTrailHub`; core no longer chooses providers.” **Grade note:** strong git/code answer; incomplete on source priority/per-page settings and MCTS alternative.

**Example B — MCTS-aware, 11/11:** “MCTS frames it as platform service injection: external settings moved from platform macros/ad-hoc reads to service-backed, source-prioritized, cached stores with explicit keys and page identity in host services. Direct `LynxEnv` macro lookup is the rejected form.”

**Evidence:** MCTS `platform-bindings.md`, `platform-service-injection-boundary.md`, `.alt/lynxenv-platform-macro-external-trail-lookup-*`; code `lynx_env.cc`, `lynx_trail_hub.h`, commit `8b2316c1b05`.

**Common misses:** code cleanup only; no cache/source/key policy; ignores instance-scoped settings.

---

## Case 8 — Shell actors, mediators, operation queues, and rebinding

**Question:** Why does LynxShell route cross-plane work through `LynxActor`, mediators, and operation queues, and why can actors be rebound or transferred instead of exposing direct engine/layout/UI object references?

**Canonical correct answer:** LynxShell is built around thread-affine ownership rather than direct shared references. UI facade, TASM engine, JS runtime, layout, and performance/reporting may live on separate, shared, merged, or temporarily rebound runners depending on thread strategy and reuse. `LynxActor` owns an implementation with its runner and exposes work as closures, preserving affinity and teardown safety. Mediators define cross-plane boundaries; operation queues preserve ordering such as parent-before-child mutations. Actors can transfer/rebind because runtime topology changes; MCTS-Mem records concrete pitfalls such as dynamic rendering-pipeline thread switching where `VSyncMonitor` runners did not follow engine switches. Raw pointers would make these topology changes unsafe.

**Rubric, 10 pts:** 2 thread-affine ownership; 2 multiple planes/strategies; 2 mediators; 2 queues/order; 2 transfer/rebinding including engine/VSync pitfall or topology changes.

**Example A — code-only, 7/10:** “Actors serialize access on runners; mediators/queues keep cross-plane calls ordered.” **Grade note:** good thread-safety summary; misses historical rebinding/VSync pitfall.

**Example B — MCTS-aware, 10/10:** “MCTS says actor graph/mediators/operation queues are the shell-threading design. Runners can merge/rebind, and dynamic engine switching exposed VSync runner mismatch, so raw engine/layout/UI pointers are not allowed.”

**Evidence:** MCTS `shell-threading/*`; code `lynx_actor.h`, `lynx_shell.h/.cc`, `dynamic_ui_operation_queue.*`, `tasm_operation_queue.*`.

**Common misses:** “thread safety” only; ignores dynamic topology; direct `Impl()` from wrong thread.

---

## Case 9 — JS inspector manager decoupling

**Question:** Why does the JS inspector use observer-created `RuntimeInspectorManager`s and engine proxies instead of letting the core runtime instantiate V8/QuickJS inspector clients directly?

**Canonical correct answer:** The JS inspector uses observer-created `RuntimeInspectorManager`s to keep core runtime engine-neutral and DevTool-optional. Core JS runtimes know only abstract observer/manager interfaces; concrete V8, QuickJS, or other inspector clients live in DevTool/engine layers. The observer wires managers through opaque handles and JS-thread proxying instead of typed `LynxRuntime`/`JSIExecutor` ownership. MCTS-Mem records this as an engine-decoupling decision replacing older core-engine inspector fields. The design supports multiple engines, optional DevTool packaging, unsupported/no-op targets, and view/runtime-scoped routing without requiring core runtime to instantiate engine-specific DevTool clients.

**Rubric, 11 pts:** 2 abstract core; 2 concrete DevTool layer; 2 opaque/proxy; 2 historical replacement; 2 multi-engine/optional/no-op/view scope; 1 not generic factory only.

**Example A — code-only, 8/11:** “Runtime asks observer to create manager; concrete implementations are outside core.” **Grade note:** good dependency inversion; missing historical core-field replacement and opaque proxy rationale.

**Example B — MCTS-aware, 11/11:** “MCTS records inspector managers replacing core-engine inspector fields. `InspectorRuntimeObserver` uses opaque handles plus JS-thread proxying; core stays engine-neutral and DevTool-optional while concrete managers live in DevTool/engine layers.”

**Evidence:** MCTS `inspector/engine-decoupling-boundary.md`, `runtime/jsi-abstraction/engine-backends-and-compatibility.md`, `shell-threading/proxies-and-bridges.md`; code `inspector_runtime_observer_ng.h`, `runtime_inspector_manager.h`, V8/QuickJS runtime files.

**Common misses:** factory pattern only; no history; no opaque/proxy boundary.

---

## Case 10 — Recycled TemplateBundle greedy decode boundary

**Question:** Why does `loadTemplate` with `RECYCLE_TEMPLATE_BUNDLE` complete lazy-decoded sections on a concurrent task before calling `onTemplateBundleReady`, instead of returning the first-load lazy bundle directly?

**Canonical correct answer:** `RECYCLE_TEMPLATE_BUNDLE` is a reusable-bundle contract. The first `loadTemplate` path may use lazy decoding optimized for first render, leaving CSS, page, JS source, Lepus code, or other sections behind lazy readers. `onTemplateBundleReady` must give platform code a stable artifact that can later be passed to `loadTemplateBundle` to avoid repeated template decode, not leak first-render lazy entry state. Lynx schedules completion/greedy decode on a concurrent task, verifies/generates reusable state, and only then calls back. MCTS-Mem records that safe reuse depends on digest/version verification generated during GreedyDecode/PreDecode from binary MD5, and on stable lifetime/string-table identity shared by entry, assembler, and runtime callers.

**Rubric, 10 pts:** 2 lazy vs reusable artifact; 2 `onTemplateBundleReady`/`loadTemplateBundle`; 2 CompleteDecode/GreedyDecode; 2 digest/version/binary MD5; 2 stable lifetime/string-table/artifact scope.

**Example A — code-only, 8/10:** “First load may leave `lazy_reader_`; recycle completes decode before callback because callback needs complete bundle.” **Grade note:** good mechanism; missing digest/version and stable lifetime/string-table rationale.

**Example B — MCTS-aware, 10/10:** “MCTS says the callback returns a reusable TemplateBundle, not first-render lazy state. GreedyDecode/PreDecode complete decoded artifacts and produce digest/version verification from binary MD5, preserving stable lifetime/string-table identity for later `loadTemplateBundle`.”

**Evidence:** MCTS `template-bundle.md`, `template-bundle/bundle-object.md`, relevant `.alt/` files; code `template_assembler.cc/.h`, `lynx_template_bundle.cc`, `tasm_mediator.cc`.

**Common misses:** “complete bundle” only; ignores reuse contract/version digest; leaks TemplateEntry/lazy-reader state.
