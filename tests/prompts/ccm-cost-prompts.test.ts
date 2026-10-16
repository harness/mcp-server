import { describe, it, expect } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { registerOptimizeCostsPrompt } from "../../src/prompts/optimize-costs.js";
import { registerRightsizingPrompt } from "../../src/prompts/rightsizing.js";
import { registerAllPrompts } from "../../src/prompts/index.js";

async function connect(server: McpServer): Promise<Client> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.0.1" });
  await Promise.all([
    client.connect(clientTransport),
    server.connect(serverTransport),
  ]);
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

describe("optimize-costs prompt", () => {
  it("appears in the prompt list", async () => {
    const client = await createOptimizeCostsClient();
    const { prompts } = await client.listPrompts();
    expect(prompts.find((p) => p.name === "optimize-costs")).toBeDefined();
  });

  it("steers Open-tab list defaults aligned with CCM UI (days_back, min_saving, OPEN)", async () => {
    const client = await createOptimizeCostsClient();
    const result = await client.getPrompt({ name: "optimize-costs", arguments: {} });
    const text = (result.messages[0].content as { type: string; text: string }).text;

    expect(text).toContain('resource_type="cost_recommendation"');
    expect(text).toContain("compact=false");
    expect(text).toContain("top-level argument, not inside params");
    expect(text).toContain("days_back=4");
    expect(text).toContain("min_saving=1");
    expect(text).toContain("OPEN");
    expect(text).toContain("Do not map a UI date range to days_back");
    expect(text).toContain("cost_category + cost_buckets");
  });

  it("interpolates optional project_id on recommendation and anomaly calls", async () => {
    const client = await createOptimizeCostsClient();
    const result = await client.getPrompt({
      name: "optimize-costs",
      arguments: { projectId: "ccm-demo" },
    });
    const text = (result.messages[0].content as { type: string; text: string }).text;

    expect(text).toContain('project_id="ccm-demo"');
    expect(text).toContain('resource_type="cost_anomaly"');
  });
});

describe("rightsizing-recommendations prompt", () => {
  it("appears in the prompt list with optional minSavings argument", async () => {
    const client = await createRightsizingClient();
    const { prompts } = await client.listPrompts();
    const prompt = prompts.find((p) => p.name === "rightsizing-recommendations");
    expect(prompt).toBeDefined();
    expect(prompt!.arguments!.map((a) => a.name)).toEqual(expect.arrayContaining(["projectId", "minSavings"]));
  });

  it("uses cost_recommendation_stats before listing rows (Open-tab defaults)", async () => {
    const client = await createRightsizingClient();
    const result = await client.getPrompt({ name: "rightsizing-recommendations", arguments: {} });
    const text = (result.messages[0].content as { type: string; text: string }).text;

    expect(text).toContain('resource_type="cost_recommendation_stats"');
    expect(text).toContain("days_back=4");
    expect(text).toContain("min_saving=1");
    expect(text).toContain("OPEN");
    expect(text).toContain("Do not widen days_back to match a calendar");
    expect(text).toContain('params={group_by: "type"}');
  });

  it("requires top-level compact: false on recommendation list for monthlySaving", async () => {
    const client = await createRightsizingClient();
    const result = await client.getPrompt({ name: "rightsizing-recommendations", arguments: {} });
    const text = (result.messages[0].content as { type: string; text: string }).text;

    expect(text).toContain('resource_type="cost_recommendation"');
    expect(text).toContain("compact=false");
    expect(text).toContain("top-level argument, not inside params");
    expect(text).toContain("monthlySaving");
    expect(text).toContain("cost_recommendation_filter");
  });

  it("documents harness_execute actions for state updates and ticketing", async () => {
    const client = await createRightsizingClient();
    const result = await client.getPrompt({ name: "rightsizing-recommendations", arguments: {} });
    const text = (result.messages[0].content as { type: string; text: string }).text;

    expect(text).toContain('action="update_state"');
    expect(text).toContain('action="create_jira_ticket"');
    expect(text).toContain('action="create_snow_ticket"');
    expect(text).toContain("Present recommendations for review before taking any action");
  });

  it("interpolates project filter and min savings threshold", async () => {
    const client = await createRightsizingClient();
    const result = await client.getPrompt({
      name: "rightsizing-recommendations",
      arguments: { projectId: "finops", minSavings: "250" },
    });
    const text = (result.messages[0].content as { type: string; text: string }).text;

    expect(text).toContain('project_id="finops"');
    expect(text).toContain(">= $250");
  });

  it("is wired into registerAllPrompts", async () => {
    const server = new McpServer(
      { name: "test-server", version: "0.0.1" },
      { capabilities: { prompts: {} } },
    );
    registerAllPrompts(server);
    const client = await connect(server);
    const { prompts } = await client.listPrompts();
    expect(prompts.find((p) => p.name === "optimize-costs")).toBeDefined();
    expect(prompts.find((p) => p.name === "rightsizing-recommendations")).toBeDefined();
  });
});
