# DATA SHEET — ReasoningBank: Scaling Agent Self-Evolving with Reasoning Memory

_Source PDF: `reasoningbank-2509.25140.pdf` · extracted from the PDF, not HTML. Verify each quote at its cited location._

**Authors/venue:** Authors: Siru Ouyang1*, Jun Yan2†, I-Hung Hsu2, Yanfei Chen2, Ke Jiang2, Zifeng Wang2, Rujun Han2, Long T. Le2, Samira Daruki2, Xiangru Tang3, Vishy Tirumalashetty2, George Lee2, Mahsan Rofouei4, Hangfei Lin4, Jiawei Han1, Chen-Yu Lee2† and Tomas Pfister2. Affiliations: 1University of Illinois Urbana-Champaign, 2Google Cloud AI Research, 3Yale University, 4Google Cloud AI. "* This work was done while Siru interned at Google Cloud AI Research. † Corresponding authors." Venue: not stated in paper (arXiv preprint, arXiv:2509.25140v2 [cs.AI], Google logo on title page). Date: "arXiv:2509.25140v2 [cs.AI] 16 Mar 2026".

**What it does:** ReasoningBank is a memory framework for LLM agents that, per the abstract, "distills generalizable reasoning strategies from an agent's self-judged successful and failed experiences." Mechanism (Section 3.2, Fig. 2): a closed loop of (i) memory retrieval (embed task query with gemini-embedding-001, cosine similarity, top-k items, default k=1, inject into system instruction), (ii) memory extraction (an LLM-as-a-judge labels the trajectory Success/Failure without ground truth; an LLM pipeline extracts at most 3 memory items per trajectory, each with title/description/content), and (iii) memory consolidation (new items directly added without pruning). The paper also introduces memory-aware test-time scaling (MaTTS): parallel scaling (multiple trajectories per query + self-contrast) and sequential scaling (iterative self-refinement within one trajectory), with scaling factor k. Memory items "abstract away low-level execution details while preserving transferable reasoning patterns and strategies" (Section 3.2).

## Load-bearing findings

**Q: SWE-bench Verified resolve-rate per backbone: no-memory vs ReasoningBank (and other baselines)**
- Answer: Table 2. Gemini-2.5-flash: No Memory 34.2 (AS 30.3), Synapse 35.4 (AS 30.7), ReasoningBank 38.8 (AS 27.5). Gemini-2.5-pro: No Memory 54.0 (AS 21.1), Synapse 53.4 (AS 21.0), ReasoningBank 57.4 (AS 19.8). Metric column is 'Resolve Rate' with 'AS' (average steps). AWM is NOT included for SWE-bench.
- Quote: "Table 2 | Experiment results of ReasoningBank on SWE-Bench-Verified dataset for issue-resolving in a given repository. ... Gemini-2.5-flash | No Memory 34.2 30.3 | Synapse 35.4 30.7 | ReasoningBank 38.8 27.5 | Gemini-2.5-pro | No Memory 54.0 21.1 | Synapse 53.4 21.0 | ReasoningBank 57.4 19.8"
- Location: Table 2, page 7

**Q: WebArena resolve/success-rate numbers per backbone (no-memory vs ReasoningBank and baselines)**
- Answer: Table 1 (parallel scaling k=5, pass@1). Overall SR (684): Gemini-2.5-flash — No Memory 40.5, Synapse 42.1, AWM 44.1, ReasoningBank 48.8, +MaTTS 51.8. Gemini-2.5-pro — No Memory 46.7, Synapse 47.7, AWM 47.6, ReasoningBank 53.9, +MaTTS 56.3. Claude-3.7-sonnet — No Memory 41.7, Synapse 42.6, AWM 40.8, ReasoningBank 46.3, +MaTTS 48.8. (Per-subset SR/Step values also given for Shopping, Admin, Gitlab, Reddit, Multi.)
- Quote: "Table 1 | Experiment results of ReasoningBank and MaTTS (parallel scaling, k = 5, pass@1) on WebArena benchmark. Success rate (SR↑) and the number of steps (Step↓) ... Overall (684) ... Gemini-2.5-flash ... No Memory ... 40.5 9.7 ... ReasoningBank ... 48.8 8.3 ... +MaTTS ... 51.8 7.9"
- Location: Table 1, page 7

**Q: Mind2Web numbers per backbone**
- Answer: Table 3 (EA / AF1 / SSR / SR for Cross-Task, Cross-Website, Cross-Domain). Gemini-2.5-flash Cross-Task: No Memory EA 46.0/AF1 59.1/SSR 40.3/SR 3.3; ReasoningBank EA 52.1/AF1 60.4/SSR 44.9/SR 4.8. Gemini-2.5-pro Cross-Task: No Memory 49.3/60.2/44.4/3.5; ReasoningBank 53.6/62.7/45.6/5.1. Cross-Website and Cross-Domain values for No Memory, Synapse, AWM, ReasoningBank also tabulated (e.g., flash Cross-Domain ReasoningBank EA 40.6/AF1 41.3/SSR 36.6/SR 1.6).
- Quote: "Table 3 | Results on Mind2Web benchmark for cross-task, cross-website, and cross-domain generalization test. EA (↑) is short for element accuracy, AF1 (↑) is short for action F1, and SSR (↑) is short for step success rate. SR (↑) is the task-level success rate measuring if all steps are correct."
- Location: Table 3, page 8

**Q: Full list of baselines compared on SWE-bench Verified**
- Answer: On SWE-bench, baselines are (i) No memory and (ii) Synapse only. AWM is explicitly excluded.
- Quote: "Similar to previous experiments, we compare ReasoningBank against (i) No memory and (ii) Synapse."
- Location: Appendix B.2 Software Engineering, page 26

**Q: AWM-exclusion claim for SWE-bench (verbatim)**
- Answer: Stated. AWM is excluded because mini-SWE-Agent's action space is open-ended Bash, making routine/workflow extraction hard.
- Quote: "We exclude AWM here because the action space in mini-SWE-Agent is open-ended (arbitrary Bash commands), making it difficult to extract the common routines or fixed workflows that AWM requires for cross-task generalization."
- Location: Appendix B.2, footnote 8, page 26

**Q: Agent scaffold used for SWE-bench (mini-SWE-agent? bash-only ReAct?)**
- Answer: mini-SWE-Agent setting, which enforces a Bash-Only environment with no tools and no special scaffold structure, using a simple ReAct agent loop.
- Quote: "We implement ReasoningBank for SWE-Bench following the setting of mini-SWE-Agent (Yang et al., 2024), which enforces the Bash-Only environment with no tools and no special scaffold structure. It assumes a simple ReAct agent loop (Yao et al., 2023)."
- Location: Appendix B.2 Implementation, page 26

**Q: Is memory built from the agent's OWN past trajectories, labeled by LLM-as-judge with no ground truth?**
- Answer: Yes. Memory is distilled from the agent's own successful and failed trajectories; correctness signals come from an LLM-as-a-judge without any ground-truth reference.
- Quote: "we adopt an LLM-as-a-judge (Gu et al., 2024) to label outcomes as success or failure given the query and trajectory without any ground-truth reference. Based on these signals, we apply different extraction strategies: successful experiences contribute validated strategies, while failed ones supply counterfactual signals and pitfalls"
- Location: Section 3.2 (Integrating ReasoningBank with Agents), page 5; also abstract: 'self-judged successful and failed experiences'

**Q: Which models/backbones are used**
- Answer: Gemini-2.5-Flash, Gemini-2.5-Pro, and Claude-3.7-Sonnet (accessed via Vertex AI API). A smaller open-source model Gemma-3-12B-Instruct is used in an additional analysis (Appendix C.4 / Table 6).
- Quote: "We build our agents upon several state-of-the-art LLMs accessed via the Vertex AI API, including Gemini-2.5-Flash, Gemini-2.5-Pro (Comanici et al., 2025), and Claude-3.7-Sonnet (Anthropic, 2025). These choices allow us to investigate both cross-family (Gemini, Claude) and intra-family (Flash, Pro) variations."
- Location: Appendix B.1 Implementation Details, page 25

**Q: What is the LLM-as-a-judge baseline accuracy vs ground truth, and is ReasoningBank robust to it?**
- Answer: Judge baseline accuracy on WebArena-Shopping is 72.7%; ReasoningBank is reported robust to verification noise (SR stays within similar range 70%-90% simulated accuracy; Fig. 8).
- Quote: "We first establish the baseline accuracy by comparing the judge's predictions against ground-truth labels, which we find to be 72.7%. ... We observe that the judge's accuracy does not significantly impact the performance of ReasoningBank"
- Location: Section 4.4 / page 11, Figure 8

**Q: Does ReasoningBank learn from failure trajectories (vs success-only baselines)?**
- Answer: Yes. On WebArena-Shopping (Gemini-2.5-flash), ReasoningBank reaches 46.5 on success-only traces and improves to 49.7 when failures are included; Synapse 40.6->41.7, AWM 44.4->42.2 (Fig. 7).
- Quote: "the design of ReasoningBank enables distillation of reasoning patterns from both successes and failures, achieving 46.5 on success-only traces and further improving to 49.7 when failures are included. ... Synapse increases only from 40.6 (success only) to 41.7 (with failures), while AWM drops from 44.4 to 42.2."
- Location: Section 4.4 / page 11, Figure 7

**Q: Headline relative improvement and efficiency claims**
- Answer: Up to 20% relative improvement (effectiveness) and up to 16% fewer interaction steps (efficiency).
- Quote: "We demonstrate that ReasoningBank outperforms baselines in both effectiveness (up to 20% relative improvement, Table 1) and efficiency (up to 16% fewer interaction steps, Table 1)."
- Location: Section 1 Introduction, page 2

**Q: MaTTS scaling results on WebArena-Shopping (k=5)**
- Answer: At k=5, MaTTS achieves 55.1 in parallel scaling vs 52.4 vanilla TTS; 54.5 vs 51.9 sequential. Parallel grows 49.7 (k=1) to 55.1 (k=5); sequential 49.7 to 54.5.
- Quote: "at k = 5, MaTTS achieves 55.1 in parallel scaling compared with 52.4 for vanilla TTS, and 54.5 versus 51.9 in sequential scaling. ... parallel scaling grows from 49.7 (k = 1) to 55.1 (k = 5), while sequential scaling rises from 49.7 to 54.5."
- Location: Section 4.3 / page 8 and 9

**Q: Smaller open-source model (Gemma-3-12B-Instruct) results on WebArena-Shopping**
- Answer: Table 6: Success Rate — No memory 17.1, Synapse 16.0, AWM 21.4, ReasoningBank 24.1. Average Steps — 13.7 / 14.0 / 12.5 / 11.8.
- Quote: "Table 6 | Performance on WebArena-Shopping using Gemma-3-12B-Instruct. ... Success Rate (%) 17.1 16.0 21.4 24.1 | Average Steps 13.7 14.0 12.5 11.8"
- Location: Table 6, page 28

**Q: Step (efficiency) reduction magnitude**
- Answer: On WebArena, lowers average step count by up to 1.4 vs No Memory and 1.6 vs other baselines; on SWE-Bench-Verified saves 2.8 and 1.3 steps respectively.
- Quote: "On WebArena, across almost all subsets and backbones, ReasoningBank lowers the average step count by up to 1.4 compared with "No Memory", and 1.6 compared with other memory baselines. The average step on SWE-Bench-Verified is also smaller by saving 2.8 and 1.3 steps respectively."
- Location: Section 4.2, page 8

## Key numbers

- **SWE-bench Verified resolve rate, Gemini-2.5-flash, No Memory**: 34.2  _(Table 2, p.7)_
- **SWE-bench Verified resolve rate, Gemini-2.5-flash, Synapse**: 35.4  _(Table 2, p.7)_
- **SWE-bench Verified resolve rate, Gemini-2.5-flash, ReasoningBank**: 38.8  _(Table 2, p.7)_
- **SWE-bench Verified resolve rate, Gemini-2.5-pro, No Memory**: 54.0  _(Table 2, p.7)_
- **SWE-bench Verified resolve rate, Gemini-2.5-pro, Synapse**: 53.4  _(Table 2, p.7)_
- **SWE-bench Verified resolve rate, Gemini-2.5-pro, ReasoningBank**: 57.4  _(Table 2, p.7)_
- **WebArena Overall SR, Gemini-2.5-flash, No Memory**: 40.5  _(Table 1, p.7)_
- **WebArena Overall SR, Gemini-2.5-flash, Synapse**: 42.1  _(Table 1, p.7)_
- **WebArena Overall SR, Gemini-2.5-flash, AWM**: 44.1  _(Table 1, p.7)_
- **WebArena Overall SR, Gemini-2.5-flash, ReasoningBank**: 48.8  _(Table 1, p.7)_
- **WebArena Overall SR, Gemini-2.5-flash, ReasoningBank+MaTTS**: 51.8  _(Table 1, p.7)_
- **WebArena Overall SR, Gemini-2.5-pro, No Memory**: 46.7  _(Table 1, p.7)_
- **WebArena Overall SR, Gemini-2.5-pro, ReasoningBank**: 53.9  _(Table 1, p.7)_
- **WebArena Overall SR, Gemini-2.5-pro, ReasoningBank+MaTTS**: 56.3  _(Table 1, p.7)_
- **WebArena Overall SR, Claude-3.7-sonnet, No Memory**: 41.7  _(Table 1, p.7)_
- **WebArena Overall SR, Claude-3.7-sonnet, ReasoningBank**: 46.3  _(Table 1, p.7)_
- **WebArena Overall SR, Claude-3.7-sonnet, ReasoningBank+MaTTS**: 48.8  _(Table 1, p.7)_
- **WebArena SR improvement over memory-free (flash/pro/claude)**: +8.3 / +7.2 / +4.6  _(Section 4.2, p.7)_
- **Mind2Web Cross-Task SR, Gemini-2.5-flash, No Memory vs ReasoningBank**: 3.3 vs 4.8  _(Table 3, p.8)_
- **Mind2Web Cross-Task SR, Gemini-2.5-pro, No Memory vs ReasoningBank**: 3.5 vs 5.1  _(Table 3, p.8)_
- **Mind2Web Cross-Domain SR, Gemini-2.5-flash, No Memory vs ReasoningBank**: 1.0 vs 1.6  _(Table 3, p.8)_
- **LLM-as-a-judge accuracy vs ground truth (WebArena-Shopping)**: 72.7%  _(Section 4.4, p.11)_
- **MaTTS parallel scaling at k=5 vs vanilla TTS (WebArena-Shopping)**: 55.1 vs 52.4  _(Section 4.3, p.8-9)_
- **MaTTS sequential scaling at k=5 vs vanilla TTS**: 54.5 vs 51.9  _(Section 4.3, p.9)_
- **Failure-vs-success-only ablation, ReasoningBank (Shopping, flash)**: 46.5 (success only) -> 49.7 (with failures)  _(Fig. 7 / Section 4.4, pp.10-11)_
- **Gemma-3-12B-Instruct WebArena-Shopping SR (No mem/Synapse/AWM/ReasoningBank)**: 17.1 / 16.0 / 21.4 / 24.1  _(Table 6, p.28)_
- **Total token consumption increase vs No Memory (ReasoningBank)**: ~4.3% (53054.5 vs 50847.4 total tokens), performance boosted 20.5%  _(Table 5 / C.2, pp.26-27)_
- **Default retrieval top-k**: k = 1  _(Appendix A.2, p.22)_
- **Max memory items extracted per trajectory**: at most 3  _(Appendix A.2, p.22)_
- **WebArena max step limit per query**: 30  _(Appendix B.1, p.25)_
- **Decoding temperature for WebArena/Mind2Web generation**: 0.7  _(Appendix B.1, p.25)_

## Evaluation setup
Benchmarks: WebArena (Zhou et al., 2024) — 684 total test instances; subsets Shopping (187), Admin (182), Gitlab (180), Reddit (106), Multi (29); Map domain excluded "following Miyai et al. (2025) for a fair comparison" (footnote 3, p.6). Mind2Web (Deng et al., 2023) — 1341 total instances; settings Cross-Task (252), Cross-Website (177), Cross-Domain (912). SWE-Bench-Verified (Jimenez et al., 2024) — 500 manually verified repository-level issue-resolution instances. Baselines: (i) Vanilla / No Memory (backbone LLM, no memory module), (ii) Synapse (Zheng et al., 2024, trajectory-as-exemplar / in-context memory), (iii) AWM (Wang et al., 2025d, workflow/routine memory). On SWE-bench only No memory and Synapse (AWM excluded). Baselines use the same Memory Retrieval and Memory Consolidation; only Memory Extraction differs. Backbones: Gemini-2.5-Flash, Gemini-2.5-Pro, Claude-3.7-Sonnet (via Vertex AI API); plus Gemma-3-12B-Instruct in Appendix C.4. Scaffold: web browsing uses BrowserGym (de Chezelles et al., 2025) execution environment, ReAct style (Yao et al., 2023), max 30 steps/query, temperature 0.7; SWE uses mini-SWE-Agent (bash-only, no tools, no special scaffold), simple ReAct loop. Metrics: WebArena — success rate (SR, exact match to ground-truth goal) and average number of steps (AS); Mind2Web — element accuracy (EA), action F1 (AF1), step success rate (SSR), task-level success rate (SR); SWE-Bench-Verified — issue resolution rate (patch passes all test scripts), plus patch application rate and average steps; official SWE-bench evaluation scripts used. Memory extraction: LLM-as-a-judge (same backbone, temp 0.0) labels Success/Failure with no ground truth; extractor (same backbone, temp 1.0) produces at most 3 items {title, description, content}. Retrieval: gemini-embedding-001 embeddings, cosine distance, default top-k=1. MaTTS scaling factor k; parallel uses Best-of-N (BoN) computed by an LLM selecting the best of N trajectories (prompt in Fig. 12). Robustness study simulates LLM-judge accuracy from 100% down to 50% (Fig. 8). Inference cost breakdown in Table 5; pass@k analysis in Fig. 14.

## Stated limitations
Appendix E (Limitations, pp.29-30) states: (1) Focus on memory content — the study did not extensively compare with other memory architectures such as episodic or hierarchical memory ("These designs address orthogonal concerns (memory form/structure), while our contribution targets what should be stored and reused"). (2) Simplicity in memory retrieval and consolidation — intentionally adopt simple embedding-based retrieval and straightforward consolidation to isolate content-quality effects; more sophisticated strategies (adaptive retrieval, hierarchical consolidation) are compatible but not the focus. (3) Dependence on LLM-as-a-judge for correctness signals — "While this automatic labeling enables scalable evaluation without ground-truth feedback, it may introduce noise when tasks are ambiguous or when the judge model itself errs. While our results suggest the framework remains robust under such noise, future work could incorporate stronger verifiers, human-in-the-loop feedback, or ensemble judgment to enhance the reliability of memory induction." Conclusion (Section 6) also points to "additional future directions and limitations in Appendix D and E."

## NOT stated in paper
The paper does NOT report SWE-bench Verified numbers for AWM (AWM is excluded on SWE-bench). It does NOT report Claude-3.7-sonnet results on SWE-bench or on Mind2Web (Table 2 has only Gemini-2.5-flash and Gemini-2.5-pro; Table 3 has only the two Gemini models). It does NOT compare against non-memory SWE-bench agents/leaderboard systems beyond No memory and Synapse. It does NOT claim state-of-the-art on SWE-bench. The venue/conference is not stated (arXiv preprint only). No statistical significance tests, confidence intervals, or variance/standard deviations across runs are reported. The paper does not provide ground-truth-based verification at test time (by design, the streaming test-time setting has "no ground truth available during test-time"). MaTTS results are primarily demonstrated on the WebArena-Shopping subset with Gemini-2.5-flash, not exhaustively across all benchmarks/backbones.

## Code/data
Code: "Our code can be found at https://github.com/google-research/reasoning-bank" (abstract, p.1). Embeddings accessed via gemini-embedding-001 / https://ai.google.dev/gemini-api/docs/embeddings (footnote 5, p.22). Models via Vertex AI: https://cloud.google.com/vertex-ai (footnote 6, p.25). SWE-bench harness: https://www.swebench.com/SWE-bench/api/harness/ (footnote 7, p.26). Gemma model: https://huggingface.co/google/gemma-3-12b-it (footnote 9, p.27). Benchmarks are existing public datasets (WebArena, Mind2Web, SWE-Bench-Verified); no new dataset URL released by this paper.
