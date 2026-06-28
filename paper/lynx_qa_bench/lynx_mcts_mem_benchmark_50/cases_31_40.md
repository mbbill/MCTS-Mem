# Cases 31–40 — Krypton Backend and Clay/RenderKit

## Case 31 — Dynamic audio decode and adaptive resampling

**Question:** How should Krypton handle audio codec loading and playback-rate resampling across platforms and unsupported sample rates?

**Canonical correct answer:** The audio decode pipeline is not a fixed static codec path. MCTS-Mem records dynamic `loadHostMediaCodec` behavior: one process-wide attempt guarded by a lock/state flag, failure if any symbol lookup fails, and no partial initialization. Older alternatives such as direct static NDK MediaCodec linkage, bundled mpg123, namespace-scope decoder registries, and monolithic audio modules were replaced by the maintained decoder path. Resampling has measured pitfalls: default `playbackRate=1.0` must not activate the playback-rate resampler because copying can consume excessive memory; unsupported default sampler configurations fall back permanently to adaptive sampling; once adaptive sampling exists it remains to avoid frequent sampler switching. Harmony `decodeAudioData` must wait for callback-driven PCM output, including buffer-fed MP4 audio.

**Rubric, 10 pts:** 2 dynamic codec loading/fail-whole shim; 2 rejects static/monolithic legacy decode; 2 default playbackRate avoids copies; 2 adaptive sampler fallback/stable reuse; 2 Harmony/buffer-fed decode wait.

**Example A — code-only, 4/10:** “Use `AutoSelectSampler()` and `AdaptiveSampler` if default config fails.” **Grade note:** sampler code only; misses codec loading and historical alternatives.

**Example B — MCTS-aware, 10/10:** “MCTS says `loadHostMediaCodec` initializes once and fails the whole shim on any symbol failure, replacing static NDK/mpg123/monolithic paths. Default rate 1.0 avoids copying resamplers; unsupported configs switch to adaptive sampling; Harmony decode waits for PCM callbacks.”

**Evidence:** MCTS `krypton/audio-decode-pipeline.md` and `.alt/*`; code `media_codec_pfunc.cc`, Harmony decoder files, `buffer_loader.cc`, `audio_buffer_source_node.cc`, `adaptive_sampler.h`.

**Common misses:** static-link codecs; partial symbol success; resampling for default rate; repeated sampler switching.

---

## Case 32 — Backend abstraction, Skity, RenderKit, and WebGPU gates

**Question:** For PC/Harmony/Skity/WebGPU canvas, why should Krypton use backend-neutral resource providers and feature-gated backend paths rather than replaying RenderKit draw calls or always exporting `gpu` globals?

**Canonical correct answer:** Krypton separates surface/raster/resource-provider contracts from specific platforms. MCTS-Mem records that RenderKit PC rejected intercepting Krypton JSBridge draw calls and replaying them on RenderKit’s raster thread because it was invasive, hard to extend to WebGL, and incompatible with non-GL pipelines like Metal. Instead, Krypton exposes reusable embedder APIs, uses ANGLE/shared surfaces where appropriate, and chooses providers through settings, feature flags, and canvas options. Skity has its own GPU-thread virtual GL context, app-level lazy font collection, and guarded TextLayout fallback. WebGPU is not the generic 3D provider: it uses Dawn client/server actors, WebGPU-specific resource providers, and exports `gpu` only behind Dawn/WebGPU build gates.

**Rubric, 10 pts:** 2 rejects RenderKit JSBridge replay; 2 backend-neutral provider abstraction; 2 settings/runtime backend selection; 2 Skity-specific context/font/TextLayout; 2 WebGPU Dawn gate/provider.

**Example A — code-only, 5/10:** “`CanvasElement::GetContext` chooses 2D/WebGL/WebGPU providers; Skity and WebGPU are gated.” **Grade note:** code pointers; misses RenderKit replay history and why gates exist.

**Example B — MCTS-aware, 10/10:** “MCTS rejects RenderKit-raster replay of Krypton draw calls as invasive and non-GL-hostile. Keep backend-neutral providers; select by flags/options; Skity owns GPU-thread context/font/TextLayout guards; WebGPU uses Dawn actors and is exported only when enabled.”

**Evidence:** MCTS `krypton/backend-abstraction.md`, `.alt/*`, `krypton/skity-canvas2d.md`, `krypton/native-renderer.md`, `gfx/renderkit/resources-media-gpu.md`; code `canvas_element.cc`, provider/raster/surface headers, Skity backend files, WebGPU/Dawn files, API export.

**Common misses:** RenderKit replay as simple optimization; hardcoded backend; non-GL compatibility; unconditional WebGPU export.

---

## Case 33 — Clay graphics backend abstraction

**Question:** Why should a Clay rendering change avoid adding scattered `ENABLE_SKITY`/Skia call-site forks, and what history should the answer mention?

**Canonical correct answer:** Clay’s graphics design keeps backend choice behind a rendering-backend facade: rendering code consumes `Gr*` aliases/macros, backend-neutral `Picture`, paint/image/text primitives, and typed effects rather than branching at every call site. MCTS-Mem records this replacing direct SkPicture usage, Flutter DisplayList-only plumbing, call-site Skia/Skity selection, and Skia-only effect encodings because Skity needed native picture recording and could not replay opaque Skia wrappers. The reason is not just cleanliness: it reduces package-size and Skia-dependency pressure, lowers Skity adaptation cost, and preserves a single higher-level rendering contract.

**Rubric, 10 pts:** 4 backend-neutral facade/aliases/Picture; 2 rejected SkPicture or DisplayList bridge; 2 rejected call-site dual backend or Skia-only wrapper; 1 Skity/package-size rationale; 1 code evidence.

**Example A — code-only, 4/10:** “Use `rendering_backend.h`; it aliases Skia/Skity types to `GrCanvas`, `GrPaint`, etc.” **Grade note:** current code only; misses why facade exists and alternatives.

**Example B — MCTS-aware, 10/10:** “Do not add feature-level `ENABLE_SKITY` branches. MCTS says direct SkPicture, Flutter DisplayList bridging, and call-site Skia/Skity selection were rejected because Skity needs native recorded pictures and Skia wrappers/package costs must not leak.”

**Evidence:** MCTS `clay/graphics_backend.md` and `.alt/*`; code `clay/gfx/rendering_backend.h`, `gfx_rendering_backend.h`, `picture.h`, `picture_layer.h`.

**Common misses:** `ENABLE_SKITY` forks as intended style; misses DisplayList bridge; ignores package-size/Skity rationale.

---

## Case 34 — RenderKit retained rendering pipeline

**Question:** When changing RenderKit/Clay painting, why is the retained `RenderObject`/`RenderBox` plus `FrameBuilder`/`LayerTree` pipeline important?

**Canonical correct answer:** RenderKit’s current rendering model is retained: component mutations mirror into a `RenderObject`/`RenderBox` tree, `FrameBuilder` builds a composited `LayerTree`, and invalidation distinguishes content, effect, and offset changes so unchanged subtrees and raster-side animations can survive across frames. MCTS-Mem records this as replacing direct SkPicture recording and delete/rebuild composited subtrees. The rejected shape could paint a frame but did not preserve enough lifecycle, reuse, or backend layer-tree bridging. A change that treats painting as a stateless canvas pass or rebuilds all composited state on every update misses the design.

**Rubric, 10 pts:** 3 retained tree/layer tree; 2 invalidation/subtree reuse; 2 direct SkPicture/rebuild-all alternatives; 2 raster-side animation/lifecycle/backend bridge; 1 code evidence.

**Example A — code-only, 5/10:** “`RenderObject` has children; `FrameBuilder` creates `LayerTree`; use `MarkNeedsPaint`.” **Grade note:** names code; misses decision history and why retention matters.

**Example B — MCTS-aware, 10/10:** “MCTS says RenderKit rejected direct SkPicture recording and rebuild-all compositing because retained layers preserve unchanged subtrees, effect/offset changes, and raster-thread animations without rerecording content.”

**Evidence:** MCTS `gfx/renderkit/retained-rendering-frame-pipeline.md` and `.alt/*`; code `render_object.h`, `render_box.h`, `frame_builder.h`, `layer_tree.h`, `animation_host.h`.

**Common misses:** RenderKit equals draw-to-SkCanvas; rebuild-all as simpler; misses raster-side animation reuse.

---

## Case 35 — SharedImage and external surface ownership

**Question:** For platform views, video, Lottie/AnimaX, or canvas surfaces in Clay, why are they external surface boundaries rather than ordinary Clay view drawing?

**Canonical correct answer:** SharedImage/external surface handling is a cross-API ownership and synchronization contract, not a normal Clay paint path. PlatformView, video, Lottie/AnimaX, canvas, and decode handoffs cross buffer queues, fences, ANGLE/EGL/Vulkan/Metal/D3D/IOSurface representations, and host lifetimes. The current design embeds shared images as external textures and uses `SharedImageSink`/`SharedImageSinkAccessor` with configurable buffering, replacing Mailbox/FramePromise sync and dedicated SharedImageLayer paths. This mattered because some embedders do not support external textures, sync rendering needed multi-buffer behavior, and APIs like Vulkan/OpenGL need explicit fence/layout handoff.

**Rubric, 10 pts:** 3 external ownership/sync boundary; 2 SharedImageSink/accessor buffering; 2 rejected Mailbox/FramePromise or dedicated layer; 2 fences/API representations/fallbacks; 1 code evidence.

**Example A — code-only, 5/10:** “Use `SharedImageExternalTexture` and `SharedImageSink` with buffer modes.” **Grade note:** API recognition; misses why not ordinary drawing and rejected designs.

**Example B — MCTS-aware, 10/10:** “MCTS says PlatformView/video/canvas/Lottie cannot collapse into normal Clay paint. SharedImage moved to external texture lifecycle, replacing Mailbox/FramePromise with sink/accessor buffering and explicit fence/representation handling.”

**Evidence:** MCTS `clay/shared_external_surfaces.md`, `.alt/*`, `platform-bindings/native-view-surface-and-composition-boundaries.md`; code shared image sink/accessor/representation, external texture, `render_external_content.h`, `native_view.cc`.

**Common misses:** paints platform video/canvas in `BaseView::Paint`; omits buffer/fence ownership; reintroduces Mailbox/FramePromise.

---

## Case 36 — Clay frame scheduling and image upload readiness

**Question:** Why should priority image decode/upload and forced drawing go through Clay’s scheduler/state machine instead of immediately uploading or drawing?

**Canonical correct answer:** Clay’s current frame scheduling is a UI/raster state machine with begin-frame, commit, activation, draw, frame-deadline, force-draw, lifecycle, and image-upload actions. MCTS-Mem records that decode completion is not enough for frame readiness: priority-decoded images register page-scoped upload tasks, and `RasterFrameService` processes at most one upload task when the scheduler allows it. Immediate original-size upload/cache behavior was replaced because raster/GPU-thread uploads caused fast-scroll jank and invisible list items did not need immediate work. Force-draw moved inside the state machine: it activates layer tree/recorder, then asks the scheduler to rasterize rather than bypassing scheduling.

**Rubric, 10 pts:** 3 scheduler/state-machine actions; 2 decode vs upload readiness; 2 rejected immediate/original-size upload or force-draw bypass; 2 fast-scroll/invisible item rationale; 1 code evidence.

**Example A — code-only, 5/10:** “`RegisterUploadTask` adds tasks and `RasterFrameService` processes one.” **Grade note:** mechanics; misses scheduling rationale and rejected approach.

**Example B — MCTS-aware, 10/10:** “Do not upload on decode callback. MCTS says decode completion stopped being readiness because upload caused GPU-thread jank; page-scoped upload tasks run through scheduler `UPLOAD_IMAGE`, and force-draw also stays inside frame scheduling.”

**Evidence:** MCTS `clay/frame_scheduling.md`, `clay/image_decode_upload_cache.md`, related `.alt/*`; code scheduler state machine, `raster_frame_service.cc`, `image_upload_manager.*`, `page_view.cc`.

**Common misses:** decode completion as readiness; immediate upload; missing page-scoped cleanup; force-draw bypass.

---

## Case 37 — Pixel domains and transform-aware hit testing

**Question:** Why is a Clay coordinate or hit-test change wrong if it just applies platform pixel-ratio branches or integer rounding locally?

**Canonical correct answer:** Clay explicitly separates logical, physical, framework, platform, and Clay pixel domains, with typed conversion helpers and physical-pixel rounding only at defined boundaries. MCTS-Mem records this replacing per-property desktop pixel-ratio scaling, platform-specific branches, and integer `Rect`/`Size` geometry that lost subpixel precision. Hit testing is not a flat bounds check: it traverses sorted children, respects independent subtrees/overlays, subtracts sticky offsets after normal position, rejects invisible or non-invertible transforms, and applies reverse transforms to convert displayed coordinates into view-local coordinates. Correct changes preserve float geometry and centralized conversion rather than ad-hoc DPR math.

**Rubric, 10 pts:** 3 pixel domains/conversion helpers; 2 rejected per-property/platform-specific scaling or integer geometry; 2 sticky/overlay/transform-aware hit testing; 2 subpixel/cache/event-target consequences; 1 code evidence.

**Example A — code-only, 5/10:** “Use `PixelHelper::Convert`; don’t multiply DPR directly. `HitTest` calls `GetPointBySelf`.” **Grade note:** good mechanics; weak on history/failure modes.

**Example B — MCTS-aware, 10/10:** “MCTS says platform ratio branches and integer geometry were rejected because subpixel layout/clipping broke. Use centralized pixel-domain conversions and transform-aware hit testing, including sticky offsets and non-invertible transform rejection.”

**Evidence:** MCTS `clay/coordinates_and_hit_testing.md` and `.alt/*`; code `pixel_helper.h`, `base_view.cc`, `view_context.cc`, `sticky_info.h`.

**Common misses:** inline DPR multiplication; integer geometry everywhere; ignores sticky/overlays/non-invertible transforms.

---

## Case 38 — Runtime Clay/RenderKit backend boundary

**Question:** Why should platform integration code not assume RenderKit/Clay is a build-wide static backend?

**Canonical correct answer:** Platform bindings record RenderKit/Clay as an optional backend selected through construction/runtime entry points, embedder providers/facades, and platform shell implementations—not as a global compile flag. MCTS-Mem records build-wide RenderKit selection and static Android linking as rejected because apps needed optional Clay AAR loading, APK-size reduction, and per-`LynxView` enablement. Earlier `LayoutContext`/`PaintingContext` creation inside TemplateAssembler was moved behind platform abstractions to unify native rendering and other backends. A correct integration distinguishes compile-time availability from runtime selection, keeps platform implementations under shell/platform or public interfaces, and avoids leaking concrete RenderKit classes.

**Rubric, 10 pts:** 3 runtime/per-view optional backend selection; 2 rejected build-wide/static linking; 2 optional AAR/APK-size rationale; 2 UIDelegate/layout/painting/embedder boundary; 1 code evidence.

**Example A — code-only, 4/10:** “Set Clay builder switch; use `IUIRendererCreator`; GN has `enable_clay`.” **Grade note:** conflates compile-time inclusion with runtime selection.

**Example B — MCTS-aware, 10/10:** “Do not treat `enable_clay` as RenderKit everywhere. MCTS says build-wide/static linking was replaced by per-view runtime enablement and optional Clay AAR loading, with layout/painting creation hidden behind UIDelegate/embedder surfaces.”

**Evidence:** MCTS `platform-bindings/embedder/render-backend-surface-contract.md` and `.alt/*`; code `LynxUIRendererBuilder.java`, `IUIRendererCreator.java`, `LynxUIRendererClayCreator.java`, `ui_delegate.h`, `ui_delegate_clay.*`.

**Common misses:** GN flags as runtime decision; leaking backend classes; ignores optional AAR/dynamic loading.

---

## Case 39 — Clay component vocabulary and type registration

**Question:** When adding a Clay component or UI method validation, why should implementation avoid a central enum/switchboard?

**Canonical correct answer:** Clay owns its CSS/property/type vocabulary and component extension points. MCTS-Mem records oscillations: runtime string-keyed CSS lookup briefly moved to generated keyword-id dispatch then reverted; color lookup did adopt gperf perfect hashing; view type checks moved from a central list/bitset to each derived view contributing a `StaticType` token and parent chain; element creation moved from a monolithic factory switchboard to tag registrations. The lesson is not “generate everything” or “centralize everything.” A new component should register by tag, use Clay’s active property vocabulary path, and rely on type-token inheritance for `Is<T>()` and UI method validation.

**Rubric, 10 pts:** 3 tag registration and per-class type-token model; 2 generated keyword dispatch tried/reverted; 2 color lookup vs property dispatch distinction; 2 central enum/switchboard wrong; 1 code evidence.

**Example A — code-only, 5/10:** “Use `ViewRegistry::RegisterView` and `StaticType()` for type checks.” **Grade note:** good mechanics; misses history and generated-dispatch trap.

**Example B — MCTS-aware, 10/10:** “Register by tag and use `StaticType` chain; MCTS says central view-type enum and factory switchboard were rejected, generated property keyword dispatch was tried and reverted, while gperf color lookup stayed.”

**Evidence:** MCTS `clay/component_extensibility_and_vocabulary.md` and `.alt/*`; code `view_registry.*`, `type_info.h`, `lynx_ui_method_registrar.h`, `keywords.cc`, `css_property.h`.

**Common misses:** central view-type enum; assumes generated keyword dispatch is current because gperf exists; misses color/property divergence.

---

## Case 40 — Clay text and markdown backend contract

**Question:** Why should a Clay text or markdown change avoid coupling the text module to Skia DisplayList paint wrappers or SkTextBlob-only assumptions?

**Canonical correct answer:** Clay text is a backend-selectable paragraph and geometry contract across Skia, TTText/TextLayout, Skity-native paint, glyph geometry, placeholders, and Unicode mapping. MCTS-Mem records old Skia/Minikin-only paragraph construction, per-engine SkTextBlob rendering, and DisplayList paint wrapper APIs being replaced: builds can select TTText/TextLayout, Skia and Skity text rendering share interfaces, and txt callers pass backend paints rather than DisplayList wrappers. This mattered for Skity decoupling, package size, glyph-position correctness, hit testing, truncation, and emoji/UTF-16-to-code-point mapping. Correct changes preserve paragraph APIs for coordinates/range rects/truncation and avoid Skia-specific text state.

**Rubric, 10 pts:** 3 backend-selectable paragraph/text contract; 2 rejected Skia/Minikin, SkTextBlob, or DisplayList-wrapper alternatives; 2 geometry/truncation/hit-test/glyph consequences; 2 TTText/TextLayout or Skity/package motivation; 1 code evidence.

**Example A — code-only, 5/10:** “Use `txt::Paragraph` and TTText paragraph files; don’t assume only Skia.” **Grade note:** correct but shallow; misses DisplayList/SkTextBlob rejected paths.

**Example B — MCTS-aware, 10/10:** “MCTS says text moved beyond Skia/Minikin and DisplayList paint wrappers to backend-selectable paragraph APIs. Preserve geometry APIs because truncation, glyph-coordinate lookup, emoji mapping, and TTText offsets have caused regressions.”

**Evidence:** MCTS `clay/text_and_markdown_layout.md` and `.alt/*`, `platform-bindings/platform-renderer-display-list-contract.md`; code txt paragraph/font collection files and `render_text.h`.

**Common misses:** SkTextBlob-only painting; DisplayList wrappers in txt; ignoring paragraph geometry APIs.
