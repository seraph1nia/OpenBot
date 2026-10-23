#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
bun install --frozen-lockfile
npm ci --prefix agent-mastra --no-audit --no-fund
bun test tests/compose.test.ts agent-mastra/src/subscription.test.ts agent-mastra/src/mastra/index.test.ts \
  server/tests/copilot.test.ts server/tests/memory.test.ts server/tests/memory-runtime.test.ts \
  server/tests/intelligence-networking.test.ts server/tests/mastra-roster.test.ts \
  server/tests/learning-mastra.test.ts
bun run typecheck
bunx tsc -p agent-mastra/tsconfig.json
# Optional real PostgreSQL ownership/provenance/review/deletion regressions.
if [[ ${1:-} == --database ]]; then
  docker compose exec -T postgres sh -c 'psql -U openbot -tAc "SELECT 1 FROM pg_database WHERE datname='"'"'openbot_test'"'"'" | tr -d " " | grep -q 1 || createdb -U openbot openbot_test'
  docker compose run --rm --no-deps migrate sh -c 'export DATABASE_URL="${DATABASE_URL%/openbot}/openbot_test"; exec bun scripts/migrate.ts'
  docker compose run --rm --no-deps --workdir /tmp migrate sh -c 'export TEST_DATABASE_URL="${DATABASE_URL%/openbot}/openbot_test"; exec bun test --preload /app/server/scripts/test-preload.ts /app/server/tests/memory-store.integration.test.ts /app/server/tests/memory-intelligence.integration.test.ts /app/server/tests/runtime-agents.integration.test.ts /app/server/tests/tenant-package.test.ts'
fi
