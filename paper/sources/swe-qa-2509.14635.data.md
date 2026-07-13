# DATA SHEET — SWE-QA: Can Language Models Answer Repository-level Code Questions?

_Source PDF: `swe-qa-2509.14635.pdf` · extracted from the PDF, not HTML. Verify each quote at its cited location._

**Authors/venue:** Weihan Peng†, Yuling Shi†, Yuhang Wang, Xinyun Zhang, Beijun Shen, Xiaodong Gu (Corresponding author); Shanghai Jiao Tong University. †Equal contribution. arXiv:2509.14635v2 [cs.CL] 26 Apr 2026. Venue: not stated in paper (arXiv preprint).

**What it does:** SWE-QA is a repository-level code question answering (QA) benchmark of 720 human-verified question-answer pairs spanning 15 Python repositories (12 from SWE-Bench and 3 from SWE-Bench-Live), 48 QA pairs per repository. Construction has four stages (Figure 2): (1) Seed Collection and Taxonomy Construction — crawled 77,100 GitHub issues from 12 SWE-bench repositories, filtered to issues with body length >=1,000 characters (41,955 issues), used an LLM to extract questions (yielding 127,415 distinct questions, avg 3.04 per issue), manually analyzed 1,000 sampled questions via open coding to build a two-level taxonomy (Level-1: What/Why/Where/How; Level-2: 12 fine-grained intentions), then used GPT-5 to classify the remaining 126,415 questions. (2) Question Instantiation and Expansion — parses repository structure with tree-sitter, selects a compact subgraph around a focal element, and combines it with seed templates to generate questions via LLM. (3) Answer Collection — a RAG pipeline retrieves repository context (index of functions, classes, inter-dependencies; semantic similarity + structural dependency analysis), then an LLM assisted by 4 human experts generates a preliminary reference answer. (4) Data Validation — expert answer revision (each answer reviewed/cross-validated by two experts, third expert on disagreement) and quality filtering, enforcing exactly 48 finalized pairs per repository balanced across Level-1 categories. The paper evaluates six LLMs under five approaches: Direct Prompting, Sliding Window RAG, Function Chunking RAG, and two agent frameworks (OpenHands and SWE-agent), plus two commercial tools (Tongyi Lingma, Cursor). Grading is LLM-as-Judge (Claude Sonnet 4.5) over five dimensions.

## Load-bearing findings

**Q: Total number of questions and category breakdown; size of the Why/design-rationale subcategory**
- Answer: 720 total questions, 48 per repository across 15 repositories. Level-1 distribution (Figure 3 / text): How 35.2%, Where 28.4%, Why 23.1%, What 13.3%. The final benchmark enforces an equal number of What, Why, Where, How (balanced; 'exactly 48 finalized pairs per repository'). For the Why/'Design rationale' subcategory specifically: Figure 3's legend lists 'Design rationale'; the pie chart shows numeric slice labels (10.7%, 16.6%, 22.3%, 1.5%, 21.8%, 1.7%, 9.5%, 11.6%, 2.6%, 2.5%, 7.3%, 3.4%, 6.4%). The exact percentage label tied to the 'Design rationale' slice is not unambiguously readable as a single stated number in the text; the text states only the Level-1 aggregate 'Why questions, which probe design rationales and purpose, make up 23.1% of the corpus.' Exact Design-rationale subcategory size: not stated explicitly in text.
- Quote: "SWE-QA comprises 720 high-quality QA pairs that necessitate a deep understanding of intentions, cross-file reasoning, and multi-hop dependency analysis. ... How questions are the most frequent (35.2%) ... Where questions follow at 28.4% ... Why questions, which probe design rationales and purpose, make up 23.1% of the corpus. Finally, What questions ... account for the remaining 13.3%."
- Location: Abstract; Section 2.1 Seed Collection and Taxonomy Construction; Figure 3 (Distribution of question types)

**Q: How are answers graded — LLM-as-judge? which model? reference answers? evaluation protocol**
- Answer: Yes — LLM-as-Judge. The judge model is Claude Sonnet 4.5. It is given the model's output and the gold (reference) answer and scores five dimensions (correctness, completeness, relevance, clarity, coherence), each on a 20-point scale, for a total of 100. Strict judge-candidate separation, anonymized systems, and randomized answer order are enforced; complemented by a human study (Appendix C.1).
- Quote: "We adopt an LLM-based evaluation (LLM-as-Judge) to assess repository-level code question answering performance (see Prompt 3). ... Given a model's output and the gold answer, an LLM—Claude Sonnet 4.5 (Anthropic, 2025) in our experiments—evaluates answer quality along five dimensions: correctness, completeness, relevance, clarity, and Coherence. Each dimension is scored on a 20-point scale, yielding a total score of 100 (see Appendix B.2 for details). To mitigate potential self-evaluation bias, we enforce strict judge–candidate separation, anonymize systems, randomize answer order, and complement automated evaluation with a human study (Appendix C.1)."
- Location: Section 3.1 Experiment Setup, Metrics

**Q: Which repositories are covered**
- Answer: 15 Python repositories: 12 from SWE-Bench and 3 from SWE-Bench-Live. From SWE-Bench: astropy, django, flask, matplotlib, pylint, pytest, requests, scikit-learn, sphinx, sqlfluff, sympy, xarray. From SWE-Bench-Live: conan, reflex, streamlink (per Table 5).
- Quote: "we instantiated candidate questions from 15 repositories (12 from SWE-Bench and 3 from SWE-Bench-Live (Zhang et al., 2025))"
- Location: Section 2 (intro paragraph); Table 5 (Results across different repositories by OpenHands)

**Q: What context / RAG conditions does it ship and evaluate**
- Answer: Five studied approaches per model: Direct Prompting, two RAG variants (Sliding Window RAG and Function Chunking RAG), and two agent-based frameworks (OpenHands and SWE-agent). Two commercial programming tools (Tongyi Lingma and Cursor) are also evaluated as system-level baselines. The Answer Collection stage itself uses a RAG pipeline (index of functions/classes/inter-dependencies retrieved via semantic similarity matching and structural dependency analysis).
- Quote: "For each model, we study five approaches: Direct Prompting, two retrieval-augmented generation variants (Sliding Window RAG and Function Chunking RAG), and two agent-based frameworks (OpenHands and SWE-agent). We further include two commercial programming tools, Tongyi Lingma and Cursor-agent, as system-level baselines."
- Location: Section 3.1 Experiment Setup, Studied Methods

**Q: Is the dataset/code public? URL**
- Answer: Yes. GitHub: https://github.com/peng-weihan/SWE-QA-Bench ; Hugging Face dataset: https://huggingface.co/datasets/swe-qa/SWE-QA-Benchmark
- Quote: "GitHub: https://github.com/peng-weihan/SWE-QA-Bench   Hugging Face: https://huggingface.co/datasets/swe-qa/SWE-QA-Benchmark"
- Location: Page 1 (header, below author block)

**Q: Which six LLMs are evaluated**
- Answer: Kimi K2, Qwen3-Coder-30B-A3B-Instruct, Qwen3-Coder-480B-A35B-Instruct, GLM-4.6, Gemini 2.5 Pro, and GPT-5.1.
- Quote: "We evaluate six representative LLMs: Kimi K2 (Moonshot-AI, 2025), Qwen3-Coder-30B-A3B-Instruct (Qwen Team, 2025a), Qwen3-Coder-480B-A35B-Instruct (Qwen Team, 2025b), GLM-4.6 (Zhipu AI (Z.ai), 2025), Gemini 2.5 Pro (Google-AI, 2025) and GPT-5.1 (OpenAI, 2025)."
- Location: Section 3.1 Experiment Setup, Model Selection

**Q: Best overall performance / score**
- Answer: GPT-5.1 with OpenHands achieves the best overall score of 70.79. GLM-4.6 with OpenHands attains 70.15. Cursor scores 70.66 and Tongyi Lingma 69.07.
- Quote: "GPT-5.1 achieves the best overall performance, reaching 70.79 when combined with OpenHands. Notably, strong open-source models perform competitively: GLM-4.6 with OpenHands attains 70.15, closely matching GPT-5.1."
- Location: Section 3.2; Table 3 (Comparative performance)

**Q: Benchmark corpus statistics (files, classes, functions, LOC, reasoning depth)**
- Answer: 720 questions from 15 Python repositories encompassing 13,300 files, 22,522 classes, 142,404 functions, over 3.4 million lines of code. Average question length 28.62 words; average answer length 266.64 words. On average answering a question involves 8.71 functions across 3.19 files, reasoning chain depth 4.72, dependency chain depth 2.96; 90.9% of questions have reasoning chain depth >1; 77.6% require cross-file knowledge.
- Quote: "these repositories encompass 13,300 files, 22,522 classes, 142,404 functions, and over 3.4 million lines of code ... The average question length is 28.62 words, and the average answer length is 266.64 words. ... answering each question involves 8.71 functions across 3.19 files, with a reasoning chain depth of 4.72 and a dependency chain depth of 2.96. Moreover, 90.9% of the questions exhibit a reasoning chain depth greater than one, and 77.6% require cross-file knowledge to be answered correctly"
- Location: Section 2.5 Statistics of SWE-QA

**Q: How many GitHub issues were crawled and from how many repositories**
- Answer: 77,100 GitHub issues from the 12 popular repositories used in SWE-bench.
- Quote: "we crawled 77,100 GitHub issues from the 12 popular repositories used in SWE-bench (Jimenez et al., 2024)"
- Location: Section 2.1 Seed Collection and Taxonomy Construction

**Q: Taxonomy-aware analysis: which question types score highest/lowest**
- Answer: Highest on Why questions (average 69.77), particularly Design rationale (71.48); strong on How API/Framework Support (68.75). Lowest average on What questions (65.81), with Architecture exploration at 61.84; Where questions average 66.76.
- Quote: "Models consistently achieve the highest scores on Why questions (average 69.77), particularly 'Design rationale' (71.48), and perform well on How questions related to 'API / Framework Support' (68.75). ... What questions ... yield the lowest average score (65.81), with 'Architecture exploration' at 61.84. Where questions (66.76), which demand precise location, also remain challenging."
- Location: Section 3.3 Taxonomy-Aware Analysis; Table 4

## Key numbers

- **Total QA pairs in SWE-QA**: 720  _(Abstract; Section 2.5)_
- **Repositories (12 SWE-Bench + 3 SWE-Bench-Live)**: 15  _(Section 2 intro; Table 5)_
- **QA pairs per repository**: 48  _(Section 2.4 Data Validation)_
- **GitHub issues crawled**: 77,100  _(Section 2.1)_
- **Issues after length filter (>=1,000 chars)**: 41,955  _(Section 2.1)_
- **Distinct questions extracted (avg 3.04/issue)**: 127,415  _(Section 2.1)_
- **Level-1 distribution: How / Where / Why / What**: 35.2% / 28.4% / 23.1% / 13.3%  _(Section 2.1; Figure 3)_
- **Best overall score (GPT-5.1 + OpenHands)**: 70.79  _(Table 3; Section 3.2)_
- **GLM-4.6 + OpenHands overall**: 70.15  _(Section 3.2; Table 3)_
- **Cursor overall**: 70.66  _(Table 3; Section 3.2)_
- **Tongyi Lingma overall**: 69.07  _(Table 3; Section 3.2)_
- **Kimi K2 Direct Prompting overall**: 51.47  _(Section 3.2; Table 3)_
- **Kimi K2 + Sliding Window RAG overall**: 62.44  _(Section 3.2; Table 3)_
- **Kimi K2 + SWE-agent overall**: 67.72  _(Section 3.2; Table 3)_
- **LLM-as-Judge total score scale (5 dims x 20 pts)**: 100  _(Section 3.1 Metrics)_
- **Avg functions per question**: 8.71  _(Section 2.5)_
- **Avg files per question**: 3.19  _(Section 2.5)_
- **Reasoning chain depth (avg)**: 4.72  _(Section 2.5)_
- **Dependency chain depth (avg)**: 2.96  _(Section 2.5)_
- **Questions with reasoning chain depth > 1**: 90.9%  _(Section 2.5)_
- **Questions requiring cross-file knowledge**: 77.6%  _(Section 2.5)_
- **Total files across repos**: 13,300  _(Section 2.5)_
- **Total classes across repos**: 22,522  _(Section 2.5)_
- **Total functions across repos**: 142,404  _(Section 2.5)_
- **Total lines of code**: >3.4 million  _(Section 2.5)_
- **Avg question length / answer length (words)**: 28.62 / 266.64  _(Section 2.5)_
- **Why questions highest avg (Design rationale subtype)**: 69.77 (Design rationale 71.48)  _(Table 4; Section 3.3)_
- **What questions lowest avg (Architecture exploration subtype)**: 65.81 (Architecture exploration 61.84)  _(Table 4; Section 3.3)_
- **Where questions avg**: 66.76  _(Table 4; Section 3.3)_
- **How questions avg**: 68.58  _(Table 4)_
- **SWE-Bench repos avg (OpenHands) vs SWE-Bench-Live avg**: 68.59 vs 64.98 (-3.61)  _(Section 3.4; Table 5)_
- **Easiest repo (flask) avg / hardest (pylint) avg**: 75.42 / 62.01  _(Section 3.4; Table 5)_

## Evaluation setup
Benchmark: SWE-QA, 720 QA pairs, 15 Python repositories (12 SWE-Bench + 3 SWE-Bench-Live), 48 pairs/repo, balanced across What/Why/Where/How. Models evaluated (N=6 LLMs): Kimi K2, Qwen3-Coder-30B-A3B-Instruct, Qwen3-Coder-480B-A35B-Instruct, GLM-4.6, Gemini 2.5 Pro, GPT-5.1. Plus 2 commercial tools as system-level baselines: Tongyi Lingma (v2.5.16) and Cursor (v2025.09.04). Methods/conditions (5 per model): Direct Prompting, Sliding Window RAG, Function Chunking RAG, SWE-agent, OpenHands. Metric: LLM-as-Judge using Claude Sonnet 4.5, scoring 5 dimensions (correctness, completeness, relevance, clarity, coherence) each on a 20-point scale, total 100; gold/reference answers provided; strict judge-candidate separation, anonymized systems, randomized answer order; complemented by human study (Appendix C.1). Results tables: Table 3 (overall comparative performance), Table 4 (taxonomy-aware by OpenHands across 12 intentions), Table 5 (cross-repository by OpenHands). Detailed configs in Appendix B.1; detailed per-repository statistics in Appendix A.4. Baseline comparison of benchmarks in Table 2.

## Stated limitations
The paper's stated Limitations: (1) SWE-QA focuses on Python repositories, which may limit generalizability to other programming languages, despite the language-agnostic design of the methods. (2) Evaluation relies on a combination of LLM-as-Judge and limited-scale human evaluation; although the latter is used to validate the former, both may introduce biases and may not fully capture all nuances of answer quality. (3) The benchmark is constructed from static code snapshots and does not reflect the dynamics of evolving repositories. (4) While 15 diverse repositories were selected, they may not cover the full spectrum of software projects, particularly smaller or highly domain-specific codebases.

## NOT stated in paper
- The exact numeric percentage of the 'Design rationale' (Why) subcategory in the source corpus is not stated as a single number in the text (only the Level-1 Why aggregate 23.1% is stated; Figure 3 shows unlabeled-by-subtype slice values). - The paper does not state the exact prompts inline (refers to Prompt 1, Prompt 2, Prompt 3 in Appendix E and Appendix B.2; appendices are not in the read pages). - It does not state inter-annotator agreement statistics numerically for the open-coding taxonomy. - It does not report statistical significance tests on the score differences. - The publication venue/conference is not stated (arXiv preprint). - It does not state token/context window sizes for the RAG window or the agent budgets in the main text (Appendix B.1 referenced). - The numeric human-study agreement value is not stated in the read pages (Appendix C.1 referenced). - It does not claim the methods generalize to non-Python languages (explicitly flagged as a limitation).

## Code/data
GitHub: https://github.com/peng-weihan/SWE-QA-Bench ; Hugging Face dataset: https://huggingface.co/datasets/swe-qa/SWE-QA-Benchmark
