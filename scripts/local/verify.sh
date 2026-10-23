#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
docker compose ps
# Execute inside the ONE runtime so verification and refresh share its AuthStorage.
docker compose exec -T mastra node -e '
if(process.env.OPENAI_API_KEY)throw new Error("Unexpected Platform API key in subscription runtime");
const headers={"x-openbot-agent-token":process.env.MANAGED_AGENT_TOKEN};
const r=await fetch("http://localhost:4213/ready",{headers});
console.log("Authenticated readiness:",await r.json());
if(!r.ok)process.exit(1);
const v=await fetch("http://localhost:4213/verify",{method:"POST",headers,signal:AbortSignal.timeout(120000)});
console.log("Real streamed subscription inference:",await v.json());
if(!v.ok)process.exit(1);
'
python3 scripts/local/smoke.py
