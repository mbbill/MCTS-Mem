#!/usr/bin/env python3
"""Run mini-SWE-agent on local Flipt SWE-bench Pro condition datasets.

This wrapper avoids relying on mini-extra's HF subset loader by loading our local
JSONL dataset directly. It reuses mini-SWE-agent's official SWE-bench Docker
environment and prediction writer.
"""
from __future__ import annotations
import argparse, concurrent.futures, json, re, time, os, threading, subprocess, ast, traceback, shlex
import functools
from pathlib import Path
from datasets import load_dataset
from rich.live import Live
from rich.markup import escape

from minisweagent.config import builtin_config_dir, get_config_from_spec
from minisweagent.models import get_model
from minisweagent.run.benchmarks.swebench import (
    filter_instances,
    get_sb_environment,
    remove_from_preds_file,
    update_preds_file,
)
from minisweagent.run.benchmarks.utils.common import ProgressTrackingAgent
from minisweagent.run.benchmarks.utils.batch_progress import RunBatchProgressManager
from minisweagent.utils.log import add_file_handler, logger
from minisweagent.utils.serialize import UNSET, recursive_merge

def _parse_list_field(value):
    if value is None:
        return []
    if isinstance(value, list):
        return value
    if isinstance(value, str):
        try:
            parsed = ast.literal_eval(value)
        except (SyntaxError, ValueError):
            return [value]
        return parsed if isinstance(parsed, list) else [parsed]
    return [value]

def _append_test_context(instances):
    for inst in instances:
        fail_to_pass = _parse_list_field(inst.get('fail_to_pass'))
        selected_files = _parse_list_field(inst.get('selected_test_files_to_run'))
        sections = []
        if fail_to_pass:
            sections.append('Known fail-to-pass tests for local verification:\n' + '\n'.join(f'- {item}' for item in fail_to_pass))
        if selected_files:
            sections.append('Relevant test files:\n' + '\n'.join(f'- {item}' for item in selected_files))
        if not sections:
            continue
        inst['problem_statement'] = (
            inst['problem_statement'].rstrip()
            + '\n\n<local_test_context>\n'
            + '\n\n'.join(sections)
            + '\n\nUse these selectors only for targeted inspection/checks. Do not edit tests.\n'
            + '</local_test_context>'
        )

def _estimate_chars(value):
    if value is None:
        return 0
    if isinstance(value, str):
        return len(value)
    if isinstance(value, list):
        return sum(_estimate_chars(item) for item in value)
    if isinstance(value, dict):
        return sum(_estimate_chars(item) for item in value.values())
    return len(str(value))

def _safe_json(value, **kwargs):
    return escape(json.dumps(value, **kwargs))

def _install_litellm_traffic_logging():
    """Log one line before and after every LiteLLM call.

    The logs intentionally avoid full prompt/response bodies. They are enough to
    tell whether the runner is waiting on the proxy, retrying, or receiving
    malformed/no-tool responses without bloating trajectories.
    """
    import litellm

    traffic_logger = logger.getChild('traffic')
    lock = threading.Lock()
    counter = {'value': 0}

    def next_call_id():
        with lock:
            counter['value'] += 1
            return counter['value']

    def summarize_chat_request(kwargs):
        messages = kwargs.get('messages') or []
        return {
            'model': kwargs.get('model'),
            'messages': len(messages),
            'message_chars': sum(_estimate_chars(msg.get('content')) for msg in messages if isinstance(msg, dict)),
            'tools': len(kwargs.get('tools') or []),
            'max_tokens': kwargs.get('max_tokens'),
            'temperature': kwargs.get('temperature'),
            'stream': kwargs.get('stream', False),
        }

    def summarize_chat_response(response):
        try:
            choice = response.choices[0]
            message = choice.message
            usage = getattr(response, 'usage', None)
            return {
                'finish_reason': getattr(choice, 'finish_reason', None),
                'content_chars': _estimate_chars(getattr(message, 'content', None)),
                'tool_calls': len(getattr(message, 'tool_calls', None) or []),
                'usage': usage.model_dump() if hasattr(usage, 'model_dump') else usage,
            }
        except Exception as exc:
            return {'summary_error': repr(exc), 'response_type': type(response).__name__}

    def summarize_responses_request(kwargs):
        input_value = kwargs.get('input') or []
        return {
            'model': kwargs.get('model'),
            'input_items': len(input_value) if isinstance(input_value, list) else 1,
            'input_chars': _estimate_chars(input_value),
            'tools': len(kwargs.get('tools') or []),
            'max_output_tokens': kwargs.get('max_output_tokens'),
            'temperature': kwargs.get('temperature'),
            'stream': kwargs.get('stream', False),
        }

    def summarize_responses_response(response):
        try:
            output = getattr(response, 'output', []) or []
            usage = getattr(response, 'usage', None)
            return {
                'status': getattr(response, 'status', None),
                'output_items': len(output),
                'output_chars': _estimate_chars(output),
                'usage': usage.model_dump() if hasattr(usage, 'model_dump') else usage,
            }
        except Exception as exc:
            return {'summary_error': repr(exc), 'response_type': type(response).__name__}

    original_completion = litellm.completion
    original_responses = getattr(litellm, 'responses', None)

    def logged_completion(*args, **kwargs):
        call_id = next_call_id()
        started = time.time()
        traffic_logger.info('litellm.completion start call=%s %s', call_id, _safe_json(summarize_chat_request(kwargs), sort_keys=True))
        try:
            response = original_completion(*args, **kwargs)
        except Exception as exc:
            traffic_logger.exception('litellm.completion error call=%s elapsed=%.3fs error=%r', call_id, time.time() - started, exc)
            raise
        traffic_logger.info(
            'litellm.completion end call=%s elapsed=%.3fs %s',
            call_id,
            time.time() - started,
            _safe_json(summarize_chat_response(response), default=str, sort_keys=True),
        )
        return response

    litellm.completion = logged_completion

    if original_responses is not None:
        def logged_responses(*args, **kwargs):
            call_id = next_call_id()
            started = time.time()
            traffic_logger.info('litellm.responses start call=%s %s', call_id, _safe_json(summarize_responses_request(kwargs), sort_keys=True))
            try:
                response = original_responses(*args, **kwargs)
            except Exception as exc:
                traffic_logger.exception('litellm.responses error call=%s elapsed=%.3fs error=%r', call_id, time.time() - started, exc)
                raise
            traffic_logger.info(
                'litellm.responses end call=%s elapsed=%.3fs %s',
                call_id,
                time.time() - started,
                _safe_json(summarize_responses_response(response), default=str, sort_keys=True),
            )
            return response

        litellm.responses = logged_responses

def _preview_text(value, limit=1200):
    value = value or ''
    value = str(value)
    if len(value) <= limit:
        return value
    head = value[: limit // 2]
    tail = value[-limit // 2 :]
    return f'{head}\n... <{len(value) - limit} chars elided> ...\n{tail}'

def _install_environment_action_logging():
    """Log concise bash actions/results for stalled-agent diagnosis."""
    from minisweagent.environments.docker import DockerEnvironment

    if getattr(DockerEnvironment.execute, '_mcts_mem_logged', False):
        return

    action_logger = logger.getChild('actions')
    original_execute = DockerEnvironment.execute

    def tracked_diff_names(env):
        if not getattr(env, 'container_id', None):
            return []
        cmd = [
            env.config.executable,
            'exec',
            '-w',
            env.config.cwd,
            env.container_id,
            'git',
            'diff',
            '--name-only',
            '--',
        ]
        try:
            result = subprocess.run(
                cmd,
                text=True,
                timeout=5,
                encoding='utf-8',
                errors='replace',
                stdout=subprocess.PIPE,
                stderr=subprocess.DEVNULL,
            )
        except Exception:
            return []
        if result.returncode != 0:
            return []
        return [line for line in result.stdout.splitlines() if line.strip()]

    no_diff_warn_actions = int(os.environ.get('MSWEA_NO_DIFF_WARN_ACTIONS', '12'))
    no_diff_reject_actions = int(os.environ.get('MSWEA_NO_DIFF_REJECT_ACTIONS', str(no_diff_warn_actions + 1)))
    after_diff_warn_actions = int(os.environ.get('MSWEA_AFTER_DIFF_WARN_ACTIONS', '3'))
    after_diff_reject_actions = int(os.environ.get('MSWEA_AFTER_DIFF_REJECT_ACTIONS', '5'))
    allow_git_history = os.environ.get('MCTS_MEM_ALLOW_GIT_HISTORY', '').strip().lower() in {'1', 'true', 'yes', 'on'}

    def looks_mutating(command):
        command = command.strip()
        mutating_patterns = [
            r'\bgit\s+apply\b',
            r'\bpatch\b',
            r'\bsed\s+-i\b',
            r'\bperl\s+-pi\b',
            r'\bmv\b',
            r'\bcp\b',
            r'\brm\b',
            r'\btouch\b',
            r'\btee\b',
            r'cat\s+>+',
            r'echo\b.*>+',
            r'\.write_text\s*\(',
            r'\.write_bytes\s*\(',
            r'open\s*\([^\n]*(?:["\']w|["\']a|mode\s*=\s*["\'][wa])',
        ]
        return any(re.search(pattern, command, flags=re.S) for pattern in mutating_patterns)

    history_subcommands = {
        'log',
        'show',
        'rev-list',
        'blame',
        'cat-file',
        'ls-tree',
        'for-each-ref',
        'reflog',
        'shortlog',
        'whatchanged',
        'bisect',
        'merge-base',
        'name-rev',
        'describe',
        'branch',
        'tag',
        'fsck',
    }

    def iter_git_invocations(command):
        for segment in re.split(r'[;&|]\s*|\n', command):
            segment = segment.strip()
            if not segment:
                continue
            try:
                words = shlex.split(segment)
            except ValueError:
                words = segment.split()
            for index, word in enumerate(words):
                if word != 'git' and not word.endswith('/git'):
                    continue
                arg_index = index + 1
                while arg_index < len(words):
                    arg = words[arg_index]
                    if arg in {'-C', '-c', '--git-dir', '--work-tree', '--namespace'}:
                        arg_index += 2
                        continue
                    if arg.startswith('--git-dir=') or arg.startswith('--work-tree=') or arg.startswith('--namespace='):
                        arg_index += 1
                        continue
                    if arg.startswith('-'):
                        arg_index += 1
                        continue
                    yield arg, words[arg_index + 1 :], segment
                    break

    def git_grep_uses_revision(args):
        revision_markers = re.compile(r'^(?:[0-9a-f]{7,40}|HEAD(?:[~^].*)?|refs/.*|origin/.*|main|master)$')
        for arg in args:
            if arg == '--all' or arg.startswith('--recurse-submodules'):
                return True
            if '$(git' in arg or '`git' in arg:
                return True
            if revision_markers.match(arg):
                return True
            if re.match(r'^(?:[0-9a-f]{7,40}|HEAD(?:[~^].*)?|refs/[^:]+|origin/[^:]+):', arg):
                return True
        return False

    def looks_disallowed_search(command):
        command = command.strip()
        lower = command.lower()
        if re.search(r'(?:\$\(|`)\s*git\s+rev-list\b', lower):
            return True
        if re.search(r'\bgit\b[^\n;&|`]{0,160}\b(?:log|show|rev-list|blame|cat-file|ls-tree|for-each-ref|reflog|shortlog|whatchanged|merge-base|name-rev|describe)\b', lower):
            return True
        for subcommand, args, _segment in iter_git_invocations(command):
            if subcommand in history_subcommands:
                return True
            if subcommand == 'grep' and git_grep_uses_revision(args):
                return True
            if subcommand == 'checkout' and '--' not in args:
                return True
            if subcommand == 'switch':
                return True
            if subcommand == 'restore' and any(arg == '-s' or arg == '--source' or arg.startswith('--source=') for arg in args):
                return True
        return False

    def looks_post_diff_allowed(command):
        command = command.strip()
        allowed_patterns = [
            r'COMPLETE_TASK_AND_SUBMIT_FINAL_OUTPUT',
            r'\bgit\s+(diff|status)\b',
            r'\bpython3?\s+-m\s+pytest\b',
            r'\bpython3?\s+-m\s+py_compile\b',
            r'(^|[;&|]\s*)pytest\b',
            r'\btox\b',
            r'patch\.txt',
        ]
        return any(re.search(pattern, command, flags=re.S) for pattern in allowed_patterns)

    def disallowed_search_rejection():
        return {
            'output': (
                '<BENCHMARK_GUIDANCE>\n'
                'Search command rejected by the benchmark wrapper. Use a targeted file read '
                'or a short script for inspection instead.\n'
                '</BENCHMARK_GUIDANCE>\n'
            ),
            'returncode': 2,
            'exception_info': '',
        }

    def no_diff_read_only_rejection(action_count):
        return {
            'output': (
                '<BENCHMARK_GUIDANCE>\n'
                f'Read-only command rejected after {action_count} no-diff actions. '
                'Your next command must edit a tracked source file using the files already identified. '
                'Use a small Python pathlib script with `Path.write_text(...)` or `sed -i`; '
                'then run one targeted check and submit `git diff`.\n'
                '</BENCHMARK_GUIDANCE>\n'
            ),
            'returncode': 2,
            'exception_info': '',
        }

    def after_diff_read_only_rejection(after_diff_count):
        return {
            'output': (
                '<BENCHMARK_GUIDANCE>\n'
                f'Read-only command rejected after {after_diff_count} commands with a tracked source diff. '
                'Do not keep inspecting broadly after a patch exists. Run one targeted test/check, '
                'inspect `git diff`, write `patch.txt`, then submit with COMPLETE_TASK_AND_SUBMIT_FINAL_OUTPUT.\n'
                '</BENCHMARK_GUIDANCE>\n'
            ),
            'returncode': 2,
            'exception_info': '',
        }

    def append_runtime_guidance(env, action_count, after_diff_count, command, output):
        guidance = []
        command_text = command.strip()
        output_text = output.get('output') or ''
        if action_count >= no_diff_warn_actions and not tracked_diff_names(env):
            guidance.append(
                f'You have used {action_count} bash commands without a tracked source diff. Stop broad searching; '
                'use the relevant files already identified, make the smallest source edit in the next command, '
                'then run one targeted check and submit `git diff`.'
            )
        if after_diff_count >= after_diff_warn_actions and tracked_diff_names(env) and not looks_post_diff_allowed(command_text):
            guidance.append(
                f'A tracked source diff has existed for {after_diff_count} commands. Stop expanding investigation; '
                'run one targeted check if needed, inspect `git diff`, write `patch.txt`, and submit.'
            )
        if guidance:
            output['output'] = output_text + '\n\n<BENCHMARK_GUIDANCE>\n' + '\n'.join(guidance) + '\n</BENCHMARK_GUIDANCE>\n'
        return output

    @functools.wraps(original_execute)
    def logged_execute(self, action, cwd='', *, timeout=None):
        command = action.get('command', '') if isinstance(action, dict) else str(action)
        action_count = getattr(self, '_mcts_mem_action_count', 0) + 1
        self._mcts_mem_action_count = action_count
        started = time.time()
        diff_names_before = tracked_diff_names(self)
        after_diff_count = getattr(self, '_mcts_mem_after_diff_action_count', 0)
        if diff_names_before:
            after_diff_count += 1
            self._mcts_mem_after_diff_action_count = after_diff_count
        action_logger.info(
            'docker.execute start action=%s container=%s cwd=%s timeout=%s command=%s',
            action_count,
            getattr(self, 'container_id', ''),
            cwd or getattr(self.config, 'cwd', ''),
            timeout or getattr(self.config, 'timeout', ''),
            _safe_json(_preview_text(command, 1200)),
        )
        if not allow_git_history and looks_disallowed_search(command):
            output = disallowed_search_rejection()
        elif action_count >= no_diff_reject_actions and not diff_names_before and not looks_mutating(command):
            output = no_diff_read_only_rejection(action_count)
        elif (
            diff_names_before
            and after_diff_count >= after_diff_reject_actions
            and not looks_mutating(command)
            and not looks_post_diff_allowed(command)
        ):
            output = after_diff_read_only_rejection(after_diff_count)
        else:
            output = original_execute(self, action, cwd=cwd, timeout=timeout)
        output = append_runtime_guidance(self, action_count, after_diff_count, command, output)
        action_logger.info(
            'docker.execute end action=%s container=%s elapsed=%.3fs returncode=%s output_chars=%s exception=%s output=%s',
            action_count,
            getattr(self, 'container_id', ''),
            time.time() - started,
            output.get('returncode'),
            len(output.get('output') or ''),
            _safe_json(output.get('exception_info') or ''),
            _safe_json(_preview_text(output.get('output'), 1600)),
        )
        return output

    logged_execute._mcts_mem_logged = True
    DockerEnvironment.execute = logged_execute

def _diff_submission_from_agent(agent, instance_id):
    """Recover a usable patch when the agent timed out after editing files."""
    env = getattr(agent, 'env', None)
    if env is None:
        return ''
    try:
        output = env.execute({'command': 'git diff -- .'}, timeout=30)
    except Exception as exc:
        logger.warning('Could not rescue diff for %s: %r', escape(instance_id), exc)
        return ''
    if output.get('returncode') != 0:
        logger.warning(
            'Could not rescue diff for %s: git diff returned %s',
            escape(instance_id),
            output.get('returncode'),
        )
        return ''
    diff = output.get('output') or ''
    if not diff.strip():
        return ''
    logger.warning('Rescued non-empty git diff for %s after non-submit exit', escape(instance_id))
    return diff

def _git_history_sanitizer_enabled():
    value = os.environ.get('MCTS_MEM_SANITIZE_GIT_HISTORY', '1').strip().lower()
    return value not in {'0', 'false', 'no', 'off'}

def _sanitize_environment_git_history(env, instance_id):
    """Replace the benchmark checkout's git history with one base commit.

    This preserves normal patch mechanics (`git diff`, `git status`,
    `git checkout -- path`) while preventing the agent from discovering raw
    repository history through the live shell. Raw git history, when tested, is
    supplied only through the cutoff-filtered C1 prompt context.
    """
    if not _git_history_sanitizer_enabled():
        logger.warning('Git history sanitizer disabled for %s', escape(instance_id))
        return
    container_id = getattr(env, 'container_id', None)
    if not container_id:
        raise RuntimeError(f'No container id available for git history sanitizer on {instance_id}')
    executable = getattr(env.config, 'executable', 'docker')
    cwd = getattr(env.config, 'cwd', '/app')
    script = r'''
set -eu
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "not a git work tree"
  exit 0
fi
original_head="$(git rev-parse HEAD)"
git reset --hard >/dev/null
git clean -fd >/dev/null
rm -rf .git
git init -q
git config user.email "benchmark@example.invalid"
git config user.name "Benchmark Harness"
git add -A
if git diff --cached --quiet --exit-code; then
  git commit --allow-empty -q -m "benchmark base"
else
  git commit -q -m "benchmark base"
fi
git checkout -q -B benchmark-base
printf "%s\n" "$original_head" > .git/mcts-mem-original-head
printf "sanitized original=%s visible_commits=%s\n" "$original_head" "$(git rev-list --all --count)"
'''
    result = subprocess.run(
        [executable, 'exec', '-w', cwd, container_id, 'bash', '-lc', script],
        text=True,
        encoding='utf-8',
        errors='replace',
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=180,
    )
    if result.returncode != 0:
        raise RuntimeError(
            f'Git history sanitizer failed for {instance_id} with {result.returncode}: '
            f'stdout={result.stdout[-2000:]!r} stderr={result.stderr[-2000:]!r}'
        )
    logger.info('Git history sanitized for %s: %s', escape(instance_id), escape(result.stdout.strip()))

def _run_docker_exec(env, script, *, timeout=180):
    container_id = getattr(env, 'container_id', None)
    if not container_id:
        raise RuntimeError('No container id available')
    executable = getattr(env.config, 'executable', 'docker')
    cwd = getattr(env.config, 'cwd', '/app')
    return subprocess.run(
        [executable, 'exec', '-w', cwd, container_id, 'bash', '-lc', script],
        text=True,
        encoding='utf-8',
        errors='replace',
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=timeout,
    )

def _create_cutoff_bundle(repo: Path, base_commit: str, bundle_dir: Path) -> tuple[Path, str]:
    bundle_dir.mkdir(parents=True, exist_ok=True)
    safe_base = re.sub(r'[^0-9a-fA-F]', '', base_commit)[:12]
    unique = f'{safe_base}-{os.getpid()}-{threading.get_ident()}-{int(time.time() * 1000)}'
    ref = f'refs/mcts-mem-cutoffs/{unique}'
    bundle = bundle_dir / f'{unique}.bundle'
    try:
        subprocess.run(['git', '-C', str(repo), 'cat-file', '-e', f'{base_commit}^{{commit}}'], check=True, timeout=30)
        subprocess.run(['git', '-C', str(repo), 'update-ref', ref, base_commit], check=True, timeout=30)
        subprocess.run(['git', '-C', str(repo), 'bundle', 'create', str(bundle), ref], check=True, timeout=240)
    finally:
        subprocess.run(['git', '-C', str(repo), 'update-ref', '-d', ref], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return bundle, ref

def _install_cutoff_git_history(env, instance, repo: Path, bundle_dir: Path):
    """Replace the container .git with ancestors of this task's base_commit.

    This is the raw-git baseline: the agent may freely explore git history, but
    the object database and refs are reconstructed from a bundle containing only
    commits reachable from the task base commit.
    """
    instance_id = instance['instance_id']
    base_commit = instance['base_commit']
    container_id = getattr(env, 'container_id', None)
    if not container_id:
        raise RuntimeError(f'No container id available for cutoff git setup on {instance_id}')
    executable = getattr(env.config, 'executable', 'docker')
    bundle, bundle_ref = _create_cutoff_bundle(repo, base_commit, bundle_dir)
    container_bundle = '/tmp/mcts-mem-cutoff.bundle'
    try:
        subprocess.run([executable, 'cp', str(bundle), f'{container_id}:{container_bundle}'], check=True, timeout=180)
        script = f'''
set -eu
base={shlex.quote(base_commit)}
bundle_ref={shlex.quote(bundle_ref)}
git reset --hard "$base" >/dev/null
git clean -fd >/dev/null
rm -rf .git
git init -q
git config user.email "benchmark@example.invalid"
git config user.name "Benchmark Harness"
git fetch -q {shlex.quote(container_bundle)} "$bundle_ref:refs/heads/benchmark-base"
git checkout -q -f benchmark-base
future_count="$(git rev-list --all --not "$base" --count)"
if [ "$future_count" != "0" ]; then
  echo "future commits visible: $future_count" >&2
  exit 3
fi
printf "%s\n" "$base" > .git/mcts-mem-base-commit
printf "cutoff base=%s visible_commits=%s future_commits=%s\n" "$base" "$(git rev-list --all --count)" "$future_count"
'''
        result = _run_docker_exec(env, script, timeout=300)
        if result.returncode != 0:
            raise RuntimeError(
                f'Cutoff git setup failed for {instance_id} with {result.returncode}: '
                f'stdout={result.stdout[-2000:]!r} stderr={result.stderr[-2000:]!r}'
            )
        logger.info('Cutoff git history installed for %s: %s', escape(instance_id), escape(result.stdout.strip()))
    finally:
        bundle.unlink(missing_ok=True)

def process_instance(instance, output_dir, config, progress_manager, git_history_mode, git_repo, bundle_dir):
    """Run one instance, rescuing a non-empty diff from timeout/exception exits."""
    instance_id = instance['instance_id']
    instance_dir = output_dir / instance_id
    remove_from_preds_file(output_dir / 'preds.json', instance_id)
    (instance_dir / f'{instance_id}.traj.json').unlink(missing_ok=True)
    model = get_model(config=config.get('model', {}))
    task = instance['problem_statement']

    progress_manager.on_instance_start(instance_id)
    progress_manager.update_instance_status(instance_id, 'Pulling/starting environment')

    agent = None
    exit_status = None
    result = ''
    extra_info = {}

    try:
        env = get_sb_environment(config, instance)
        if git_history_mode == 'snapshot':
            _sanitize_environment_git_history(env, instance_id)
        elif git_history_mode == 'cutoff':
            _install_cutoff_git_history(env, instance, git_repo, bundle_dir)
        elif git_history_mode != 'none':
            raise RuntimeError(f'Unknown git history mode: {git_history_mode}')
        agent = ProgressTrackingAgent(
            model,
            env,
            progress_manager=progress_manager,
            instance_id=instance_id,
            **config.get('agent', {}),
        )
        info = agent.run(task)
        exit_status = info.get('exit_status')
        result = info.get('submission') or ''
        if not result and exit_status and exit_status != 'Submitted':
            result = _diff_submission_from_agent(agent, instance_id)
            if result:
                extra_info['rescued_submission_from_diff'] = True
    except Exception as e:
        logger.error('Error processing instance %s: %s', escape(instance_id), escape(str(e)), exc_info=True)
        exit_status = type(e).__name__
        result = _diff_submission_from_agent(agent, instance_id) if agent is not None else ''
        extra_info = {
            'traceback': traceback.format_exc(),
            'exception_str': str(e),
            'rescued_submission_from_diff': bool(result),
        }
    finally:
        if agent is not None:
            traj_path = instance_dir / f'{instance_id}.traj.json'
            agent.save(
                traj_path,
                {
                    'info': {
                        'exit_status': exit_status,
                        'submission': result,
                        **extra_info,
                    },
                    'instance_id': instance_id,
                },
            )
            logger.info("Saved trajectory to '%s'", traj_path)
        update_preds_file(output_dir / 'preds.json', instance_id, model.config.model_name, result)
        progress_manager.on_instance_end(instance_id, exit_status)

def main():
    os.environ.setdefault("MSWEA_CONFIGURED", "1")
    os.environ.setdefault("MSWEA_COST_TRACKING", "ignore_errors")
    ap=argparse.ArgumentParser()
    ap.add_argument('--condition', required=True)
    ap.add_argument('--model', required=True)
    ap.add_argument('--output', required=True)
    ap.add_argument('--ids-file', default='')
    ap.add_argument('--slice', default='')
    ap.add_argument('--filter', default='')
    ap.add_argument('--workers', type=int, default=1)
    ap.add_argument('--config', action='append', default=[])
    ap.add_argument('--model-class', default=None)
    ap.add_argument('--environment-class', default='docker')
    ap.add_argument('--redo-existing', action='store_true')
    ap.add_argument('--include-test-context', action='store_true')
    ap.add_argument('--git-history-mode', choices=['snapshot', 'cutoff', 'none'], default='snapshot')
    ap.add_argument('--git-repo', type=Path, default=Path(__file__).resolve().parents[3] / 'repos' / 'flipt')
    ap.add_argument('--bundle-dir', type=Path, default=Path(__file__).resolve().parents[1] / 'tmp' / 'cutoff_bundles')
    ap.add_argument('--dry-run', action='store_true')
    args=ap.parse_args()

    base=Path(__file__).resolve().parents[1]
    data_file=base/'datasets'/f'{args.condition}.jsonl'
    if not data_file.exists():
        raise SystemExit(f'No dataset for condition {args.condition!r}: {data_file}')
    output_path=Path(args.output)
    output_path.mkdir(parents=True, exist_ok=True)
    instances=list(load_dataset('json', data_files=str(data_file), split='train'))
    instances=[dict(x) for x in instances]
    if args.ids_file:
        wanted={l.strip() for l in Path(args.ids_file).read_text().splitlines() if l.strip()}
        instances=[x for x in instances if x['instance_id'] in wanted]
    if args.filter or args.slice:
        instances=filter_instances(instances, filter_spec=args.filter or '.*', slice_spec=args.slice)
    if args.include_test_context:
        _append_test_context(instances)
    if not args.redo_existing and (output_path/'preds.json').exists():
        existing=set(json.loads((output_path/'preds.json').read_text()).keys())
        instances=[x for x in instances if x['instance_id'] not in existing]
    if args.dry_run:
        print(json.dumps({'condition':args.condition,'model':args.model,'instances':len(instances),'first_ids':[x['instance_id'] for x in instances[:10]]}, indent=2))
        return

    add_file_handler(output_path/'minisweagent.log')
    _install_litellm_traffic_logging()
    if args.git_history_mode == 'cutoff':
        os.environ['MCTS_MEM_ALLOW_GIT_HISTORY'] = '1'
    _install_environment_action_logging()
    config_specs=[str(builtin_config_dir/'benchmarks'/'swebench.yaml')]+args.config
    configs=[get_config_from_spec(spec) for spec in config_specs]
    configs.append({'environment': {'environment_class': args.environment_class or UNSET, 'run_args': ['--rm', '--platform', 'linux/amd64', '--entrypoint', '']}, 'model': {'model_name': args.model, 'model_class': args.model_class or UNSET}})
    config=recursive_merge(*configs)
    progress=RunBatchProgressManager(len(instances), output_path / f'exit_statuses_{time.time()}.yaml')
    logger.info(f'Running {len(instances)} instances for {args.condition} -> {output_path}')
    with Live(progress.render_group, refresh_per_second=4):
        with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as executor:
            futures={executor.submit(process_instance, inst, output_path, config, progress, args.git_history_mode, args.git_repo.resolve(), args.bundle_dir.resolve()): inst['instance_id'] for inst in instances}
            for fut in concurrent.futures.as_completed(futures):
                try:
                    fut.result()
                except Exception as e:
                    logger.exception('Error in future for %s: %s', escape(futures[fut]), escape(repr(e)))
                    progress.on_uncaught_exception(futures[fut], e)

if __name__=='__main__':
    main()
