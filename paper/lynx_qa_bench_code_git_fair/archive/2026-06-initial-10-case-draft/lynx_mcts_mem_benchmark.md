# Lynx MCTS-Mem Benchmark Cases

This is the benchmark-ready version of the Lynx MCTS-Mem evaluation set.

Each case contains:

- a benchmark question;
- a canonical correct answer;
- a task-specific rubric;
- two observed example answers, one from a code-only run and one from an MCTS-aware run;
- scores and notes explaining the gap;
- evidence paths for adjudication.

## Evaluation protocol

- **Code-only condition:** run in an isolated checkout/worktree where `mcts_mem/` is hidden or removed before any search. Allow code, tests, comments, and git history.
- **MCTS-aware condition:** require structural reading of `mcts_mem/` first, then code verification.
- **Scoring:** use the rubric attached to each case. Totals vary by task. Award semantic credit; exact wording is not required.
- **Primary failure mode:** the answer correctly describes implementation mechanics but misses the design decision, rejected alternative, historical constraint, or measured fact recorded in MCTS-Mem.

---

## Case 1 — DevTool DOM compression as CDP contract and scheduling boundary

### Question

Why does `DOM.enable` accept `useCompression` and `compressionThreshold`, and why are large `DOM.getDocument`/`describeNode` responses compressed on the devtool thread instead of just returning ordinary JSON from the TASM thread?

### Canonical correct answer

`DOM.enable` carries `useCompression` and `compressionThreshold` because DOM payload compression is a CDP-level negotiated behavior, not an unconditional internal transport change. Ordinary clients must still receive normal JSON, while clients that opt in can receive a compressed response shape for large DOM payloads. TASM still owns safe access to Element/TASM state, so `getDocument`/`describeNode` first build the DOM JSON from the TASM side. Once the payload has been serialized, Lynx moves the expensive compression work to the DevTool thread so the TASM thread does not spend additional time zlib/base64-compressing large inspector responses. The design is backed by a recorded measurement: a Douyin mall `getDocument` response was about 1.4 MB uncompressed and about 64 KB compressed, with roughly 72 ms compression cost. That made serialization/compression a scheduling boundary.

### Rubric, 12 pts

- 2 pts: identifies `DOM.enable` compression fields as opt-in / negotiated CDP behavior, not unconditional compression.
- 2 pts: mentions compatibility with ordinary JSON clients.
- 2 pts: explains thread split: TASM builds/reads DOM state, DevTool thread performs expensive compression.
- 2 pts: mentions threshold/large-payload behavior and zlib/base64 or equivalent compressed response shape.
- 3 pts: includes the measured motivation: about 1.4 MB to 64 KB with about 72 ms compression cost, or clearly states a recorded measurement drove the scheduling boundary.
- 1 pt: distinguishes wire-contract reasoning from a generic “reduce payload size” optimization.

### Example answer A — code-only, score 9/12

`DOM.enable` stores `useCompression` and `compressionThreshold`; DOM payloads are first built from TASM-owned state, and if compression is enabled and the serialized payload exceeds the threshold, Lynx compresses/base64-encodes it on the DevTool thread. This likely avoids blocking the TASM thread and keeps uncompressed JSON as the default for clients that do not ask for compression.

**Grade notes:** strong mechanics and inferred compatibility/threading. Missing the recorded 1.4 MB → 64 KB / 72 ms measurement and does not fully frame this as a CDP wire contract.

### Example answer B — MCTS-aware, score 12/12

`DOM.enable` is the negotiation point for a non-default compressed DOM response shape. TASM still builds the DOM tree JSON because Element/TASM state is owned there, but compression is moved to DevTool thread because the measured payload/cost made compression itself a scheduling boundary. MCTS-Mem records the motivating measurement: a Douyin mall `getDocument` response dropped from about 1.4 MB to 64 KB with about 72 ms compression cost, so compatibility required normal JSON by default and opt-in compression for large responses.

**Grade notes:** covers negotiation, compatibility, thread split, threshold/encoding, and measured historical reason.

### Evidence

- MCTS-Mem: `mcts_mem/lynx/devtool/cdp-wire.md`; `mcts_mem/lynx/inspector/dom-element-inspection-model.md`
- Code: `lynx/devtool/lynx_devtool/agent/inspector_tasm_executor.cc`; `lynx/devtool/lynx_devtool/agent/lynx_devtool_mediator.cc`

---

## Case 2 — Fiber Lepus chunks as keyed TemplateBundle sections

### Question

Why are Fiber Lepus worklet chunks stored as keyed sections inside the template bundle and optionally decoded lazily/asynchronously, instead of embedding or executing raw Relax/Lepus bytes directly at use sites?

### Canonical correct answer

Fiber Lepus worklet chunks are template artifacts, so Lynx stores them inside the TemplateBundle as keyed routed sections rather than scattering raw bytes at use sites. The key is the logical Lepus file path used by `__LoadLepusChunk`, which gives stable identity for runtime lookup and debug information. Keeping chunks inside the bundle lets them share the bundle’s section routing, random access, typed payload/length representation, SDK and compile-option compatibility checks, and lazy/asynchronous decode boundary. The rejected direction is to embed or execute raw Relax/Lepus bytes directly, or to use flat/generic custom sections; those forms bypass bundle integrity, compatibility, payload typing, and reusable decode scheduling.

### Rubric, 12 pts

- 2 pts: states chunks are bundle-owned template artifacts, not raw use-site bytes.
- 2 pts: explains key/path-based lookup, including logical Lepus file path or `__LoadLepusChunk` semantics.
- 2 pts: mentions routed sections / random access / typed payload representation.
- 2 pts: mentions SDK/version/compile-option compatibility or bundle integrity.
- 2 pts: mentions debug identity and/or lazy/asynchronous decode boundary.
- 2 pts: names rejected alternatives or their problem: raw bytes, flat sequential sections, or generic custom sections bypass bundle boundaries.

### Example answer A — code-only, score 8/12

Chunks are encoded as named entries in the TemplateBundle, with a dedicated `LEPUS_CHUNK` section and route table keyed by path. Use sites request the chunk by key, and the bundle/VM code owns decode, bytecode generation, debug metadata, and lazy scheduling. This avoids scattering raw bytes at use sites.

**Grade notes:** good implementation mechanics. It only partially explains the TemplateBundle compatibility/integrity decision and does not identify the rejected section-format alternatives.

### Example answer B — MCTS-aware, score 12/12

Fiber Lepus chunks are part of the bundle wire-format contract. They are keyed by logical Lepus file path so `__LoadLepusChunk` can route to a typed section with random access, debug identity, and compatibility checks. MCTS-Mem records that raw Relax/Lepus bytes, flat sequential sections, and generic custom sections were inferior because they bypassed target-independent payload typing, SDK/compile-option compatibility, and the reusable lazy/asynchronous decode boundary.

**Grade notes:** covers bundle artifact identity, key routing, compatibility, decode boundary, and rejected alternatives.

### Evidence

- MCTS-Mem: `mcts_mem/lynx/template-bundle/wire-format.md`
- Code: `lynx/core/template_bundle/template_codec/template_binary.h`; `lynx/core/template_bundle/template_codec/generator/meta_factory.cc`; `lynx/core/template_bundle/template_codec/binary_encoder/template_binary_writer.cc`

---

## Case 3 — RTS debugging through MTS/Lepus inspector hooks

### Question

Why is RTS debugging modeled as an `RTSInspectorManager` selected through MTS/Lepus inspector hooks instead of direct RTSVMWrapper source APIs?

### Canonical correct answer

RTS is treated as one MTS/Lepus execution backend for debugging purposes. The live design selects an `RTSInspectorManager` through the same MTS/Lepus inspector observer path used by other Lepus-like contexts, so RTS debugging participates in the common inspector lifecycle, target routing, observer takeover, connection-gated activation, and debug-info policy. The alternative direct `RTSVMWrapper` source API path was superseded: it exposes RTS-specific source handling at the wrong layer and bypasses the existing MTS/Lepus inspector boundary. RTS-specific details remain isolated in the RTS manager, while the runtime and DevTool see the common inspector abstraction.

### Rubric, 10 pts

- 2 pts: identifies RTS as an MTS/Lepus context/backend for debugger integration.
- 2 pts: explains use of common observer/inspector lifecycle rather than direct VM API access.
- 2 pts: mentions target routing / connection-gated activation / debug-info policy or equivalent shared DevTool concerns.
- 2 pts: names the rejected direct `RTSVMWrapper` source API direction.
- 2 pts: explains isolation of RTS-specific details behind `RTSInspectorManager`.

### Example answer A — code-only, score 7/10

`MTSRuntime::InitInspector()` creates the inspector manager through the Lepus observer, and `JSDebugHelper` picks an RTS manager factory when the context type is RTS. This keeps debug behavior in DevTool’s context/observer lifecycle instead of putting it directly in the low-level RTS VM wrapper.

**Grade notes:** correct live architecture and lifecycle inference. Missing the historical direct `RTSVMWrapper` alternative and some shared DevTool concerns such as target routing / connection-gated activation.

### Example answer B — MCTS-aware, score 10/10

RTS debugging is intentionally selected through the MTS/Lepus inspector hook because RTS is a backend of the MTS execution model. The rejected shape was direct `RTSVMWrapper` source APIs. The live design keeps RTS in the common inspector lifecycle—target routing, observer takeover, connection-gated activation, and debug-info policy—while isolating RTS-specific details in `RTSInspectorManager`.

**Grade notes:** covers current model, rejected alternative, shared lifecycle, and isolation boundary.

### Evidence

- MCTS-Mem: `mcts_mem/lynx/inspector/lepus-mts-debug-contract.md`
- Code: `lynx/core/shell/runtime/mts/mts_runtime.cc`; `lynx/devtool/lynx_devtool/js_debug/helper/js_debug_helper.cc`; `devtool/lynx_devtool/js_debug/rts/manager/rts_inspector_manager_factory.cc`

---

## Case 4 — WhiteBoard delegate split for session storage

### Question

Why is WhiteBoard session storage routed through WhiteBoardDelegate subclasses for TASM and runtime instead of letting the WhiteBoard own TemplateAssembler callbacks or a single TASM-only listener path?

### Canonical correct answer

WhiteBoard is the shared-data store and listener registry; it deliberately does not own execution-plane callback policy. Session-storage callbacks must run in different environments depending on who is using the data: TASM/LynxView, runtime-standalone, Relax, and JS/runtime paths have different owners, threads, event contexts, and callback-removal mechanisms. `WhiteBoardDelegate` keeps the common shared-data API while letting each execution plane own callback invocation and teardown. MCTS-Mem records two rejected shapes: WhiteBoard directly coupled to `TemplateAssembler`, and a single TASM-oriented delegate/listener path. Both were too narrow because shared data had to work across runtime and Relax reuse boundaries.

### Rubric, 12 pts

- 2 pts: states WhiteBoard owns shared data/listeners, not execution-plane callback policy.
- 2 pts: explains why callbacks differ across TASM/runtime/standalone/Relax or equivalent execution planes.
- 2 pts: explains delegate role as the execution-plane boundary for invocation/removal/teardown.
- 2 pts: names rejected direct `TemplateAssembler` coupling.
- 2 pts: names rejected single TASM-only path or explains why it was too narrow.
- 2 pts: connects the decision to runtime-standalone / Relax reuse pressure.

### Example answer A — code-only, score 8/12

`WhiteBoard` is only the shared key/value store and listener registry. `WhiteBoardDelegate` owns environment-specific callback invocation/removal because TASM/LynxView and runtime-standalone have different owners, threads, event contexts, and teardown rules.

**Grade notes:** strong current mechanics. Missing explicit rejected alternatives and only partially captures runtime-standalone/Relax pressure.

### Example answer B — MCTS-aware, score 12/12

WhiteBoard was kept as a plane-neutral shared-data domain. MCTS-Mem records that direct `TemplateAssembler` coupling and a single TASM-oriented listener/delegate path were superseded. Callback execution belongs to TASM/runtime delegates because shared data must serve TASM, runtime-standalone, JS/runtime, and Relax reuse boundaries without making WhiteBoard own one execution plane’s callbacks.

**Grade notes:** covers shared-data role, delegate boundary, both rejected alternatives, and runtime/Relax constraints.

### Evidence

- MCTS-Mem: `mcts_mem/lynx/shared-data.md`; `mcts_mem/lynx/shared-data.alt/whiteboard-directly-coupled-to-templateassembler-8f9fe3.md`; `mcts_mem/lynx/shared-data.alt/single-tasm-oriented-whiteboarddelegate-path-abs-72497c.md`
- Code: `lynx/core/shared_data/lynx_white_board.h`; `lynx/core/shared_data/lynx_white_board.cc`; `lynx/core/shared_data/white_board_delegate.h`

---

## Case 5 — `lynx.requireModule` two-level cache and failure policy

### Question

Why does `lynx.requireModule` use both a per-LynxView exports cache and a LynxGroup-level factory/loadScript cache, and why are failed loads or thrown factories deliberately not cached?

### Canonical correct answer

The two caches store different phases with different lifetimes. The per-LynxView cache stores the final `exports` object returned to user code, preserving module singleton semantics within one LynxView and dying with that view. The LynxGroup-level cache stores reusable fetch/evaluate artifacts such as loaded script or evaluated factory, so multiple LynxViews in the same group can avoid repeated ResourceLoader requests and JavaScript-engine evaluation while still executing factories with view-specific injected variables. Failed loads, failed evaluation, or factories that throw are not cached because caching those results would poison later `requireModule` calls; the intended behavior matches Node-style failed-module behavior. MCTS-Mem also records that Lynx intentionally avoided adding another ResourceLoader cache layer because ResourceLoader/Gecko already provide memory/disk caching and another layer would add memory and platform complexity.

### Rubric, 12 pts

- 2 pts: distinguishes per-LynxView final exports cache from group-level script/factory cache.
- 2 pts: explains different lifetimes: LynxView vs LynxGroup.
- 2 pts: explains phase split: ResourceLoader fetch, JS evaluation to factory, view-specific factory execution.
- 2 pts: explains failure/throw not cached to avoid poisoned entries / preserve retry semantics.
- 2 pts: mentions Node-style failed-module behavior or equivalent retry semantics.
- 2 pts: mentions rejected extra Lynx-owned ResourceLoader cache layer and why it was skipped.

### Example answer A — code-only, score 9/12

`requireModule` uses a per-view exports cache for final module objects and a group-level cache for reusable script/factory work. This preserves singleton exports per LynxView while avoiding repeated load/evaluate across the same group. Failed loads or factories are not cached because cache writes happen only after success.

**Grade notes:** good cache mechanics and success-only behavior. Missing the explicit fetch/evaluate/execute phase model, Node-style poisoned-entry rationale, and rejected ResourceLoader cache layer.

### Example answer B — MCTS-aware, score 12/12

The caches correspond to different phases and lifetimes: ResourceLoader fetch/evaluate-to-factory can be reused at LynxGroup scope, while final exports are view-specific because factories run with LynxView-injected variables. Failures are not cached to avoid poisoned entries and match Node-style failed-module behavior. MCTS-Mem also records that a separate Lynx-owned ResourceLoader cache layer was intentionally skipped because ResourceLoader/Gecko already cache and another layer would add memory/platform cost.

**Grade notes:** covers phases, lifetimes, failure policy, Node-style behavior, and rejected cache layer.

### Evidence

- MCTS-Mem: `mcts_mem/lynx/runtime.md`; `mcts_mem/lynx/runtime/js-app-surface.md`
- Code: `lynx/js_libraries/lynx-core/src/lynx/lynx.ts`

---

## Case 6 — Android Service registry and `@Keep`

### Question

Why do Android services use `IServiceProvider` plus `LynxServiceCenter` registration, and why are both the service interfaces and AutoService providers annotated with `@Keep`?

### Canonical correct answer

Android services use `IServiceProvider` and `LynxServiceCenter` to make platform/host services optional, interface-keyed, and centrally initialized instead of hard-linking concrete implementations into core Lynx. Each service implementation declares its stable lookup key, usually an `ILynx*Service` interface, via `getServiceClass()`. `LynxServiceCenter` registers instances under that key, calls `onInitialize()` once, and lets consumers retrieve services by API interface. This supports separately integrated service modules, generated/autolinked providers, reflection-loaded implementations, and optional DevTool/service packages. Both provider classes and service interfaces use `@Keep` because Android shrinking can remove or rename classes that are only reached through SPI/reflection/generated names, and because interfaces are themselves the registry keys and ABI-facing contracts. MCTS-Mem records these as Android shrinker pitfalls: keep `AutoService(IServiceProvider)` providers and keep SPI-facing service provider interfaces.

### Rubric, 11 pts

- 2 pts: explains interface-keyed service registration and lookup through `IServiceProvider#getServiceClass()`.
- 2 pts: explains central service lifecycle/initialization in `LynxServiceCenter`.
- 2 pts: explains optional/injected service-module boundary instead of hard-linked concrete services.
- 2 pts: explains why provider classes need `@Keep` under reflection/SPI/generated loading.
- 2 pts: explains why service interfaces also need `@Keep` as SPI-facing API keys/contracts, not just implementations.
- 1 pt: notes this was a recorded shrinker pitfall / historical hardening, not generic style.

### Example answer A — code-only, score 8/11

`IServiceProvider` provides a common contract and service key; `LynxServiceCenter` registers and initializes services by that key. Consumers ask for interfaces such as `ILynxImageService` while concrete implementations live in separate modules or generated/reflection-loaded providers. `@Keep` protects reflected/generated classes, singleton fields, and interface keys from R8/ProGuard.

**Grade notes:** strong implementation answer. It does not clearly frame the service-center move away from hard-linked/ad-hoc APIs and does not identify the two `@Keep` annotations as recorded shrinker pitfalls.

### Example answer B — MCTS-aware, score 11/11

Android service registration is part of Lynx’s move from hard-linked modules/ad-hoc APIs to optional protocol/service-center lookup with explicit provider identities and centralized lifecycle. `IServiceProvider` gives the registry key and `LynxServiceCenter` manages initialization and lookup. MCTS-Mem records two Android shrinker pitfalls: `AutoService(IServiceProvider)` providers must be kept, and the SPI-facing service interfaces must also be kept because they are lookup keys and ABI-facing contracts.

**Grade notes:** covers mechanics, design direction, provider/interface keep reasons, and historical pitfall.

### Evidence

- MCTS-Mem: `mcts_mem/lynx/services/service-registry.md`; `mcts_mem/lynx/platform-bindings/platform-service-injection-boundary.md`
- Code: `lynx/platform/android/service_api/src/main/java/com/lynx/tasm/service/IServiceProvider.java`; `lynx/platform/android/service_api/src/main/java/com/lynx/tasm/service/LynxServiceCenter.java`; `lynx/platform/android/lynx_processor/src/main/java/com/lynx/processor/LynxLibraryProcessor.java`; `lynx/platform/android/lynx_android/src/main/java/com/lynx/tasm/library/LynxLibraryRegistry.java`; `platform/android/lynx_android/proguard-rules.pro`

---

## Case 7 — `LynxTrailHub` external settings boundary

### Question

Why did LynxEnv move external trail/settings reads behind `LynxTrailHub` and platform service implementations instead of directly choosing Android or Darwin settings providers with platform macros?

### Canonical correct answer

LynxEnv moved external trail/settings access behind `LynxTrailHub` because external environment values became a service-backed policy boundary, not a compile-time platform branch in core code. The old shape made `LynxEnv` choose Android or Darwin providers with platform macros, coupling core runtime environment lookup to platform-specific settings implementations. The new design lets platform services provide settings/trail sources while LynxEnv follows a common lookup path with source priority, caching, and explicit key handling. This also makes Harmony and other platforms fit the same injection model and keeps OSS/core-facing code away from direct settings-manager dependencies. The rejected alternative is direct platform-macro external trail lookup inside `LynxEnv`.

### Rubric, 11 pts

- 2 pts: describes old platform-macro provider selection in `LynxEnv`.
- 2 pts: describes `LynxTrailHub`/platform service-backed lookup.
- 2 pts: explains source priority, caching, or explicit key handling as part of the boundary.
- 2 pts: explains dependency inversion away from core selecting platform providers directly.
- 2 pts: names rejected platform-macro external trail lookup or equivalent historical alternative.
- 1 pt: connects the design to cross-platform service injection, not just code cleanup.

### Example answer A — code-only, score 9/11

Old `LynxEnv` used platform macros to pick Android or Darwin settings providers. A refactor replaced that with `LynxTrailHub`, and current `LynxEnv` checks external maps, calls the hub, and caches results. The reason is dependency inversion: core no longer directly chooses platform settings providers.

**Grade notes:** strong because git history exposed the refactor. It only partially covers source priority / explicit key policy and does not fully frame the change as a platform-service injection boundary with a recorded rejected alternative.

### Example answer B — MCTS-aware, score 11/11

External trail/settings reads moved behind `LynxTrailHub` because MCTS-Mem records this as a platform service injection boundary: settings moved from platform macros/ad-hoc reads to service-backed, source-prioritized, cached stores with explicit key acceptance. The rejected alternative was direct platform-macro lookup in `LynxEnv`, which coupled core runtime environment access to platform settings implementations.

**Grade notes:** covers old/new design, source/cache/key policy, dependency inversion, and rejected alternative.

### Evidence

- MCTS-Mem: `mcts_mem/lynx/platform-bindings.md`; `mcts_mem/lynx/platform-bindings/platform-service-injection-boundary.md`; `mcts_mem/lynx/platform-bindings.alt/lynxenv-platform-macro-external-trail-lookup-lyn-a007e5.md`
- Code: `lynx/core/renderer/utils/lynx_env.cc`; `lynx/core/renderer/utils/lynx_trail_hub.h`; git commit `8b2316c1b05`

---

## Case 8 — Shell actors, mediators, operation queues, and rebinding

### Question

Why does LynxShell route cross-plane work through `LynxActor`, mediators, and operation queues, and why can actors be rebound or transferred instead of exposing direct engine/layout/UI object references?

### Canonical correct answer

LynxShell is built around thread-affine ownership rather than direct shared references. UI facade, TASM engine, JS runtime, layout, and performance/reporting work may live on separate, shared, merged, or temporarily rebound runners depending on the selected thread strategy and runtime/engine reuse path. `LynxActor` owns an implementation with its runner and exposes work as posted or synchronous closures, preserving affinity and teardown safety. Mediators define cross-plane boundaries, while operation queues preserve ordering, such as parent-before-child mutations and staged UI operations. Actors can be transferred or rebound because the runtime topology can change; exposing stable raw engine/layout/UI pointers would make those topology changes unsafe and would encourage cross-thread mutation outside the intended queues.

### Rubric, 10 pts

- 2 pts: identifies thread-affine ownership as the primary design.
- 2 pts: explains multiple planes/runners and strategy-selected topology.
- 2 pts: explains mediators as cross-plane boundaries.
- 2 pts: explains operation queues/order preservation and teardown safety.
- 2 pts: explains actor transfer/rebinding and why raw references would break topology/ownership safety.

### Example answer A — code-only, score 7/10

LynxShell owns UI, TASM, JS runtime, layout, and reporting planes on different runners. `LynxActor` serializes access on the owner runner, and mediators/queues keep cross-plane calls ordered and safe. Actors can transfer implementations to new runners, avoiding direct cross-thread references.

**Grade notes:** good thread-safety answer. It underplays strategy-selected topology, rebinding as a durable design axis, and the operation-queue ordering constraints.

### Example answer B — MCTS-aware, score 10/10

MCTS-Mem frames this as shell-threading architecture: actor graph, mediators, operation queues, and runner strategy are the design. Runners may be separate, shared, merged, or rebound; actors encode thread-affine ownership through closures; mediators are cross-plane boundaries; operation queues preserve parent-before-child and staged mutation ordering. Direct raw references would break topology changes and teardown safety.

**Grade notes:** covers all rubric points.

### Evidence

- MCTS-Mem: `mcts_mem/lynx/shell-threading.md`; `mcts_mem/lynx/shell-threading/actor-model.md`; `mcts_mem/lynx/shell-threading/mediators.md`; `mcts_mem/lynx/shell-threading/operation-queues.md`; `mcts_mem/lynx/shell-threading/thread-strategy.md`
- Code: `lynx/base/include/lynx_actor.h`; `lynx/core/shell/lynx_shell.h`; `lynx/core/shell/lynx_shell.cc`

---

## Case 9 — JS inspector manager decoupling

### Question

Why does the JS inspector use observer-created `RuntimeInspectorManager`s and engine proxies instead of letting the core runtime instantiate V8/QuickJS inspector clients directly?

### Canonical correct answer

The JS inspector uses observer-created `RuntimeInspectorManager`s to keep the core runtime engine-neutral and DevTool-optional. Core JS runtimes know only abstract observer/manager interfaces; concrete V8, QuickJS, or other inspector clients live in the DevTool layer. The observer creates the appropriate manager and wires it to the runtime through opaque handles and JS-thread proxying, rather than letting core own typed `LynxRuntime`/`JSIExecutor` or concrete inspector client links. MCTS-Mem records this as an engine-decoupling decision that replaced older core-engine inspector fields. The design supports multiple engines, optional DevTool packaging, unsupported targets with no-op managers, and view/runtime-scoped inspector routing without making the core runtime instantiate engine-specific DevTool objects.

### Rubric, 11 pts

- 2 pts: explains core depends on abstract observer/manager, not concrete DevTool clients.
- 2 pts: explains concrete engine inspectors live in DevTool/engine-specific layer.
- 2 pts: mentions opaque handles and/or JS-thread proxying.
- 2 pts: explains historical replacement of core-engine inspector fields / direct typed ownership.
- 2 pts: explains benefits for multiple engines, optional packaging, unsupported/no-op targets, or view-scoped routing.
- 1 pt: distinguishes this from a generic factory-pattern explanation.

### Example answer A — code-only, score 8/11

Core runtime depends only on `InspectorRuntimeObserverNG` and abstract `RuntimeInspectorManager`; V8/QuickJS ask the observer to create a manager. Concrete implementations live outside core in LynxDevtool, which keeps DevTool optional and avoids direct concrete inspector dependencies.

**Grade notes:** good dependency-inversion explanation. Missing historical replacement of core-engine inspector fields, opaque handle/proxy rationale, and some engine/target constraints.

### Example answer B — MCTS-aware, score 11/11

MCTS-Mem records this as an engine-decoupling boundary: inspector managers replaced core-engine inspector fields, and `InspectorRuntimeObserver` uses opaque handles plus JS-thread proxying instead of typed `LynxRuntime`/`JSIExecutor` ownership. Core remains engine-neutral and DevTool-optional; concrete V8/QuickJS managers live in the DevTool/engine layer, with no-op managers for unsupported targets and view/runtime-scoped routing.

**Grade notes:** covers all rubric points and explicitly avoids generic factory-only reasoning.

### Evidence

- MCTS-Mem: `mcts_mem/lynx/inspector/engine-decoupling-boundary.md`; `mcts_mem/lynx/runtime/jsi-abstraction/engine-backends-and-compatibility.md`; `mcts_mem/lynx/shell-threading/proxies-and-bridges.md`
- Code: `lynx/core/inspector/observer/inspector_runtime_observer_ng.h`; `lynx/core/inspector/runtime_inspector_manager.h`; `lynx/core/runtime/js/jsi/v8/v8_runtime.cc`; `lynx/core/runtime/js/jsi/quickjs/quickjs_runtime.cc`

---

## Case 10 — Recycled TemplateBundle greedy decode boundary

### Question

Why does `loadTemplate` with `RECYCLE_TEMPLATE_BUNDLE` complete lazy-decoded sections on a concurrent task before calling `onTemplateBundleReady`, instead of returning the first-load lazy bundle directly?

### Canonical correct answer

`RECYCLE_TEMPLATE_BUNDLE` is a reusable-bundle contract. The first `loadTemplate` path may use lazy decoding optimized for first render, leaving some sections behind a lazy reader. But `onTemplateBundleReady` is meant to give platform code a stable artifact that can later be passed to `loadTemplateBundle` to avoid repeated template decode. Therefore Lynx cannot simply return the live first-load lazy entry state. It schedules completion/greedy decode on a concurrent task, verifies/generates the reusable bundle state, and only then calls the callback. MCTS-Mem records that safe reuse also depends on digest/version verification generated during GreedyDecode/PreDecode from the binary MD5, and that the reusable bundle needs a stable lifetime boundary shared by entry, assembler, and runtime callers.

### Rubric, 10 pts

- 2 pts: explains first-load lazy decode vs complete reusable bundle distinction.
- 2 pts: explains `onTemplateBundleReady`/`loadTemplateBundle` as reuse/caching contract.
- 2 pts: explains why `CompleteDecode`/GreedyDecode happens before callback.
- 2 pts: mentions digest/version verification or binary MD5 safety for reuse.
- 2 pts: explains stable lifetime/API boundary and why first-render lazy state should not leak.

### Example answer A — code-only, score 8/10

The first `loadTemplate` path can leave sections lazy via a `lazy_reader_`. With `RECYCLE_TEMPLATE_BUNDLE`, Lynx does not callback with that in-entry bundle; it goes through `RecycleTemplateBundle` and completes decoding on a concurrent task because `OnTemplateBundleReady` requires a complete bundle.

**Grade notes:** strong mechanism and callback-completeness explanation. Missing the broader reusable artifact contract, digest/version verification, and lifetime-boundary rationale.

### Example answer B — MCTS-aware, score 10/10

`RECYCLE_TEMPLATE_BUNDLE` means the callback returns a reusable TemplateBundle for future `loadTemplateBundle`, not the first render’s lazy entry state. MCTS-Mem records that reuse must avoid repeated decode and depends on GreedyDecode/PreDecode digest/version verification from the binary MD5. Completing lazy sections before callback creates the stable lifetime/API boundary shared by entry, assembler, and runtime callers.

**Grade notes:** covers reuse contract, decode completion, digest/version safety, and boundary rationale.

### Evidence

- MCTS-Mem: `mcts_mem/lynx/template-bundle.md`; `mcts_mem/lynx/template-bundle/bundle-object.md`
- Code: `lynx/core/renderer/template_assembler.cc`; `lynx/core/renderer/template_assembler.h`; `lynx/core/template_bundle/lynx_template_bundle.cc`; `lynx/core/shell/tasm_mediator.cc`
