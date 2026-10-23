/**
 * Mastra as a Bot.
 *
 * Mastra brings its own HTTP server, so unlike the Python harnesses this one is not a FastAPI app
 * with a route bolted on: it is a plain Mastra server, and that is the whole point. Mastra already
 * serves its agents over its own API, and OpenBot dials that API through `@ag-ui/mastra`, the bridge
 * Mastra and AG-UI maintain between them. See `remoteTransport` in server/src/copilot.ts.
 *
 * SO THERE IS NO AG-UI ROUTE HERE, deliberately. An earlier version mounted `registerCopilotKit`
 * from `@ag-ui/mastra/copilotkit`, which serves the CopilotKit Runtime protocol rather than AG-UI:
 * a different wire format that answers a run with a complaint about a missing `method` field. The
 * translation belongs on OpenBot's side, in one place, where every remote Bot is governed the same
 * way — not in each harness.
 */
import { Agent } from "@mastra/core/agent";
import { Mastra } from "@mastra/core/mastra";
import { registerApiRoute } from "@mastra/core/server";
import { listenPort } from "../../../shared/listen-port";
import {
  apiKeyOrPlaceholder,
  botSettings,
  providerSpec,
} from "../../../shared/model-providers";
import {
  subscriptionModel,
  subscriptionModelId,
  subscriptionReadiness,
} from "../subscription";

/** The providers this Bot can drive: the ones whose SDK modules it loads below. */
const SUPPORTED_PROVIDERS = new Set(["openai", "anthropic"]);

/**
 * The model this Bot answers with, read from the spec file rather than remembered in this file.
 *
 * `shared/model-providers.json` holds this Bot's `bots.agent-mastra` row and the provider facts
 * around it; `BOT_PROVIDER` and `BOT_MODEL` still win over both, as they always have. The file
 * says which providers exist; this file still decides which of them it can drive, because only two
 * SDK modules are loaded here. Both halves refuse at startup: a provider the file has not heard of,
 * and one it has that this harness has no module for, used to fall through to the OpenAI branch
 * below and answer with a model the deployment never chose.
 */
async function buildModel() {
  if (process.env.BOT_PROVIDER === "openai-codex") return subscriptionModel();
  const settings = botSettings("agent-mastra");
  const providerName = settings.provider;
  const spec = providerSpec(providerName);
  if (!spec) {
    // What to use is what this harness answers on, which is narrower than the registry.
    throw new Error(
      `BOT_PROVIDER=${providerName} is not one this Bot knows. Use ${[...SUPPORTED_PROVIDERS].join(" or ")}.`,
    );
  }
  if (!SUPPORTED_PROVIDERS.has(spec.id)) {
    throw new Error(
      `BOT_PROVIDER=${providerName} names ${spec.label}, and this Bot loads no ${spec.label} module. It answers on OpenAI and Anthropic only.`,
    );
  }
  const model = settings.model;
  const baseVariable = spec.baseUrlVariable;
  const baseURL = process.env[baseVariable]?.trim();
  // Provider modules create default clients at import, which reject Compose's empty overrides.
  if (!baseURL) delete process.env[baseVariable];

  if (spec.id === "anthropic") {
    const { createAnthropic } = await import("@ai-sdk/anthropic");
    // Other harnesses accept an Anthropic origin; AI SDK expects the /v1 API prefix.
    const origin = (baseURL || "https://api.anthropic.com").replace(/\/+$/, "");
    return createAnthropic({
      baseURL: origin.endsWith("/v1") ? origin : `${origin}/v1`,
    })(model);
  }
  const { createOpenAI } = await import("@ai-sdk/openai");
  const compatible =
    Boolean(baseURL) &&
    baseURL?.replace(/\/+$/, "") !== "https://api.openai.com/v1";
  const openai = createOpenAI({
    baseURL: baseURL || "https://api.openai.com/v1",
    apiKey: compatible
      ? apiKeyOrPlaceholder(process.env[spec.keyVariable])
      : undefined,
  });
  // Compatible endpoints commonly expose Chat Completions; OpenAI keeps its Responses default.
  return compatible ? openai.chat(model) : openai(model);
}
const port = listenPort(process.env.PORT, 4213);
if (!port.ok) throw new Error(port.reason);

export const openbotBaseInstructions =
  "Answer the question you are asked, briefly and correctly.";

const OPENBOT_CONTEXT_DESCRIPTIONS = [
  "OpenBot standing role",
  "OpenBot granted tools guidance",
  "OpenBot learned skills",
  "OpenBot personal memory",
] as const;

type OpenBotInstructionArgs = {
  requestContext?: {
    get(key: string): unknown;
  };
};

function agUiContextEntries(
  requestContext?: OpenBotInstructionArgs["requestContext"],
) {
  const agUi = requestContext?.get("ag-ui");
  if (
    typeof agUi !== "object" ||
    agUi === null ||
    !("context" in agUi) ||
    !Array.isArray(agUi.context)
  ) {
    return [];
  }
  return agUi.context;
}

export function buildOpenBotInstructions({
  requestContext,
}: OpenBotInstructionArgs = {}) {
  const contextEntries = agUiContextEntries(requestContext);
  const openbotInstructions = OPENBOT_CONTEXT_DESCRIPTIONS.flatMap(
    (description) =>
      contextEntries
        .filter(
          (entry): entry is { description: string; value: string } =>
            typeof entry === "object" &&
            entry !== null &&
            "description" in entry &&
            entry.description === description &&
            "value" in entry &&
            typeof entry.value === "string" &&
            entry.value.trim().length > 0,
        )
        .map((entry) => entry.value.trim()),
  );

  if (openbotInstructions.length === 0) return openbotBaseInstructions;
  return [openbotBaseInstructions, ...openbotInstructions].join("\n\n");
}

const openbot = new Agent({
  id: "openbot",
  name: "openbot",
  instructions: buildOpenBotInstructions,
  model: await buildModel(),
});

/** The one header OpenBot's server sends, compared without leaking length through timing. */
function carriesTheServerToken(request: Request): boolean {
  const expected = (process.env.MANAGED_AGENT_TOKEN ?? "").trim();
  const offered = (request.headers.get("x-openbot-agent-token") ?? "").trim();
  // Unset means unconfigured, not open.
  if (!expected || offered.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < offered.length; index += 1) {
    difference |= offered.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}

export const mastra = new Mastra({
  agents: { openbot },
  server: {
    port: port.port,
    host: "0.0.0.0",
    middleware: [
      // Everything but `/health`, which Compose polls before any token exists.
      async (context, next) => {
        if (new URL(context.req.url).pathname === "/health") return next();
        if (!carriesTheServerToken(context.req.raw)) {
          return context.json({ error: "unauthorised" }, 401);
        }
        // Fail before starting a streamed turn when login is missing. The native
        // client can then surface an actionable HTTP error instead of an opaque
        // serialized provider error embedded halfway through a stream.
        if (
          process.env.BOT_PROVIDER === "openai-codex" &&
          context.req.method === "POST" &&
          /^\/api\/agents\/[^/]+\/(?:stream|generate|resume-stream)$/.test(
            new URL(context.req.url).pathname,
          )
        ) {
          const status = await subscriptionReadiness();
          if (!status.ok) {
            return context.json(
              {
                error:
                  "Codex subscription sign-in required. Run ./scripts/local/login.sh in your terminal, approve the device code, then retry.",
                code: "OPENBOT_MODEL_AUTH_REQUIRED",
              },
              401,
            );
          }
        }
        return next();
      },
    ],
    apiRoutes: [
      registerApiRoute("/ready", {
        method: "GET",
        handler: async (context) => {
          try {
            const status = await subscriptionReadiness();
            return context.json(status, status.ok ? 200 : 503);
          } catch {
            return context.json(
              {
                ok: false,
                reason: "credential_store_unavailable",
                recovery: "Run scripts/local/login.sh",
              },
              503,
            );
          }
        },
      }),
      registerApiRoute("/verify", {
        method: "POST",
        handler: async (context) => {
          try {
            const status = await subscriptionReadiness();
            if (!status.ok) return context.json(status, 503);
            const result = await openbot.stream(
              "Reply with exactly OPENBOT_CODEX_OK.",
              { maxSteps: 1 },
            );
            let text = "";
            let chunks = 0;
            for await (const chunk of result.textStream) {
              text += chunk;
              chunks++;
            }
            if (!text.includes("OPENBOT_CODEX_OK"))
              throw new Error("verification failed");
            return context.json({
              ok: true,
              model: subscriptionModelId,
              streamedChunks: chunks,
              inferenceVerified: true,
            });
          } catch {
            return context.json(
              {
                ok: false,
                reason: "generation_failed",
                recovery:
                  "Check ChatGPT usage allowance and BOT_MODEL access; re-login with scripts/local/login.sh if revoked. No API fallback is enabled.",
              },
              503,
            );
          }
        },
      }),
      registerApiRoute("/health", {
        method: "GET",
        handler: async (context) =>
          context.json({ ok: true, harness: "mastra" }),
      }),
    ],
  },
});
