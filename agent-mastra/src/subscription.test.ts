import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AuthStorage, getOAuthProvider } from "@mastra/code-sdk/auth/storage";
import { buildOpenAICodexOAuthFetch } from "@mastra/code-sdk/providers/openai-codex";
import { buildOpenBotInstructions } from "./mastra/index";

// Synthetic credentials and a fake upstream: no account credentials or model allowance used.
describe("installed Codex subscription contract", () => {
  test("deduplicates expired-token refresh and persists the replacement", async () => {
    const directory = mkdtempSync(join(tmpdir(), "openbot-refresh-test-"));
    const path = join(directory, "auth.json");
    const storage = new AuthStorage(path);
    storage.set("openai-codex", {
      type: "oauth",
      access: "expired-synthetic",
      refresh: "old-synthetic",
      expires: 1,
    });
    const provider = getOAuthProvider("openai-codex");
    if (!provider) throw new Error("Missing published Codex OAuth provider");
    const original = provider.refreshToken;
    let refreshes = 0;
    provider.refreshToken = async () => {
      refreshes++;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return {
        access: "refreshed-synthetic",
        refresh: "rotated-synthetic",
        expires: Date.now() + 3600000,
      };
    };
    try {
      const results = await Promise.all([
        storage.getOAuthCredential("openai-codex"),
        storage.getOAuthCredential("openai-codex"),
      ]);
      expect(refreshes).toBe(1);
      expect(
        results.every((result) => result?.access === "refreshed-synthetic"),
      ).toBe(true);
      expect(new AuthStorage(path).get("openai-codex")).toMatchObject({
        refresh: "rotated-synthetic",
      });
      expect(statSync(path).mode & 0o777).toBe(0o600);
    } finally {
      provider.refreshToken = original;
      rmSync(directory, { recursive: true, force: true });
    }
  });
  test("publishes device mode and persists a private, reloadable credential store", () => {
    expect(
      getOAuthProvider("openai-codex")?.authModes?.map((mode) => mode.id),
    ).toContain("device");
    const directory = mkdtempSync(join(tmpdir(), "openbot-auth-test-"));
    try {
      const path = join(directory, "auth.json");
      new AuthStorage(path).set("openai-codex", {
        type: "oauth",
        access: "synthetic-access",
        refresh: "synthetic-refresh",
        expires: Date.now() + 3600000,
      });
      expect(statSync(path).mode & 0o777).toBe(0o600);
      expect(new AuthStorage(path).isLoggedIn("openai-codex")).toBe(true);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("rewrites inference to ChatGPT and replaces any API-key headers", async () => {
    const directory = mkdtempSync(join(tmpdir(), "openbot-oauth-fetch-"));
    const originalFetch = globalThis.fetch;
    const storage = new AuthStorage(join(directory, "auth.json"));
    storage.set("openai-codex", {
      type: "oauth",
      access: "synthetic-access",
      refresh: "synthetic-refresh",
      expires: Date.now() + 3600000,
    });
    let observed: Request | undefined;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      observed = input as Request;
      return new Response("ok");
    }) as typeof fetch;
    try {
      const fetchWithSubscription = buildOpenAICodexOAuthFetch({
        authStorage: storage,
      });
      await fetchWithSubscription("https://api.openai.com/v1/responses", {
        method: "POST",
        body: "{}",
        headers: {
          authorization: "Bearer unwanted-api-key",
          "x-api-key": "unwanted-api-key",
        },
      });
      expect(observed?.url).toBe(
        "https://chatgpt.com/backend-api/codex/responses",
      );
      expect(observed?.headers.get("authorization")).toBe(
        "Bearer synthetic-access",
      );
      expect(observed?.headers.has("x-api-key")).toBe(false);
      storage.logout("openai-codex");
      await expect(
        fetchWithSubscription("https://api.openai.com/v1/responses"),
      ).rejects.toThrow("Not logged in");
    } finally {
      globalThis.fetch = originalFetch;
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("delivers cross-conversation personal context to Mastra instructions", () => {
    const result = buildOpenBotInstructions({
      requestContext: {
        get: () => ({
          context: [
            { description: "OpenBot standing role", value: "ROLE_MARKER" },
            { description: "OpenBot personal memory", value: "MEMORY_MARKER" },
            {
              description: "OpenBot learned skills",
              value: "PUBLISHED_SKILL_MARKER",
            },
          ],
        }),
      },
    });
    expect(result).toContain("ROLE_MARKER");
    expect(result).toContain("MEMORY_MARKER");
    expect(result).toContain("PUBLISHED_SKILL_MARKER");
  });
});
