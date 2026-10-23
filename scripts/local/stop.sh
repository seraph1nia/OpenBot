#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
# Stop only this deployment's computers, retaining their named volumes.
if [[ ${1:-} == --help || ${1:-} == -h ]]; then
  echo 'Usage: scripts/local/stop.sh [--keep-computers] (preserves all volumes)'
  exit 0
fi
namespace=$(sed -n 's/^COMPOSE_PROJECT_NAME=//p' .env)
mapfile -t computers < <(docker ps -q --filter "label=openbot.namespace=${namespace:-openbot-local}")
if [[ ${1:-} != --keep-computers ]] && ((${#computers[@]})); then docker stop "${computers[@]}"; fi
docker compose stop
