# Cases 21–30 — Animation and Krypton Canvas/WebGL/Media

## Case 21 — Centralized animation ticking and page FPS policy

**Question:** A developer proposes that each animation register its own VSync callback and locally skip frames for low-FPS mode. According to the MCTS-Mem tree and current code, what design should they preserve, and why did the rejected alternatives lose?

**Canonical correct answer:** Lynx centralizes animation ticking instead of letting each animation independently register VSync callbacks. `ElementManager` gathers animated elements, `ElementVsyncProxy` applies page `preferredFps` policy, and low mode skips work until roughly a 30fps interval has elapsed; high mode can request high-refresh VSync. `ThreadLocalAnimationHandler` also coalesces animation-frame callbacks behind a single next-frame request. MCTS-Mem records that per-animation VSync and ad-hoc ticking lost because shared page policy, animation timeout reporting, run-state timing, and many simultaneous animations need one scheduler. A delta/next-frame-ns throttling alternative also lost because interval tracking avoids precision, drift, and inconsistent frame pacing problems.

**Rubric, 10 pts:** 2 centralized ticking; 2 `preferredFps`/30fps throttling; 2 coalesced frame requests; 2 why per-animation/ad-hoc ticking lost; 1 high-refresh/UI VSync policy; 1 code+MCTS connection.

**Example A — code-only, 4/10:** “`ElementVsyncProxy` stores `preferred_fps_`, `last_tick_time_`, and low-frame duration; `TickAllElement` skips low-FPS frames.” **Grade note:** correct implementation details, but misses rejected per-animation design and historical rationale.

**Example B — MCTS-aware, 10/10:** “Preserve the centralized scheduler. MCTS says per-animation VSync was rejected because page policy, timeout reporting, shared timing state, and large animation counts require one coordinated scheduler; code implements this through `ElementManager`/`ElementVsyncProxy` and coalesced animation frame requests.”

**Evidence:** MCTS `mcts_mem/lynx/animation/gfx-timing-core.md`, `gfx-timing-core.alt/*`; code `element_manager.cc`, `element_vsync_proxy.*`, `thread_local_animation_handler.*`, `animation_timing.*`, `lynx_env.cc`, `lynx_shell_builder.cc`.

**Common misses:** treats low-FPS as local optimization; misses page-level policy; ignores coalescing; omits rejected per-animation VSync history.

---

## Case 22 — Stable keyframe animator identity and custom-property sampling

**Question:** When a style refresh contains the same named keyframe animation, should Lynx recreate all native animators, or preserve/update existing animation objects? Explain the current design, including custom-property keyframes.

**Canonical correct answer:** Lynx preserves named keyframe animation identity whenever possible. `CSSKeyframeManager` keys animations by `AnimationData.name`; on refresh it updates changed same-name animations, keeps unchanged ones, removes names no longer present, and rebuilds only when forced. This preserves timeline identity, pause/play state, sample history, and simultaneous-animation behavior. MCTS-Mem records that recreating all native animators on style refresh lost because it broke continuity and repeated old lifecycle bugs. In the new pipeline, animation samples carry property overrides, custom-property overrides, resets, and `requires_base_style_rebuild`. Custom-property keyframes are not paint-only overrides: they can affect variable-dependent parsing and computed style, so Fiber may rebuild final style.

**Rubric, 10 pts:** 2 same-name identity preserved; 2 update/keep/remove/recreate behavior; 2 timeline/play-state/sample continuity; 2 custom-property overrides and base-style rebuild; 1 rejected recreate-all alternative; 1 new-pipeline sample/style resolution link.

**Example A — code-only, 4/10:** “`CSSKeyframeManager` has `animations_map_` keyed by animation name and updates animation data; Fiber applies samples.” **Grade note:** correct code hooks, but misses why identity matters and custom-property rebuild implications.

**Example B — MCTS-aware, 10/10:** “Do not recreate by default. MCTS says recreate-all lost because it broke lifecycle/play-state continuity. Same-name animations keep identity and update data; samples include custom-property overrides and may require base-style rebuild when variables affect computed style.”

**Evidence:** MCTS `mcts_mem/lynx/animation/keyframe.md`, `keyframe.alt/recreate-all-*`, `renderer/element-model/style-resolution-and-animation-state.md`; code `css_keyframe_manager.*`, `animation.cc`, `animation_keyframe_curve.h`, `fiber_element.cc`, `style_resolver.*`, `LynxKeyframeAnimator.m`.

**Common misses:** recreate same-name animations by default; misses play-state continuity; treats custom-property animations as paint-only; ignores `requires_base_style_rebuild`.

---

## Case 23 — CSS transition eligibility, canonical values, and list semantics

**Question:** A code reviewer suggests simplifying transition triggering with shorthand bitmasks and raw declared values. What should the correct answer say about Lynx transition eligibility, canonical values, list cycling, and previous-end suppression?

**Canonical correct answer:** Lynx transition triggering is property-accurate and computed-value based, not a shorthand bitmask over raw declarations. `CSSTransitionManager` expands `all` and composite families such as border, margin, and padding into exact transition property types, checks validity, and compares displayed previous/start values with new underlying values. `TransitionData` preserves CSS list semantics by cycling shorter duration, delay, and timing-function lists with modulo indexing. The manager rejects invalid values, unchanged start/end pairs, and repeated previous end values, preventing redundant transitions. MCTS-Mem records that bitmask shorthand eligibility lost because variables, longhands, composites, canonical computed values, layout-only sources, and previous-end tracking require exact property-level eligibility.

**Rubric, 10 pts:** 2 rejects shorthand bitmask/raw declarations; 2 exact property identity and expansion; 2 canonical/displayed-vs-underlying comparison; 2 list cycling semantics; 1 previous-end suppression; 1 MCTS rejected alternative.

**Example A — code-only, 4/10:** “`CSSTransitionManager` checks validity and whether start/end values differ; `TransitionData` stores duration/delay/timing.” **Grade note:** some correct mechanics; misses canonical values, list cycling, previous-end suppression, and rejected bitmask rationale.

**Example B — MCTS-aware, 10/10:** “Use exact property-level eligibility. MCTS rejects bitmask shorthand dispatch because variables, longhands, composites, canonical computed values, and previous-end history matter. Code expands `all`/composites, compares displayed/canonical values, cycles transition lists, and suppresses repeated end values.”

**Evidence:** MCTS `mcts_mem/lynx/animation/transition.md`, `transition.alt/*`, `style-css/typed-style-data.md`; code `css_transition_manager.*`, `transition_data.h`, `computed_css_style.h`, `element.cc`, `LynxTransitionAnimationManager.m`.

**Common misses:** compares raw specified CSS; treats shorthands as identities; forgets modulo list cycling; misses previous-end suppression.

---

## Case 24 — Optional lazy Krypton adoption boundary

**Question:** Why should a Lynx embedder avoid initializing Krypton/Canvas globally at LynxView creation, and what design should it use instead?

**Canonical correct answer:** Krypton is designed as an optional subsystem with public embedder/service/module extension APIs and per-LynxView `KryptonApp` ownership. MCTS-Mem records that Krypton was split out to avoid mandatory dependencies, support lite/full integration tiers, and keep canvas/effect/audio adopters from depending on all Lynx or all effect/audio subspecs. Later facts warn that enabling canvas during LynxView creation can add about 16 ms when unused, and that first-use service bootstrap must run synchronously if already on the JS runtime thread. The correct design is per-view lazy bootstrap: create/adopt a `CanvasManager`/`KryptonApp` only when canvas services are needed, register services/modules through public APIs, and keep platform dependencies explicit.

**Rubric, 10 pts:** 3 optional/lazy subsystem; 2 per-view/KryptonApp scope; 2 public embedder/service/module APIs; 2 dependency/performance rationale; 1 avoids global singleton/unconditional startup.

**Example A — code-only, 4/10:** “Use `CanvasApp` and initialize only when creating a canvas.” **Grade note:** useful code shape, but misses dependency history, lazy-service scope, and 16 ms startup-cost evidence.

**Example B — MCTS-aware, 10/10:** “Krypton stays lazily adopted. MCTS says it was separated to avoid mandatory Aurum/effect/audio linkage and support lite/full tiers; `KryptonApp` is per-view, bootstrap can be synchronous on JS thread, and unused `enable_canvas` cost was measured around 16 ms.”

**Evidence:** MCTS `mcts_mem/lynx/krypton.md`, `krypton.alt/*`, `platform-bindings/xelement-media-canvas-backends.md`; code `krypton/core/context/canvas_app.*`, `krypton/platform/embedder/krypton_app.h`, `krypton_extension_manager.cc`, `CanvasRuntimeMediator.java`.

**Common misses:** treats Canvas as always-on core; process-global registry; ignores lite/full dependency tiers and startup cost.

---

## Case 25 — Canvas surface lifecycle and GPU-thread ownership

**Question:** A contributor proposes local dirty booleans on `CanvasElement` and direct surface-registry access from canvas code. Why is that wrong?

**Canonical correct answer:** Krypton puts presentation eligibility and surface/framebuffer ownership in Drawable, surface, and resource-provider layers, not in local `CanvasElement` dirty flags. `CanvasApp` owns a GPU task runner and a `SurfaceRegistry` actor on that runner, while JS-thread canvas logic communicates through actors and resource providers. MCTS-Mem records local dirty booleans as rejected because draw, clear, surface-create, and surface-change eligibility moved to Drawable; direct `SurfaceRegistry` access was rejected because lifecycle and threading belong in the actor. First-frame callbacks, readback, and resize/presentation ordering are mediated through `CanvasUIBridge` and `CanvasResourceProvider`, preserving sequencing and avoiding cross-thread state corruption.

**Rubric, 10 pts:** 2 rejects local dirty booleans; 2 Drawable/resource-provider/surface ownership; 2 GPU runner/SurfaceRegistry actor; 2 lifecycle/threading rationale; 2 first-frame/readback/resize ordering.

**Example A — code-only, 5/10:** “Use `CanvasApp::surface_registry_actor()` and `CanvasUIBridge` rather than direct registry access.” **Grade note:** good code pointers; under-explains rejected dirty flag/direct access designs.

**Example B — MCTS-aware, 10/10:** “MCTS says local dirty flags and direct `SurfaceRegistry` access were superseded. Presentation eligibility moved to Drawable/resource-provider logic and registry ownership moved behind a GPU-thread actor. UI first-frame/readback paths go through `CanvasUIBridge`.”

**Evidence:** MCTS `mcts_mem/lynx/krypton/canvas-surface-lifecycle.md` and `.alt/*`; code `canvas_app.cc`, `vsync_monitor.cc`, `surface_registry.cc`, `canvas_resource_provider.cc`, `canvas_ui_bridge.cc`.

**Common misses:** dirty flags as “simpler”; misses GPU actor; treats first-frame as JS-only; ignores readback/resize ordering.

---

## Case 26 — Selective generated WebGL command buffering

**Question:** Should Krypton buffer every void WebGL call and expose raw native object pointers to JS for speed? Explain the settled design.

**Canonical correct answer:** No. Krypton’s WebGL path uses generated command-buffer architecture with record-time payload serialization, async puppet/buffered objects, ABI guards, and WebGL2-aware facades. MCTS-Mem records that direct NAPI calls with native pointer fields were rejected because bufferable calls can be replayed asynchronously without exposing raw addresses or confusing typed-array element width with byte length. “All void calls are bufferable” was also rejected: buffering preserves semantics only for calls that do not require immediate GL state/readback or unsupported overload handling. WebGL2 required extra buffer targets, arbitrary framebuffer attachment enums, sequences, and VAO/query/sampler/sync/transform-feedback support, so generated/mixin implementation wins.

**Rubric, 10 pts:** 2 rejects raw native pointers; 2 rejects buffering all void calls; 2 generated command-buffer serialization; 2 async puppet/buffered objects; 2 WebGL2 targets/sequences/object family.

**Example A — code-only, 5/10:** “Use generated command-buffer files and object registries instead of exposing pointers.” **Grade note:** good code clue; misses semantic limit on buffering and alternatives.

**Example B — MCTS-aware, 10/10:** “MCTS rejects direct NAPI pointer fields and all-void-call buffering. Command buffers serialize only safe payloads, use puppet object registries, and support WebGL2 framebuffers, sequences, and object families without exposing native addresses.”

**Evidence:** MCTS `mcts_mem/lynx/krypton/webgl-command-buffer.md`, related `.alt/*`; code `napi_canvas_command_buffer.*`, `gl_command_buffer.h`, `puppet.h`, `runnable_buffer.cc`, `webgl2RenderingContext.ts`.

**Common misses:** pointer-valued JS handles; all void calls safe to batch; byte-length vs element-width bug; WebGL2 attachment/sequence reasons.

---

## Case 27 — Explicit WebGL texture format and state policy

**Question:** Why can’t Krypton normalize all image/video/ImageData texture uploads to RGBA/UNSIGNED_BYTE and rely on the GLES driver for validity?

**Canonical correct answer:** Krypton’s texture policy deliberately carries WebGL-visible `internalFormat`, `format`, `type`, source kind, alpha representation, and extension gates through upload/readback. MCTS-Mem records forced RGBA uploads as rejected because `ImageElement` texture uploads must honor requested WebGL format/type; raw ImageData byte-vector upload lost because dimensions/format metadata matter; driver-only validation lost because Krypton must enforce WebGL-visible completeness and object-status rules independently of GLES shortcuts. Current code validates format/type, applies color-renderability and depth constraints, handles premultiplied/unpremultiplied alpha explicitly, protects pixel-store state, and uses intrinsic video dimensions from `GetVideoWidth`/`GetVideoHeight` rather than CSS size.

**Rubric, 10 pts:** 2 rejects RGBA normalization; 2 explicit internalFormat/format/type; 2 extension-gated WebGL validation; 2 alpha/pixel-store handling; 2 intrinsic video dimensions.

**Example A — code-only, 5/10:** “`ValidateTexImage2DFormatAndType` checks formats, and video uploads use `GetVideoWidth/Height`.” **Grade note:** good code; misses rejected alternatives and alpha/extension policy.

**Example B — MCTS-aware, 10/10:** “MCTS rejects forced RGBA upload, raw ImageData byte vectors, and driver-only validation. WebGL callers observe requested format/type, extension gates, alpha state, pixel-store state, and intrinsic video frame size, so Krypton validates explicitly.”

**Evidence:** MCTS `mcts_mem/lynx/krypton/webgl-texture-format-policy.md`, `.alt/*`, `webgl-state-and-resources.md`; code `webgl_rendering_context_base_tex_image_2d.cc`, `webgl_texture.h`, `webgl2_rendering_context.cc`, `scoped_gl_reset_restore.cc`, `video_element.cc`.

**Common misses:** GLES driver validation as enough; CSS size for video; ignores premultiplied alpha; missing extension gates.

---

## Case 28 — Host-injected media texture pipeline

**Question:** How should Krypton integrate video/camera frames into canvas/WebGL without blocking on CPU readback or sharing mutable video contexts across threads?

**Canonical correct answer:** The settled design unifies camera and video under an ExternalTexture/texture-source style pipeline with host-injected video/camera implementations and GPU-thread actors. MCTS-Mem records that RGBA camera/player sampling was replaced by NV12/YUV formats to avoid full-frame conversion, beauty-camera `glReadPixels` was replaced by IOSurface-backed sharing to eliminate stalls, and directly shared video/camera contexts were replaced by serialization through a GPU-task-runner actor. `VideoElement` state follows native player notifications rather than optimistic play/pause assumptions. Current code exposes `VideoContext::GetNewTextureSource`, weak-guarded state callbacks, async disposal, platform camera/video services, and VECamera stream bridges for effects, stickers, and touch messages.

**Rubric, 10 pts:** 2 ExternalTexture/texture-source; 2 host-injected camera/video; 2 avoids RGBA conversion/glReadPixels stalls; 2 GPU-thread actor serialization; 2 native-notification-driven video state.

**Example A — code-only, 5/10:** “Use `VideoContext::GetNewTextureSource()` and platform camera services; don’t call `glReadPixels` for each frame.” **Grade note:** useful implementation; misses actor/threading and historical alternatives.

**Example B — MCTS-aware, 10/10:** “MCTS says RGBA sampling and beauty-camera `glReadPixels` were replaced by NV12/IOSurface-style sharing, and direct shared contexts by GPU-task-runner actors. Use host-injected video/camera services and native-notification-driven state.”

**Evidence:** MCTS `mcts_mem/lynx/krypton/media-pipeline.md`, `.alt/*`, `platform-bindings/xelement-media-canvas-backends.md`; code `video_context.h`, `video_element.cc`, `texture_source.h`, `gpu_external_texture.h`, camera/video services, embedder contexts.

**Common misses:** per-frame readback; mutable cross-thread video context; optimistic JS state; ignores host service injection.

---

## Case 29 — Krypton resource-loading boundary and URL redirection

**Question:** Why should Canvas image/audio loading go through Krypton’s resource-loader boundary instead of directly using image-specific loaders or raw file paths?

**Canonical correct answer:** Krypton’s resource-loading design is an embedder/package boundary with explicit URL, data-URI, bitmap/raw-data, stream, encoding, and redirection contracts. MCTS-Mem records that iOS canvas image loading moved from `LynxImageLoader` to generic `LynxResourceFetcher`, with old image loading retained only as fallback for hosts lacking the newer protocol. Harmony needed data-URI bitmap/raw-data decoding before generic loaders supported it, so data-URI recognition became part of the loader surface. Audio file writer paths are redirected through the canvas resource loader before `file://` validation so platform-specific resource paths can be accepted. Direct raw paths or image-only loaders would bypass host compatibility and package-resolution rules.

**Rubric, 10 pts:** 2 generic embedder resource boundary; 2 `LynxResourceFetcher` migration/fallback; 2 data-URI support; 2 audio path redirection before file validation; 2 avoids raw path/image-only loading.

**Example A — code-only, 5/10:** “Use `ResourceLoader::LoadData`, `LoadBitmap`, `DecodeDataURLSync`, and `RedirectUrl`.” **Grade note:** good APIs; misses migration history and raw-path danger.

**Example B — MCTS-aware, 10/10:** “MCTS says canvas resource loading moved from image-specific loader to generic host fetcher with fallback; Harmony data-URI and Aurum file-output redirection made loader-surface behavior part of the contract. Direct file/image paths bypass host/package resolution.”

**Evidence:** MCTS `mcts_mem/lynx/krypton/resource-loading.md`, `.alt/*`, `resource/image.md`; code `resource_loader.h`, `resource_loader_embedder.cc`, `krypton_loader_service.h`, Android/Darwin loader services, `audio_stream_file_writer_node.cc`.

**Common misses:** opens file paths directly; image-only resource view; forgets data URI/audio redirection.

---

## Case 30 — Audio graph lifecycle and weak ownership

**Question:** Why did Krypton’s audio graph move away from raw backend pointers and immediate node release during API calls?

**Canonical correct answer:** The current audio design emphasizes backend lifecycle safety, weak/shared ownership, selectable audio modules/backends, generated WebAudio bindings, and cleanup at audio-context boundaries. MCTS-Mem records raw backend pointers as use-after-free risks because audio callbacks can outlive engine teardown; callbacks now dereference a shared context with a release flag. Immediate node release during API calls was replaced because it could cause OOM or release nodes while the graph was being processed. Other alternatives show the graph moving beyond polling BitMap adjacency, single sample listener slots, and external buffer pointers. Newer facts note the old module’s reckless lifecycle caused memory errors/OOMs, while remote decode callbacks must weak-lock the environment before sending results.

**Rubric, 10 pts:** 2 rejects raw backend pointers; 2 callbacks outlive teardown/weak guards; 2 rejects immediate node release; 2 context-boundary cleanup/graph safety; 2 selectable backend/remote binding lifecycle.

**Example A — code-only, 4/10:** “Use `weak_from_this` in callbacks and don’t delete nodes directly from setters.” **Grade note:** directionally right; lacks MCTS history and graph cleanup model.

**Example B — MCTS-aware, 10/10:** “MCTS records raw backend pointer UAF and immediate node-release OOM/safety failures. Current graph uses weak/shared lifecycle guards, context-level cleanup batching, generated bindings, selectable backend/module surfaces, and remote decode weak-locking.”

**Evidence:** MCTS `mcts_mem/lynx/krypton/audio-node-graph.md`, `.alt/*`; code `audio_context.*`, `audio_context_manager.cc`, `audio_backend.h`, `audio_node.cc`, `remote_audio_command_buffer.cc`, `napi_decode_audio_data_callback.cc`.

**Common misses:** callback bounded by JS object lifetime; raw backend handles; inline node deletion; remote env teardown hazards.
