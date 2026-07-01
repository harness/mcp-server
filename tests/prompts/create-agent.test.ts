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

describe("create-agent prompt", () => {
  it("appears in the prompt list", async () => {
    const client = await createTestClient();
    const { prompts } = await client.listPrompts();

    const prompt = prompts.find((p) => p.name === "create-agent");
    expect(prompt).toBeDefined();
    expect(prompt!.description).toContain("Harness AI agent");
  });

  it("documents allowedDomains network access contract in generated prompt text", async () => {
    const client = await createTestClient();
    const result = await client.getPrompt({
      name: "create-agent",
      arguments: {
        agent_name: "Network Agent",
        task_description: "Call external APIs",
      },
    });

    const text = result.messages
      .map((m) => (m.content.type === "text" ? m.content.text : ""))
      .join("\n");

    expect(text).toContain("allowedDomains");
    expect(text).toContain("PLUGIN_ALLOWED_DOMAINS: ${{inputs.allowedDomains}}");
    expect(text).toMatch(/layout[\s\S]*allowedDomains/);
    expect(text).toMatch(/allowedDomains[\s\S]*default.*""/i);
  });
});
