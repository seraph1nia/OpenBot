import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { parse } from "yaml";

const compose = parse(
  readFileSync(new URL("../docker-compose.yml", import.meta.url), "utf8"),
);
const services = compose.services;

test("keeps database and Docker socket away from the agent runtime and computers", () => {
  expect(services.postgres.networks).toEqual(["data"]);
  expect(compose.networks.data.internal).toBe(true);
  expect(services.mastra.networks).not.toContain("data");
  expect(services["agent-computer"].networks).not.toContain("data");
  const holders = Object.entries(services)
    .filter(([, value]) =>
      JSON.stringify(value).includes("/var/run/docker.sock"),
    )
    .map(([name]) => name);
  expect(holders).toEqual(["supervisor"]);
});

test("publishes only the local UI/API port", () => {
  const published = Object.entries(services)
    .filter(
      ([, value]) =>
        typeof value === "object" && value !== null && "ports" in value,
    )
    .map(([name]) => name);
  expect(published).toEqual(["server"]);
  // biome-ignore lint/suspicious/noTemplateCurlyInString: literal Compose interpolation
  expect(services.server.ports).toEqual(["127.0.0.1:${APP_PORT:-3010}:3001"]);
});

test("gates API startup on successful migrations and healthy transports", () => {
  expect(services.migrate.command).toEqual(["bun", "scripts/migrate.ts"]);
  expect(services.migrate.depends_on.postgres.condition).toBe(
    "service_healthy",
  );
  expect(services.server.depends_on.migrate.condition).toBe(
    "service_completed_successfully",
  );
  expect(services.server.depends_on.mastra.condition).toBe("service_healthy");
  expect(services.worker.depends_on.server.condition).toBe("service_healthy");
  for (const name of [
    "server",
    "worker",
    "maintenance",
    "mastra",
    "postgres",
    "supervisor",
  ]) {
    expect(services[name].restart).toBe("unless-stopped");
    expect(services[name].healthcheck.test.length).toBeGreaterThan(0);
  }
});

test("subscription login and inference share a writable store and matching environment", () => {
  expect(services.mastra.volumes).toContain("mastra-auth:/var/lib/mastra");
  expect(services["mastra-auth"].volumes).toEqual(services.mastra.volumes);
  expect(services.mastra.environment.MASTRA_APP_DATA_DIR).toBe(
    "/var/lib/mastra",
  );
  expect(services["mastra-auth"].command).toEqual([
    "node",
    "--import",
    "tsx",
    "src/auth.ts",
  ]);
  expect(services.mastra.environment.NODE_ENV).toBe("production");
  expect(services.mastra.environment.BOT_PROVIDER).toBe("openai-codex");
  expect(services.mastra.environment.OPENAI_API_KEY).toBeUndefined();
  expect(services.server.environment.OPENAI_API_KEY).toBe("");
  expect(services.server.environment.OPENBOT_SUBSCRIPTION_ONLY).toBe("true");
});

test("retains native Mastra identity and authenticated server callbacks", () => {
  const tenant = parse(
    readFileSync(
      new URL("../local/tenant/agents.yaml", import.meta.url),
      "utf8",
    ),
  );
  expect(tenant.agents).toHaveLength(1);
  expect(tenant.agents[0].id).toBe("general-assistant");
  expect(tenant.agents[0].type).toBe("remote-mastra");
  expect(tenant.agents[0].remote_agent_id).toBe("openbot");
  expect(services.server.environment.PICKED_HARNESS_URL).toBe(
    tenant.agents[0].endpoint,
  );
  expect(services.server.environment.MANAGED_AGENT_AG_UI_URL).toBeUndefined();
  expect(services.mastra.environment.OPENBOT_TOOL_URL).toBe(
    "http://server:3001/api/agent-tools/call",
  );
  expect(services.mastra.environment.AGENT_TOOL_TOKEN).toBe(
    services.server.environment.AGENT_TOOL_TOKEN,
  );
});
