# Cases 41–50 — Events, Lists, Renderer, Layout, CSS, Relax

## Case 41 — Event dispatch must survive listener and target mutation

**Question:** Why should Lynx keep `EventTarget`/`EventDispatcher` with weak event paths and listener snapshots instead of direct raw-pointer dispatch?

**Canonical correct answer:** Lynx centralizes dispatch through `EventTarget` and `EventDispatcher` because listeners can synchronously mutate listener maps or the element tree while dispatch is in progress. The dispatcher initializes an event path, keeps weak targets, handles conflict/detail normalization, triggers global events, and runs capture, target, and bubble phases with cancellation checks. MCTS-Mem records raw dispatch-path pointers, split handler maps, and cached raw response chains as rejected because they were unsafe under tree mutation and backend divergence. Correct implementations preserve listener-map snapshot behavior, weak target lifetime, phase ordering, cancellation, and global-event routing rather than optimizing to raw element callbacks.

**Rubric, 10 pts:** 3 listener/target mutation; 2 weak path/lifetime; 2 capture/target/bubble/cancel; 2 rejected raw/split/cached alternatives; 1 evidence.

**Example A — code-only, 4/10:** “`EventDispatcher::Dispatch` calls capture, target, and bubble handlers.” **Grade note:** surface mechanics only; misses mutation safety and rejected paths.

**Example B — MCTS-aware, 10/10:** “MCTS says raw paths/cached chains lost because listeners can mutate targets or retain events. Code uses weak paths, listener snapshots, normalized payloads, global events, and capture/target/bubble cancellation.”

**Evidence:** MCTS `event/core-event-model.md`, related `.alt/*`, `renderer/input-events/event-dispatch-and-gesture-routing.md`; code `event_dispatcher.cc`, `event_target.h`, `event_listener_map.cc`, `touch_event_handler.cc`.

**Common misses:** dispatcher as callback loop; ignores listener add/remove and tree mutation; raw `Element*` dispatch.

---

## Case 42 — Non-UI touch targets and platform target-tree hit testing

**Question:** Why must Lynx touch dispatch support non-view targets and platform target-tree hit testing instead of requiring every target to be a native UI view?

**Canonical correct answer:** Lynx cannot restrict event targets to concrete platform views because inline text spans and fragment/platform-rendered objects must participate in touch, hit testing, bubbling, exposure, and dataset delivery. MCTS-Mem records concrete `LynxUI`/view-only targets as rejected because inline text spans and other non-UI objects must be valid touch targets. Android verifies this with `EventTargetSpan implements EventTarget`, using a weak parent to avoid leaks through text caches. Fragment rendering verifies a separate `PlatformEventTarget` tree with geometry, parent/children, pointer-events retry, scroll offsets, exposure metadata, and hit-test traversal. Correct answers preserve target-tree abstraction, not platform view lookup only.

**Rubric, 10 pts:** 3 non-view/inline targets; 2 platform target-tree hit testing; 2 weak parent/lifetime; 2 rejected UI-only alternative; 1 evidence.

**Example A — code-only, 3/10:** “Android finds the active UI and dispatches touch.” **Grade note:** too UI-centric; misses inline spans and target tree.

**Example B — MCTS-aware, 10/10:** “MCTS says concrete UI targets lost because inline spans need event participation. Android `EventTargetSpan` and fragment `PlatformEventTarget` preserve non-view hit testing, pointer-events, exposure metadata, and weak lifetime.”

**Evidence:** MCTS `event/touch-dispatch.md`, `touch-dispatch.alt/concrete-lynxui-*`, `event/platform-event-target-tree.md`; code `EventTargetSpan.java`, `TouchEventDispatcher.java`, `platform_event_target.*`.

**Common misses:** every target is View/UIView; forgets inline spans; misses pointer-events retry and leak prevention.

---

## Case 43 — Event payload compatibility and input anti-echo

**Question:** What payload compatibility rules must Lynx preserve for touch, custom, and input events, especially around `setValue` anti-echo?

**Canonical correct answer:** Lynx event payloads preserve legacy and Web/mini-program compatibility rather than using one universal wrapper. Touch events emit layout-unit-normalized `x/y`, `pageX/pageY`, `clientX/clientY`, `identifier`, `touches`, and `changedTouches`, including multi-touch compatibility behavior. Custom events preserve event-specific parameter names and legacy frontend/detail behavior; MCTS-Mem rejects always wrapping under `params`. Input events must emit stable `value`, `selectionStart`, `selectionEnd`, and `isComposing` fields, but must not echo programmatic `setValue` as user input. Benchmarks should golden-test touch/custom JSON and explicitly test Android/iOS programmatic value updates, composition, paste, and selection paths.

**Rubric, 10 pts:** 2 touch coordinate/unit normalization; 2 custom event legacy/detail; 2 input fields/composition/selection; 2 `setValue` anti-echo; 1 rejected universal wrapper/single-offset; 1 evidence.

**Example A — code-only, 4/10:** “`TouchEvent` writes `touches`; `CustomEvent` writes detail.” **Grade note:** misses compatibility, input anti-echo, and rejected payload alternatives.

**Example B — MCTS-aware, 10/10:** “Payloads are compatibility contracts. MCTS rejects single-offset touch payloads and always-`params` custom events; input must keep selection/composition fields and suppress programmatic `setValue` echo.”

**Evidence:** MCTS `event/payload-compatibility-contract.md` and `.alt/*`; code `touch_event.cc`, `custom_event.cc`, Android/iOS input implementations.

**Common misses:** wrap all custom events under `params`; platform pixels; echo programmatic setValue; omit composition/selection.

---

## Case 44 — Gesture arena, NewGesture lifecycle, event-through, and consume-slide

**Question:** Why should Lynx route gestures through an arena/native-interception policy, and what lifecycle cases must be benchmarked?

**Canonical correct answer:** Lynx uses gesture arenas and native-interception policy because nested scroll, overlapping recognizers, event-through, consume-slide directions, and platform gestures cannot be handled by a single touch callback. MCTS-Mem rejects single event-handler gesture dispatch because recognizers and scrollable members need arbitration before winner dispatch and safe member lifetime during sweeps. Code verifies candidate chains, current/simultaneous winners, recompetition, fling handoff, and detector registration. Benchmarking must include a NewGesture lifecycle case: disabled NewGesture resources must not be created/released off the UI thread when page config is consumed asynchronously. It should also cover event-through returns, consume-slide angles/directions, member removal, and disabled-resource teardown.

**Rubric, 10 pts:** 3 arena arbitration/winners; 2 event-through/consume-slide; 2 NewGesture disabled-resource lifecycle; 2 rejected single-handler dispatch; 1 evidence.

**Example A — code-only, 4/10:** “`GestureHandlerTrigger` dispatches motion events and supports fling.” **Grade note:** code only; misses arena rationale and lifecycle pitfalls.

**Example B — MCTS-aware, 10/10:** “MCTS says single-handler dispatch lost because recognizers/scrollables need arbitration and safe lifetime. Code tracks winners/chains/fling; benchmarks must include event-through, consume-slide, member removal, and disabled NewGesture UI-thread lifecycle.”

**Evidence:** MCTS `event/native-input-and-gesture-policy.md` and `.alt/*`; code `GestureHandlerTrigger.java`, `TouchEventDispatcher.java`, `GestureArenaManager.java`, `LynxTouchHandler.mm`.

**Common misses:** touchmove only; ignores event-through/consume-slide; no NewGesture disabled-resource teardown.

---

## Case 45 — Decoupled list core and operation-id guarded async batch rendering

**Question:** How does Lynx’s decoupled list core make async/batch item rendering safe against stale completions?

**Canonical correct answer:** The decoupled list core moves list lifecycle into C++ container, adapter, holder, layout, event, children, and animation managers behind delegates shared by renderer and Relax. Each `ItemHolder` stores item key, dirty/removed/diff status, operation id, delegate binding, sticky/full-span/layout metadata, and animation state. Batch rendering is safe because `BatchListAdapter` generates an operation id, maps it to item key, marks the item in binding, calls `ComponentAtIndex`/`ComponentAtIndexes`, and validates on completion that operation id and holder status still match. Stale, removed, dirty, or unknown completions are enqueued/recycled rather than attached to the wrong item.

**Rubric, 10 pts:** 3 holder/delegate decoupled core; 3 operation-id validation; 2 stale completion enqueue/recycle; 1 renderer/Relax sharing; 1 evidence.

**Example A — code-only, 4/10:** “`BatchListAdapter` calls `ComponentAtIndex` and later attaches items.” **Grade note:** misses operation-id stale-completion guard and decoupled core reason.

**Example B — MCTS-aware, 10/10:** “MCTS says list core is decoupled into holders/delegates. Code maps operation id to item key, validates completion against current holder status, and enqueues stale components rather than attaching them to wrong items.”

**Evidence:** MCTS `list/decoupled-core-backend.md`, `list/batch-render-adapter.md`, `list/diff-update-model.md`, `list/shell-proxy-rendering-api.md`; code `decoupled_item_holder.h`, `decoupled_batch_list_adapter.cc`, `decoupled_list_container_impl.h`, `list_element.cc`.

**Common misses:** platform RecyclerView problem only; stale async completions; missing operation-id-to-key mapping.

---

## Case 46 — List identity, reuse lifecycle, and data-version compatibility

**Question:** Why is stable `item-key` mandatory for Lynx list reuse, and how do lifecycle/data-version compatibility rules affect list descendants?

**Canonical correct answer:** Lynx list reuse is type/item-key based rather than position-only. MCTS-Mem records repeated pitfalls where duplicate or unchanged `item-key` values caused crashes, mis-anchoring, invisible images, or old reused items remaining visible. Code verifies item key as holder state and adapter map identity for status, binding, holder lookup, and delegate attachment. MCTS-Mem also records ReactLynx list descendants bypassing ordinary data-version conflict gating, while old-architecture reuse does not rerun constructors or `componentDidMount`; update lifecycles or exposure events should be used for visibility/state logic. Correct answers flag globally unique stable item keys, old-architecture lifecycle limitations, and list-specific data-version/readiness handling.

**Rubric, 10 pts:** 3 stable unique item-key; 2 old-architecture non-remount lifecycle; 2 list data-version compatibility; 2 duplicate-key/readiness pitfalls; 1 evidence.

**Example A — code-only, 4/10:** “`ItemHolder` has `item_key`; maps are keyed by it.” **Grade note:** misses compatibility, lifecycle, and known failure modes.

**Example B — MCTS-aware, 10/10:** “`item-key` is reuse identity. MCTS records duplicate keys and old-architecture reuse causing state/lifecycle bugs. Descendants have special data-version/readiness handling, and reused components may not remount.”

**Evidence:** MCTS `list/item-reuse-lifecycle.md`, `list/data-version-compatibility-policy.md`, `renderer/component-architectures/list-rendering.md`; code `decoupled_item_holder.h`, `decoupled_list_adapter.cc`, `radon_component.cc`.

**Common misses:** array index identity; expects remount; ignores duplicate-key crashes/mis-anchors.

---

## Case 47 — Renderer lifecycle: dynamic placeholders, page update options, and queued painting

**Question:** Why should renderer lifecycle use explicit placeholders/options/queued operations instead of fully-loaded-only dynamic components, boolean page-update flags, or direct platform delegate calls?

**Canonical correct answer:** Renderer lifecycle is explicitly stateful across dynamic templates, page updates, and platform painting. MCTS-Mem rejects dynamic components that require fully loaded templates because unloaded lazy components need placeholders with identity while request/cache/preload/loading states resolve. It rejects growing boolean update flags in favor of option objects and pipeline context carrying reload/reset/native-order/timing state. It also rejects direct platform delegate painting because re-entrant flush and raw ownership hazards require queued, id-addressed UI operations. Code verifies `RadonLazyComponent` empty state, `LazyBundleLoader`, `UpdatePageOption`/`PipelineOptions`, and `PaintingContext::Enqueue`. Correct answers preserve lifecycle staging and identity instead of collapsing these into synchronous calls.

**Rubric, 10 pts:** 2 lazy placeholder/load states; 2 update options/pipeline context; 2 queued painting boundary; 2 rejected fully-loaded-only/boolean/direct-delegate alternatives; 2 lifecycle identity/evidence.

**Example A — code-only, 4/10:** “Renderer has lazy components, update options, and painting context.” **Grade note:** API names only; misses replacement history.

**Example B — MCTS-aware, 10/10:** “MCTS says lazy components must exist before loading, page updates need option/pipeline state, and painting must be queued to avoid reentrant delegate flush. Code verifies placeholders, options, and `PaintingContext::Enqueue`.”

**Evidence:** MCTS `renderer/page-assembly/dynamic-template-entries.md`, `pipeline-context-and-page-lifecycle.md`, `platform-ui-bridge/layout-painting-operation-boundary.md`, related `.alt/*`; code `radon_lazy_component.cc`, `lazy_bundle_loader.cc`, `pipeline_option.h`, `pipeline_context.h`, `painting_context.cc`.

**Common misses:** fully loaded lazy components only; new boolean flags; direct platform painting delegates.

---

## Case 48 — Owned Starlight, not Yoga as semantic substrate

**Question:** A contributor proposes reintroducing Yoga or exposing Yoga-compatible nodes/styles for a new layout feature because Yoga flex behavior is familiar. What should the design-aware answer say?

**Canonical correct answer:** Reject Yoga as the default substrate. MCTS-Mem records Lynx’s current layout design as an owned Starlight backend with a renderer-independent scheduling/API boundary. Yoga is preserved only in `.alt`, rejected because owning the engine lets Lynx encode CSS-native style and measurement contracts directly and removes Yoga as a public semantic option. Code verifies the Starlight path through `LayoutObject`, Starlight algorithms, typed layout style, `NLength`, and standalone Starlight public APIs. Yoga may be historical comparison or compatibility input, but should not be reopened without evidence that the recorded reason has lapsed.

**Rubric, 5 pts:** 1 owned Starlight current design; 1 Yoga `.alt` rejection reason; 1 standalone/API boundary; 1 code anchors; 1 reopening condition.

**Example A — code-only, 2/5:** “The code uses Starlight, not Yoga.” **Grade note:** current-code observation only; misses semantic re-decision.

**Example B — MCTS-aware, 5/5:** “Keep Starlight. MCTS records Yoga as a rejected alternative because owning layout lets Lynx encode CSS-native style/measurement semantics and removes Yoga from public semantics. Reopen only if that constraint no longer holds.”

**Evidence:** MCTS `layout-starlight.md`, `layout-starlight.alt/third-party-yoga-*`, `layout-starlight.alt/layout-as-an-internal-*`; code `layout_object.cc`, `nlength.h`, Starlight standalone headers.

**Common misses:** Yoga absent in code only; treats Yoga swap as implementation detail; ignores API boundary.

---

## Case 49 — CSS property IDs, typed values, and ordered declaration model

**Question:** For a new CSS feature, can Lynx add a string-keyed property name and parse `lepus::Value` strings at each use site?

**Canonical correct answer:** No. The CSS value model makes property IDs and typed values part of the runtime/wire contract. MCTS-Mem records current design as `CSSValue` storage, typed parser pipeline, generated `CSSPropertyID` registry/metadata contract, ordered `StyleMap` declarations, and stable CSS-variable annotations. Rejected alternatives include string-keyed property names, Lepus string values parsed at each use site, unordered maps that lose cascade order, implicit variable codecs, and hand-maintained runtime/TypeScript tables. Code verifies `CSSValuePattern` units/types, variable references/defaults, generated property macros, and `StyleMap` keyed by `CSSPropertyID` with ordered `LinearFlatMap`. New features should follow generated/typed and cascade-order-preserving paths.

**Rubric, 5 pts:** 1 rejects string/use-site parsing; 1 property ID/generated registry; 1 typed value pipeline; 1 ordered declarations/cascade; 1 rejected alternatives.

**Example A — code-only, 3/5:** “Use `CSSValue` and `StyleMap`.” **Grade note:** correct but lacks ABI/generated/cascade rationale.

**Example B — MCTS-aware, 5/5:** “Add via generated property-ID and typed value pipeline. MCTS rejects string keys, Lepus string parsing, unordered maps, and hand tables because IDs are wire identities, units travel with values, and cascade order must survive decode.”

**Evidence:** MCTS `style-css/css-value-model.md` and `.alt/*`; code `css_value.h`, `css_property.h/.cc`, `css_property_generator.py`.

**Common misses:** property names as local strings; unordered containers; CSS variable fallback shape.

---

## Case 50 — Grammar-aware CSS parsing and compatibility strictness

**Question:** A new shorthand or Tailwind-emitted syntax fails. Is a per-property string split or regex fix sufficient?

**Canonical correct answer:** Usually no. MCTS-Mem records text-to-value parsing as centralized in `CSSStringParser` and scanner grammar consolidation with parser compatibility gates and strictness policy. Per-property string splitting was rejected because embedded quotes, brackets, functions, comma lists, and unordered shorthand tokens require grammar-aware parsing; fixed-position shorthand parsing was rejected because CSS shorthands are unordered and list-valued. Facts show real compatibility failures around escaped keyframe identifiers, bare `0` lengths, `calc()` minus spacing, CSS Color 4 rgba syntax, and unsupported properties that still fail encode. Code verifies recursive-descent parsing for background/border/transform/etc. and NG tokenizer escape/name/token handling. Prefer parser-level support or gated compatibility handling.

**Rubric, 5 pts:** 1 rejects ad hoc splitting/regex; 1 centralized parser/scanner; 1 at least two compatibility pitfalls; 1 code parser/tokenizer; 1 gates/strictness.

**Example A — code-only, 3/5:** “Add support in `CSSStringParser` instead of splitting strings.” **Grade note:** good direction; misses recorded pitfalls and gates.

**Example B — MCTS-aware, 5/5:** “Do not regex-split. MCTS rejects per-property splitting because CSS values contain functions, lists, quotes, brackets, and unordered shorthands. Recent facts cover escaped keyframes, bare zero, calc spacing, Color 4, and unsupported-property failures, so parser-level gated behavior is needed.”

**Evidence:** MCTS `style-css/text-to-value-parsing.md`, `.alt/per-property-string-splitting-*`; code `css_string_parser.h`, `css_tokenizer.h`, `unit_handler.cc`.

**Common misses:** strip unknown CSS; ignore Tailwind/RSpeedy syntax; parse shorthand by position.
