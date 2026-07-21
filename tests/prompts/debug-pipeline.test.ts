import { describe, it, expect } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { registerDebugPipelinePrompt } from "../../src/prompts/debug-pipeline.js";

async function createTestClient(): Promise<Client> {
  const server = new McpServer(
    { name: "test-server", version: "0.0.1" },
    { capabilities: { prompts: {} } },
  );
  registerDebugPipelinePrompt(server);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.0.1" });

  await Promise.all([
    client.connect(clientTransport),
    server.connect(serverTransport),
  ]);

  return client;
}

describe("debug-pipeline-failure prompt", () => {
  it("appears in the prompt list", async () => {
    const client = await createTestClient();
    const { prompts } = await client.listPrompts();

    const prompt = prompts.find((p) => p.name === "debug-pipeline-failure");
    expect(prompt).toBeDefined();
    expect(prompt!.description).toContain("Analyze a failed pipeline execution");
  });

  it("registers pipeline_error_analysis as an alias with a distinguishing description", async () => {
    const client = await createTestClient();
    const { prompts } = await client.listPrompts();

    const alias = prompts.find((p) => p.name === "pipeline_error_analysis");
    expect(alias).toBeDefined();
    expect(alias!.description).toContain("Alias of debug-pipeline-failure");
    expect(alias!.description).toContain("analyze a failed pipeline execution");
  });

  it("pipeline_error_analysis returns the same prompt content", async () => {
    const client = await createTestClient();

    const original = await client.getPrompt({
      name: "debug-pipeline-failure",
      arguments: { executionId: "exec-123" },
    });
    const alias = await client.getPrompt({
      name: "pipeline_error_analysis",
      arguments: { executionId: "exec-123" },
    });

    const originalText = (original.messages[0].content as { type: string; text: string }).text;
    const aliasText = (alias.messages[0].content as { type: string; text: string }).text;
    expect(aliasText).toBe(originalText);
  });

  it("interpolates executionId and projectId", async () => {
    const client = await createTestClient();
    const result = await client.getPrompt({
      name: "pipeline_error_analysis",
      arguments: {
        executionId: "exec-abc-123",
        projectId: "my-project",
      },
    });

    expect(result.messages).toHaveLength(1);
    const text = (result.messages[0].content as { type: string; text: string }).text;
    expect(text).toContain('execution_id="exec-abc-123"');
    expect(text).toContain('project_id="my-project"');
  });

  it("detects URL input and uses url param", async () => {
    const client = await createTestClient();
    const result = await client.getPrompt({
      name: "pipeline_error_analysis",
      arguments: {
        executionId: "https://app.harness.io/ng/#/account/abc/pipelines/exec123",
      },
    });

    const text = (result.messages[0].content as { type: string; text: string }).text;
    expect(text).toContain('url="https://app.harness.io/ng/#/account/abc/pipelines/exec123"');
    expect(text).not.toContain("execution_id=");
  });

  it("references harness_diagnose with include_logs", async () => {
    const client = await createTestClient();
    const result = await client.getPrompt({
      name: "pipeline_error_analysis",
      arguments: { executionId: "exec123" },
    });

    const text = (result.messages[0].content as { type: string; text: string }).text;
    expect(text).toContain("harness_diagnose");
    expect(text).toContain("include_logs=true");
  });
});
