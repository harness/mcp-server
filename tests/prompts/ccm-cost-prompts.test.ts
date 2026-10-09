import { describe, it, expect } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { registerOptimizeCostsPrompt } from "../../src/prompts/optimize-costs.js";
import { registerRightsizingPrompt } from "../../src/prompts/rightsizing.js";
import { registerBusinessValueReviewPrompt } from "../../src/prompts/business-value-review.js";

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

async function createBusinessValueReviewClient(): Promise<Client> {
  const server = new McpServer(
    { name: "test-server", version: "0.0.1" },
    { capabilities: { prompts: {} } },
  );
  registerBusinessValueReviewPrompt(server);
  return connect(server);
}

function promptText(result: Awaited<ReturnType<Client["getPrompt"]>>): string {
  return (result.messages[0].content as { type: string; text: string }).text;
}

describe("optimize-costs prompt — CCM Open-tab alignment (#948)", () => {
  it("appears in the prompt list", async () => {
    const client = await createOptimizeCostsClient();
    const { prompts } = await client.listPrompts();
    expect(prompts.find((p) => p.name === "optimize-costs")).toBeDefined();
  });

  it("steers cost_recommendation list to Open-tab defaults and top-level compact: false", async () => {
    const client = await createOptimizeCostsClient();
    const result = await client.getPrompt({ name: "optimize-costs", arguments: {} });
    const text = promptText(result);

    expect(text).toContain('resource_type="cost_recommendation"');
    expect(text).toContain("compact=false");
    expect(text).toContain("top-level argument, not inside params");
    expect(text).toContain("days_back=4");
    expect(text).toContain("OPEN");
    expect(text).toContain("Do not map a UI date range to days_back");
    expect(text).toContain("monthlySaving");
    expect(text).toContain("cost_category");
  });

  it("interpolates optional projectId into harness_list calls", async () => {
    const client = await createOptimizeCostsClient();
    const result = await client.getPrompt({
      name: "optimize-costs",
      arguments: { projectId: "finops-proj" },
    });
    const text = promptText(result);

    expect(text).toContain('project_id="finops-proj"');
  });
});

describe("rightsizing-recommendations prompt — CCM Open-tab alignment (#948)", () => {
  it("appears in the prompt list", async () => {
    const client = await createRightsizingClient();
    const { prompts } = await client.listPrompts();
    expect(prompts.find((p) => p.name === "rightsizing-recommendations")).toBeDefined();
  });

  it("uses stats defaults and forbids widening days_back for calendar windows", async () => {
    const client = await createRightsizingClient();
    const result = await client.getPrompt({ name: "rightsizing-recommendations", arguments: {} });
    const text = promptText(result);

    expect(text).toContain('resource_type="cost_recommendation_stats"');
    expect(text).toContain("days_back=4");
    expect(text).toContain("Do not widen days_back to match a calendar");
    expect(text).toContain('resource_type="cost_recommendation"');
    expect(text).toContain("compact=false");
    expect(text).toContain("top-level argument, not inside params");
    expect(text).toContain("cost_recommendation_filter");
  });

  it("interpolates minSavings threshold into the workflow text", async () => {
    const client = await createRightsizingClient();
    const result = await client.getPrompt({
      name: "rightsizing-recommendations",
      arguments: { minSavings: "250" },
    });
    const text = promptText(result);

    expect(text).toContain("monthly savings >= $250");
  });

  it("documents execute actions for state and ticketing", async () => {
    const client = await createRightsizingClient();
    const result = await client.getPrompt({ name: "rightsizing-recommendations", arguments: {} });
    const text = promptText(result);

    expect(text).toContain('action="update_state"');
    expect(text).toContain('action="create_jira_ticket"');
    expect(text).toContain('action="create_snow_ticket"');
  });
});

describe("business-value-review prompt — recommendation freshness guard (#948)", () => {
  it("documents Open-tab defaults and forbids mapping review calendar to days_back", async () => {
    const client = await createBusinessValueReviewClient();
    const result = await client.getPrompt({ name: "business-value-review", arguments: {} });
    const text = promptText(result);

    expect(text).toContain("Open-tab defaults are built in");
    expect(text).toContain("days_back=4");
    expect(text).toContain("Do **not** map the UI date picker or review calendar to `days_back`");
    expect(text).toContain("applied_at_start");
    expect(text).toContain("recommendation_states=APPLIED");
    expect(text).toContain("Do not use `days_back` for this window");
  });
});
