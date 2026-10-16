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

async function createOptimizeCostsClient(): Promise<Client> {
  const server = new McpServer(
    { name: "test-server", version: "0.0.1" },
    { capabilities: { prompts: {} } },
  );
  registerOptimizeCostsPrompt(server);
  return connect(server);
}

async function createRightsizingClient(): Promise<Client> {
  const server = new McpServer(
    { name: "test-server", version: "0.0.1" },
    { capabilities: { prompts: {} } },
  );
  registerRightsizingPrompt(server);
  return connect(server);
}

function promptText(result: Awaited<ReturnType<Client["getPrompt"]>>): string {
  return (result.messages[0].content as { type: string; text: string }).text;
}

describe("optimize-costs prompt", () => {
  it("appears in the prompt list", async () => {
    const client = await createOptimizeCostsClient();
    const { prompts } = await client.listPrompts();
    const prompt = prompts.find((p) => p.name === "optimize-costs");
    expect(prompt).toBeDefined();
    expect(prompt!.description).toContain("cost");
  });

  it("documents Open-tab defaults and warns against mapping UI dates to days_back", async () => {
    const client = await createOptimizeCostsClient();
    const result = await client.getPrompt({ name: "optimize-costs", arguments: {} });
    const text = promptText(result);

    expect(text).toContain('resource_type="cost_recommendation"');
    expect(text).toContain("compact=false");
    expect(text).toContain("top-level argument");
    expect(text).toContain("days_back=4");
    expect(text).toContain("min_saving=1");
    expect(text).toContain("OPEN");
    expect(text).toContain("Do not map a UI date range to days_back");
    expect(text).toContain("monthlySaving");
  });

  it("injects project_id when projectId argument is provided", async () => {
    const client = await createOptimizeCostsClient();
    const result = await client.getPrompt({
      name: "optimize-costs",
      arguments: { projectId: "ccm-demo" },
    });
    const text = promptText(result);

    expect(text).toContain('project_id="ccm-demo"');
  });
});

describe("rightsizing-recommendations prompt", () => {
  it("appears in the prompt list", async () => {
    const client = await createRightsizingClient();
    const { prompts } = await client.listPrompts();
    const prompt = prompts.find((p) => p.name === "rightsizing-recommendations");
    expect(prompt).toBeDefined();
  });

  it("documents Open-tab stats defaults and compact list guidance", async () => {
    const client = await createRightsizingClient();
    const result = await client.getPrompt({ name: "rightsizing-recommendations", arguments: {} });
    const text = promptText(result);

    expect(text).toContain('resource_type="cost_recommendation_stats"');
    expect(text).toContain('resource_type="cost_recommendation"');
    expect(text).toContain("days_back=4");
    expect(text).toContain("min_saving=1");
    expect(text).toContain("OPEN");
    expect(text).toContain("Do not widen days_back to match a calendar");
    expect(text).toContain("compact=false");
    expect(text).toContain("top-level argument");
    expect(text).toContain("cost_recommendation_filter");
  });

  it("includes min savings threshold when minSavings is set", async () => {
    const client = await createRightsizingClient();
    const result = await client.getPrompt({
      name: "rightsizing-recommendations",
      arguments: { minSavings: "250" },
    });
    const text = promptText(result);

    expect(text).toContain("monthly savings >= $250");
  });

  it("injects project_id filter on harness calls when projectId is set", async () => {
    const client = await createRightsizingClient();
    const result = await client.getPrompt({
      name: "rightsizing-recommendations",
      arguments: { projectId: "rightsizing-proj" },
    });
    const text = promptText(result);

    expect(text).toContain('project_id="rightsizing-proj"');
  });
});
