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

describe("pipeline_summarizer prompt", () => {
  it("appears in the prompt list", async () => {
    const client = await createTestClient();
    const { prompts } = await client.listPrompts();

    const prompt = prompts.find((p) => p.name === "pipeline_summarizer");
    expect(prompt).toBeDefined();
    expect(prompt!.description).toContain("Fetch and summarize ALL step logs");
  });

  it("registers summarize-pipeline as a backward-compatible alias", async () => {
    const client = await createTestClient();
    const { prompts } = await client.listPrompts();

    const alias = prompts.find((p) => p.name === "summarize-pipeline");
    expect(alias).toBeDefined();
    expect(alias!.description).toBe(
      prompts.find((p) => p.name === "pipeline_summarizer")!.description,
    );

    const result = await client.getPrompt({
      name: "summarize-pipeline",
      arguments: { executionId: "exec-legacy" },
    });
    const text = (result.messages[0].content as { type: string; text: string }).text;
    expect(text).toContain('execution_id="exec-legacy"');
  });

  it("has the correct arguments", async () => {
    const client = await createTestClient();
    const { prompts } = await client.listPrompts();
    const prompt = prompts.find((p) => p.name === "pipeline_summarizer")!;

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
      name: "pipeline_summarizer",
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
      name: "pipeline_summarizer",
      arguments: {
        executionId: "https://app.harness.io/ng/#/account/abc/pipelines/exec123",
      },
    });

    const text = (result.messages[0].content as { type: string; text: string }).text;
    expect(text).toContain('url="https://app.harness.io/ng/#/account/abc/pipelines/exec123"');
    expect(text).not.toContain("execution_id=");
  });

  it("references harness_diagnose with include_all_step_logs", async () => {
    const client = await createTestClient();
    const result = await client.getPrompt({
      name: "pipeline_summarizer",
      arguments: { executionId: "exec123" },
    });

    const text = (result.messages[0].content as { type: string; text: string }).text;

    expect(text).toContain("harness_diagnose");
    expect(text).toContain("include_logs: true");
    expect(text).toContain("include_all_step_logs: true");
    expect(text).toContain("all_step_logs");
  });

  it("instructs to summarize every step without skipping", async () => {
    const client = await createTestClient();
    const result = await client.getPrompt({
      name: "pipeline_summarizer",
      arguments: { executionId: "exec123" },
    });

    const text = (result.messages[0].content as { type: string; text: string }).text;

    expect(text).toContain("DO NOT skip any steps");
    expect(text).toContain("summarize every single one");
  });

  it("includes running execution guidance", async () => {
    const client = await createTestClient();
    const result = await client.getPrompt({
      name: "pipeline_summarizer",
      arguments: { executionId: "exec123" },
    });

    const text = (result.messages[0].content as { type: string; text: string }).text;
    expect(text).toContain("non-terminal executions");
    expect(text).toContain('resource_type="execution"');
  });

  it("includes required output table format", async () => {
    const client = await createTestClient();
    const result = await client.getPrompt({
      name: "pipeline_summarizer",
      arguments: { executionId: "exec123" },
    });

    const text = (result.messages[0].content as { type: string; text: string }).text;
    expect(text).toContain("Step Name");
    expect(text).toContain("Status");
    expect(text).toContain("Duration");
    expect(text).toContain("What Happened");
  });
});
