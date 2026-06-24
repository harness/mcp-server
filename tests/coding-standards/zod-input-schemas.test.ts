/**
 * Ensures every consolidated MCP tool exposes non-empty parameter descriptions
 * on the registered Zod input schema (Zod 4 + MCP SDK contract).
 */
import { describe, it, expect, vi, beforeAll } from "vitest";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import type { ToolResult } from "../../src/utils/response-formatter.js";
import { Registry } from "../../src/registry/index.js";
import { registerAllTools } from "../../src/tools/index.js";

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
    HARNESS_API_KEY: "pat.test.abc.xyz",
    HARNESS_ACCOUNT_ID: "test-account",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "default",
    HARNESS_PROJECT: "test-project",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 3,
    LOG_LEVEL: "info",
  };
}

function makeClient(): HarnessClient {
  return {
    request: vi.fn().mockResolvedValue({}),
    account: "test-account",
  } as unknown as HarnessClient;
}

function makeMcpServer() {
  const tools = new Map<string, { schema: unknown; handler: (...args: unknown[]) => Promise<ToolResult> }>();
  return {
    server: {
      getClientCapabilities: () => ({ elicitation: { form: {} } }),
      elicitInput: vi.fn().mockResolvedValue({ action: "accept", content: { confirm: true } }),
    },
    registerTool: vi.fn((name: string, schema: unknown, handler: (...args: unknown[]) => Promise<ToolResult>) => {
      tools.set(name, { schema, handler });
    }),
    schema(name: string): { inputSchema: Record<string, { description?: string | null } | undefined> } {
      const tool = tools.get(name);
      if (!tool) throw new Error(`Tool "${name}" not registered`);
      return tool.schema as { inputSchema: Record<string, { description?: string | null } | undefined> };
    },
  };
}

describe("Coding standards — registered MCP input schemas", () => {
  const mcp = makeMcpServer();
  const registry = new Registry(makeConfig());
  const client = makeClient();

  beforeAll(() => {
    registerAllTools(mcp as never, registry, client, makeConfig());
  });

  it("registers exactly the 11 consolidated MCP tools", () => {
    const registered = [...mcp.registerTool.mock.calls.map((call) => call[0] as string)].sort();
    expect(registered).toEqual([...ALLOWED_MCP_TOOLS].sort());
  });

  it("exposes a non-empty description on every inputSchema field for all MCP tools", () => {
    const violations: string[] = [];

    for (const toolName of ALLOWED_MCP_TOOLS) {
      const { inputSchema } = mcp.schema(toolName);
      for (const [field, schema] of Object.entries(inputSchema)) {
        const desc = schema?.description;
        if (!desc || desc.trim().length < 5) {
          violations.push(`${toolName}.${field}: missing or too-short description`);
        }
      }
    }

    expect(
      violations,
      `MCP tools must document every input parameter for LLM tool selection:\n${violations.join("\n")}`,
    ).toEqual([]);
  });
});
