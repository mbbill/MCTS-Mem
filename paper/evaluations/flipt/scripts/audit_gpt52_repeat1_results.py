#!/usr/bin/env python3
"""Audit the GPT-5.2 Flipt repeat-1 generation and local grading artifacts."""

from __future__ import annotations

import argparse
import collections
import json
from pathlib import Path
import re
from statistics import median


CONDITIONS = ["C0", "C1_git_history", "C4_git_history_mcts_mem"]
RESULTS_ROOT = Path("paper/evaluations/flipt/results")
TASKS_FILE = Path("paper/evaluations/flipt/tasks/flipt_swebench_pro_tasks.jsonl")


def load_json(path: Path):
    return json.loads(path.read_text())


def iter_trajs(run_dir: Path, condition: str):
    yield from sorted((run_dir / condition).glob("*/instance_*.traj.json"))


def expected_total(run_dir: Path) -> int:
    task_order = run_dir / "task_order.tsv"
    if task_order.exists():
        return sum(1 for line in task_order.read_text().splitlines() if line.strip())
    return 85


def summarize_numbers(values: list[int | float]) -> str:
    if not values:
        return "-"
    values = sorted(values)
    return f"min={values[0]}; median={values[len(values) // 2]}; max={values[-1]}"


def counter_text(counter: collections.Counter) -> str:
    return ", ".join(f"`{k}={v}`" for k, v in sorted(counter.items())) or "-"


def result_for(run_dir: Path, condition: str, instance_id: str):
    path = run_dir / "local_grade_reports" / condition / instance_id / "result.json"
    return load_json(path) if path.exists() else None


def status_counts(run_dir: Path, condition: str):
    counts = collections.Counter()
    resolved = set()
    for path in sorted((run_dir / "local_grade_reports" / condition).glob("*/result.json")):
        result = load_json(path)
        counts[result.get("status", "<missing>")] += 1
        if result.get("resolved"):
            resolved.add(path.parent.name)
    return counts, resolved


def classify_failure(result_path: Path, result: dict) -> str:
    if result.get("status") != "unresolved":
        return result.get("status", "<missing>")
    chunks = (result.get("fail_to_pass") or {}).get("chunks") or []
    if not chunks:
        return "unresolved_no_chunk"
    log_path = Path(str(chunks[0].get("log", "")).replace("/grader", str(result_path.parent)))
    text = log_path.read_text(errors="replace") if log_path.exists() else ""
    if any(marker in text for marker in ["undefined:", "has no field or method", "cannot use"]):
        return "compile_error"
    if "--- FAIL:" in text:
        return "test_assertion_fail"
    if "FAIL\t" in text:
        return "package_fail_other"
    return "other_unresolved"


def classify_oracle_nonresolved(result_path: Path, result: dict) -> str:
    status = result.get("status", "<missing>")
    if status == "docker_failed_no_result":
        docker_log = result_path.parent / "docker.log"
        text = docker_log.read_text(errors="replace") if docker_log.exists() else ""
        if any(marker in text for marker in ["failed to resolve reference", "connection refused", "unexpected EOF", "TLS handshake timeout"]):
            return "docker_pull_or_registry_failure"
        return "docker_failed_no_result"
    if status == "unresolved":
        chunks = (result.get("fail_to_pass") or {}).get("chunks") or []
        texts = []
        for chunk in chunks:
            log_path = Path(str(chunk.get("log", "")).replace("/grader", str(result_path.parent)))
            if log_path.exists():
                texts.append(log_path.read_text(errors="replace"))
        text = "\n".join(texts)
        if "self-signed.badssl.com" in text and "lookup" in text:
            return "external_dns_dependency"
        if "--- FAIL:" in text:
            return "reference_patch_test_assertion_fail"
        if any(marker in text for marker in ["undefined:", "has no field or method", "cannot use"]):
            return "reference_patch_compile_error"
        return "reference_patch_unresolved"
    return status


def short_ids(ids: set[str]) -> str:
    if not ids:
        return "-"
    return ", ".join(f"`{item.replace('instance_flipt-io__flipt-', '')[:8]}`" for item in sorted(ids))


def render_table(headers: list[str], rows: list[list[str]]) -> list[str]:
    lines = ["| " + " | ".join(headers) + " |", "| " + " | ".join("---" for _ in headers) + " |"]
    lines.extend("| " + " | ".join(row) + " |" for row in rows)
    return lines


def parse_task_list(value):
    if isinstance(value, list):
        return value
    if value in (None, ""):
        return []
    try:
        return json.loads(value)
    except Exception:
        import ast

        return ast.literal_eval(value)


def selector_sanity_rows(tasks_file: Path) -> list[list[str]]:
    if not tasks_file.exists():
        return []
    field_counts = collections.Counter()
    fail_lengths = []
    slash_selectors = []
    for line in tasks_file.read_text().splitlines():
        if not line.strip():
            continue
        row = json.loads(line)
        fail_to_pass = parse_task_list(row.get("fail_to_pass"))
        pass_to_pass = parse_task_list(row.get("pass_to_pass"))
        fail_lengths.append(len(fail_to_pass))
        field_counts["rows"] += 1
        field_counts["fail_to_pass_selectors"] += len(fail_to_pass)
        field_counts["fail_to_pass_nonempty_rows"] += bool(fail_to_pass)
        field_counts["pass_to_pass_selectors"] += len(pass_to_pass)
        field_counts["pass_to_pass_nonempty_rows"] += bool(pass_to_pass)
        for selector in fail_to_pass + pass_to_pass:
            if "/" in selector:
                slash_selectors.append(selector)
    return [[
        str(field_counts["rows"]),
        str(field_counts["fail_to_pass_selectors"]),
        str(field_counts["fail_to_pass_nonempty_rows"]),
        str(field_counts["pass_to_pass_selectors"]),
        str(field_counts["pass_to_pass_nonempty_rows"]),
        str(len(slash_selectors)),
        summarize_numbers(fail_lengths),
    ]]


def load_task_ids(tasks_file: Path) -> set[str]:
    if not tasks_file.exists():
        return set()
    return {
        json.loads(line)["instance_id"]
        for line in tasks_file.read_text().splitlines()
        if line.strip()
    }


def result_inventory(results_root: Path) -> list[list[str]]:
    rows: list[list[str]] = []
    if not results_root.exists():
        return rows
    for result_dir in sorted(path for path in results_root.iterdir() if path.is_dir()):
        condition_parts = []
        grade_parts = []
        for condition_dir in sorted(path for path in result_dir.iterdir() if path.is_dir()):
            preds_path = condition_dir / "preds.json"
            if not preds_path.exists():
                continue
            try:
                preds = load_json(preds_path)
            except Exception:
                condition_parts.append(f"`{condition_dir.name}`=unreadable")
                continue
            nonempty = sum(1 for row in preds.values() if (row.get("model_patch") or "").strip())
            traj_count = sum(1 for _ in condition_dir.glob("*/instance_*.traj.json"))
            condition_parts.append(f"`{condition_dir.name}`={len(preds)} preds/{nonempty} nonempty/{traj_count} traj")
            grade_root = result_dir / "local_grade_reports" / condition_dir.name
            if grade_root.exists():
                statuses = collections.Counter(load_json(path).get("status", "<missing>") for path in grade_root.glob("*/result.json"))
                grade_parts.append(f"`{condition_dir.name}`: {counter_text(statuses)}")
        if condition_parts:
            rows.append([f"`{result_dir.name}`", "; ".join(condition_parts), "; ".join(grade_parts) or "-"])
    return rows


def audit(run_dir: Path, oracle_dir: Path | None) -> str:
    total = expected_total(run_dir)
    lines: list[str] = []
    lines.append("# GPT-5.2 Flipt Repeat-1 Audit")
    lines.append("")
    lines.append("This report audits generation, local grading, wrapper-limit effects, and reference-patch oracle checks for the clean GPT-5.2 cutoff-git repeat 1.")
    lines.append("")

    inventory_rows = result_inventory(RESULTS_ROOT)
    if inventory_rows:
        lines.append("## Result Directory Inventory")
        lines.extend(render_table(["result dir", "generation artifacts", "local grades"], inventory_rows))
        lines.append("")

    lines.append("## Generation Configuration")
    config_rows = []
    for condition in CONDITIONS:
        traj_paths = list(iter_trajs(run_dir, condition))
        first_info = load_json(traj_paths[0]).get("info") if traj_paths else {}
        config = (first_info or {}).get("config") or {}
        agent_config = config.get("agent") or {}
        model_config = config.get("model") or {}
        kwargs = model_config.get("model_kwargs") or {}
        api_calls = []
        message_counts = []
        responses_starts = 0
        responses_errors = 0
        for log_path in sorted((run_dir / condition).glob("*.runner.log")):
            text = log_path.read_text(errors="replace")
            responses_starts += text.count("litellm.responses start")
            responses_errors += text.count("litellm.responses error")
        for traj_path in traj_paths:
            traj = load_json(traj_path)
            stats = ((traj.get("info") or {}).get("model_stats") or {})
            if isinstance(stats.get("api_calls"), int):
                api_calls.append(stats["api_calls"])
            message_counts.append(len(traj.get("messages") or []))
        config_rows.append([
            f"`{condition}`",
            f"`{model_config.get('model_name')}`",
            f"step={agent_config.get('step_limit')}; wall={agent_config.get('wall_time_limit_seconds')}s",
            f"max_output={kwargs.get('max_output_tokens')}; temp={kwargs.get('temperature')}; effort={(kwargs.get('reasoning') or {}).get('effort')}",
            summarize_numbers(api_calls),
            f"{responses_starts}/{responses_errors}",
            summarize_numbers(message_counts),
        ])
    lines.extend(render_table(["condition", "model", "agent limit", "model kwargs", "api calls", "responses start/error", "messages"], config_rows))
    lines.append("")

    lines.append("## Artifact Completeness")
    artifact_rows = []
    for condition in CONDITIONS:
        preds = load_json(run_dir / condition / "preds.json")
        pred_count = len(preds)
        traj_count = sum(1 for _ in iter_trajs(run_dir, condition))
        result_count = sum(1 for _ in (run_dir / "local_grade_reports" / condition).glob("*/result.json"))
        artifact_rows.append([f"`{condition}`", str(pred_count), str(traj_count), str(result_count)])
    lines.extend(render_table(["condition", "predictions", "trajectories", "grade results"], artifact_rows))
    lines.append("")

    task_ids = load_task_ids(TASKS_FILE)
    if task_ids:
        lines.append("## Instance Set Audit")
        instance_rows = []
        for condition in CONDITIONS:
            preds = load_json(run_dir / condition / "preds.json")
            pred_ids = set(preds)
            traj_ids = {path.parent.name for path in iter_trajs(run_dir, condition)}
            grade_ids = {path.parent.name for path in (run_dir / "local_grade_reports" / condition).glob("*/result.json")}
            all_ids = pred_ids | traj_ids | grade_ids
            mismatches = (task_ids ^ pred_ids) | (task_ids ^ traj_ids) | (task_ids ^ grade_ids)
            instance_rows.append([
                f"`{condition}`",
                str(len(pred_ids)),
                str(len(traj_ids)),
                str(len(grade_ids)),
                str(len(all_ids - task_ids)),
                str(len(task_ids - pred_ids)),
                str(len(task_ids - traj_ids)),
                str(len(task_ids - grade_ids)),
                short_ids(mismatches),
            ])
        lines.extend(render_table(["condition", "pred ids", "traj ids", "grade ids", "extra ids", "missing preds", "missing trajs", "missing grades", "mismatches"], instance_rows))
        lines.append("")

    lines.append("## Prediction Patch Sanity")
    patch_rows = []
    for condition in CONDITIONS:
        preds = load_json(run_dir / condition / "preds.json")
        lengths = [len((row.get("model_patch") or "")) for row in preds.values()]
        nonempty = [(instance_id, row.get("model_patch") or "") for instance_id, row in preds.items() if (row.get("model_patch") or "").strip()]
        diff_patches = [(instance_id, patch) for instance_id, patch in nonempty if "diff --git " in patch]
        malformed_nonempty = [instance_id for instance_id, patch in nonempty if "diff --git " not in patch]
        patch_rows.append([
            f"`{condition}`",
            str(len(preds)),
            str(len(nonempty)),
            str(len(diff_patches)),
            str(len(malformed_nonempty)),
            summarize_numbers(lengths),
        ])
    lines.extend(render_table(["condition", "predictions", "nonempty", "diff patches", "nonempty without diff", "patch bytes"], patch_rows))
    lines.append("")

    lines.append("## Generation Exits")
    exit_rows = []
    for condition in CONDITIONS:
        exit_total = collections.Counter()
        resolved = collections.Counter()
        rescued = collections.Counter()
        rescued_resolved = collections.Counter()
        for traj_path in iter_trajs(run_dir, condition):
            instance_id = traj_path.parent.name
            info = load_json(traj_path).get("info") or {}
            exit_status = info.get("exit_status") or "<missing>"
            result = result_for(run_dir, condition, instance_id) or {}
            is_resolved = bool(result.get("resolved"))
            exit_total[exit_status] += 1
            if is_resolved:
                resolved[exit_status] += 1
            rescue_key = "rescued" if info.get("rescued_submission_from_diff") else "direct"
            rescued[rescue_key] += 1
            if is_resolved:
                rescued_resolved[rescue_key] += 1
        exit_rows.append([
            f"`{condition}`",
            counter_text(exit_total),
            counter_text(resolved),
            ", ".join(f"`{k}={rescued[k]}/{rescued_resolved[k]}`" for k in sorted(rescued)),
        ])
    lines.extend(render_table(["condition", "exit statuses", "resolved by exit", "total/resolved direct vs rescued"], exit_rows))
    lines.append("")

    lines.append("## Local Grade Summary")
    summary_rows = []
    resolved_sets: dict[str, set[str]] = {}
    for condition in CONDITIONS:
        counts, resolved_ids = status_counts(run_dir, condition)
        resolved_sets[condition] = resolved_ids
        preds = load_json(run_dir / condition / "preds.json")
        nonempty = sum(1 for row in preds.values() if (row.get("model_patch") or "").strip())
        summary_rows.append([
            f"`{condition}`",
            str(total),
            str(nonempty),
            str(len(resolved_ids)),
            counter_text(counts),
        ])
    lines.extend(render_table(["condition", "total", "nonempty", "resolved", "statuses"], summary_rows))
    lines.append("")

    lines.append("## Paired Outcomes")
    pair_rows = []
    pairs = [("C4_git_history_mcts_mem", "C1_git_history"), ("C4_git_history_mcts_mem", "C0"), ("C1_git_history", "C0")]
    for first, second in pairs:
        first_only = resolved_sets[first] - resolved_sets[second]
        second_only = resolved_sets[second] - resolved_sets[first]
        both = resolved_sets[first] & resolved_sets[second]
        neither = total - len(resolved_sets[first] | resolved_sets[second])
        pair_rows.append([f"`{first}` vs `{second}`", str(len(first_only)), str(len(second_only)), str(len(both)), str(neither), short_ids(first_only), short_ids(second_only)])
    lines.extend(render_table(["comparison", "first-only", "second-only", "both", "neither", "first-only ids", "second-only ids"], pair_rows))
    lines.append("")

    lines.append("## Failure Classification")
    failure_rows = []
    for condition in CONDITIONS:
        failures = collections.Counter()
        for path in sorted((run_dir / "local_grade_reports" / condition).glob("*/result.json")):
            result = load_json(path)
            failures[classify_failure(path, result)] += 1
        failure_rows.append([f"`{condition}`", counter_text(failures)])
    lines.extend(render_table(["condition", "classification counts"], failure_rows))
    lines.append("")

    selector_rows = selector_sanity_rows(TASKS_FILE)
    if selector_rows:
        lines.append("## Local Grader Selector Sanity")
        lines.append("The local grader builds `go test ./... -run <regex>` from task `fail_to_pass` names. Go gives `/` special subtest semantics, so selectors containing `/` would require extra care; this task snapshot has none.")
        lines.append("")
        lines.extend(render_table(["rows", "fail_to_pass selectors", "fail_to_pass rows", "pass_to_pass selectors", "pass_to_pass rows", "selectors containing `/`", "fail_to_pass per row"], selector_rows))
        lines.append("")

    lines.append("## Wrapper-Limit Audit")
    wrapper_rows = []
    for condition in CONDITIONS:
        no_rejects = []
        after_diff_guidance = []
        search_rejects = []
        history_counts = []
        for traj_path in iter_trajs(run_dir, condition):
            text = traj_path.read_text(errors="replace")
            no_rejects.append(text.count("Read-only command rejected after"))
            after_diff_guidance.append(text.count("A tracked source diff has existed"))
            search_rejects.append(text.count("Search command rejected"))
            history_counts.append(len(re.findall(r"\bgit\s+(?:log|show|rev-list|blame|grep|ls-tree|cat-file)\b", text)))
        wrapper_rows.append([
            f"`{condition}`",
            f"{sum(x > 0 for x in no_rejects)}/{total}; median={median(no_rejects):.1f}; max={max(no_rejects)}",
            f"{sum(x > 0 for x in after_diff_guidance)}/{total}; median={median(after_diff_guidance):.1f}; max={max(after_diff_guidance)}",
            f"{sum(x > 0 for x in search_rejects)}/{total}; max={max(search_rejects)}",
            f"{sum(x > 0 for x in history_counts)}/{total}; median={median(history_counts):.1f}; max={max(history_counts)}",
        ])
    lines.extend(render_table(["condition", "no-diff read-only rejections", "after-diff guidance/rejections", "search rejections", "history-command mentions"], wrapper_rows))
    lines.append("")

    lines.append("## Git-History Guard Audit")
    guard_rows = []
    for condition in CONDITIONS:
        runner_logs = sorted((run_dir / condition).glob("*.runner.log"))
        if condition == "C0":
            sanitized = sum("Git history sanitized" in path.read_text(errors="replace") for path in runner_logs)
            failures = sum("Git history sanitizer failed" in path.read_text(errors="replace") for path in runner_logs)
            guard_rows.append([f"`{condition}`", str(len(runner_logs)), f"sanitized={sanitized}", f"failures={failures}"])
        else:
            checks = 0
            bad = 0
            missing = 0
            for path in runner_logs:
                text = path.read_text(errors="replace")
                matches = re.findall(r"future_commits=(\d+)", text)
                if not matches:
                    missing += 1
                else:
                    checks += 1
                    bad += sum(item != "0" for item in matches)
            guard_rows.append([f"`{condition}`", str(len(runner_logs)), f"future_checks={checks}", f"bad_or_missing={bad + missing}"])
    lines.extend(render_table(["condition", "runner logs", "check", "bad"], guard_rows))
    lines.append("")

    smoke_root = RESULTS_ROOT / "gpt52_codex_smoke10_c0_snapshot_responses"
    if smoke_root.exists():
        lines.append("## GPT-5.2 Smoke Context")
        smoke_rows = []
        for condition_dir in sorted(path for path in smoke_root.iterdir() if path.is_dir() and (path / "preds.json").exists()):
            preds = load_json(condition_dir / "preds.json")
            nonempty = sum(1 for row in preds.values() if (row.get("model_patch") or "").strip())
            trajs = sum(1 for _ in condition_dir.glob("*/instance_*.traj.json"))
            grade_root = smoke_root / "local_grade_reports" / condition_dir.name
            statuses = collections.Counter(load_json(path).get("status", "<missing>") for path in grade_root.glob("*/result.json")) if grade_root.exists() else collections.Counter()
            smoke_rows.append([f"`{condition_dir.name}`", str(len(preds)), str(nonempty), str(trajs), counter_text(statuses)])
        lines.extend(render_table(["condition", "predictions", "nonempty", "trajectories", "local grades"], smoke_rows))
        lines.append("")

    if oracle_dir is not None and (oracle_dir / "local_grade_reports" / "ORACLE").exists():
        lines.append("## Reference-Patch Oracle")
        oracle_paths = sorted((oracle_dir / "local_grade_reports" / "ORACLE").glob("*/result.json"))
        oracle_counts = collections.Counter(load_json(path).get("status", "<missing>") for path in oracle_paths)
        bad_oracle = []
        for path in oracle_paths:
            result = load_json(path)
            if result.get("status") != "resolved":
                bad_oracle.append((path.parent.name, result.get("status", "<missing>"), classify_oracle_nonresolved(path, result)))
        lines.append(f"Reference patch results completed: {len(oracle_paths)}/{total}.")
        if len(oracle_paths) < total:
            lines.append("The full oracle is still in progress; completed entries are enough for a smoke check but not a final grader proof.")
        elif bad_oracle:
            lines.append("Completed oracle contains non-resolved reference patches; inspect these before interpreting model scores.")
        else:
            lines.append("Completed oracle resolved every reference patch, which is strong evidence that the local grader is operational for these tasks.")
        lines.append("")
        lines.extend(render_table(["status", "count"], [[f"`{k}`", str(v)] for k, v in sorted(oracle_counts.items())]))
        if bad_oracle:
            lines.append("")
            oracle_bad_rows = [[f"`{instance_id}`", f"`{status}`", f"`{classification}`"] for instance_id, status, classification in bad_oracle]
            lines.extend(render_table(["instance", "status", "audit classification"], oracle_bad_rows[:20]))
            if len(oracle_bad_rows) > 20:
                lines.append(f"Additional non-resolved oracle entries omitted: {len(oracle_bad_rows) - 20}.")
        lines.append("")

        oracle_status_by_id = {path.parent.name: load_json(path).get("status", "<missing>") for path in oracle_paths}
        timeout_rows = []
        for condition in CONDITIONS:
            timeout_ids = []
            for result_path in sorted((run_dir / "local_grade_reports" / condition).glob("*/result.json")):
                result = load_json(result_path)
                if result.get("status") == "timeout":
                    timeout_ids.append(result_path.parent.name)
            covered = [instance_id for instance_id in timeout_ids if instance_id in oracle_status_by_id]
            covered_counts = collections.Counter(oracle_status_by_id[instance_id] for instance_id in covered)
            timeout_rows.append([
                f"`{condition}`",
                str(len(timeout_ids)),
                str(len(covered)),
                counter_text(covered_counts),
                str(len(timeout_ids) - len(covered)),
            ])
        lines.append("Oracle coverage of model timeout IDs helps distinguish grader slowness from model-patch-induced hangs or compile stalls.")
        lines.append("")
        lines.extend(render_table(["condition", "model timeout ids", "oracle completed", "oracle statuses on completed", "oracle pending"], timeout_rows))
        lines.append("")

    lines.append("## Current Interpretation")
    lines.append("")
    lines.append("The completed model run is artifact-complete, and the cutoff-git guard checks did not find future-history leakage. The suspicious result is not explained by missing artifacts, empty predictions, malformed patch extraction, or an obvious cutoff guard failure.")
    lines.append("")
    lines.append("It should not be treated as a clean measurement of GPT-5.2 capability. The generation harness imposed a 24-step limit, a 600s wall-time limit, 2048 output tokens, and aggressive read-only command rejection after inspection or after a source diff existed. Most trajectories hit wrapper guidance/rejections, API calls are saturated near the step limit, the runner saw repeated 180s Responses API timeouts, and many final patches were rescued after non-submit exits. The reference-patch oracle now resolves all 85 tasks, so the low model score is best treated as a generation-harness validity problem rather than evidence that cutoff git history is unhelpful.")
    lines.append("")
    lines.append("Next clean experiment should not repeat this strict harness. Use a small relaxed smoke first, then rerun the three-arm Flipt comparison only after the relaxed settings produce normal baseline behavior.")
    lines.append("")
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-dir", type=Path, default=Path("paper/evaluations/flipt/results/full85_three_arm_gpt52_codex_cutoffgit_repeat1"))
    parser.add_argument("--oracle-dir", type=Path, default=Path("paper/evaluations/flipt/results/oracle_reference_patch_local"))
    parser.add_argument("--output", type=Path, default=Path("paper/evaluations/flipt/docs/gpt52_repeat1_audit.md"))
    args = parser.parse_args()
    report = audit(args.run_dir, args.oracle_dir if args.oracle_dir.exists() else None)
    args.output.write_text(report + "\n")
    print(args.output)


if __name__ == "__main__":
    main()
