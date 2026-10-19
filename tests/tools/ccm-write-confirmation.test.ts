import { describe, it, expect, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import type { ToolResult } from "../../src/utils/response-formatter.js";
import { Registry } from "../../src/registry/index.js";
import { registerCreateTool } from "../../src/tools/harness-create.js";
import { registerUpdateTool } from "../../src/tools/harness-update.js";

function makeConfig(): Config {
  return {
    HARNESS_API_KEY: "pat.test.abc.xyz",
    HARNESS_ACCOUNT_ID: "test-account",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 3,
    LOG_LEVEL: "info",
  } as Config;
}

function makeClient(requestFn: ReturnType<typeof vi.fn>): HarnessClient {
  return {
    request: requestFn,
    account: "test-account",
  } as unknown as HarnessClient;
}

function makeMcpServer(options: { elicitation?: boolean; action?: "accept" | "decline" } = {}) {
  const tools = new Map<string, { handler: (args: Record<string, unknown>) => Promise<ToolResult> }>();
  const elicitInput = vi.fn().mockResolvedValue(
    options.action === "decline"
      ? { action: "decline" }
      : { action: "accept", content: { confirm: true } },
  );
  const server = {
    server: {
      getClientCapabilities: () => (options.elicitation === false ? {} : { elicitation: { form: {} } }),
      elicitInput,
    },
    registerTool: vi.fn((name: string, _schema: unknown, handler: (args: Record<string, unknown>) => Promise<ToolResult>) => {
      tools.set(name, { handler });
    }),
    async call(name: string, args: Record<string, unknown>): Promise<ToolResult> {
      const tool = tools.get(name);
      if (!tool) throw new Error(`Tool "${name}" not registered`);
      return tool.handler(args);
    },
  };
  return server;
}

const categoryBody = {
  name: "Business Units",
  costTargets: [
    {
      name: "Production",
      rules: [
        {
          viewConditions: [
            { viewField: { fieldName: "Account" }, viewOperator: "IN", values: ["111"] },
          ],
        },
      ],
    },
  ],
  sharedCosts: [
    {
      name: "Platform",
      strategy: "FIXED",
      splits: [{ costTargetName: "Production", percentageContribution: 100 }],
      rules: [],
    },
  ],
  unallocatedCost: { strategy: "HIDE" },
};

describe("CCM write confirmation prompts", () => {
  it("previews chargeback fields before creating a cost category", async () => {
    const request = vi.fn().mockResolvedValue({ data: { uuid: "category-1" } });
    const server = makeMcpServer();
    registerCreateTool(server as unknown as McpServer, new Registry(makeConfig()), makeClient(request), makeConfig());

    const result = await server.call("harness_create", {
      resource_type: "cost_category",
      body: categoryBody,
    });

    expect(result.isError).toBeUndefined();
    expect(request).toHaveBeenCalledOnce();
    const message = server.server.elicitInput.mock.calls[0]![0].message as string;
    expect(message.startsWith("Create cost_category?")).toBe(true);
    expect(message).toContain("strategy HIDE");
    expect(message).toContain("Platform: Production 100%");
    expect(message).toContain("Production: rule 1: Account IN [111]");
    expect(message.indexOf("Chargeback preview:")).toBeLessThan(message.indexOf("strategy HIDE"));
  });

  it("does not dispatch a cost category create when the client cannot prompt", async () => {
    const request = vi.fn().mockResolvedValue({ data: { uuid: "category-1" } });
    const server = makeMcpServer({ elicitation: false });
    registerCreateTool(server as unknown as McpServer, new Registry(makeConfig()), makeClient(request), makeConfig());

    const result = await server.call("harness_create", {
      resource_type: "cost_category",
      body: categoryBody,
    });

    expect(result.isError).toBe(true);
    expect(request).not.toHaveBeenCalled();
    expect(server.server.elicitInput).not.toHaveBeenCalled();
    expect(result.content[0]?.text).toContain("strategy HIDE");
    expect(result.content[0]?.text).toContain("Review before retrying");
  });

  it("previews perspective filters and cost basis before update", async () => {
    const request = vi.fn().mockResolvedValue({ data: { uuid: "view-1" } });
    const server = makeMcpServer();
    registerUpdateTool(server as unknown as McpServer, new Registry(makeConfig()), makeClient(request), makeConfig());

    const result = await server.call("harness_update", {
      resource_type: "cost_perspective",
      resource_id: "view-1",
      body: {
        uuid: "view-1",
        name: "Prod AWS",
        dataSources: ["AWS"],
        viewState: "COMPLETED",
        viewRules: [
          { viewConditions: [{ viewField: { fieldName: "Account" }, viewOperator: "IN", values: ["111"] }] },
        ],
        viewPreferences: {
          showAnomalies: true,
          awsPreferences: { awsCost: "AMORTISED", includeDiscounts: true },
        },
      },
    });

    expect(result.isError).toBeUndefined();
    expect(request).toHaveBeenCalledOnce();
    const message = server.server.elicitInput.mock.calls[0]![0].message as string;
    expect(message).toContain('Update cost_perspective "view-1"?');
    expect(message).toContain("Name: Prod AWS");
    expect(message).toContain("Data sources: AWS");
    expect(message).toContain("View state: COMPLETED");
    expect(message).toContain("Account IN [111]");
    expect(message).toContain("showAnomalies=true");
    expect(message).toContain("AWS AMORTISED (includeDiscounts=true)");
    expect(message).not.toContain("applied when omitted");
  });

  it("does not dispatch a perspective update when the user declines", async () => {
    const request = vi.fn().mockResolvedValue({ data: { uuid: "view-1" } });
    const server = makeMcpServer({ action: "decline" });
    registerUpdateTool(server as unknown as McpServer, new Registry(makeConfig()), makeClient(request), makeConfig());

    const result = await server.call("harness_update", {
      resource_type: "cost_perspective",
      resource_id: "view-1",
      body: { uuid: "view-1", name: "Prod AWS" },
    });

    expect(result.isError).toBe(true);
    expect(request).not.toHaveBeenCalled();
    expect(result.content[0]?.text).toContain("declined");
    expect(result.content[0]?.text).not.toContain("Review before retrying");
  });
});
