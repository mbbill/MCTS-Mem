# Cases 11–20 — Platform, Services, DevTool, Shared Data, Runtime Communication

## Case 11 — Darwin service protocols replace side-effect registration and host-library coupling

**Question:** How should a Darwin Lynx feature access host services such as logging, monitoring, settings, or resources, and what historical alternatives should it avoid?

**Canonical correct answer:** On Darwin, host capability should be expressed as LynxService protocols and accessed through ServiceAPI registration/lookup, not Objective-C `+load` side effects or direct compile-time host-library access. MCTS-Mem records BDLynx services as optional protocols with explicit context lifecycle, and Darwin protocols as injectable seams for resources, monitoring, settings, and logging. Darwin history moved registration away from side effects into lazy singleton or Mach-O-section scanning, and consolidated duplicate iOS/macOS APIs into common protocols. Direct BDALog compilation was replaced by asking `LynxServiceLogProtocol` for an optional write function, preserving OSS/core independence. Code verifies protocol-to-class maps, lazy auto-registration, and `LynxService(...)` lookup.

**Rubric, 10 pts:** 3 protocol/ServiceAPI seam; 2 rejects `+load`/direct host coupling; 2 OSS/common-surface reason; 1.5 lazy registration lookup code; 1.5 concrete service example.

**Example A — code-only, 4/10:** “Use `LynxService(SomeProtocol)` and `LynxServiceRegister`.” **Grade note:** mechanism only; no history/OSS decoupling.

**Example B — MCTS-aware, 9.5/10:** “Define a protocol, register via ServiceAPI, and access with `LynxService(...)`; avoid `+load` side effects and direct BDALog/host dependencies because MCTS records optional injected Darwin services and common iOS/macOS seams.”

**Evidence:** MCTS `platform-bindings/darwin.md`, `services/service-registry.md`, `platform-service-injection-boundary.md`; code `ServiceAPI.h/.m`, `LynxServiceLogProtocol.h`, `LynxService.h`.

**Common misses:** “just use macro”; recommend direct singleton; misses BDALog/OSS history.

---

## Case 12 — Typed host resource contract, not consumer-private byte glue

**Question:** A developer wants to add a new resource-loading path for external JS, fonts, and frame bundles by wiring a consumer-specific byte callback directly into TASM. What should the correct Lynx design answer say?

**Canonical correct answer:** Lynx should not add another consumer-private byte callback retained by TASM. Resource loading converges on a typed, host-provided `LynxResourceLoader` contract: callers describe resources with `LynxResourceRequest` and `LynxResourceType`, and loaders return typed `LynxResourceResponse` or `LynxPathResponse`. Platform layers provide backend hooks, redirection, path loading, scheduling, and richer metadata; the core request is thin, mainly URL/type/thread flag. Lazy bundle, frame, JS, bytecode, image, font, Lottie, SVG, and template paths should pass through this typed boundary rather than consumer-specific callbacks. Scheduling is platform-specific, not uniform across Darwin, Android, and Harmony.

**Rubric, 10 pts:** 3 request/response/type names; 2 platform backend/redirect/scheduling; 2 rejects consumer byte callback; 1 thin core metadata; 1 platform scheduling differs; 1 MCTS rationale.

**Example A — code-only, 5/10:** “Use `LynxResourceLoader::LoadResource` with URL/type and callback.” **Grade note:** sees class; misses host policy and anti-callback decision.

**Example B — MCTS-aware, 10/10:** “MCTS says resource loading settled on typed host contracts, not TASM-owned byte glue. Use request/response/path structs and platform hooks; host owns backend/scheduling and richer metadata.”

**Evidence:** MCTS `resource/loader/typed-host-contract.md`, `resource/loader/backend-offline-scheme-policy.md`, `services/service-registry.md`; code `lynx_resource_loader.h/.cc`, Darwin/Harmony/Android resource loaders, `LynxResourceRequest.java`.

**Common misses:** byte helper only; uniform scheduling; overstates core request metadata.

---

## Case 13 — C++ service_api per-service lazy registry

**Question:** The C++ side needs a host-provided capability callable from multiple modules. Should it add a central `ServiceCenter`, reuse platform services, or follow the C++ service_api registry model?

**Canonical correct answer:** The C++ layer should not rebuild an Android/Darwin-style central `ServiceCenter`. The live C++ `service_api` uses a per-service template singleton registry with lazy `set_creator`/`get` construction and decentralized maintenance, allowing Lynx to call host C/C++ capabilities without routing through platform service layers. The live `service_api` declares interface anchors and registration macros; each service interface has an exported `get_registry<S>()` so separate modules share the same registry under dynamic linking, while static linking yields one instance. `get_service` returns a cached singleton or null if no implementation is loaded. This differs from Java map-backed `LynxServiceCenter`.

**Rubric, 10 pts:** 3 per-service registry; 2 lazy creator/cache/null; 2 distinguish platform service centers; 1.5 dynamic/static sharing; 1.5 decentralized/subset rationale.

**Example A — code-only, 5/10:** “Use `LYNX_SERVICE_DECLARE`, `LYNX_SERVICE_REGISTER`, and `get_service<T>()`.” **Grade note:** API only; no central-service rejection.

**Example B — MCTS-aware, 9.5/10:** “Use per-service registry; MCTS says C++ deliberately avoided a central ServiceCenter. Each service owns lazy singleton registry, exported via `get_registry<S>()`, with nullable lookup and decentralized maintenance.”

**Evidence:** MCTS `services/service-registry.md`, `services.md`; code `lynx/service_api/service_api.h/.cc`, `service_api_services.h`, tests.

**Common misses:** central global C++ ServiceCenter; confuses Android lifecycle; assumes lookup succeeds.

---

## Case 14 — PerformanceEntry stream model through PerformanceController

**Question:** A new performance metric needs to report memory/timing/render data across Android, Darwin, and multiple runtime/render flows. Should it add another setup/update callback or use the newer performance model?

**Canonical correct answer:** New performance data belongs in the `PerformanceEntry` stream mediated by `PerformanceController`, not another fixed setup/update callback. MCTS-Mem records that separate Report-thread actors for `NativeFacadeReporter` and `TimingHandler` duplicated C++/platform communication, and the current code exposes a more general PerformanceEntry/PerformanceObserver model than fixed setup/update callbacks. The replacement is a single Report-thread actor per LynxView centralizing `TimingHandler`, `MemoryMonitor`, and `PerformanceEntry` dispatch to client, BTS, and MTS. Public entries are generated from schemas and delivered by `entryType`/`name`. Code confirms `PerformanceController` owns timing/memory pieces and platform observer callbacks run on reporter thread.

**Rubric, 10 pts:** 3 PerformanceEntry/Observer/Controller; 2 fixed callbacks are weaker than entry-stream model; 2 central timing/memory dispatch; 1.5 reporter-thread constraints; 1.5 schema/generated entries.

**Example A — code-only, 5/10:** “Add a `PerformanceEntry` and notify observers through `PerformanceController`.” **Grade note:** right class; misses why callbacks were replaced.

**Example B — MCTS-aware, 9.5/10:** “Use schema-backed `PerformanceEntry` through `PerformanceObserver`/`PerformanceController`; MCTS says fixed setup/update callbacks and duplicate reporter actors were superseded by an entry-stream model centralized on the Report thread.”

**Evidence:** MCTS `services/perf-monitor.md`, `performance-entry-streams.md`, `services/timing.md`; code `performance_controller.h/.cc`, Android/Darwin performance controllers, `PipelineEntry.yml`.

**Common misses:** legacy callbacks; ignores reporter thread; separates memory monitoring path.

---

## Case 15 — Timing freshness is pipeline-scoped

**Question:** During reload or multi-threaded rendering, how should Lynx prevent stale timing marks and represent host platform timing? Should it clear marks heuristically or infer pipeline end from paint end?

**Canonical correct answer:** Timing should stay pipeline-scoped with explicit pipeline ids, phase/order validation, host-platform timing lanes, and microsecond internal precision; do not revive reload clear-time heuristics or paint-end inference. MCTS-Mem records timing moving from loose flags/enums and ad-hoc marks to service-owned setup/update/extra timing maps, `PipelineOptions`, `pipeline_id`, ordered/string-keyed maps, and typed `PerformanceEntry`/`PipelineEntry` records. Reload freshness is validated by setup phase/order so stale multi-threaded load/reload marks are discarded. The design should guard against stale reload and pipeline-freshness failure modes. Code maps pipeline ids to origins/flags, gates readiness, resets before reload, stores host-platform timing, and defines `PipelineEntry` plus `HostPlatformTiming` schemas.

**Rubric, 10 pts:** 3 pipeline ids/origins; 2 setup/update/reload freshness; 2 host-platform timing/schema; 1.5 precision/polyfill; 1.5 stale/reload/pipeline-freshness failure modes.

**Example A — code-only, 5/10:** “Use `ResetTimingBeforeReload`, `SetTiming` with pipeline id, and host platform timing APIs.” **Grade note:** API-level; misses why heuristics are unsafe.

**Example B — MCTS-aware, 9/10:** “Keep timing pipeline-scoped. MCTS rejects clear-time/pain-end inference; stale marks are filtered by pipeline identity and setup/update phase, with host platform lanes and typed PipelineEntry schema.”

**Evidence:** MCTS `services/timing.md`, `timing/lifetime-and-dispatch-boundaries.md`, `timing/pipeline-entry-contract.md`; code `timing_handler.h/.cc`, PerformanceController, `PipelineEntry.yml`, `HostPlatformTiming.yml`.

**Common misses:** clear all on reload; infer from paint end; lose host timing lanes.

---

## Case 16 — Clay service actor/owner/lifecycle model

**Question:** A Clay feature needs access to a platform/UI/raster/IO service and may cross thread boundaries. What should the design say about service ownership, lookup, and lifecycle?

**Canonical correct answer:** Clay services are owner-bound services accessed through Actor/Puppet wrappers and lifecycle-managed contexts, not raw globals usable from any thread. MCTS-Mem records `Service`/`ServiceManager` plus Puppet actor access, `owner_thread_override` for direct-stack versus task-runner execution, explicit null for missing services instead of null actors, and BaseView-owned Puppet service ownership. Code verifies platform/UI/raster/IO owners, per-owner contexts, task-runner selection, `GetService` returning an actor or null, `GetMultiThreadService` for flagged services, and `Attach`/`Detach` driving `OnInit`/`OnDestroy`. UI may be overridden to platform thread for Clay performance, but sync cross-owner calls are narrowly whitelisted to avoid cycles.

**Rubric, 10 pts:** 3 owner-bound service/Actor/Puppet; 2 lifecycle attach/detach; 2 null/multi-thread distinction; 1.5 owner-thread override/sync limits; 1.5 code+MCTS evidence.

**Example A — code-only, 5/10:** “Use `ServiceManager::GetService<T>()`; multi-thread services use `GetMultiThreadService<T>()`.” **Grade note:** code API only; misses ownership/lifecycle rationale.

**Example B — MCTS-aware, 9.5/10:** “Model as Clay service owned by platform/UI/raster/IO; access through actor/Puppet wrappers or direct pointer only for multi-thread services. MCTS records owner-thread overrides, null missing services, attach/detach lifecycle, and sync-call constraints.”

**Evidence:** MCTS `services/clay-service-actor-model.md`, `platform-bindings/clay-android-startup-and-registry-boundary.md`; code `clay/common/service/*`, Darwin service manager.

**Common misses:** raw cross-thread service pointers; ignores attach/detach; overuses sync calls.

---

## Case 17 — View-scoped CDP event routing

**Question:** A developer wants SDK-side consumers to listen to Lynx CDP events by subscribing at the global DebugRouter or raw message-channel layer. Based on the design tree and code, where should view-level CDP event fanout happen, and why?

**Canonical correct answer:** View-level SDK listeners should attach through the `LynxDevToolMediator` path, not by intercepting global DebugRouter traffic. MCTS-Mem records the inspector CDP layer as a multi-agent architecture with view-level CDP event routing, and specifically says SDK-side Android/iOS listeners route through `LynxDevToolMediator::SendCDPEvent` to both DebugRouter and weak, named listener callbacks. Code matches that: `SendCDPEventImpl` first sends `CDP` to the devtool message sender, then locks `cdp_event_listener_mutex_` and fans the same message to the named listener map. This preserves per-view scoping and avoids making listeners parse unrelated global traffic or reimplement CDP dispatch.

**Rubric, 10 pts:** 3 mediator fanout point; 2 view scoping/global interception wrong; 2 delivery to DebugRouter and SDK listeners; 2 MCTS evidence; 1 code class/function names.

**Example A — code-only, 5/10:** “Use `LynxDevToolMediator::AddCDPEventListener`; `SendCDPEventImpl` loops over listeners.” **Grade note:** correct hook; misses design rationale and view-level routing constraint.

**Example B — MCTS-aware, 10/10:** “Do it in the mediator. MCTS says view-level CDP events route through `SendCDPEvent` to DebugRouter and SDK listeners, preserving per-LynxView scope. Global DebugRouter interception flattens view identity.”

**Evidence:** MCTS `inspector/cdp-message-layer.md`, `devtool/cdp-wire.md`; code `lynx_devtool_mediator.h/.cc`, `devtool_message_dispatcher.cc`, `cdp_event_listener_sender_android.h`.

**Common misses:** global DebugRouter interception; forgetting SDK-side fanout; ignoring per-view scope.

---

## Case 18 — WhiteBoard DevTool JSON-string value contract

**Question:** For shared-data debugging, should DevTool expose WhiteBoard values as native typed CDP fields, arbitrary strings, or JSON-string payloads? Explain the expected protocol and implementation behavior.

**Canonical correct answer:** The WhiteBoard DevTool domain should use CDP methods `enable`, `disable`, `getSharedData`, `setSharedData`, `removeSharedData`, and `clear`, with mutation events for added, updated, removed, and cleared data. Values are carried as JSON strings, not untyped raw strings or native CDP typed fields. MCTS-Mem records that this was chosen so numbers, strings, objects, and JSON-string payloads remain distinguishable during display and editing. Code enforces the contract: `WhiteBoardInspectorDelegate` reads `params["value"].asString()`, `WhiteBoardInspectorImpl::SetSharedData` parses it as JSON and rejects invalid JSON, then converts to Lepus/pub values. `GetSharedData` serializes stored values back to strings and delegates emit mutation events.

**Rubric, 10 pts:** 3 JSON-string value contract; 2 methods/events; 2 type-distinguishability rationale; 2 parse/serialize behavior; 1 enable/delegate path.

**Example A — code-only, 6/10:** “`SetSharedData` parses value with RapidJSON and get returns strings.” **Grade note:** implementation detail; weak on protocol shape and rationale.

**Example B — MCTS-aware, 10/10:** “Use WhiteBoard CDP domain with JSON-string values. MCTS says this preserves numbers, strings, objects, and JSON-string payload distinctions. Code parses string JSON on set, serializes on get, and emits mutation events only when enabled.”

**Evidence:** MCTS `inspector/whiteboard-shared-data-domain.md`, `shared-data.md`; code `inspector_white_board_agent.cc`, `white_board_inspector_delegate.*`, `white_board_inspector_impl.cc`.

**Common misses:** ordinary strings; no mutation events; confuses with JS sessionStorage.

---

## Case 19 — Element inspection uses live attributes and thread-aware snapshots

**Question:** When implementing a DOM/CSS inspector feature, should Lynx keep a separate DevTools-only DOM tree synchronized with runtime state, or derive inspection data from live element inspector attributes and executor-thread boundaries?

**Canonical correct answer:** Lynx should not maintain a separate DevTools-only DOM tree as the primary model. MCTS-Mem records that DevTools 2.0 moved away from frequently syncing a Lynx DOM-corresponding tree because inspection should not interfere with patching or native UI tree generation. The live inspector model uses `ElementBase` representation, validated DOM mutation/editing, CDP query/layout snapshot protocol, CSS-pixel coordinate boundary, and new styling-pipeline edit writes. Code matches: `ElementInspector` initializes per-element inspector attributes, IDs, node names, style sheets, attrs/data/events, style roots, and CSS parse-token records; mediator dispatches DOM/CSS work to TASM and box/layout work to UI executors.

**Rubric, 10 pts:** 3 rejects separate synced tree; 2 non-interference and thread-boundary rationale; 2 live element attributes; 2 TASM/UI boundaries; 1 CSS-pixel/style edits.

**Example A — code-only, 6/10:** “Use `ElementInspector`; layout goes through mediator.” **Grade note:** correct code; no historical reason.

**Example B — MCTS-aware, 10/10:** “Do not rebuild a synced DevTools DOM. MCTS says inspection should avoid interfering with patch/native UI generation. Use live element inspector attributes with TASM for DOM/CSS and UI for box snapshots.”

**Evidence:** MCTS `devtool/inspector-tree.md`, `inspector/dom-element-inspection-model.md`, `inspector/engine-decoupling-boundary.md`; code `element_inspector.*`, `helper_util.h`, `lynx_devtool_mediator.cc`.

**Common misses:** propose mirrored tree; miss TASM/UI split; ignore style edits.

---

## Case 20 — Runtime communication uses explicit `ContextProxy`/`MessageEvent`

**Question:** A change proposes sending runtime-to-runtime and runtime-to-DevTool messages by reusing lifecycle/data-update calls and per-view runtime state, instead of `ContextProxy`/`MessageEvent` and `RuntimeManager` shared-context grouping. What should an MCTS-aware answer say?

**Canonical correct answer:** Reusing lifecycle/data-update calls should be rejected as the general communication mechanism. MCTS-Mem records runtime communication among Lepus, JS, and DevTool around `RuntimeProxy`/`ContextProxy` style channels with `dispatchEvent` and `postMessage` primitives, because lifecycle/data-update calls are not the general runtime messaging boundary. Code implements this as `ContextProxy` with origin/target context types, `MessageEvent` payloads, and JS/Lepus context proxy bindings. Separately, runtime creation preserves group identity, engine compatibility, preload/core loading, and memory-pressure tracking through `RuntimeManager`; shared context reuse can force engine compatibility. Messages stay on explicit event channels; shared runtime state stays in `RuntimeManager`.

**Rubric, 10 pts:** 3 rejects lifecycle/data-update reuse; 2 ContextProxy/MessageEvent; 2 RuntimeManager group/shared context; 2 engine/preload compatibility; 1 DevTool target.

**Example A — code-only, 6/10:** “Use `ContextProxy::PostMessage` and `MessageEvent`; `RuntimeManager` stores shared contexts.” **Grade note:** right mechanisms; misses rejected lifecycle/data-update pattern.

**Example B — MCTS-aware, 10/10:** “Do not reuse lifecycle/data-update calls. MCTS says runtime communication was standardized around ContextProxy/MessageEvent because lifecycle/data-update calls are not the explicit runtime messaging boundary. RuntimeManager owns group/shared context and engine compatibility.”

**Evidence:** MCTS `runtime.md`, `runtime/event-and-resource-bindings/context-proxy-message-event-channel.md`, its `.alt/`, `runtime/lifecycle-and-contexts/context-sharing-and-engine-selection.md`; code `context_proxy.h`, `message_event.h`, JS/Lepus bindings, `runtime_manager.h/.cc`.

**Common misses:** treats `postMessage` as JS convenience; mixes communication with shared-context ownership; ignores DevTool target.
