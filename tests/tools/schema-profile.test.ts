import { createHash } from "node:crypto";
import { describe, it, expect, vi } from "vitest";
import * as z from "zod/v4";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import { Registry } from "../../src/registry/index.js";
import { registerAllTools } from "../../src/tools/index.js";

// Pinned hash of the full-mode tool schemas. Full mode must stay byte-identical when compact-mode
// copy changes; update this only for an intentional full-mode contract change.
const FULL_MODE_SCHEMA_SHA256 = "b4ade5b6a6399eedaec3d73c51df6463ece04e4ec8d9ae51c8438d0d81c4d32c";

function makeConfig(mode: "full" | "compact"): Config {
  return {
    HARNESS_API_KEY: "pat.test.abc.xyz",
    HARNESS_ACCOUNT_ID: "test-account",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "default",
    HARNESS_PROJECT: "test-project",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 3,
    HARNESS_SCHEMA_MODE: mode,
    LOG_LEVEL: "info",
  } as Config;
}

function collectTools(mode: "full" | "compact") {
  const config = makeConfig(mode);
  const tools = new Map<string, { description?: string; schema: unknown }>();
  const server = {
    registerTool: vi.fn((name: string, def: { description?: string; inputSchema: z.ZodRawShape }) => {
      tools.set(name, { description: def.description, schema: z.toJSONSchema(z.object(def.inputSchema)) });
    }),
  };
  const client = { request: vi.fn(), account: "test-account" } as unknown as HarnessClient;
  registerAllTools(server as never, new Registry(config), client, config);
  return tools;
}

const serialize = (tools: ReturnType<typeof collectTools>) =>
  JSON.stringify([...tools.entries()].sort(([a], [b]) => a.localeCompare(b)));

describe("HARNESS_SCHEMA_MODE", () => {
  it("full mode tool schemas are unchanged", () => {
    const hash = createHash("sha256").update(serialize(collectTools("full"))).digest("hex");
    expect(hash).toBe(FULL_MODE_SCHEMA_SHA256);
  });

  it("compact mode is meaningfully smaller than full", () => {
    expect(serialize(collectTools("compact")).length).toBeLessThan(serialize(collectTools("full")).length * 0.65);
  });

  it("compact confirm copy keeps the user-intent and decline-is-final rules", () => {
    const tools = collectTools("compact");
    for (const name of ["harness_execute", "harness_create", "harness_update", "harness_delete"]) {
      const props = (tools.get(name)!.schema as { properties: Record<string, { description?: string }> }).properties;
      expect(props.confirm?.description, name).toMatch(/only with user intent/i);
      expect(props.confirm?.description, name).toMatch(/never overrides a user's decline/i);
    }
  });
});
