import { describe, it, expect } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { registerCreatePipelinePrompt } from "../../src/prompts/create-pipeline.js";

async function createTestClient(): Promise<Client> {
  const server = new McpServer(
    { name: "test-server", version: "0.0.1" },
    { capabilities: { prompts: {} } },
  );
  registerCreatePipelinePrompt(server);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.0.1" });

  await Promise.all([
    client.connect(clientTransport),
    server.connect(serverTransport),
  ]);

  return client;
}

describe("create-pipeline prompt", () => {
  it("appears in the prompt list", async () => {
    const client = await createTestClient();
    const { prompts } = await client.listPrompts();

    const prompt = prompts.find((p) => p.name === "create-pipeline");
    expect(prompt).toBeDefined();
    expect(prompt!.description).toContain("Generate a new Harness pipeline YAML");
  });

  it("guides agents to skip Git connectors for Harness Code repos", async () => {
    const client = await createTestClient();
    const result = await client.getPrompt({
      name: "create-pipeline",
      arguments: {
        description: "Build and deploy a Node.js service from Harness Code",
        projectId: "my-project",
      },
    });

    const text = (result.messages[0].content as { type: string; text: string }).text;

    expect(text).toContain("Harness Code");
    expect(text).toContain("no Git connector is needed");
    expect(text).toContain("properties.ci.codebase.repoName");
    expect(text).toContain("third-party repos");
    expect(text).toContain('project_id="my-project"');
  });
});
