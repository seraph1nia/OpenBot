#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
python3 scripts/local/init.py
# Sign-in and accept-terms must be performed by the operator in their own terminal.
# No automatic agreement acceptance, managed hosting, or paid analysis model.
npx --yes copilotkit@4.30.0 local setup --defer-model --no-samples --json
npx --yes copilotkit@4.30.0 local connect --approve-connection --json >/dev/null
python3 scripts/local/connect-intelligence.py
# The official CLI uses the local installer service token for the connected project.
# This is an operator action; the OpenBot runtime key cannot create Learning containers.
if ! npx --yes copilotkit@4.30.0 learning containers get openbot --json >/dev/null; then
  npx --yes copilotkit@4.30.0 learning containers create --id openbot --name OpenBot \
    --prompt-context 'Learn reusable guidance from completed OpenBot workflows; require review before publication.' --json
fi
