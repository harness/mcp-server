import { createHash } from "node:crypto";
import { describe, it, expect, vi } from "vitest";
import * as z from "zod/v4";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import { Registry } from "../../src/registry/index.js";
import { registerAllTools } from "../../src/tools/index.js";

// Pinned hash of the full-mode tool schemas (descriptions, input and output schemas as advertised by tools/list). Full mode must stay byte-identical when compact-mode
// copy changes; update this only for an intentional full-mode contract change.
const FULL_MODE_SCHEMA_SHA256 = "6628ca41d3c97a33f652bb37cff80de9c3e37aebaa5ccb96d7fa4a2c312fb2e4";

// Measured: tool descriptions + input and output schemas in compact mode. Measured 21372 B total, 3585 B largest tool; headroom is deliberately small (~5%).
const COMPACT_TOTAL_BUDGET_BYTES = 22500;
const COMPACT_PER_TOOL_BUDGET_BYTES = 3800;

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
  const tools = new Map<string, { description?: string; schema: unknown; output?: unknown }>();
  const server = {
    registerTool: vi.fn((name: string, def: { description?: string; inputSchema: z.ZodRawShape; outputSchema?: z.ZodType }) => {
      tools.set(name, {
        description: def.description,
        schema: z.toJSONSchema(z.object(def.inputSchema)),
        output: def.outputSchema ? z.toJSONSchema(def.outputSchema) : undefined,
      });
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

  // Size budget for compact mode: the point of the mode is a small tools/list. Raise a budget only
  // deliberately and say why in the PR (see docs/schema-budget.md).
  it("compact mode stays within its size budget", () => {
    const tools = collectTools("compact");
    const sizes = [...tools.entries()].map(([name, t]) => [name, JSON.stringify(t).length] as const);
    const total = sizes.reduce((n, [, b]) => n + b, 0);
    const worst = [...sizes].sort((a, b) => b[1] - a[1])[0]!;
    expect(total, `total ${total}B; per tool: ${sizes.map(([n, b]) => `${n}=${b}`).join(" ")}`).toBeLessThanOrEqual(COMPACT_TOTAL_BUDGET_BYTES);
    expect(worst[1], `${worst[0]} is ${worst[1]}B`).toBeLessThanOrEqual(COMPACT_PER_TOOL_BUDGET_BYTES);
  });

  it("compact mode does not inline long enums", () => {
    const longest = (node: unknown): number => {
      if (Array.isArray(node)) return Math.max(0, ...node.map(longest));
      if (node && typeof node === "object") {
        const o = node as Record<string, unknown>;
        const here = Array.isArray(o.enum) ? o.enum.length : 0;
        return Math.max(here, ...Object.values(o).map(longest));
      }
      return 0;
    };
    for (const [name, t] of collectTools("compact")) expect(longest(t.schema), name).toBeLessThanOrEqual(20);
  });
});
