/**
 * registerAllTools wiring — docs/coding-standards.md §1.
 *
 * Ensures the fixed set of 11 consolidated handlers is the only surface
 * exposed via MCP; new API domains must extend the registry, not add tools.
 */
import { describe, it, expect, vi } from "vitest";
import { registerAllTools } from "../../src/tools/index.js";
import { Registry } from "../../src/registry/index.js";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";

const ALLOWED_MCP_TOOLS = [
  "harness_list",
  "harness_get",
  "harness_create",
  "harness_update",
  "harness_delete",
  "harness_execute",
  "harness_diagnose",
  "harness_search",
  "harness_describe",
  "harness_status",
  "harness_schema",
] as const;

function makeConfig(): Config {
  return {
    HARNESS_API_KEY: "pat.testaccount.testtoken.testsecret",
    HARNESS_ACCOUNT_ID: "testaccount",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "default",
    HARNESS_PROJECT: "test-project",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 3,
    LOG_LEVEL: "info",
  };
}

function makeClient(): HarnessClient {
  return { request: vi.fn() } as unknown as HarnessClient;
}

describe("Coding standards — registerAllTools wiring", () => {
  it("registers exactly the 11 allowed consolidated MCP tools", () => {
    const registry = new Registry(makeConfig());
    const server = { registerTool: vi.fn() };

    registerAllTools(server as never, registry, makeClient(), makeConfig());

    const registered = server.registerTool.mock.calls.map(([name]) => name as string).sort();
    expect(registered).toEqual([...ALLOWED_MCP_TOOLS].sort());
  });

  it("does not register any tool outside the allowed consolidated set", () => {
    const registry = new Registry(makeConfig());
    const server = { registerTool: vi.fn() };

    registerAllTools(server as never, registry, makeClient(), makeConfig());

    const allowed = new Set<string>(ALLOWED_MCP_TOOLS);
    const unexpected = server.registerTool.mock.calls
      .map(([name]) => name as string)
      .filter((name) => !allowed.has(name));

    expect(unexpected, `Unexpected MCP tools registered: ${unexpected.join(", ")}`).toEqual([]);
  });
});
