# Gmail MCP: browser OAuth, reading and drafts

OpenBot uses [Google's official Gmail MCP server](https://developers.google.com/workspace/gmail/api/guides/configure-mcp-server)
at `https://gmailmcp.googleapis.com/mcp/v1`, over the existing MCP transport and per-person browser
OAuth. There is no custom Gmail REST adapter or terminal authentication helper.

Google currently documents this server as a **Google Workspace Developer Preview**. Your Google Cloud
project must be eligible and have both `gmail.googleapis.com` and `gmailmcp.googleapis.com` enabled.
Public tool-schema listing was verified live; that does not prove authenticated mailbox access or
preview eligibility for your project. If the provider refuses access, resolve that prerequisite;
OpenBot does not silently switch providers or protocols.

One-time operator setup, following the linked Google guide:

1. Configure a Google Cloud OAuth consent screen, adding your account as a test user if the app is
   External/Testing. Request `gmail.readonly` and `gmail.compose`.
2. Create a **Web application** OAuth client, selecting **Use this client for an AI-powered agent**
   as Google requires for Workspace MCP. Register the exact callback
   `http://localhost:3010/api/plugins/oauth/callback`.
3. Open `http://localhost:3010/admin/plugins/google-gmail`. Enable it if needed and save the client
   ID and secret under **OAuth client**. The secret is stored encrypted in OpenBot's existing vault.
4. Open `http://localhost:3010/connections/google-gmail`, click **Connect**, and consent at Google.
   This is the regular OpenBot browser connection flow, with state, PKCE and an offline refresh grant.
   The catalogue supplies `access_type=offline` and `prompt=consent` for renewable authorization.
5. Refresh the advertised tools on the admin page. Personal Assistant may use `search_threads`,
   `get_message`, `get_thread`, `list_drafts`, `get_draft`, `list_labels` and `create_draft`.
   Grant only those operations; do not select Every tool.

Drafts must remain unsent, as requested. The configured grants include **draft creation and reads**,
with no send, trash, label-changing or other write grants. New provider tools receive no grants
on discovery or refresh. Unknown tools classify as writes. Review and send drafts yourself in Gmail.
Google's `gmail.compose` OAuth scope also permits sending at the API level; Google has no narrower
standalone draft-only scope. OpenBot's tool-grant boundary is what limits this integration to drafts.

Tool schemas can be listed without authentication at this reviewed endpoint. That does not authorize
tool execution: every mailbox call still uses the asking person's OAuth grant, tool permissions,
action policy, approval handling and audit trail. No mailbox content is fetched merely by enabling
or listing the connector.

After consent, start a new Personal Assistant conversation and ask to search your inbox. Check the
audit log for the actual call. Test draft creation only with an explicit instruction and recipient;
setup does not create a draft or send a message automatically. A successful schema listing or OAuth
callback alone is not evidence of a successful Gmail tool call.

Google may require verification for a publicly distributed OAuth app, and Workspace policies can
restrict consent. External apps left in Testing issue [seven-day refresh tokens for these scopes](https://developers.google.com/identity/protocols/oauth2#expiration).
Reconnect after expiry/revocation, or configure the appropriate app publishing/verification status.
Normal restarts preserve the encrypted client and refresh grant in OpenBot's PostgreSQL volume.
