# Lynx MCTS-Mem Evaluation Cases

Purpose: test whether access to `mcts_mem/` improves architecture answers beyond code-only reading.

Protocol used for these cases:

- **code-only arm**: run in an isolated checkout/worktree with `mcts_mem/` hidden or removed before any search; allow code, tests, comments, and git history.
- **mcts-aware arm**: read `mcts_mem/` structurally first, then verify with code.
- Evaluation focus: whether the answer captures decisions, rejected alternatives, historical constraints, measured facts, and design direction—not just implementation mechanics.

Recommended result format per run:

```text
Question:
Code-only answer/summary:
MCTS-aware answer/summary:
Gap analysis:
MCTS evidence:
Code evidence:
Score/rubric:
```

---

## Case 1 — DevTool DOM compression as CDP contract and scheduling boundary

### Question

Why does `DOM.enable` accept `useCompression` and `compressionThreshold`, and why are large `DOM.getDocument`/`describeNode` responses compressed on the devtool thread instead of just returning ordinary JSON from the TASM thread?

### Why this tests MCTS-Mem

Code shows the mechanism: `DOM.enable` stores compression flags, TASM builds JSON, and large payloads are compressed on the DevTool thread. MCTS-Mem adds the design reason: this is a CDP wire-level compatibility contract backed by measured payload/cost data.

### Code-only answer summary observed

The code-only agent correctly found:

- compression defaults off with threshold around 10240 bytes;
- `DOM.enable` reads `useCompression` and `compressionThreshold`;
- `DOM.getDocument`, `DOM.describeNode`, and related DOM payloads are built from TASM state;
- large payloads are then compressed/base64-encoded off the TASM path;
- likely reason is compatibility plus avoiding expensive work on TASM.

### MCTS-aware answer summary observed

The MCTS-aware agent added:

- compression is negotiated at CDP level so ordinary JSON clients stay compatible;
- this is not just a helper optimization but a wire contract;
- MCTS-Mem records a measured Douyin mall `getDocument` response dropping from about **1.4 MB to 64 KB** at about **72 ms** compression cost;
- that measurement made serialization/compression a scheduling boundary.

### Gap analysis

Code-only can infer performance and compatibility. It misses the measured historical driver and why the design is framed as CDP negotiation rather than an internal implementation detail.

### MCTS-Mem evidence

- `mcts_mem/lynx/devtool/cdp-wire.md`
- `mcts_mem/lynx/inspector/dom-element-inspection-model.md`

### Code evidence

- `lynx/devtool/lynx_devtool/agent/inspector_tasm_executor.cc`
- `lynx/devtool/lynx_devtool/agent/lynx_devtool_mediator.cc`

### Evaluation rubric

Good answer mentions:

- TASM thread reads/builds TASM/Element-owned state;
- DevTool thread handles expensive compression;
- `DOM.enable` negotiates non-standard compressed payloads;
- ordinary JSON compatibility remains;
- measured 1.4 MB → 64 KB / ~72 ms fact.

---

## Case 2 — Fiber Lepus chunks as keyed TemplateBundle sections

### Question

Why are Fiber Lepus worklet chunks stored as keyed sections inside the template bundle and optionally decoded lazily/asynchronously, instead of embedding or executing raw Relax/Lepus bytes directly at use sites?

### Why this tests MCTS-Mem

Code shows chunk encoding and lookup, but MCTS-Mem frames it as a TemplateBundle wire-format decision with rejected alternatives and compatibility constraints.

### Code-only answer summary observed

The code-only agent found:

- `lepusChunk` entries are keyed by logical path/name;
- encoder writes a dedicated `LEPUS_CHUNK` section and route table;
- use sites request chunks by key;
- lazy/async decode supports on-demand loading, debug metadata, and dynamic component use.

### MCTS-aware answer summary observed

The MCTS-aware agent added:

- this is a bundle-format/container decision, not merely runtime convenience;
- keyed sections preserve section routing, SDK/compile-option compatibility, payload typing, random access, and debug identity;
- MCTS-Mem records rejected alternatives: raw Relax/Lepus bytes, flat sequential sections, and generic custom-section serialization;
- `__LoadLepusChunk` works because chunk identity is a logical Lepus file path in the bundle.

### Gap analysis

Code-only explains how chunks work. MCTS-aware explains why the chunk must be a template artifact under the bundle’s routing/compatibility boundary rather than opaque bytes at use sites.

### MCTS-Mem evidence

- `mcts_mem/lynx/template-bundle/wire-format.md`

### Code evidence

- `lynx/core/template_bundle/template_codec/template_binary.h`
- `lynx/core/template_bundle/template_codec/generator/meta_factory.cc`
- `lynx/core/template_bundle/template_codec/binary_encoder/template_binary_writer.cc`

### Evaluation rubric

Good answer mentions:

- key/path-based chunk routing;
- random access section table;
- SDK/version/compile-option compatibility;
- debug identity;
- rejected alternatives: raw bytes, flat sections, generic custom sections.

---

## Case 3 — RTS debugging through MTS/Lepus inspector hooks

### Question

Why is RTS debugging modeled as an `RTSInspectorManager` selected through MTS/Lepus inspector hooks instead of direct RTSVMWrapper source APIs?

### Why this tests MCTS-Mem

The live code shows a factory path, but MCTS-Mem records the historical alternative: direct RTSVMWrapper source APIs. This is exactly the kind of lost context code-only reading often misses.

### Code-only answer summary observed

The code-only agent found:

- `MTSRuntime::InitInspector()` asks the Lepus observer for an inspector manager;
- `JSDebugHelper::CreateLepusInspectorManager()` special-cases `RTSContextType`;
- RTS manager factory returns `RTSInspectorManagerImpl`;
- debug behavior belongs to DevTool observer/context lifecycle rather than the low-level RTS VM wrapper.

### MCTS-aware answer summary observed

The MCTS-aware agent added:

- direct `RTSVMWrapper` source APIs were the old/alternative design;
- current design treats RTS as one MTS execution backend;
- RTS debugging must share MTS/Lepus lifecycle, target routing, observer takeover, connection-gated activation, and debug-info policy;
- RTS-specific details remain behind an RTS-only manager.

### Gap analysis

Code-only can infer lifecycle ownership. MCTS-aware identifies the historical direction being avoided and why the factory path is a design boundary rather than arbitrary indirection.

### MCTS-Mem evidence

- `mcts_mem/lynx/inspector/lepus-mts-debug-contract.md`

### Code evidence

- `lynx/core/shell/runtime/mts/mts_runtime.cc`
- `lynx/devtool/lynx_devtool/js_debug/helper/js_debug_helper.cc`
- `devtool/lynx_devtool/js_debug/rts/manager/rts_inspector_manager_factory.cc`

### Evaluation rubric

Good answer mentions:

- RTS as an MTS context/backend;
- shared Lepus/MTS inspector lifecycle;
- rejected direct `RTSVMWrapper` source APIs;
- connection-gated activation / observer takeover;
- RTS-specific details isolated behind `RTSInspectorManager`.

---

## Case 4 — WhiteBoard delegate split for session storage

### Question

Why is WhiteBoard session storage routed through WhiteBoardDelegate subclasses for TASM and runtime instead of letting the WhiteBoard own TemplateAssembler callbacks or a single TASM-only listener path?

### Why this tests MCTS-Mem

Code reveals a delegate split, but MCTS-Mem records why: direct TemplateAssembler coupling and single TASM-only paths were superseded by a plane-neutral shared-data domain.

### Code-only answer summary observed

The code-only agent found:

- `WhiteBoard` is a shared key/value store and listener registry;
- `WhiteBoardDelegate` abstracts session-storage APIs and callback invocation/removal;
- TASM/LynxView and runtime-standalone have different owners, threads, event contexts, and callback-removal mechanisms.

### MCTS-aware answer summary observed

The MCTS-aware agent added:

- WhiteBoard’s design lineage is a shared data center across LynxViews;
- it replaced direct coupling to `TemplateAssembler`;
- it also replaced a single TASM-oriented delegate path;
- runtime-standalone and Relax reuse requirements drove the separation between data ownership and callback execution.

### Gap analysis

Code-only can infer the current polymorphism. MCTS-aware explains the rejected earlier forms and why WhiteBoard must remain a shared-data domain rather than a TASM callback owner.

### MCTS-Mem evidence

- `mcts_mem/lynx/shared-data.md`
- `mcts_mem/lynx/shared-data.alt/whiteboard-directly-coupled-to-templateassembler-8f9fe3.md`
- `mcts_mem/lynx/shared-data.alt/single-tasm-oriented-whiteboarddelegate-path-abs-72497c.md`

### Code evidence

- `lynx/core/shared_data/lynx_white_board.h`
- `lynx/core/shared_data/lynx_white_board.cc`
- `lynx/core/shared_data/white_board_delegate.h`

### Evaluation rubric

Good answer mentions:

- WhiteBoard owns shared data, not execution policy;
- callback execution belongs to TASM/runtime delegates;
- rejected alternatives: direct `TemplateAssembler` coupling and single TASM path;
- runtime-standalone / Relax reuse boundary.

---

## Case 5 — `lynx.requireModule` two-level cache and failure policy

### Question

Why does `lynx.requireModule` use both a per-LynxView exports cache and a LynxGroup-level factory/loadScript cache, and why are failed loads or thrown factories deliberately not cached?

### Why this tests MCTS-Mem

Code shows cache assignment points, but MCTS-Mem frames the design as phase/lifetime separation and records a rejected extra ResourceLoader cache layer.

### Code-only answer summary observed

The code-only agent found:

- per-LynxView cache stores final exports;
- group-level cache stores script/factory/loadScript artifacts;
- per-view cache preserves module singleton semantics inside one view;
- group cache avoids repeated ResourceLoader requests/evaluation;
- failures are not cached because assignment happens only after success.

### MCTS-aware answer summary observed

The MCTS-aware agent added:

- module loading is split into ResourceLoader fetch, JS-engine evaluation into factory, and LynxView-specific factory execution;
- per-view and group caches correspond to different ownership/lifetime boundaries;
- MCTS-Mem records that a Lynx-owned ResourceLoader cache was intentionally skipped because ResourceLoader/Gecko already cache and another layer adds memory/platform cost;
- failed loads/evaluations/factories are not cached to avoid poisoned entries and match Node-style failed-module behavior.

### Gap analysis

Code-only identifies mechanics. MCTS-aware adds phase boundaries, ownership rationale, avoided ResourceLoader cache layer, and poisoned-entry rationale.

### MCTS-Mem evidence

- `mcts_mem/lynx/runtime.md`
- `mcts_mem/lynx/runtime/js-app-surface.md`

### Code evidence

- `lynx/js_libraries/lynx-core/src/lynx/lynx.ts`

### Evaluation rubric

Good answer mentions:

- exports vs factory/loadScript cache;
- LynxView vs LynxGroup lifetime;
- fetch/evaluate/execute phase split;
- failure not cached to avoid poisoned entries;
- rejected Lynx-owned ResourceLoader cache layer.

---

## Case 6 — Android Service registry and `@Keep`

### Question

Why do Android services use `IServiceProvider` plus `LynxServiceCenter` registration, and why are both the service interfaces and AutoService providers annotated with `@Keep`?

### Why this tests MCTS-Mem

Code reveals registry mechanics and shrinker annotations. MCTS-Mem explains the broader move from hard-linked/ad-hoc services to injected service boundaries and records the exact Android shrinker pitfalls.

### Code-only answer summary observed

The code-only agent found:

- `IServiceProvider#getServiceClass()` declares a stable service key;
- `LynxServiceCenter` registers, initializes, and retrieves services by key;
- consumers depend on interfaces like `ILynxImageService` or `ILynxHttpService`;
- service implementations can be separate modules, generated providers, or reflection-loaded classes;
- `@Keep` protects reflection/generation/interface keys from R8/ProGuard;
- current direct Java `ServiceLoader` use for `@AutoService(IServiceProvider)` was not obvious from code alone.

### MCTS-aware answer summary observed

The MCTS-aware agent added:

- service registry is part of a design move away from hard-linked modules and ad-hoc feature APIs;
- service-center/protocol lookup gives optional protocols, injected host adapters, explicit provider identities, and centralized lifecycle;
- MCTS-Mem records two Android shrinker pitfalls: keep `AutoService(IServiceProvider)` providers and keep SPI-facing service provider interfaces;
- `@Keep` is therefore a recorded compatibility/survivability constraint, not merely a general reflection habit.

### Gap analysis

Code-only explains the mechanics. MCTS-aware explains the decision direction and the historical shrinker failures that justify keeping both provider classes and interfaces.

### MCTS-Mem evidence

- `mcts_mem/lynx/services/service-registry.md`
- `mcts_mem/lynx/platform-bindings/platform-service-injection-boundary.md`

### Code evidence

- `lynx/platform/android/service_api/src/main/java/com/lynx/tasm/service/IServiceProvider.java`
- `lynx/platform/android/service_api/src/main/java/com/lynx/tasm/service/LynxServiceCenter.java`
- `lynx/platform/android/service_api/src/main/java/com/lynx/tasm/service/ILynxImageService.java`
- `lynx/platform/android/lynx_processor/src/main/java/com/lynx/processor/LynxLibraryProcessor.java`
- `lynx/platform/android/lynx_android/src/main/java/com/lynx/tasm/library/LynxLibraryRegistry.java`
- `platform/android/lynx_services/lynx_image_service/.../LynxImageServiceProvider.java`
- `platform/android/lynx_android/proguard-rules.pro`

### Evaluation rubric

Good answer mentions:

- interface-keyed service lookup;
- optional/injected service boundary;
- centralized service lifecycle;
- `@Keep` for providers and interfaces;
- historical shift from hard-linked/ad-hoc APIs to service-center/protocol lookup.

---

## Case 7 — `LynxTrailHub` external settings boundary

### Question

Why did LynxEnv move external trail/settings reads behind `LynxTrailHub` and platform service implementations instead of directly choosing Android or Darwin settings providers with platform macros?

### Why this tests MCTS-Mem

Git history can show the macro removal, but MCTS-Mem places it inside a broader platform-service injection decision: source-prioritized cached settings with explicit keys and platform-provided services.

### Code-only answer summary observed

The code-only agent found:

- old `LynxEnv` directly used platform macros to choose Android/Darwin settings providers;
- refactor commit replaced platform macro lookup with `LynxTrailHub`;
- current `LynxEnv` reads external env map, calls `LynxTrailHub::GetStringForTrailKey`, and caches results;
- the immediate reason is dependency inversion and removing platform selection from core `LynxEnv`.

### MCTS-aware answer summary observed

The MCTS-aware agent added:

- MCTS-Mem records this as platform service injection, not just macro cleanup;
- settings/trail access moved from platform macros/ad-hoc reads to service-backed, source-prioritized, cached stores;
- explicit key acceptance and precedence are part of the decision;
- rejected alternative is direct `LynxEnv` platform-macro external trail lookup.

### Gap analysis

Code-only can reconstruct the refactor from commits. MCTS-aware adds the design boundary: external env/trail is a service-backed policy layer, not a platform macro branch in core.

### MCTS-Mem evidence

- `mcts_mem/lynx/platform-bindings.md`
- `mcts_mem/lynx/platform-bindings/platform-service-injection-boundary.md`
- `mcts_mem/lynx/platform-bindings.alt/lynxenv-platform-macro-external-trail-lookup-lyn-a007e5.md`

### Code evidence

- `lynx/core/renderer/utils/lynx_env.cc`
- `lynx/core/renderer/utils/lynx_trail_hub.h`
- git commit `8b2316c1b05`

### Evaluation rubric

Good answer mentions:

- old macro-based provider selection;
- `LynxTrailHub`/service-backed lookup;
- source priority, caching, explicit key acceptance;
- dependency inversion from core to platform services;
- rejected platform-macro lookup alternative.

---

## Case 8 — Shell actors, mediators, operation queues, and rebinding

### Question

Why does LynxShell route cross-plane work through `LynxActor`, mediators, and operation queues, and why can actors be rebound or transferred instead of exposing direct engine/layout/UI object references?

### Why this tests MCTS-Mem

Code shows actors and queues. MCTS-Mem records the durable architectural choice: thread-affine ownership under strategy-selected runner topologies, not direct references plus locks.

### Code-only answer summary observed

The code-only agent found:

- LynxShell owns multiple planes: UI facade, TASM engine, JS runtime, layout, performance/reporting;
- planes bind to different runners;
- `LynxActor` serializes access on the owner runner;
- `TransferToNewActor` supports moving an implementation to a new actor/runner;
- mediators and queues preserve ordering and teardown safety.

### MCTS-aware answer summary observed

The MCTS-aware agent added:

- MCTS-Mem records actor graph, operation queues, mediators, and runner strategy as the shell-threading design;
- thread topology can be separate, shared, merged, or rebound;
- operation queues preserve mutation ordering such as parent-before-child;
- runtime extension work should go through effective runtime actor/platform invoker rather than shell-owned staging queues;
- actor rebinding is part of supporting runtime/thread topology changes, not a local trick.

### Gap analysis

Code-only sees thread safety. MCTS-aware explains why the design rejects stable raw cross-plane references: topology and ownership can change, and queues/actors are the durable boundary.

### MCTS-Mem evidence

- `mcts_mem/lynx/shell-threading.md`
- `mcts_mem/lynx/shell-threading/actor-model.md`
- `mcts_mem/lynx/shell-threading/mediators.md`
- `mcts_mem/lynx/shell-threading/operation-queues.md`
- `mcts_mem/lynx/shell-threading/thread-strategy.md`

### Code evidence

- `lynx/base/include/lynx_actor.h`
- `lynx/core/shell/lynx_shell.h`
- `lynx/core/shell/lynx_shell.cc`

### Evaluation rubric

Good answer mentions:

- thread-affine actor ownership;
- mediators as cross-plane boundaries;
- operation queues for ordering;
- strategy-selected runner topology;
- actor transfer/rebinding;
- why direct raw references would break ownership/teardown/order.

---

## Case 9 — JS inspector manager decoupling

### Question

Why does the JS inspector use observer-created `RuntimeInspectorManager`s and engine proxies instead of letting the core runtime instantiate V8/QuickJS inspector clients directly?

### Why this tests MCTS-Mem

Code-only can identify dependency inversion. MCTS-Mem records the historical coupling that was replaced and the exact engine-decoupling boundary: opaque handles and JS-thread proxying instead of typed runtime ownership.

### Code-only answer summary observed

The code-only agent found:

- core runtime only depends on abstract `InspectorRuntimeObserverNG` and `RuntimeInspectorManager`;
- V8/QuickJS runtime asks observer to create a manager;
- concrete implementations live in LynxDevtool;
- this avoids core runtime owning concrete DevTool inspector clients and supports optional linking / engine abstraction.

### MCTS-aware answer summary observed

The MCTS-aware agent added:

- MCTS-Mem records that inspector APIs moved out of core-engine fields like `TemplateAssembler`, `RNPatching`, `UIImpl`, and `VirtualNode` into inspector managers;
- `InspectorRuntimeObserver` uses opaque `intptr_t` handles plus JS-thread proxying instead of typed `LynxRuntime`/`JSIExecutor` ownership;
- unsupported 32-bit iOS targets use `NoneInspectorRuntimeManager`;
- the design protects engine/backend neutrality across QuickJS, V8, JSC, JSVM, and packaging constraints.

### Gap analysis

Code-only says “factory/abstraction.” MCTS-aware explains what previous coupling was removed and why direct engine inspector construction would violate the engine-decoupling boundary.

### MCTS-Mem evidence

- `mcts_mem/lynx/inspector/engine-decoupling-boundary.md`
- `mcts_mem/lynx/runtime/jsi-abstraction/engine-backends-and-compatibility.md`
- `mcts_mem/lynx/shell-threading/proxies-and-bridges.md`

### Code evidence

- `lynx/core/inspector/observer/inspector_runtime_observer_ng.h`
- `lynx/core/inspector/runtime_inspector_manager.h`
- `lynx/core/runtime/js/jsi/v8/v8_runtime.cc`
- `lynx/core/runtime/js/jsi/quickjs/quickjs_runtime.cc`

### Evaluation rubric

Good answer mentions:

- observer-created managers;
- abstract core vs concrete devtool implementation;
- opaque handles / JS-thread proxy;
- removed core-engine inspector fields;
- engine/backend neutrality and optional DevTool dependency.

---

## Case 10 — Recycled TemplateBundle greedy decode boundary

### Question

Why does `loadTemplate` with `RECYCLE_TEMPLATE_BUNDLE` complete lazy-decoded sections on a concurrent task before calling `onTemplateBundleReady`, instead of returning the first-load lazy bundle directly?

### Why this tests MCTS-Mem

Code comments explain much of the mechanism. MCTS-Mem adds the API-contract decision: `onTemplateBundleReady` returns a stable reusable artifact, not the first-render entry’s lazy state.

### Code-only answer summary observed

The code-only agent found:

- normal `loadTemplate` uses `LynxTemplateBundle::FromBinary`;
- `FromBinary` can leave lazy sections behind a `lazy_reader_`;
- with `RECYCLE_TEMPLATE_BUNDLE`, TemplateAssembler routes through `RecycleTemplateBundle`;
- comments say `OnTemplateBundleReady` needs a complete bundle;
- a concurrent task performs `CompleteDecode` before callback.

### MCTS-aware answer summary observed

The MCTS-aware agent added:

- MCTS-Mem records `onTemplateBundleReady` as a TemplateBundle reuse contract;
- later loads use `loadTemplateBundle` to avoid repeated template decode;
- reusable decoded bundles need a stable lifetime boundary shared by entry, assembler, and runtime callers;
- digest/version verification from GreedyDecode/PreDecode is part of safe reuse;
- first-render lazy state should not leak into the reusable bundle API.

### Gap analysis

Code-only identifies why a complete bundle is needed. MCTS-aware frames it as a boundary between render-time lazy entry state and reusable/cachable TemplateBundle artifact.

### MCTS-Mem evidence

- `mcts_mem/lynx/template-bundle.md`
- `mcts_mem/lynx/template-bundle/bundle-object.md`

### Code evidence

- `lynx/core/renderer/template_assembler.cc`
- `lynx/core/renderer/template_assembler.h`
- `lynx/core/template_bundle/lynx_template_bundle.cc`
- `lynx/core/shell/tasm_mediator.cc`

### Evaluation rubric

Good answer mentions:

- lazy first-load decode vs complete reusable bundle;
- `onTemplateBundleReady` as reuse/caching contract;
- `CompleteDecode`/GreedyDecode before callback;
- digest/version verification;
- avoiding leakage of TemplateEntry/lazy-reader state.
