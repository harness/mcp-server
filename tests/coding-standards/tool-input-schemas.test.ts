/**
 * Validates agent-facing MCP tool input schemas follow coding standards:
 * - Zod 4 import convention
 * - .describe() is the last chain call (descriptions visible on registered schemas)
 */
import { describe, it, expect, vi, beforeAll } from "vitest";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import { Registry } from "../../src/registry/index.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "../..");

const HANDLER_FILES = [
  "src/tools/harness-list.ts",
  "src/tools/harness-get.ts",
  "src/tools/harness-create.ts",
  "src/tools/harness-update.ts",
  "src/tools/harness-delete.ts",
  "src/tools/harness-execute.ts",
  "src/tools/harness-diagnose.ts",
  "src/tools/harness-search.ts",
  "src/tools/harness-describe.ts",
  "src/tools/harness-status.ts",
  "src/tools/harness-schema.ts",
] as const;

/** Zod 4: .describe() before .optional()/.default()/.min()/.max() drops the public description. */
const DESCRIBE_BEFORE_CHAIN = /\.describe\s*\([^)]*\)\s*\.(?:optional|default|min|max)\s*\(/;

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

type RegisteredTool = {
  name: string;
  inputSchema: Record<string, { description?: string | null } | undefined>;
};

function makeCaptureServer() {
  const tools = new Map<string, RegisteredTool>();
  return {
    server: {
      getClientCapabilities: () => ({ elicitation: { form: {} } }),
      elicitInput: vi.fn().mockResolvedValue({ action: "accept", content: { confirm: true } }),
    },
    registerTool: vi.fn((name: string, def: { inputSchema: Record<string, unknown> }) => {
      tools.set(name, {
        name,
        inputSchema: def.inputSchema as RegisteredTool["inputSchema"],
      });
    }),
    getTool(name: string): RegisteredTool {
      const tool = tools.get(name);
      if (!tool) throw new Error(`Tool "${name}" not registered`);
      return tool;
    },
  };
}

describe("Coding standards — tool input schemas", () => {
  it("harness handler files import Zod from zod/v4", () => {
    const violations: string[] = [];
    for (const file of HANDLER_FILES) {
      const content = readFileSync(join(REPO_ROOT, file), "utf8");
      if (!content.includes('from "zod/v4"') && !content.includes("from 'zod/v4'")) {
        violations.push(file);
      }
      if (/from\s+["']zod["']/.test(content)) {
        violations.push(`${file} (bare zod import)`);
      }
    }
    expect(violations, `Use import * as z from "zod/v4":\n${violations.join("\n")}`).toEqual([]);
  });

  it("does not call .describe() before .optional()/.default()/.min()/.max() in handler files", () => {
    const violations: string[] = [];
    for (const file of HANDLER_FILES) {
      const content = readFileSync(join(REPO_ROOT, file), "utf8");
      if (DESCRIBE_BEFORE_CHAIN.test(content)) {
        violations.push(file);
      }
    }
    expect(
      violations,
      `.describe() must be the LAST chain call (Zod 4):\n${violations.join("\n")}`,
    ).toEqual([]);
  });

  describe("registered input schemas expose descriptions on every field", () => {
    let registry: Registry;
    let client: HarnessClient;
    let config: Config;

    beforeAll(() => {
      registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pipelines" }));
      client = makeClient();
      config = makeConfig({ HARNESS_TOOLSETS: "pipelines" });
    });

    const toolRegistrations: Array<{
      toolName: string;
      register: (server: ReturnType<typeof makeCaptureServer>, reg: Registry, cli: HarnessClient, cfg?: Config) => void;
    }> = [];

    beforeAll(async () => {
      const [
        { registerListTool },
        { registerGetTool },
        { registerCreateTool },
        { registerUpdateTool },
        { registerDeleteTool },
        { registerExecuteTool },
        { registerDiagnoseTool },
        { registerSearchTool },
        { registerDescribeTool },
        { registerStatusTool },
        { registerSchemaTool },
      ] = await Promise.all([
        import("../../src/tools/harness-list.js"),
        import("../../src/tools/harness-get.js"),
        import("../../src/tools/harness-create.js"),
        import("../../src/tools/harness-update.js"),
        import("../../src/tools/harness-delete.js"),
        import("../../src/tools/harness-execute.js"),
        import("../../src/tools/harness-diagnose.js"),
        import("../../src/tools/harness-search.js"),
        import("../../src/tools/harness-describe.js"),
        import("../../src/tools/harness-status.js"),
        import("../../src/tools/harness-schema.js"),
      ]);

      toolRegistrations.push(
        { toolName: "harness_list", register: (s, r, c) => registerListTool(s as never, r, c) },
        { toolName: "harness_get", register: (s, r, c) => registerGetTool(s as never, r, c) },
        { toolName: "harness_create", register: (s, r, c, cfg) => registerCreateTool(s as never, r, c, cfg) },
        { toolName: "harness_update", register: (s, r, c, cfg) => registerUpdateTool(s as never, r, c, cfg) },
        { toolName: "harness_delete", register: (s, r, c, cfg) => registerDeleteTool(s as never, r, c, cfg) },
        { toolName: "harness_execute", register: (s, r, c, cfg) => registerExecuteTool(s as never, r, c, cfg) },
        { toolName: "harness_diagnose", register: (s, r, c, cfg) => registerDiagnoseTool(s as never, r, c, cfg!) },
        { toolName: "harness_search", register: (s, r, c) => registerSearchTool(s as never, r, c) },
        { toolName: "harness_describe", register: (s, r) => registerDescribeTool(s as never, r) },
        { toolName: "harness_status", register: (s, r, c, cfg) => registerStatusTool(s as never, r, c, cfg!) },
        { toolName: "harness_schema", register: (s, r, c) => registerSchemaTool(s as never, r, c) },
      );
    });

    it("every registered tool field has a non-empty description", () => {
      for (const entry of toolRegistrations) {
        const capture = makeCaptureServer();
        entry.register(capture, registry, client, config);
        const tool = capture.getTool(entry.toolName);

        for (const [field, schema] of Object.entries(tool.inputSchema)) {
          const desc = schema?.description;
          expect(desc, `${entry.toolName}.${field} must expose a description`).toBeTruthy();
          expect(String(desc).length, `${entry.toolName}.${field} description must be non-empty`).toBeGreaterThan(3);
        }
      }
    });
  });
});
