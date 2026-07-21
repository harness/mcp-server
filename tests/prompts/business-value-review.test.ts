import { describe, it, expect } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { registerBusinessValueReviewPrompt } from "../../src/prompts/business-value-review.js";

async function createTestClient(): Promise<Client> {
  const server = new McpServer(
    { name: "test-server", version: "0.0.1" },
    { capabilities: { prompts: {} } },
  );
  registerBusinessValueReviewPrompt(server);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.0.1" });

  await Promise.all([
    client.connect(clientTransport),
    server.connect(serverTransport),
  ]);

  return client;
}

describe("business-value-review prompt", () => {
  it("appears in the prompt list", async () => {
    const client = await createTestClient();
    const { prompts } = await client.listPrompts();

    const prompt = prompts.find((p) => p.name === "business-value-review");
    expect(prompt).toBeDefined();
    expect(prompt!.description).toContain("Business Value Review");
  });

  it("has the correct optional arguments", async () => {
    const client = await createTestClient();
    const { prompts } = await client.listPrompts();
    const prompt = prompts.find((p) => p.name === "business-value-review")!;

    const argNames = prompt.arguments!.map((a) => a.name);
    expect(argNames).toContain("customer");
    expect(argNames).toContain("quarter");
    expect(argNames).toContain("projectId");

    for (const name of ["customer", "quarter", "projectId"]) {
      expect(prompt.arguments!.find((a) => a.name === name)!.required).toBe(false);
    }
  });

  it("interpolates customer and quarter", async () => {
    const client = await createTestClient();
    const result = await client.getPrompt({
      name: "business-value-review",
      arguments: { customer: "Acme Corp", quarter: "Q2 FY27" },
    });

    expect(result.messages).toHaveLength(1);
    const text = (result.messages[0].content as { type: string; text: string }).text;
    expect(text).toContain("Acme Corp");
    expect(text).toContain("Q2 FY27");
  });

  it("interpolates projectId into a project filter when provided", async () => {
    const client = await createTestClient();
    const result = await client.getPrompt({
      name: "business-value-review",
      arguments: { projectId: "my-project" },
    });

    const text = (result.messages[0].content as { type: string; text: string }).text;
    expect(text).toContain('project_id="my-project"');
  });

  it("omits the project filter when projectId is not provided", async () => {
    const client = await createTestClient();
    const result = await client.getPrompt({
      name: "business-value-review",
      arguments: {},
    });

    const text = (result.messages[0].content as { type: string; text: string }).text;
    expect(text).not.toContain("project_id=");
  });

  it("references consolidated harness_* tools and valid CCM resource_types", async () => {
    const client = await createTestClient();
    const result = await client.getPrompt({ name: "business-value-review", arguments: {} });
    const text = (result.messages[0].content as { type: string; text: string }).text;

    expect(text).toContain("harness_get");
    expect(text).toContain("harness_list");
    expect(text).toContain('resource_type="cost_summary"');
    expect(text).toContain('resource_type="cost_category"');
    expect(text).toContain('resource_type="cost_perspective"');
    expect(text).toContain('resource_type="cost_breakdown"');
    expect(text).toContain('resource_type="cost_timeseries"');
    expect(text).toContain('resource_type="cost_commitment"');
    expect(text).toContain('resource_type="cost_recommendation_stats"');
    expect(text).toContain('resource_type="cost_recommendation"');
    expect(text).toContain('resource_type="cost_anomaly_summary"');

    // Must NOT reference maestro-only tool names
    expect(text).not.toContain("harness_adoption_core_list");
    expect(text).not.toContain("harness_adoption_ccm_governance_savings");
    expect(text).not.toContain("harness_adoption_ccm_budget_health");
    expect(text).not.toContain("harness_adoption_ccm_maturity_chart");
    expect(text).not.toContain("harness_adoption_reports_render");
  });

  it("embeds the 7-dimension maturity rubric and data-integrity guardrails", async () => {
    const client = await createTestClient();
    const result = await client.getPrompt({ name: "business-value-review", arguments: {} });
    const text = (result.messages[0].content as { type: string; text: string }).text;

    for (const dim of [
      "visibility", "allocation", "tooling", "commitment_strategy",
      "anomaly_detection", "optimization", "accountability",
    ]) {
      expect(text).toContain(dim);
    }
    expect(text).toContain("Crawl");
    expect(text).toContain("Walk");
    expect(text).toContain("Run");
    expect(text).toContain("Never invent numbers");
    expect(text).toContain("data unavailable");
  });

  it("defaults to full mermaid mode with radar, diagrams required not optional", async () => {
    const client = await createTestClient();
    const result = await client.getPrompt({ name: "business-value-review", arguments: {} });
    const text = (result.messages[0].content as { type: string; text: string }).text;

    expect(text).toContain("Required diagrams");
    expect(text).toContain("xychart-beta");
    expect(text).toContain("pie");
    // Default is full mermaid mode → radar enabled for the maturity chart.
    expect(text).toContain("full mode — use radar");
    expect(text).toContain("```mermaid");
    expect(text).toContain("radar");
    expect(text).toContain("supporting data table");
    // The prompt must require diagrams, never frame them as optional.
    expect(text).not.toMatch(/optional(?:ly)?\s+.{0,20}(mermaid|diagram|radar)/i);
  });

  it("steers away from radar in explicit auto mode", async () => {
    const client = await createTestClient();
    const result = await client.getPrompt({
      name: "business-value-review",
      arguments: { diagrams: "auto" },
    });
    const text = (result.messages[0].content as { type: string; text: string }).text;

    expect(text).toContain("do NOT use radar");
    expect(text).toContain("xychart-beta");
  });

  it("exposes a diagrams mode argument", async () => {
    const client = await createTestClient();
    const { prompts } = await client.listPrompts();
    const prompt = prompts.find((p) => p.name === "business-value-review")!;
    expect(prompt.arguments!.map((a) => a.name)).toContain("diagrams");
  });

  it("enables radar only in full mermaid mode", async () => {
    const client = await createTestClient();
    const result = await client.getPrompt({
      name: "business-value-review",
      arguments: { diagrams: "mermaid" },
    });
    const text = (result.messages[0].content as { type: string; text: string }).text;

    expect(text).toContain("full mode — use radar");
    expect(text).toContain("```mermaid");
    expect(text).toContain("radar");
  });

  it("suppresses all Mermaid in tables mode", async () => {
    const client = await createTestClient();
    const result = await client.getPrompt({
      name: "business-value-review",
      arguments: { diagrams: "tables" },
    });
    const text = (result.messages[0].content as { type: string; text: string }).text;

    expect(text).toContain("tables");
    expect(text).toContain("do NOT emit any Mermaid");
    expect(text).not.toContain("```mermaid");
    expect(text).not.toContain("xychart-beta");
  });
});
