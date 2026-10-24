# Verification record

Baseline: OpenBot `bd4dc94943a9d62aefd05e5e99073ba58919c9c6`, Mastra SDK 1.15.0,
Mastra core 1.79.0, Mastra CLI 1.35.0, CopilotKit CLI 4.30.0, local Intelligence 0.15.0.
Host: Linux amd64, rootful Docker Engine 29.9.2, Compose 5.6.1, 12 CPUs, about 15.5 GiB RAM.

Checked live on 2026-10-23. Synthetic checks are identified separately from account/model verification.

| Check | Evidence/status |
| --- | --- |
| Images build and health | API/UI, Mastra, supervisor and Chromium images built. PostgreSQL, API/UI, Mastra, supervisor, routine worker and maintenance all healthy. |
| Database migrations | Real pgvector PostgreSQL: 61 migrations applied successfully. |
| Intelligence local bootstrap | Official CLI installed local stack; no managed cloud project selected. |
| Learning setup | Official local operator CLI created logical container `openbot`; server auto-assigned it. |
| Governed computer | Live API navigation to example.com returned Example Domain; audit record found. |
| Browser/server WebSocket split | Live runtime info returns localhost client URL; regression test keeps runner on private DNS. |
| UI | Real Chromium completed first-run onboarding and displayed Personal Assistant at `/bot?agent=general-assistant`; no Platform key required. |
| Published provider exports | Imported installed SDK storage/provider subpaths; verified device authModes. |
| OAuth storage/refresh contracts | Synthetic credential reload, 0600 permissions, refresh deduplication and replacement persistence tested. Real OAuth refresh not yet tested. |
| Memory ownership/provenance/review/deletion | 27 tests passed against a separate live PostgreSQL test database. |
| Code/tests | 145 focused tests passed; 94 additional tests passed against a dedicated live PostgreSQL test DB (including the 27 memory cases). Workspace and Mastra TypeScript checks, focused lint/format, shell/Python syntax, Compose configuration, and diff whitespace checks passed. |
| Real subscription generation | Operator device sign-in completed. `/verify` passed with `gpt-5.6-sol`, 5 streamed text chunks, and OPENAI_API_KEY absent. Passed again after restart and on the final locked-dependency image. |
| Model-driven memory lifecycle in new threads | `smoke.py --journey` passed: remember tool called; unique badge recalled after restart in a second thread; forget tool called in a third; absent from memory API and fourth thread. |
| History across application restart | Completed saved-thread messages compared equal before/after restarting PostgreSQL, API, Mastra, worker, maintenance and supervisor. |
| Credentials across restart | Login and real generation survived restart. Directory 0700 and credential file 0600 verified inside uid 1000 runtime; automatic refresh code/deduplication tested with synthetic expired credentials. No live token-expiry/refresh claim. |
| Learning ingestion | Official operator CLI lists all four memory-journey threads bound to openbot; API harvester logs confirm evidence ingestion. Runtime loaded empty published revision 0 successfully. |
| Learning analysis and published delivery | Analysis model absent. No real analysis or publication/delivery claimed. Published skill catalog and tool-result delivery to the installed Mastra bridge passed a synthetic-provider regression. |
| Learning Inspector limitation | Official local API `/api/inspector/learning?runtimeContainerId=openbot` returns HTTP 503 (route logs inspector_learning_route_failed). OpenBot Admin reports it as unavailable. This does not block thread ingestion, empty skill delivery, chat, or personal memory. Cause not established; no claim that configuring a model fixes this separate endpoint. |

Reproduce with `scripts/local/test.sh --database`, `scripts/local/verify.sh`, and
`python3 scripts/local/smoke.py --journey`. The journey uses four new threads and a unique harmless
badge. It verifies actual memory tool calls and reads saved history after restart.

Mastra production builds use the installed deployer’s verified `MASTRA_BUILD_SKIP_INSTALL=true` setting,
so generated output resolves against the committed npm-ci dependency tree. No second floating install
(including generated `typescript: latest`) is performed. The final image passed real generation.

## GitHub and Gmail — standard MCP OAuth, 2026-10-24

Both connectors now use the existing MCP transport and per-person browser Connect/OAuth flow.
The earlier PAT helper and Gmail REST adapter were removed following review. Their earlier test
results do not establish the behavior of the final MCP implementation.

- GitHub resource and authorization-server discovery passed live using the installed MCP SDK.
  Endpoints/issuer/S256 are verified against the reviewed configuration. No account tokens are used
  during discovery. A registered GitHub App with expiring user tokens remains an operator prerequisite;
  GitHub's remote MCP provider does not support dynamic client registration.
- Google Gmail's official MCP initialize and tools/list passed live without credentials. This only
  verifies public tool metadata, not mailbox access or your Google Cloud preview entitlement.
- Rebuilt and deployed the API/UI image. The running native transport listed 23 Gmail tools;
  Personal Assistant has exactly six read grants and create_draft. A mailbox search before consent
  returned HTTP 403 with the native Connect prompt. GitHub is enabled and awaits account connection
  before authenticated tool discovery. Both connectors have no OAuth client configured yet.
- Gmail's allowed grants remain reads and create_draft. Unknown/new tools classify as writes and
  are never automatically granted. Native per-person credential selection still protects calls.
- 111 focused discovery/catalogue/OAuth/callback/connect/refresh tests passed; workspace TypeScript
  checks and focused Biome checks passed. Live GitHub metadata discovery passed again on final source.
- Real Chromium rendered both admin OAuth-client entries and both personal Connect pages, with the
  correct localhost callback and no missing-public-URL error. All six long-running services healthy.
- Browser account consent and real account tool calls remain untested until the provider clients
  are registered and the user connects. No GitHub write, Gmail draft or email was sent in setup.

See docs/plugins/github.md and docs/plugins/gmail.md. Account connection takes place in the web UI;
there is no terminal PAT or Google OAuth credential helper.
