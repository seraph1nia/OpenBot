#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
python3 scripts/local/init.py
python3 scripts/local/connect-intelligence.py
docker compose build server mastra supervisor agent-computer
docker compose up -d --wait
printf 'OpenBot: http://localhost:%s\n' "$(sed -n 's/^APP_PORT=//p' .env)"
