import { describe, it, expect } from "vitest";
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

async function getPromptText(args: Record<string, string>): Promise<string> {
  const client = await createTestClient();
  const result = await client.getPrompt({
    name: "create-agent",
    arguments: args,
  });
  return (result.messages[0].content as { type: string; text: string }).text;
}

describe("create-agent prompt", () => {
  it("appears in the prompt list with agent workflow description", async () => {
    const client = await createTestClient();
    const { prompts } = await client.listPrompts();

    const prompt = prompts.find((p) => p.name === "create-agent");
    expect(prompt).toBeDefined();
    expect(prompt!.description).toContain("Harness AI agent");
  });

  it("requires agent_name and task_description arguments", async () => {
    const client = await createTestClient();
    const { prompts } = await client.listPrompts();
    const prompt = prompts.find((p) => p.name === "create-agent")!;

    const agentName = prompt.arguments!.find((a) => a.name === "agent_name")!;
    const taskDescription = prompt.arguments!.find((a) => a.name === "task_description")!;

    expect(agentName.required).toBe(true);
    expect(taskDescription.required).toBe(true);
  });

  it("documents the allowedDomains network access contract", async () => {
    const text = await getPromptText({
      agent_name: "Network Agent",
      task_description: "Call external APIs",
    });

    expect(text).toContain("PLUGIN_ALLOWED_DOMAINS: ${{inputs.allowedDomains}}");
    expect(text).toContain("allowedDomains:");
    expect(text).toContain('default: ""');
    expect(text).toContain("regexes separated by `|`");
    expect(text).toContain("| **Allowed domains**");
  });

  it("includes allowedDomains in the layout block guidance", async () => {
    const text = await getPromptText({
      agent_name: "Layout Agent",
      task_description: "Verify layout fields",
    });

    expect(text).toContain("at most four items");
    expect(text).toContain("`llmConnector`, `allowedDomains`, `modelName`, and `mcpConnectors`");
    expect(text).toContain("- allowedDomains        # always present");
  });

  it("includes allowedDomains in the example agent YAML", async () => {
    const text = await getPromptText({
      agent_name: "Example Agent",
      task_description: "Review pull requests",
    });

    expect(text).toContain("## Example: Code Review Agent");
    expect(text).toMatch(/allowedDomains:\s*\n\s+type: string/);
    expect(text).toMatch(/layout:[\s\S]*- allowedDomains/);
  });
});
