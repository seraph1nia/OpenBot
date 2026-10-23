#!/usr/bin/env python3
"""Create local configuration once; retain all existing values and secrets."""
import base64
import os
from pathlib import Path
import secrets

os.chdir(Path(__file__).resolve().parents[2])
os.umask(0o077)
p = Path('.env')
if not p.exists():
    p.write_text(Path('.env.example').read_text())
text = p.read_text()
for name in ('POSTGRES_PASSWORD', 'KEY_ENCRYPTION_KEY', 'COMPUTER_TOKEN', 'SUPERVISOR_TOKEN',
             'MANAGED_AGENT_TOKEN', 'AGENT_TOOL_TOKEN', 'WORKER_SHARED_SECRET'):
    lines = text.splitlines()
    existing = next((line.split('=', 1)[1].strip() for line in lines if line.startswith(name + '=')), '')
    if existing:
        continue
    value = base64.b64encode(secrets.token_bytes(32)).decode() if name == 'KEY_ENCRYPTION_KEY' else secrets.token_hex(32)
    lines = [line for line in lines if not line.startswith(name + '=')]
    text = '\n'.join(lines) + '\n' + name + '=' + value + '\n'
p.write_text(text)
p.chmod(0o600)
print('Private .env initialized; existing secrets preserved. Next: scripts/local/bootstrap-intelligence.sh')
