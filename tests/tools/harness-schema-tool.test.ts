import { describe, it, expect } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerSchemaTool } from "../../src/tools/harness-schema.js";

function makeServer() {
  return new McpServer({ name: "test", version: "0.0.0" });
}

describe("registerSchemaTool additionalSchemas", () => {
  it("accepts additionalSchemas without throwing", () => {
    const server = makeServer();
    const extra = {
      DashboardContract: { type: "object", properties: { id: { type: "string" } } },
    };
    expect(() => registerSchemaTool(server, extra)).not.toThrow();
  });

  it("registers without additionalSchemas (backwards compat)", () => {
    const server = makeServer();
    expect(() => registerSchemaTool(server)).not.toThrow();
  });
});
