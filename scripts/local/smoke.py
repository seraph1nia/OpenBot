#!/usr/bin/env python3
"""Infrastructure and governed browser check; --journey also spends subscription allowance.

The journey uses new threads for save, recall, forget, and absence. It restarts
Compose services and checks durable history instead of trusting old prompt context.
"""
import argparse
import json
import os
from pathlib import Path
import subprocess
import time
import urllib.request
import uuid

os.chdir(Path(__file__).resolve().parents[2])
config = dict(line.split('=', 1) for line in Path('.env').read_text().splitlines()
              if line and not line.startswith('#') and '=' in line)
base = 'http://localhost:' + config.get('APP_PORT', '3010')
bot = 'general-assistant'

def api(path, body=None, method=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(base + path, data=data, method=method,
                                 headers={'Content-Type': 'application/json', 'Origin': base})
    with urllib.request.urlopen(req, timeout=180) as response:
        return json.load(response)

def history(thread):
    return api(f'/api/copilotkit/threads/{thread}/messages?agentId={bot}')['messages']

def turn(prompt):
    channel = api('/api/channels', {'agentIds': [bot]})['channel']
    thread = channel['threadId']
    run = str(uuid.uuid4())
    api(f'/api/copilotkit/agent/{bot}/run', {
        'threadId': thread, 'runId': run,
        'messages': [{'id': str(uuid.uuid4()), 'role': 'user', 'content': prompt}],
        'state': {}, 'tools': [], 'context': [], 'forwardedProps': {},
    })
    deadline = time.monotonic() + 180
    while time.monotonic() < deadline:
        payload = api(f'/api/copilotkit/threads/{thread}/events?agentId={bot}')
        events = payload.get('events', [])
        # The store may envelope events; normalize its event field.
        events = [event.get('event', event) for event in events]
        errors = [event for event in events if event.get('type') == 'RUN_ERROR']
        if errors:
            raise AssertionError('Agent run failed; inspect server diagnostics (no API fallback).')
        if any(event.get('type') == 'RUN_FINISHED' for event in events):
            messages = history(thread)
            text = ' '.join(str(message.get('content', '')) for message in messages if message.get('role') == 'assistant')
            return thread, text, events
        time.sleep(1)
    raise AssertionError('Agent did not finish in 180 seconds; check subscription readiness/approvals.')

def called(events, name):
    return any(event.get('type') == 'TOOL_CALL_START' and event.get('toolCallName') == name for event in events)

parser = argparse.ArgumentParser()
parser.add_argument('--journey', action='store_true', help='spend subscription allowance and restart application containers')
args = parser.parse_args()
assert api('/api/capabilities')['mode'] == 'intelligence'
info = api('/api/copilotkit/info')
assert bot in info['agents'], 'Default Mastra Bot is absent'
assert 'localhost' in info['intelligence']['wsUrl'], 'Browser received a Docker-only gateway hostname'
page = api(f'/api/computers/{bot}/navigate', {'url': 'https://example.com'})
assert page['title'] == 'Example Domain', page
trail = api('/api/admin/audit-events?limit=25')['events']
assert any(event['eventType'].startswith('computer.') for event in trail)
print('PASS: UI/API runtime, registered Bot, browser WebSocket URL, governed navigation and audit record')
if not args.journey:
    print('Subscription and memory journey not requested; run with --journey after login.')
    raise SystemExit(0)

nonce = 'violet-' + uuid.uuid4().hex[:12]
fact = f'My harmless OpenBot verification badge is {nonce}.'
first, response, events = turn(f'Explicitly remember this personal fact with remember_personal_fact: {fact}')
assert called(events, 'remember_personal_fact'), 'Save was claimed without calling memory tool'
assert any(nonce in memory['content'] for memory in api('/api/memory')['memories'])
assert any(event.get('type') == 'TEXT_MESSAGE_CONTENT' for event in events), 'No streamed text event'
before = history(first)
subprocess.run(['docker', 'compose', 'restart', 'postgres', 'mastra', 'supervisor', 'server', 'worker', 'maintenance'], check=True)
subprocess.run(['docker', 'compose', 'up', '-d', '--wait'], check=True)
assert history(first) == before, 'Completed history changed across restart'
second, response, _ = turn('Recall my current personal memory. What is my OpenBot verification badge?')
assert second != first and nonce in response, 'New conversation did not recall durable memory'
third, _, events = turn('Please forget my OpenBot verification badge using forget_personal_memory. Recall its memory ID if needed.')
assert third not in (first, second) and called(events, 'forget_personal_memory')
assert not any(nonce in memory['content'] for memory in api('/api/memory')['memories'])
fourth, response, _ = turn('What is my OpenBot verification badge? Use current personal memory only; say you do not know if absent.')
assert fourth not in (first, second, third) and nonce not in response, 'Forgotten fact reappeared in a new thread'
subprocess.run(['bash', 'scripts/local/verify.sh'], check=True)
print('PASS: streamed Mastra response; explicit save, recall after restart, forget, fresh-thread absence; history and authentication survive restart')
