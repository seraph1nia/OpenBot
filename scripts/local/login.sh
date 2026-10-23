#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
python3 scripts/local/init.py
docker compose build mastra
# Login is the only second writer. Stop the runtime; flock also enforces exclusion.
docker compose stop mastra
trap 'docker compose up -d --no-deps mastra' EXIT
docker compose --profile setup run --rm mastra-auth
