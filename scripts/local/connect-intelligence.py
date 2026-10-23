#!/usr/bin/env python3
"""Map CLI credentials and bridge its loopback-only stack through Docker DNS.

Attach only the official container publishing each selected port to an isolated
Intelligence network. No host port rebinding, socket in API, or fabricated image.
"""
import json
import os
from pathlib import Path
import subprocess
from urllib.parse import urlsplit, urlunsplit

os.chdir(Path(__file__).resolve().parents[2])
os.umask(0o077)
p = Path('.env')
lines = p.read_text().splitlines()
values = {}
for line in lines:
    if line and not line.startswith('#') and '=' in line:
        k, v = line.split('=', 1)
        values[k] = v.strip().strip('"').strip("'")

def run(*args):
    return subprocess.check_output(args, text=True).strip()

def put(k, v):
    global lines
    lines = [line for line in lines if not line.startswith(k + '=')]
    lines.append(k + '=' + v)

key = values.get('CPK_INTELLIGENCE_API_KEY')
if not key:
    raise SystemExit('Run official local connect --approve-connection first.')
old = values.get('INTELLIGENCE_API_KEY')
if old and old != key:
    raise SystemExit('INTELLIGENCE_API_KEY differs from CLI key. Clear the old value explicitly to select this local project.')
put('INTELLIGENCE_API_KEY', key)
project = values.get('COMPOSE_PROJECT_NAME', 'openbot-local')
network = project + '_intelligence'
networks = run('docker', 'network', 'ls', '--format', '{{.Name}}').splitlines()
if network not in networks:
    run('docker', 'network', 'create', '--label', f'com.docker.compose.project={project}',
        '--label', 'com.docker.compose.network=intelligence', network)
ids = run('docker', 'ps', '-q').splitlines()
containers = json.loads(run('docker', 'inspect', *ids)) if ids else []
listeners = {}
for source, target, alias in (
    ('INTELLIGENCE_API_URL', 'INTELLIGENCE_CONTAINER_API_URL', 'intelligence-api'),
    ('INTELLIGENCE_GATEWAY_WS_URL', 'INTELLIGENCE_CONTAINER_WS_URL', 'intelligence-gateway'),
):
    url = urlsplit(values.get(source, ''))
    if url.hostname not in ('localhost', '127.0.0.1', '::1'):
        raise SystemExit(f'{source} must be the official local loopback endpoint; no cloud switch is allowed.')
    host_port = url.port or (443 if url.scheme in ('https', 'wss') else 80)
    matches = [(c, port.split('/')[0]) for c in containers
               for port, bindings in (c['NetworkSettings'].get('Ports') or {}).items()
               if any(b['HostPort'] == str(host_port) for b in bindings or [])]
    if len(matches) != 1:
        raise SystemExit(f'Cannot uniquely locate official Docker listener for {source} port {host_port}. Run local status.')
    c, port = matches[0]
    listener = listeners.setdefault(c['Id'], {'container': c, 'aliases': []})
    listener['aliases'].append(alias)
    put(target, urlunsplit((url.scheme, f'{alias}:{port}', url.path, url.query, '')))
for identifier, listener in listeners.items():
    attachment = listener['container']['NetworkSettings']['Networks'].get(network)
    if not attachment:
        aliases = [argument for alias in listener['aliases'] for argument in ('--alias', alias)]
        run('docker', 'network', 'connect', *aliases, network, identifier)
    elif any(alias not in (attachment.get('Aliases') or []) for alias in listener['aliases']):
        raise SystemExit(f'{network} attachment lacks expected aliases; disconnect this official listener and rerun this script.')
# Atomic replace in a writable directory, preserving private permissions.
tmp = p.with_name('.env.local-tmp')
tmp.write_text('\n'.join(lines) + '\n')
tmp.chmod(0o600)
tmp.replace(p)
print('Mapped runtime key and official local Intelligence Docker endpoints; no credentials printed.')
