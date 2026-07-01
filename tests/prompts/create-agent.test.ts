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
  const content = result.messages[0].content as { type: string; text: string };
  return content.text;
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

    const agentName = prompt.arguments!.find((a) => a.name === "agent_name")!;
    const taskDescription = prompt.arguments!.find((a) => a.name === "task_description")!;
    expect(agentName.required).toBe(true);
    expect(taskDescription.required).toBe(true);
  });

  it("documents PLUGIN_ALLOWED_DOMAINS wired to allowedDomains input", async () => {
    const text = await getPromptText({
      agent_name: "PR Reviewer",
      task_description: "Review pull requests for security issues",
    });

    expect(text).toContain("PLUGIN_ALLOWED_DOMAINS: ${{inputs.allowedDomains}}");
    expect(text).toContain("allowedDomains:");
    expect(text).toContain('default: ""');
    expect(text).toContain("Always include `allowedDomains`");
  });

  it("requires allowedDomains in the layout block", async () => {
    const text = await getPromptText({
      agent_name: "Code Coverage Agent",
      task_description: "Measure and report code coverage",
    });

    expect(text).toContain("- allowedDomains");
    expect(text).toContain("Always include `allowedDomains`");
    expect(text).toContain("at most four items");
    expect(text).toContain("llmConnector");
    expect(text).toContain("mcpConnectors");
  });

  it("interpolates agent metadata and scope", async () => {
    const text = await getPromptText({
      agent_name: "PR Reviewer",
      task_description: "Review pull requests",
      org_id: "my-org",
      project_id: "my-project",
    });

    expect(text).toContain("**Agent Name**: PR Reviewer");
    expect(text).toContain("**Task**: Review pull requests");
    expect(text).toContain("Org: my-org");
    expect(text).toContain("Project: my-project");
  });
});
