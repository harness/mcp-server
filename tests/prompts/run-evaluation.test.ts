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

async function getPromptText(args: Record<string, string>): Promise<string> {
  const client = await createTestClient();
  const result = await client.getPrompt({
    name: "run-evaluation",
    arguments: args,
  });
  return (result.messages[0].content as { type: string; text: string }).text;
}

describe("run-evaluation prompt", () => {
  it("appears in the prompt list with managed offline workflow description", async () => {
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

    const goal = prompt.arguments!.find((a) => a.name === "goal")!;
    const orgId = prompt.arguments!.find((a) => a.name === "org_id")!;
    const projectId = prompt.arguments!.find((a) => a.name === "project_id")!;

    expect(goal.required).toBe(true);
    expect(orgId.required).toBeFalsy();
    expect(projectId.required).toBeFalsy();
  });

  it("interpolates goal and explicit scope", async () => {
    const text = await getPromptText({
      goal: "Compare prompt v2 on support tickets",
      org_id: "myorg",
      project_id: "myproj",
    });

    expect(text).toContain("Compare prompt v2 on support tickets");
    expect(text).toContain("org_id=myorg");
    expect(text).toContain("project_id=myproj");
  });

  it("defaults scope to HARNESS_ORG and HARNESS_PROJECT when omitted", async () => {
    const text = await getPromptText({ goal: "Smoke-test retrieval quality" });

    expect(text).toContain("Use default HARNESS_ORG");
    expect(text).toContain("Use default HARNESS_PROJECT");
  });

  it("documents managed-offline safety rules and MCP tool flow", async () => {
    const text = await getPromptText({ goal: "Evaluate RAG answers" });

    expect(text).toContain("managed offline evaluations only");
    expect(text).toContain("Never fabricate UUIDs");
    expect(text).toContain("judge_llm_config: { connector_ref, model? }");
    expect(text).toContain('storage_type: "managed"');
    expect(text).toContain('harness_describe(resource_type="eval_dataset")');
    expect(text).toContain('harness_create(resource_type="evaluation"');
    expect(text).toContain('harness_execute(resource_type="evaluation", action="run"');
    expect(text).toContain("explicit confirmation");
    expect(text).toContain('harness_execute(resource_type="eval_run", action="compare"');
    expect(text).toContain("bulk_delete");
    expect(text).toContain("destructive scope");
    expect(text).toContain("clone");
    expect(text).toContain("item_history");
  });
});
