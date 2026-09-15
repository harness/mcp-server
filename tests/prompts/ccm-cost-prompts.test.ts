import { describe, it, expect } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { registerOptimizeCostsPrompt } from "../../src/prompts/optimize-costs.js";
import { registerRightsizingPrompt } from "../../src/prompts/rightsizing.js";

async function connect(server: McpServer): Promise<Client> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.0.1" });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  return client;
}

async function createClient(
  register: (server: McpServer) => void,
): Promise<Client> {
  const server = new McpServer(
    { name: "test-server", version: "0.0.1" },
    { capabilities: { prompts: {} } },
  );
  register(server);
  return connect(server);
}

function promptText(result: Awaited<ReturnType<Client["getPrompt"]>>): string {
  return (result.messages[0].content as { type: string; text: string }).text;
}

describe("optimize-costs prompt", () => {
  it("steers agents to Open-tab defaults and top-level compact: false", async () => {
    const client = await createClient(registerOptimizeCostsPrompt);
    const text = promptText(await client.getPrompt({ name: "optimize-costs", arguments: {} }));

    expect(text).toContain('resource_type="cost_recommendation"');
    expect(text).toContain("compact=false");
    expect(text).toContain("top-level argument, not inside params");
    expect(text).toContain("days_back=4");
    expect(text).toContain("min_saving=1");
    expect(text).toContain("OPEN");
    expect(text).toContain("Do not map a UI date range to days_back");
    expect(text).toContain("monthlySaving");
    expect(text).not.toMatch(/params=\{[^}]*compact:\s*false/);
  });

  it("interpolates project_id when provided", async () => {
    const client = await createClient(registerOptimizeCostsPrompt);
    const text = promptText(
      await client.getPrompt({ name: "optimize-costs", arguments: { projectId: "finops-demo" } }),
    );

    expect(text).toContain('project_id="finops-demo"');
  });
});

describe("rightsizing-recommendations prompt", () => {
  it("uses cost_recommendation_stats and list with Open-tab defaults", async () => {
    const client = await createClient(registerRightsizingPrompt);
    const text = promptText(
      await client.getPrompt({ name: "rightsizing-recommendations", arguments: {} }),
    );

    expect(text).toContain('resource_type="cost_recommendation_stats"');
    expect(text).toContain('resource_type="cost_recommendation"');
    expect(text).toContain("days_back=4");
    expect(text).toContain("Do not widen days_back");
    expect(text).toContain("compact=false");
    expect(text).toContain("top-level argument, not inside params");
    expect(text).toContain("cost_recommendation_filter");
    expect(text).not.toMatch(/params=\{[^}]*compact:\s*false/);
  });

  it("interpolates minSavings threshold and project_id", async () => {
    const client = await createClient(registerRightsizingPrompt);
    const text = promptText(
      await client.getPrompt({
        name: "rightsizing-recommendations",
        arguments: { projectId: "ccm-proj", minSavings: "250" },
      }),
    );

    expect(text).toContain('project_id="ccm-proj"');
    expect(text).toContain("monthly savings >= $250");
  });
});
