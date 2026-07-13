#!/usr/bin/env bash
set -u

SUPERVISOR_PID="${1:-}"
INTERVAL_SECONDS="${INTERVAL_SECONDS:-120}"

cleanup_once() {
  local active_images
  active_images="$(docker ps --format '{{.Image}}' | sort -u)"
  docker images --format '{{.Repository}}:{{.Tag}}' \
    | rg '^jefzda/sweap-images:flipt' \
    | while read -r image; do
        if printf '%s\n' "$active_images" | rg -qx "$image"; then
          continue
        fi
        docker rmi "$image" >/dev/null 2>&1 || true
      done
}

if [[ -z "$SUPERVISOR_PID" ]]; then
  cleanup_once
  exit 0
fi

while kill -0 "$SUPERVISOR_PID" >/dev/null 2>&1; do
  cleanup_once
  sleep "$INTERVAL_SECONDS"
done

cleanup_once
