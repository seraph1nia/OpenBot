# GitHub MCP and browser OAuth

OpenBot uses [GitHub's official MCP server](https://github.com/github/github-mcp-server/blob/main/docs/remote-server.md)
at `https://api.githubcopilot.com/mcp/` through the existing MCP transport and **per-person OAuth**.
No PAT, terminal authentication helper, broker subscription, or extra model key is required.

GitHub's MCP service does not support dynamic client registration. A self-hosted client therefore
needs an OAuth application registered once; each person can then use the ordinary browser Connect
flow. See [GitHub's host integration guide](https://github.com/github/github-mcp-server/blob/main/docs/host-integration.md).
Apps such as VS Code supply their own registered OAuth clients; OpenBot cannot inherit their client
registration or tokens.

For this checkout, use a **GitHub App** with **expiring user authorization tokens enabled**. OpenBot's
existing connector store persists refresh tokens, so a non-expiring OAuth App token is not the
appropriate configuration for this flow.

1. Create a GitHub App with homepage `http://localhost:3010` and callback
   `http://localhost:3010/api/plugins/oauth/callback`.
2. Enable **Expire user authorization tokens**. Set repository permissions for Contents, Issues,
   and Pull requests to Read and write. Install the App on only the selected repositories you need.
3. Open `http://localhost:3010/admin/plugins/github-mcp`. Enable the connector if needed, then save
   the App's **client ID and client secret** under **OAuth client**. The private key is not needed
   for this user-authorization flow. The secret is encrypted in OpenBot's vault.
4. Open `http://localhost:3010/connections/github-mcp` and click **Connect**. Authorize in GitHub;
   OpenBot owns state, PKCE, the callback, refresh storage and the authenticated MCP requests.
5. Press **Refresh tools** on the admin connector page. Grant Personal Assistant the desired reads
   and `issue_write`, `create_branch`, `create_pull_request`. Do not choose Every tool merely to
   enable those operations. `issue_write` can create and update issues.

The installed MCP SDK discovers GitHub's protected-resource and authorization-server metadata at
Connect time and checks the resource, issuer, endpoints and S256 support against the reviewed
provider configuration. Token redemption and refresh request JSON responses as GitHub requires.
No credential is sent during discovery. Discovery does not prove an account has authorized access.

Existing OpenBot grants, approvals and audit apply. New or unreviewed GitHub tools classify as writes,
and newly advertised tools gain no grants automatically. Test a read first in a new Personal Assistant
conversation, such as listing issues in a selected repository; check `/admin/audit`. Repository
writes require an explicit task. Setup creates no test issue, branch or PR.

This tool connector is separate from OpenBot's GitHub identity/event linking feature. The latter uses
`GITHUB_APP_CLIENT_ID` / `GITHUB_APP_CLIENT_SECRET` and a different identity callback; linking an
identity does not itself provide MCP tools. No identity configuration is replaced here.

Provider revocation remains in GitHub Settings → Applications. GitHub advertises no RFC 7009
revocation endpoint in its OAuth metadata; no such endpoint is invented. Ordinary restarts preserve
the local encrypted client, refresh credential and grants in PostgreSQL. Reconnect after revocation.
