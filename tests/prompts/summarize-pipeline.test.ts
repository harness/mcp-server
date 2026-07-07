import { describe, it, expect } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { registerSummarizePipelinePrompt } from "../../src/prompts/summarize-pipeline.js";

async function createTestClient(): Promise<Client> {
  const server = new McpServer(
    { name: "test-server", version: "0.0.1" },
    { capabilities: { prompts: {} } },
  );
  registerSummarizePipelinePrompt(server);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.0.1" });

  await Promise.all([
    client.connect(clientTransport),
    server.connect(serverTransport),
  ]);

  return client;
}

describe("summarize-pipeline prompt", () => {
  it("appears in the prompt list", async () => {
    const client = await createTestClient();
    const { prompts } = await client.listPrompts();

    const prompt = prompts.find((p) => p.name === "summarize-pipeline");
    expect(prompt).toBeDefined();
    expect(prompt!.description).toContain("Summarize an entire pipeline execution");
  });

  it("has the correct arguments", async () => {
    const client = await createTestClient();
    const { prompts } = await client.listPrompts();
    const prompt = prompts.find((p) => p.name === "summarize-pipeline")!;

    const argNames = prompt.arguments!.map((a) => a.name);
    expect(argNames).toContain("executionId");
    expect(argNames).toContain("projectId");

    const executionId = prompt.arguments!.find((a) => a.name === "executionId")!;
    expect(executionId.required).toBe(false);

    const projectId = prompt.arguments!.find((a) => a.name === "projectId")!;
    expect(projectId.required).toBe(false);
  });

  it("interpolates executionId and projectId", async () => {
    const client = await createTestClient();
    const result = await client.getPrompt({
      name: "summarize-pipeline",
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
      name: "summarize-pipeline",
      arguments: {
        executionId: "https://app.harness.io/ng/#/account/abc/pipelines/exec123",
      },
    });

    const text = (result.messages[0].content as { type: string; text: string }).text;
    expect(text).toContain('url="https://app.harness.io/ng/#/account/abc/pipelines/exec123"');
    expect(text).not.toContain("execution_id=");
  });

  it("references consolidated harness_* tools, not legacy names", async () => {
    const client = await createTestClient();
    const result = await client.getPrompt({
      name: "summarize-pipeline",
      arguments: { executionId: "exec123" },
    });

    const text = (result.messages[0].content as { type: string; text: string }).text;

    expect(text).toContain("harness_diagnose");
    expect(text).toContain("harness_get");
    expect(text).toContain('resource_type="execution_log"');
    expect(text).toContain('resource_type="pipeline"');

    // Must NOT reference legacy tool names
    expect(text).not.toContain("get_execution");
    expect(text).not.toContain("download_execution_logs");
    expect(text).not.toContain("get_pipeline");
  });

  it("includes selective log-fetching guidance", async () => {
    const client = await createTestClient();
    const result = await client.getPrompt({
      name: "summarize-pipeline",
      arguments: { executionId: "exec123" },
    });

    const text = (result.messages[0].content as { type: string; text: string }).text;

    expect(text).toContain("selectively");
    expect(text).toContain("do NOT fetch logs for every step");
    expect(text).toContain("Slowest steps");
    expect(text).toContain("Failed steps");
  });

  it("includes differentiation from debug-pipeline-failure", async () => {
    const client = await createTestClient();
    const result = await client.getPrompt({
      name: "summarize-pipeline",
      arguments: { executionId: "exec123" },
    });

    const text = (result.messages[0].content as { type: string; text: string }).text;
    expect(text).toContain("Unlike debug-pipeline-failure");
  });

  it("includes running execution guidance", async () => {
    const client = await createTestClient();
    const result = await client.getPrompt({
      name: "summarize-pipeline",
      arguments: { executionId: "exec123" },
    });

    const text = (result.messages[0].content as { type: string; text: string }).text;
    expect(text).toContain("non-terminal executions");
    expect(text).toContain('resource_type="execution"');
  });
});
