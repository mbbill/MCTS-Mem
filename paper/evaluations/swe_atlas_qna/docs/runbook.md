# SWE-Atlas QnA local harness — runbook

How to run SWE-Atlas Codebase QnA locally (harbor + Colima Docker) against the local
proxy. Captures the environment gotchas found while standing this up on 2026-06-27.

## Components
- **harbor** (Laude Institute) — the SWE-Atlas official harness. Installed via
  `uv tool install harbor --native-tls` (the `--native-tls` is required behind the
  corporate TLS interception, else pypi fails with `UnknownIssuer`).
- **SWE-Atlas** repo cloned at `~/Dev/SWE-Atlas` (data/qa + run_config). `.env` (gitignored)
  holds proxy creds.
- **Proxy**: `http://127.0.0.1:8789/v1`, OpenAI-compatible, model `claude-gpt-5.2-codex`.
  Agent = mini-swe-agent on host; judge = `evaluate_answer.py` inside the container.

## Environment gotchas (all resolved except Rosetta)
1. **Docker Compose v2 missing on Colima.** harbor shells out to `docker compose`; Colima
   ships no compose plugin → `unknown flag: --project-name`. Fixed by installing the plugin:
   `~/.docker/cli-plugins/docker-compose` (v5.2.0, darwin-aarch64). Done.
2. **Task resource request >> VM.** Tasks request `cpus=16, memory_mb=16384`; Colima VM is
   2 CPU / 2 GB → `range of CPUs is from 0.01 to 2.00`. Fixed with harbor flags
   `--cpus ignore --memory ignore` (no Colima change, no dataset edit). In `run_qna.sh`.
3. **amd64 images need Rosetta. ← THE BLOCKER.** SWE-Atlas images are amd64-only; Colima is
   `vmType: vz, rosetta: false` → amd64 `bash` can't exec (`exit 126`). QEMU binfmt does not
   work on the vz kernel (handler registered without usable fix-binary). The other agent's
   Flipt images run only because they bake QEMU in; SWE-Atlas images don't. **Fix requires a
   Colima restart with Rosetta** (destroys running containers):
   ```
   colima stop && colima start --vz-rosetta --cpu 8 --memory 12 --disk 100
   ```
   Pulled images survive the restart (persistent VM disk). 8 CPU / 12 GB leaves host headroom
   on the 10-core / 16 GB Mac and also fixes the 2/2 throughput bottleneck.
4. **Proxy networking (two hostnames).** Proxy binds 127.0.0.1 only.
   - Host agent reaches it at `127.0.0.1:8789` (global `OPENAI_API_BASE` in `.env`).
   - In-container judge reaches it at `host.docker.internal:8789`, injected via harbor
     `--ve EVAL_BASE_URL=...`. Both verified reachable.

## Run
Smoke (1 task, step-capped):
```
cd ~/Dev/SWE-Atlas
CONFIG=.../configs/mswea_qa_config_smoke.yaml JOBNAME=kitty_smoke EFFORT=low \
  .../scripts/run_qna.sh task-6905333b74f22949d97ba9e3
```
Full kitty C0 baseline (26 tasks):
```
CONFIG=.../configs/mswea_qa_config.yaml JOBNAME=kitty_c0 EFFORT=high NCONC=2 \
  .../scripts/run_qna.sh $(cat .../tasks/kitty_qna_task_names.txt)
```
Score: `python3 scripts/parse_results.py results/kitty_c0 --label C0`
(reports binary pass rate + mean agg_score (rubric-item recall) + must-have recall, per category).

## Kitty cutoff (for the later MCTS-Mem build)
All 26 kitty QnA tasks share **one** `base_commit`:
`815df1e210e0a9ab4622f5c7f2d6891d7dbeddf1` — committed **2024-06-24**. So the kitty MCTS-Mem
tree must be built **only from kitty history that is an ancestor of `815df1e2`** (≤ 2024-06-24).
One cutoff for the whole kitty set — no per-task slicing needed.
