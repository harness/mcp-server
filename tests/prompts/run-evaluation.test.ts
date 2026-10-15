import { describe, it, expect } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { registerRunEvaluationPrompt } from "../../src/prompts/run-evaluation.js";
import { registerAllPrompts } from "../../src/prompts/index.js";

async function createTestClient(
  register: (server: McpServer) => void = registerRunEvaluationPrompt,
): Promise<Client> {
  const server = new McpServer(
    { name: "test-server", version: "0.0.1" },
    { capabilities: { prompts: {} } },
  );
  register(server);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.0.1" });

  await Promise.all([
    client.connect(clientTransport),
    server.connect(serverTransport),
  ]);

  return client;
}

async function getPromptText(args: Record<string, string> = {}): Promise<string> {
  const client = await createTestClient();
  const result = await client.getPrompt({
    name: "run-evaluation",
    arguments: args,
  });
  return (result.messages[0].content as { type: string; text: string }).text;
}

describe("run-evaluation prompt", () => {
  it("appears in the prompt list with managed offline evaluation description", async () => {
    const client = await createTestClient();
    const { prompts } = await client.listPrompts();

    const prompt = prompts.find((p) => p.name === "run-evaluation");
    expect(prompt).toBeDefined();
    expect(prompt!.description).toContain("managed offline AI evaluation");
  });

  it("is wired into registerAllPrompts (guards against accidental removal)", async () => {
    const client = await createTestClient(registerAllPrompts);
    const { prompts } = await client.listPrompts();
    expect(prompts.find((p) => p.name === "run-evaluation")).toBeDefined();
  });

  it("requires goal and treats org_id and project_id as optional", async () => {
    const client = await createTestClient();
    const { prompts } = await client.listPrompts();
    const prompt = prompts.find((p) => p.name === "run-evaluation")!;

    expect(prompt.arguments!.find((a) => a.name === "goal")!.required).toBe(true);
    expect(prompt.arguments!.find((a) => a.name === "org_id")!.required).toBe(false);
    expect(prompt.arguments!.find((a) => a.name === "project_id")!.required).toBe(false);
  });

  it("interpolates goal and explicit scope", async () => {
    const text = await getPromptText({
      goal: "Score support-bot replies on a JSONL dataset",
      org_id: "myorg",
      project_id: "myproj",
    });

    expect(text).toContain("Score support-bot replies on a JSONL dataset");
    expect(text).toContain("org_id=myorg");
    expect(text).toContain("project_id=myproj");
  });

  it("documents default org/project when scope args are omitted", async () => {
    const text = await getPromptText({ goal: "Smoke test eval flow" });

    expect(text).toContain("Use default HARNESS_ORG");
    expect(text).toContain("Use default HARNESS_PROJECT");
  });

  it("restricts the workflow to managed offline evaluations and forbids fabricated IDs", async () => {
    const text = await getPromptText({ goal: "Evaluate prompt quality" });

    expect(text).toContain("managed offline evaluations only");
    expect(text).toContain("Never fabricate UUIDs");
    expect(text).toContain("storage_type: \"managed\"");
    expect(text).toContain("MCP preflight rejects inaccessible or mismatched references");
  });

  it("guides agents through harness_describe, list, create, execute, and poll steps", async () => {
    const text = await getPromptText({ goal: "End-to-end eval" });

    expect(text).toContain('harness_describe(resource_type="eval_dataset")');
    expect(text).toContain('harness_list(resource_type="eval_dataset")');
    expect(text).toContain('harness_create(resource_type="evaluation"');
    expect(text).toContain('harness_execute(resource_type="evaluation", action="run"');
    expect(text).toContain('harness_list(resource_type="eval_run")');
    expect(text).toContain('harness_get(resource_type="eval_run"');
  });

  it("documents judge_llm_config, run compare, and costly-action confirmation", async () => {
    const text = await getPromptText({ goal: "Judge metrics" });

    expect(text).toContain("judge_llm_config: { connector_ref, model? }");
    expect(text).toContain('harness_execute(resource_type="eval_run", action="compare"');
    expect(text).toContain("explicit confirmation");
    expect(text).toContain("likely cost and external effect");
  });
});
