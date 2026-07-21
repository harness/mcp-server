import { describe, it, expect } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { registerBusinessValueReviewPrompt } from "../../src/prompts/business-value-review.js";
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

async function createTestClient(): Promise<Client> {
  const server = new McpServer(
    { name: "test-server", version: "0.0.1" },
    { capabilities: { prompts: {} } },
  );
  registerBusinessValueReviewPrompt(server);
  return connect(server);
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
    expect(argNames).toContain("diagrams");
    // projectId was removed — CCM is account-scoped, the filter was ineffective.
    expect(argNames).not.toContain("projectId");

    for (const name of ["customer", "quarter", "diagrams"]) {
      expect(prompt.arguments!.find((a) => a.name === name)!.required).toBe(false);
    }
  });

  it("exposes descriptions on every argument (zod .optional().describe() order)", async () => {
    const client = await createTestClient();
    const { prompts } = await client.listPrompts();
    const prompt = prompts.find((p) => p.name === "business-value-review")!;

    for (const arg of prompt.arguments!) {
      expect(arg.description, `arg "${arg.name}" must have a description`).toBeTruthy();
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

  it("never emits a project_id filter (CCM is account-scoped)", async () => {
    const client = await createTestClient();
    const result = await client.getPrompt({
      name: "business-value-review",
      arguments: { customer: "Acme", quarter: "Q1" },
    });

    const text = (result.messages[0].content as { type: string; text: string }).text;
    expect(text).not.toContain("project_id=");
    expect(text).toContain("CCM data is account-scoped");
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
    // Default is full mermaid mode → radar-beta enabled for the maturity chart.
    expect(text).toContain("full mode — use radar-beta");
    expect(text).toContain("```mermaid");
    expect(text).toContain("radar-beta");
    expect(text).toContain("supporting data table");
    // The prompt must require diagrams, never frame them as optional.
    expect(text).not.toMatch(/optional(?:ly)?\s+.{0,20}(mermaid|diagram|radar)/i);
  });

  it("uses radar-beta (not the invalid bare radar keyword) and placeholder scores", async () => {
    const client = await createTestClient();
    const result = await client.getPrompt({
      name: "business-value-review",
      arguments: { diagrams: "mermaid" },
    });
    const text = (result.messages[0].content as { type: string; text: string }).text;

    expect(text).toContain("radar-beta");
    // The maturity curve must be a placeholder, not fabricated fixed scores.
    expect(text).toContain("curve current{<vis>,<alloc>,<tool>,<comm>,<anom>,<opt>,<acct>}");
    expect(text).not.toContain("curve current{2,2,1,3,2,2,3}");
  });

  it("steers away from radar-beta in explicit auto mode", async () => {
    const client = await createTestClient();
    const result = await client.getPrompt({
      name: "business-value-review",
      arguments: { diagrams: "auto" },
    });
    const text = (result.messages[0].content as { type: string; text: string }).text;

    expect(text).toContain("do NOT use radar-beta");
    expect(text).toContain("xychart-beta");
    expect(text).not.toContain("```mermaid");
  });

  it("exposes a diagrams mode argument", async () => {
    const client = await createTestClient();
    const { prompts } = await client.listPrompts();
    const prompt = prompts.find((p) => p.name === "business-value-review")!;
    expect(prompt.arguments!.map((a) => a.name)).toContain("diagrams");
  });

  it("enables radar-beta only in full mermaid mode", async () => {
    const client = await createTestClient();
    const result = await client.getPrompt({
      name: "business-value-review",
      arguments: { diagrams: "mermaid" },
    });
    const text = (result.messages[0].content as { type: string; text: string }).text;

    expect(text).toContain("full mode — use radar-beta");
    expect(text).toContain("```mermaid");
    expect(text).toContain("radar-beta");
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

  it("is wired into registerAllPrompts (guards against accidental removal)", async () => {
    const server = new McpServer(
      { name: "test-server", version: "0.0.1" },
      { capabilities: { prompts: {} } },
    );
    registerAllPrompts(server);
    const client = await connect(server);

    const { prompts } = await client.listPrompts();
    expect(prompts.find((p) => p.name === "business-value-review")).toBeDefined();
  });

  it("uses harness_list (not harness_get) for CCM metadata and summary", async () => {
    const client = await createTestClient();
    const result = await client.getPrompt({ name: "business-value-review", arguments: {} });
    const text = (result.messages[0].content as { type: string; text: string }).text;

    // Step 0 metadata + Step 3 summary are list operations; only budget status is a get.
    expect(text).toMatch(/harness_list.*resource_type="cost_summary".*no perspective_id/s);
    expect(text).toContain("budget status");
    // Guard against reintroducing the harness_get-for-metadata bug.
    expect(text).not.toMatch(/harness_get with resource_type="cost_summary".*no perspective_id/s);
  });

  it("computes recommendation subtotal from stats, not summed list rows", async () => {
    const client = await createTestClient();
    const result = await client.getPrompt({ name: "business-value-review", arguments: {} });
    const text = (result.messages[0].content as { type: string; text: string }).text;

    expect(text).toContain("Authoritative totals");
    expect(text).toContain("do NOT compute the section subtotal by summing these 25 rows");
  });

  it("separates active anomalies from the all-status summary", async () => {
    const client = await createTestClient();
    const result = await client.getPrompt({ name: "business-value-review", arguments: {} });
    const text = (result.messages[0].content as { type: string; text: string }).text;

    expect(text).toContain('resource_type="cost_anomaly"');
    expect(text).toContain('status: "ACTIVE"');
    expect(text).toContain("NOT status-filtered");
  });

  it("distinguishes a confirmed zero from a silent-empty response (all sections)", async () => {
    const client = await createTestClient();
    const result = await client.getPrompt({ name: "business-value-review", arguments: {} });
    const text = (result.messages[0].content as { type: string; text: string }).text;

    expect(text).toContain("Distinguish a confirmed zero from a silent-empty response");
    expect(text).toContain("applies to EVERY section");
    expect(text).toContain("is NOT proof that the real value is zero");
    // An unverified empty must not become a positive finding.
    expect(text).toContain('"clean queue"');
  });

  it("requires corroboration before reporting a clean anomaly queue as Run", async () => {
    const client = await createTestClient();
    const result = await client.getPrompt({ name: "business-value-review", arguments: {} });
    const text = (result.messages[0].content as { type: string; text: string }).text;

    expect(text).toContain("Zero-active handling");
    expect(text).toContain("explicit `total: 0`");
    // Unconfirmable zero → N/A, not a best-case score.
    expect(text).toContain("score `anomaly_detection` **N/A**");
  });

  it("guards allocation math against zero/invalid totals and validates commitment dates", async () => {
    const client = await createTestClient();
    const result = await client.getPrompt({ name: "business-value-review", arguments: {} });
    const text = (result.messages[0].content as { type: string; text: string }).text;

    expect(text).toContain("do NOT divide by zero");
    expect(text).toContain("Validate the dates before every call");
    expect(text).toContain("strictly before");
  });

  it("warns that cost_breakdown lacks BUSINESS_MAPPING group-by", async () => {
    const client = await createTestClient();
    const result = await client.getPrompt({ name: "business-value-review", arguments: {} });
    const text = (result.messages[0].content as { type: string; text: string }).text;

    expect(text).toContain("resolves any non-predefined");
    expect(text).toContain("LABEL");
  });

  it("enforces a single reporting window across all queries", async () => {
    const client = await createTestClient();
    const result = await client.getPrompt({ name: "business-value-review", arguments: {} });
    const text = (result.messages[0].content as { type: string; text: string }).text;

    expect(text).toContain("Pick ONE reporting window and reuse it everywhere");
    expect(text).toContain("REVIEW_START");
    expect(text).toContain("Do NOT mix a quarter headline with 30-day anomalies");
  });

  it("scopes commitment analysis to EC2-only, no RDS/ElastiCache figures or fixed discount", async () => {
    const client = await createTestClient();
    const result = await client.getPrompt({ name: "business-value-review", arguments: {} });
    const text = (result.messages[0].content as { type: string; text: string }).text;

    expect(text).toContain("treat these figures as EC2-only");
    expect(text).toContain("Do NOT report RDS or ElastiCache");
    // The old commitment-section instruction that told the model to APPLY a
    // ~40% RI discount must be gone. (The global guardrail may still cite
    // "~40% RI discount" as a forbidden example — that's expected.)
    expect(text).not.toContain("× ~40% RI discount = annual opportunity");
  });

  it("requires N/A for maturity dimensions lacking evidence and excludes them from averages", async () => {
    const client = await createTestClient();
    const result = await client.getPrompt({ name: "business-value-review", arguments: {} });
    const text = (result.messages[0].content as { type: string; text: string }).text;

    expect(text).toContain("Do not force a score when the backing data is missing");
    expect(text).toContain("mark that dimension **N/A**");
    expect(text).toContain("exclude N/A dimensions");
  });

  it("guards allocation against a false 100% when no unattributed row exists", async () => {
    const client = await createTestClient();
    const result = await client.getPrompt({ name: "business-value-review", arguments: {} });
    const text = (result.messages[0].content as { type: string; text: string }).text;

    expect(text).toContain("do NOT report 100% allocation");
  });

  it("uses the response count for active anomalies, not one page of rows", async () => {
    const client = await createTestClient();
    const result = await client.getPrompt({ name: "business-value-review", arguments: {} });
    const text = (result.messages[0].content as { type: string; text: string }).text;

    expect(text).toContain("do not equate the count with the number of rows returned");
    expect(text).toContain("paginate with");
  });

  it("forbids fabricated rates/discounts globally (incl. recommendations matrix)", async () => {
    const client = await createTestClient();
    const result = await client.getPrompt({ name: "business-value-review", arguments: {} });
    const text = (result.messages[0].content as { type: string; text: string }).text;

    expect(text).toContain("Never apply a fabricated rate, ratio, or discount");
    expect(text).toContain("recommendations matrix");
  });

  it("requires dollar figures to be individually traceable (no rolled-up ~$X)", async () => {
    const client = await createTestClient();
    const result = await client.getPrompt({ name: "business-value-review", arguments: {} });
    const text = (result.messages[0].content as { type: string; text: string }).text;

    expect(text).toContain("Dollar figures must be individually traceable");
    expect(text).toContain("Quick Wins");
    expect(text).toContain("enumerate the exact per-item savings");
  });

  it("requires allocation to be N/A (not Crawl/1.0) when unmeasurable", async () => {
    const client = await createTestClient();
    const result = await client.getPrompt({ name: "business-value-review", arguments: {} });
    const text = (result.messages[0].content as { type: string; text: string }).text;

    expect(text).toContain("Critical — allocation specifically");
    expect(text).toContain("score `allocation` = **N/A**, NOT 1.0/Crawl");
    expect(text).toContain('do not conflate "couldn\'t measure" with "0% allocated"');
  });

  it("instructs compact: false on recommendation/breakdown/timeseries list calls", async () => {
    const client = await createTestClient();
    const result = await client.getPrompt({ name: "business-value-review", arguments: {} });
    const text = (result.messages[0].content as { type: string; text: string }).text;

    expect(text).toContain("compact: false");
    // The recommendation list specifically must call out per-item monthlySaving.
    expect(text).toContain("required to get per-item `monthlySaving`");
  });

  it("targets historical quarters via start_time/end_time on perspective calls", async () => {
    const client = await createTestClient();
    const result = await client.getPrompt({ name: "business-value-review", arguments: {} });
    const text = (result.messages[0].content as { type: string; text: string }).text;

    // Perspective calls now accept an explicit epoch-ms window — no month-summing hack.
    expect(text).toContain("REVIEW_START_MS");
    expect(text).toContain("REVIEW_END_MS");
    expect(text).toContain("pass `start_time`/`end_time` directly");
    // Must warn LAST_QUARTER won't match a named past quarter.
    expect(text).toContain("do NOT rely on `LAST_QUARTER`");
    // The old manual month-summing workaround must be gone as an INSTRUCTION.
    // (The prompt may still say "do NOT sum months manually" as a prohibition.)
    expect(text).toContain("do NOT rely on `LAST_QUARTER`");
    expect(text).not.toContain("sum the specific calendar months");
    expect(text).not.toContain("**sum the target quarter");
    // Fiscal vs calendar ambiguity must be surfaced, not assumed.
    expect(text).toContain("Fiscal vs calendar");
  });
});
