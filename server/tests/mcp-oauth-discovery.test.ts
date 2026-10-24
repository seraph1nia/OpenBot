import { expect, test } from "bun:test";
import {
  catalogueEntry,
  classifyTool,
  resolveServerUrl,
  serverCredentialKind,
} from "../src/plugins/catalogue";
import { validateMcpOAuthDiscovery } from "../src/plugins/mcp-oauth-discovery";

function githubAuth() {
  const entry = catalogueEntry("github-mcp");
  if (entry?.auth.kind !== "user-oauth")
    throw new Error("GitHub must use per-person OAuth");
  return entry.auth;
}
const resource = {
  resource: "https://api.githubcopilot.com/mcp",
  authorization_servers: ["https://github.com/login/oauth"],
  scopes_supported: ["repo"],
};
const metadata = {
  issuer: "https://github.com/login/oauth",
  authorization_endpoint: "https://github.com/login/oauth/authorize",
  token_endpoint: "https://github.com/login/oauth/access_token",
  response_types_supported: ["code"],
  grant_types_supported: ["authorization_code", "refresh_token"],
  code_challenge_methods_supported: ["S256"],
};

function fakeDiscovery(
  overrides: { resource?: object; metadata?: object } = {},
) {
  const calls: { url: string; options?: RequestInit }[] = [];
  const fetch = (async (input, options) => {
    const url = String(input);
    calls.push({ url, options });
    return Response.json(
      url.includes("oauth-protected-resource")
        ? (overrides.resource ?? resource)
        : (overrides.metadata ?? metadata),
    );
  }) as typeof globalThis.fetch;
  return { fetch, calls };
}

test("uses installed MCP SDK resource and authorization-server discovery with no credentials", async () => {
  const { fetch, calls } = fakeDiscovery();
  await validateMcpOAuthDiscovery(githubAuth(), fetch);
  expect(
    calls.some((call) =>
      call.url.includes(".well-known/oauth-protected-resource"),
    ),
  ).toBe(true);
  expect(
    calls.some((call) =>
      call.url.includes(".well-known/oauth-authorization-server"),
    ),
  ).toBe(true);
  for (const call of calls) {
    expect(call.options?.redirect).toBe("error");
    expect(new Headers(call.options?.headers).has("authorization")).toBe(false);
  }
});

test("rejects a substituted authorization server before contacting it", async () => {
  const { fetch, calls } = fakeDiscovery({
    resource: { ...resource, authorization_servers: ["https://evil.invalid"] },
  });
  await expect(validateMcpOAuthDiscovery(githubAuth(), fetch)).rejects.toThrow(
    "resource metadata",
  );
  expect(calls.every((call) => !call.url.includes("evil.invalid"))).toBe(true);
});

test("rejects substituted token endpoints and authorization metadata without PKCE", async () => {
  for (const changed of [
    { ...metadata, token_endpoint: "https://evil.invalid/token" },
    { ...metadata, code_challenge_methods_supported: ["plain"] },
  ]) {
    await expect(
      validateMcpOAuthDiscovery(
        githubAuth(),
        fakeDiscovery({ metadata: changed }).fetch,
      ),
    ).rejects.toThrow("authorization metadata");
  }
});

test("both connectors use the native MCP transport and individual OAuth credentials", () => {
  for (const key of ["github-mcp", "google-gmail"]) {
    const entry = catalogueEntry(key);
    expect(entry?.auth.kind).toBe("user-oauth");
    expect(entry?.transport ?? "mcp").toBe("mcp");
    expect(serverCredentialKind(entry!)).toBeNull();
  }
  expect(resolveServerUrl("google-gmail")?.url).toBe(
    "https://gmailmcp.googleapis.com/mcp/v1",
  );
  expect(catalogueEntry("google-gmail")?.publicToolList).toBe(true);
});

test("Gmail grants can keep drafts while treating sending and unknown tools as writes", () => {
  const entry = catalogueEntry("google-gmail");
  expect(classifyTool(entry, "search_threads", true)).toBe("read");
  expect(classifyTool(entry, "get_thread", true)).toBe("read");
  for (const name of [
    "create_draft",
    "send_message",
    "trash_message",
    "new_tool",
  ]) {
    expect(classifyTool(entry, name, true)).toBe("write");
  }
});
