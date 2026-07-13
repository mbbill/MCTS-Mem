#!/usr/bin/env bash
set -euo pipefail

# Create a paper-local Python environment for mini-SWE-agent runs.
# If package downloads need a proxy, export HTTPS_PROXY/HTTP_PROXY/ALL_PROXY first.

cd "$(git rev-parse --show-toplevel)"
VENV="paper/evaluations/flipt/.venv-mcts-eval"

if command -v uv >/dev/null 2>&1; then
  uv venv "$VENV" --python 3.11
else
  python3.11 -m venv "$VENV"
fi

source "$VENV/bin/activate"
python -m ensurepip --upgrade || true
python -m pip install --upgrade pip setuptools wheel --trusted-host pypi.org --trusted-host files.pythonhosted.org
python -m pip install swebench litellm datasets tiktoken --trusted-host pypi.org --trusted-host files.pythonhosted.org
python -m pip install 'git+https://github.com/SWE-agent/mini-swe-agent.git' --trusted-host pypi.org --trusted-host files.pythonhosted.org
python - <<'PY'
import importlib.util
for mod in ['swebench', 'datasets', 'tiktoken', 'litellm', 'minisweagent']:
    print(mod, 'OK' if importlib.util.find_spec(mod) else 'MISSING')
PY
