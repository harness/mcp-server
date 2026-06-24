import { describe, expect, it } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { registerCreateAgentPrompt } from "../../src/prompts/create-agent.js";

async function createTestClient(): Promise<Client> {
  const server = new McpServer(
    { name: "test-server", version: "0.0.1" },
    { capabilities: { prompts: {} } },
  );
  registerCreateAgentPrompt(server);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.0.1" });

  await Promise.all([
    client.connect(clientTransport),
    server.connect(serverTransport),
  ]);

  return client;
}

describe("create-agent prompt", () => {
  it("appears in the prompt list", async () => {
    const client = await createTestClient();
    const { prompts } = await client.listPrompts();

    const prompt = prompts.find((p) => p.name === "create-agent");
    expect(prompt).toBeDefined();
    expect(prompt!.description).toContain("Harness AI agent");
  });

  it("requires agent_name and task_description", async () => {
    const client = await createTestClient();
    const { prompts } = await client.listPrompts();
    const prompt = prompts.find((p) => p.name === "create-agent")!;

    const required = prompt.arguments!.filter((a) => a.required).map((a) => a.name);
    expect(required).toContain("agent_name");
    expect(required).toContain("task_description");

    const optional = prompt.arguments!.filter((a) => !a.required).map((a) => a.name);
    expect(optional).toContain("org_id");
    expect(optional).toContain("project_id");
  });

  it("returns workflow text with agent name, task, and scope interpolated", async () => {
    const client = await createTestClient();
    const result = await client.getPrompt({
      name: "create-agent",
      arguments: {
        agent_name: "Code Reviewer",
        task_description: "Review pull requests for security issues",
        org_id: "my-org",
        project_id: "my-project",
      },
    });

    expect(result.messages).toHaveLength(1);
    const text = result.messages[0]!.content as { type: string; text: string };
    expect(text.type).toBe("text");
    expect(text.text).toContain("Code Reviewer");
    expect(text.text).toContain("Review pull requests for security issues");
    expect(text.text).toContain("my-org");
    expect(text.text).toContain("my-project");
    expect(text.text).toContain("harness_list");
    expect(text.text).toContain('resource_type="agent"');
  });

  it("references harness_update for modifying existing agents", async () => {
    const client = await createTestClient();
    const result = await client.getPrompt({
      name: "create-agent",
      arguments: {
        agent_name: "Existing Agent",
        task_description: "Update behavior",
      },
    });

    const text = (result.messages[0]!.content as { text: string }).text;
    expect(text).toContain("harness_update");
    expect(text).toContain("harness_get");
  });
});
