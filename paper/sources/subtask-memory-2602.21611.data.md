# DATA SHEET — Structurally Aligned Subtask-Level Memory for Software Engineering Agents

_Source PDF: `subtask-memory-2602.21611.pdf` · extracted from the PDF, not HTML. Verify each quote at its cited location._

**Authors/venue:** Kangning Shen, Jingyuan Zhang, Chenxi Sun, Wencong Zeng, Yang Yue. Affiliation: Kuaishou Technology, Beijing, China. Correspondence to: Yang Yue <yueyang07@kuaishou.com>. Venue: "Preprint. February 26, 2026." arXiv:2602.21611v1 [cs.SE] 25 Feb 2026.

**What it does:** The paper proposes "Structurally Aligned Subtask-Level Memory," a method that aligns memory storage, retrieval, and updating with the agent's functional decomposition rather than treating the entire problem-solving episode as the atomic unit. The reasoning process is modeled as a sequence of discrete subtasks defined by functional categories Z = {ANALYZE, REPRODUCE, EDIT, VERIFY}. Each memory entry is a triple m = (z, d, e): category z, a localized intent description d, and abstracted experience e. Retrieval is two-stage: a hard category filter (z as constraint) followed by semantic similarity matching on intent description d via a fixed embedding model; the retrieved experience is injected into the subtask's initial context (memory injection). Upon subtask completion, an LLM-based extractor distills the subtask trajectory into transferable experience and the memory state is updated online. The extractor uses the same LLM backbone as the task-solving agent. Subtasks are segmented via a transition-oriented strategy where the agent autonomously predicts the next category and description. Quote (Abstract): "we propose Structurally Aligned Subtask-Level Memory, a method that aligns memory storage, retrieval, and updating with the agent's functional decomposition."

## Load-bearing findings

**Q: What is the memory and its SOURCE (test-time trajectories? subtask-level decomposition?)**
- Answer: The memory is a repository of fine-grained subtask experiences. Its source is the agent's own test-time subtask trajectories, abstracted online: each memory entry is a triple (z, d, e) = category, localized intent description, abstracted experience. Experiences are extracted from completed subtask trajectory segments (subtask-level decomposition) during a test-time streaming protocol; the memory starts empty and accumulates on-the-fly.
- Quote: "our memory state acts as a repository of fine-grained subtask entries, where each entry is structured as a triple (z, d, e) comprising the category z, a localized intent description d, and the abstracted experience e. ... Upon subtask completion, the method abstracts transferable insights from the raw subtask trajectory and incrementally updates the memory state"
- Location: Section 1 (Introduction), page 2

**Q: What is the source / test-time protocol of the memory?**
- Answer: Memory storage S_sub is initialized empty and accumulates experience on-the-fly under a test-time streaming protocol over the 500 instances; three runs are performed with shuffled execution order.
- Quote: "All experiments follow a test-time streaming protocol: the memory storage S_sub is initialized as empty and accumulates experience on-the-fly. To mitigate ordering effects inherent to streaming, we perform three independent runs, using distinct random seeds to shuffle the execution sequence of the 500 instances"
- Location: Section 4.1, page 5

**Q: What benchmark(s) are used?**
- Answer: SWE-bench Verified, comprising 500 real-world GitHub issues. Metric is Pass@1; Best@3 and Avg. Pass@1 over three runs are reported.
- Quote: "We evaluate our method on SWE-bench Verified (Jimenez et al., 2024; OpenAI, 2024), a rigorous benchmark comprising 500 real-world GitHub issues. Performance is reported using Pass@1"
- Location: Section 4.1, page 5

**Q: What are the EXACT main result numbers?**
- Answer: Table 1 (Avg. Pass@1, Vanilla -> Subtask-level Mem Ours): Gemini 2.5 Flash 36.3 -> 41.9 (+5.6, +15.4%); Gemini 2.5 Pro 53.5 -> 60.3 (+6.8, +12.7%); Claude 3.7 Sonnet 52.2 -> 56.1 (+3.9, +7.5%); Claude 4.0 Sonnet 63.5 -> 65.8 (+2.3, +3.6%). Average +4.7 pp. Best@3 for Ours: Flash 43.2, Pro 61.2, Claude 3.7 57.2, Claude 4.0 66.8.
- Quote: "improving mean Pass@1 over the vanilla agent by +4.7 pp on average (e.g., +6.8 pp on Gemini 2.5 Pro)"
- Location: Abstract and Table 1, page 5

**Q: What are the baselines compared?**
- Answer: Two primary baselines: (i) Vanilla Agent — standard Mini SWE Agent without memory; (ii) Instance-level Memory — a faithful reproduction of Reasoning-Bank (Ouyang et al., 2025), which stores/retrieves instance-level reasoning summaries based on global semantic similarity. Ablation baselines also include Structured-prompting-only, No Category Filter / global retrieval, and Raw Trajectory.
- Quote: "We compare our approach against two primary baselines: (i) Vanilla Agent: the standard Mini SWE Agent without memory; (ii) Instance-level Memory: a faithful reproduction of Reasoning-Bank (Ouyang et al., 2025), which stores and retrieves instance-level reasoning summaries based on global semantic similarity, and updates the memory after each instance."
- Location: Section 4.1 (Baselines, Models, and Protocol), page 5

**Q: What is the agent scaffold?**
- Answer: The Mini SWE Agent scaffold using the official system prompts. Greedy decoding (temp = 0). All methods implemented on this same scaffold.
- Quote: "all methods are implemented on the Mini SWE Agent scaffold (Yang et al., 2024a; SWE-bench Team, 2025) utilizing the official system prompts. We employ greedy decoding (temp = 0) for the agent policy"
- Location: Section 4.1 (Benchmark, Metrics, and Agent Scaffold), page 5

**Q: Is code public? What URL?**
- Answer: No code/data URL is provided. The paper states the workflow will be released upon acceptance. No repository URL is given.
- Quote: "We will release the proposed workflow and experimental results upon acceptance."
- Location: Section 2 (end of first column) / Abstract area, page 2

**Q: What backbone models are evaluated?**
- Answer: Four backbones: Gemini 2.5 Flash, Gemini 2.5 Pro, Claude 3.7 Sonnet, Claude 4.0 Sonnet.
- Quote: "we evaluate four backbone LLMs: Gemini 2.5 Flash, Gemini 2.5 Pro (Comanici et al., 2025), Claude 3.7 Sonnet (Anthropic, 2025a), and Claude 4.0 Sonnet (Anthropic, 2025b)."
- Location: Section 4.1, page 5

**Q: What are the ablation results?**
- Answer: Table 2 (Structured prompting only): Vanilla 52.2, Structured prompting only 53.2 (+1.0), Ours Full 56.1 (+3.9). Table 3 (Category isolation): Vanilla 52.2, No Category Filter 53.8 (+1.6), Ours Category Isolated 56.1 (+3.9). Table 4 (Abstraction): Vanilla 52.2, Raw Trajectory 53.4 (+1.2), Ours Abstract Insight 56.1 (+3.9). All ablations on Claude 3.7 Sonnet.
- Quote: "All experiments are conducted using Claude 3.7 Sonnet on the full task stream of SWE-bench Verified."
- Location: Section 4.3 (Tables 2, 3, 4), page 6

**Q: What is the Pass@1 improvement by task complexity?**
- Answer: Figure 4: Easy (<=18 steps) +1.8%, Medium (19-28 steps) +1.2%, Hard (>28 steps) +8.7% (Hard increases from 35.5% to 44.2%). Instance-level memory shows negative gains: Easy -4.2%, Medium -0.7%, Hard -1.2%. Split sizes: Easy n=166, Medium n=162, Hard n=172.
- Quote: "the method delivers a substantial boost on Hard instances, increasing the success rate by +8.7% (from 35.5% to 44.2%)."
- Location: Section 4.4 (Figure 4), page 7

## Key numbers

- **Avg. Pass@1, Gemini 2.5 Flash: Vanilla -> Subtask-level (Ours)**: 36.3 ± 0.76 -> 41.9 ± 1.17 (Abs +5.6, Rel +15.4%); Best@3 43.2  _(Table 1, page 5)_
- **Avg. Pass@1, Gemini 2.5 Pro: Vanilla -> Subtask-level (Ours)**: 53.5 ± 1.21 -> 60.3 ± 1.29 (Abs +6.8, Rel +12.7%); Best@3 61.2  _(Table 1, page 5)_
- **Avg. Pass@1, Claude 3.7 Sonnet: Vanilla -> Subtask-level (Ours)**: 52.2 ± 0.72 -> 56.1 ± 1.33 (Abs +3.9, Rel +7.5%); Best@3 57.2  _(Table 1, page 5)_
- **Avg. Pass@1, Claude 4.0 Sonnet: Vanilla -> Subtask-level (Ours)**: 63.5 ± 0.81 -> 65.8 ± 0.92 (Abs +2.3, Rel +3.6%); Best@3 66.8  _(Table 1, page 5)_
- **Instance-level Mem Avg. Pass@1 (Best@3)**: Gemini 2.5 Flash 37.8 (39.8); Gemini 2.5 Pro 55.1 (56.0); Claude 3.7 Sonnet 51.1 (53.6); Claude 4.0 Sonnet 63.3 (63.8)  _(Table 1, page 5)_
- **Average Pass@1 improvement over Vanilla across all backbones**: +4.7 pp on average  _(Abstract / Section 4.2, page 5)_
- **Ablation: Structured prompting only vs Full method (Claude 3.7)**: Vanilla 52.2; Structured prompting only 53.2 (+1.0); Ours Full 56.1 (+3.9)  _(Table 2, page 6)_
- **Ablation: Category isolation (Claude 3.7)**: Vanilla 52.2; No Category Filter 53.8 (+1.6); Ours Category Isolated 56.1 (+3.9)  _(Table 3, page 6)_
- **Ablation: Abstraction vs Raw Trajectory (Claude 3.7)**: Vanilla 52.2; Raw Trajectory 53.4 (+1.2); Ours Abstract Insight 56.1 (+3.9)  _(Table 4, page 6)_
- **Pass@1 improvement on Hard tasks (>28 steps)**: +8.7% (35.5% -> 44.2%)  _(Figure 4, page 7)_
- **Pass@1 improvement Easy / Medium tasks**: Easy +1.8%, Medium +1.2% (Instance-level: Easy -4.2%, Medium -0.7%, Hard -1.2%)  _(Figure 4, page 7)_
- **Memory utilization: unique memory entries retrieved across 500 test instances**: 797 unique memory entries; head (top 100) accounts for 33.8% of retrievals; 50.7% of memories are single-use; over 400 single-use memories  _(Section 4.4 / Figure 5, page 7)_
- **Functional specialization of retrieved memories**: ANALYZE: Diagnostics 62.0%; EDIT: Implementation 62.0%; VERIFY: Strategy 64.0%  _(Figure 6 / Section 4.4, page 8)_
- **Temporal dynamics (Δ Resolved vs baseline by 100-instance bins)**: Bin 1-100: -1; 101-200: -1; 201-300: +3; 301-400: +9; 401-500: +10  _(Figure 3, page 7)_

## Evaluation setup
Benchmark: SWE-bench Verified (500 real-world GitHub issues). Metric: Pass@1 (single attempt); reported as Avg. Pass@1 (mean ± std over three independent runs) and Best@3 (best of three runs, reported as an upper bound). N = 500 instances. Agent scaffold: Mini SWE Agent with official system prompts; greedy decoding (temp = 0); identical non-memory configurations (execution environment, step limits) across all experiments; per-instance step limit encompasses both agent reasoning and memory extraction overhead (budget-neutral). Backbones: Gemini 2.5 Flash, Gemini 2.5 Pro, Claude 3.7 Sonnet, Claude 4.0 Sonnet. Baselines: (i) Vanilla Agent (Mini SWE Agent, no memory); (ii) Instance-level Memory (faithful reproduction of Reasoning-Bank, Ouyang et al. 2025). Protocol: test-time streaming, memory initialized empty and accumulated on-the-fly, three runs with shuffled instance order using distinct random seeds. Ablations conducted on Claude 3.7 Sonnet over the full task stream: Structured-prompting-only (Table 2), No-Category-Filter/global retrieval (Table 3), Raw-Trajectory vs Abstract Insight (Table 4). Complexity tiers by baseline trajectory step count: Easy (<=18 steps, n=166), Medium (19-28 steps, n=162), Hard (>28 steps, n=172). The extractor uses the same LLM backbone as the solving agent (no stronger teacher model). Embedding: a fixed embedding model E(.) for semantic matching (model not named).

## Stated limitations
The paper does not contain an explicit Limitations section. The closest stated caveats: (1) Cold-start / sparse-memory phase causes an initial slight performance dip — "In the initial buckets (Instances 1-200), the memory state is sparse; the agent exhibits a slight performance dip (-1) due to the overhead of retrieval without sufficient relevant matches" (Section 4.4, Figure 3, page 7). (2) Best@3 is explicitly framed as an upper bound: "we additionally report Best@3 (the best run among the three) as an upper bound" (Section 4.1, page 5). (3) On Easy tasks the improvement is marginal (+1.8%) because the baseline already possesses sufficient internal knowledge (Section 4.4, page 7). No other limitations or threats to validity are stated.

## NOT stated in paper
The paper does NOT state: the name/identity of the fixed embedding model E(.) used for semantic matching; the exact step limit value per instance; token or compute/cost numbers; wall-clock runtime; statistical significance tests / p-values for the improvements; the exact prompts used for the extractor or segmentation; the number of subtasks per instance on average; results on benchmarks other than SWE-bench Verified (no SWE-bench Lite, Full, Multimodal, or multilingual results despite citing them); any human evaluation; comparison against MCTS-based or search-based methods (Antoniades et al. SWE-Search is cited only in related work, not compared). It does NOT provide a public code repository URL — only "We will release the proposed workflow ... upon acceptance." It does NOT claim transfer/generalization across repositories or to held-out tasks beyond the streaming setup.

## Code/data
No code or data repository URL is provided. The paper states only: "We will release the proposed workflow and experimental results upon acceptance." (page 2). The benchmark used, SWE-bench Verified, is an external resource (Jimenez et al., 2024; OpenAI, 2024 — https://openai.com/index/introducing-swe-bench-verified/). No authors' own repo/dataset URL exists in the paper.
