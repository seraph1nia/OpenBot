import { AuthStorage } from "@mastra/code-sdk/auth/storage";
import { openaiCodexProvider } from "@mastra/code-sdk/providers/openai-codex";

// One instance per runtime: the SDK deduplicates refreshes on this instance.
export const authStorage = new AuthStorage();
export const subscriptionModelId =
  process.env.BOT_MODEL?.trim() || "gpt-5.6-sol";
export function subscriptionModel() {
  return openaiCodexProvider(subscriptionModelId, { authStorage });
}
export async function subscriptionReadiness() {
  authStorage.reload();
  if (!authStorage.isLoggedIn("openai-codex")) {
    return {
      ok: false,
      reason: "login_required",
      recovery: "Run scripts/local/login.sh",
    };
  }
  const credential = await authStorage.getOAuthCredential("openai-codex");
  return credential
    ? { ok: true, model: subscriptionModelId, inferenceVerified: false }
    : {
        ok: false,
        reason: "refresh_failed",
        recovery: "Run scripts/local/login.sh",
      };
}
