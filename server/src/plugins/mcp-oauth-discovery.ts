import {
  discoverAuthorizationServerMetadata,
  discoverOAuthProtectedResourceMetadata,
} from "@modelcontextprotocol/sdk/client/auth.js";
import type { CatalogueAuth } from "./catalogue";

/** Use the installed MCP SDK's discovery, retaining OpenBot's reviewed origin boundary. */
export async function validateMcpOAuthDiscovery(
  auth: Extract<CatalogueAuth, { kind: "user-oauth" }>,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const expected = auth.mcpDiscovery;
  if (!expected) return;
  const origins = new Set([
    new URL(expected.resource).origin,
    new URL(expected.authorizationServer).origin,
  ]);
  const safeFetch: typeof fetch = (async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (
      url.protocol !== "https:" ||
      !origins.has(url.origin) ||
      url.username ||
      url.password
    ) {
      throw new Error("MCP OAuth discovery returned an unreviewed origin.");
    }
    return fetchImpl(input, {
      ...init,
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
  }) as typeof fetch;
  const resource = await discoverOAuthProtectedResourceMetadata(
    expected.resource,
    {},
    safeFetch,
  );
  if (
    resource.resource !== expected.resource ||
    !resource.authorization_servers?.includes(expected.authorizationServer)
  ) {
    throw new Error(
      "MCP OAuth resource metadata does not match the reviewed provider.",
    );
  }
  const metadata = await discoverAuthorizationServerMetadata(
    expected.authorizationServer,
    { fetchFn: safeFetch },
  );
  if (
    !metadata ||
    metadata.issuer !== expected.authorizationServer ||
    metadata.authorization_endpoint !== auth.authorizationUrl ||
    metadata.token_endpoint !== auth.tokenUrl ||
    !metadata.code_challenge_methods_supported?.includes("S256")
  ) {
    throw new Error(
      "MCP OAuth authorization metadata does not match the reviewed provider.",
    );
  }
}
