import { expect, test } from "bun:test";
import { LocallyAddressedIntelligence } from "../src/intelligence-networking";

test("separates browser WebSockets from the private runner address", () => {
  const client = new LocallyAddressedIntelligence(
    {
      apiUrl: "http://intelligence-api:30080",
      wsUrl: "ws://intelligence-gateway:30081",
      apiKey: "synthetic-project-key",
    },
    "ws://localhost:42253",
  );
  expect(client.ɵgetClientWsUrl()).toBe("ws://localhost:42253/client");
  expect(client.ɵgetRunnerWsUrl()).toBe(
    "ws://intelligence-gateway:30081/runner",
  );
});
