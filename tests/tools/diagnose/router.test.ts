import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerDiagnoseTool } from "../../../src/tools/harness-diagnose.js";
import { makeConfig, makeClient, makeRegistry, makeExtra } from "./helpers.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Registry } from "../../../src/registry/index.js";
import type { HarnessClient } from "../../../src/client/harness-client.js";
import type { Config } from "../../../src/config.js";

type ToolHandler = (args: Record<string, unknown>, extra: unknown) => Promise<{ content: Array<{ type: string; text: string }> }>;

let capturedHandler: ToolHandler;
let config: Config;
let client: HarnessClient;
let registry: Registry;

function mockServer(): McpServer {
  return {
    registerTool: vi.fn((_name: string, _config: unknown, handler: ToolHandler) => {
      capturedHandler = handler;
    }),
  } as unknown as McpServer;
}

beforeEach(() => {
  config = makeConfig();
  client = makeClient();
  registry = makeRegistry();
  const server = mockServer();
  registerDiagnoseTool(server, registry, client, config);
});

function parseResult(result: { content: Array<{ type: string; text: string }> }): Record<string, unknown> {
  return JSON.parse(result.content[0].text);
}

describe("harness_diagnose router", () => {
  it("defaults to pipeline handler when no resource_type given", async () => {
    const extra = makeExtra();
    const result = await capturedHandler({ execution_id: "exec-001" }, extra);
    const parsed = parseResult(result);

    // Pipeline handler catches dispatch errors internally as execution_error
    // (not the router's error field), proving it routed to pipeline handler
    expect(parsed.execution_error).toBeDefined();
    expect(parsed.execution_error).toContain("execution");
  });

  it("routes to connector handler with explicit resource_type", async () => {
    const extra = makeExtra();
    const result = await capturedHandler({ resource_type: "connector" }, extra);
    const parsed = parseResult(result);

    expect(parsed.error).toContain("resource_id");
  });

  it("routes execution alias to pipeline handler", async () => {
    const extra = makeExtra();
    const result = await capturedHandler({ resource_type: "execution" }, extra);
    const parsed = parseResult(result);

    expect(parsed.error).toContain("execution_id or pipeline_id");
  });

  it("routes gitops_app alias to gitops_application handler", async () => {
    const extra = makeExtra();
    const result = await capturedHandler({ resource_type: "gitops_app", resource_id: "my-app" }, extra);
    const parsed = parseResult(result);

    expect(parsed.error).toContain("agent_id");
  });

  it("returns error for unsupported resource_type", async () => {
    const extra = makeExtra();
    const result = await capturedHandler({ resource_type: "unknown_thing" }, extra);
    const parsed = parseResult(result);

    expect(parsed.error).toContain("not supported");
    expect(parsed.error).toContain("unknown_thing");
  });

  it("auto-detects resource_type from URL", async () => {
    const extra = makeExtra();
    const result = await capturedHandler({
      url: "https://app.harness.io/ng/account/abc/all/orgs/default/projects/proj/setup/connectors/my-conn",
    }, extra);
    const parsed = parseResult(result);

    // Should have routed to connector handler with resource_id extracted
    // Connector handler doesn't throw for resource_id since URL provides it — 
    // it will fail at dispatch level (no mock), proving routing worked
    expect(parsed.error).not.toContain("not supported");
  });
});
