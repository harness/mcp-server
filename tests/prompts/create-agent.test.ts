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

async function getPromptText(args: {
  agent_name: string;
  task_description: string;
  org_id?: string;
  project_id?: string;
}): Promise<string> {
  const client = await createTestClient();
  const result = await client.getPrompt({
    name: "create-agent",
    arguments: args,
  });
  return (result.messages[0].content as { type: string; text: string }).text;
}

describe("create-agent prompt", () => {
  it("appears in the prompt list", async () => {
    const client = await createTestClient();
    const { prompts } = await client.listPrompts();

    const prompt = prompts.find((p) => p.name === "create-agent");
    expect(prompt).toBeDefined();
    expect(prompt!.description).toContain("Harness AI agent");
  });

  it("has the correct arguments", async () => {
    const client = await createTestClient();
    const { prompts } = await client.listPrompts();
    const prompt = prompts.find((p) => p.name === "create-agent")!;

    const argNames = prompt.arguments!.map((a) => a.name);
    expect(argNames).toEqual(
      expect.arrayContaining(["agent_name", "task_description", "org_id", "project_id"]),
    );

    expect(prompt.arguments!.find((a) => a.name === "agent_name")!.required).toBe(true);
    expect(prompt.arguments!.find((a) => a.name === "task_description")!.required).toBe(true);
    expect(prompt.arguments!.find((a) => a.name === "org_id")!.required).toBe(false);
    expect(prompt.arguments!.find((a) => a.name === "project_id")!.required).toBe(false);
  });

  it("interpolates agent name, task, and scope", async () => {
    const text = await getPromptText({
      agent_name: "PR Reviewer",
      task_description: "Review pull requests for security issues",
      org_id: "my-org",
      project_id: "my-project",
    });

    expect(text).toContain("**Agent Name**: PR Reviewer");
    expect(text).toContain("**Task**: Review pull requests for security issues");
    expect(text).toContain("Org: my-org");
    expect(text).toContain("Project: my-project");
  });

  it("documents the allowedDomains network-access contract", async () => {
    const text = await getPromptText({
      agent_name: "Network Agent",
      task_description: "Call external APIs",
    });

    expect(text).toContain("PLUGIN_ALLOWED_DOMAINS: ${{inputs.allowedDomains}}");
    expect(text).toContain("allowedDomains:");
    expect(text).toContain('type: string');
    expect(text).toContain('default: ""');
    expect(text).toContain("domains matching `allowedDomains`");
    expect(text).toContain("regexes separated by `|`");
    expect(text).toContain("Always include `allowedDomains`");
  });

  it("requires allowedDomains in the layout block and caps layout items at four", async () => {
    const text = await getPromptText({
      agent_name: "Layout Agent",
      task_description: "Verify layout guidance",
    });

    expect(text).toContain("at most four items");
    expect(text).toContain("`llmConnector`, `allowedDomains`, `modelName`, and `mcpConnectors`");
    expect(text).toContain("- allowedDomains        # always present");
    expect(text).toContain("Always include `allowedDomains`");
  });

  it("includes allowedDomains in the example agent spec", async () => {
    const text = await getPromptText({
      agent_name: "Example Agent",
      task_description: "Example task",
    });

    const exampleStart = text.indexOf("## Example: Code Review Agent");
    expect(exampleStart).toBeGreaterThan(-1);
    const example = text.slice(exampleStart);

    expect(example).toContain("PLUGIN_ALLOWED_DOMAINS: ${{inputs.allowedDomains}}");
    expect(example).toContain("allowedDomains:");
    expect(example).toMatch(/layout:[\s\S]*- allowedDomains/);
  });

  it("lists Allowed domains in CRITICAL GUIDELINES", async () => {
    const text = await getPromptText({
      agent_name: "Guidelines Agent",
      task_description: "Check guidelines table",
    });

    expect(text).toContain("| **Allowed domains**");
    expect(text).toContain("PLUGIN_ALLOWED_DOMAINS");
    expect(text).toContain("allowedDomains` in layout");
  });

  it("references harness_list and harness_create for agent lifecycle", async () => {
    const text = await getPromptText({
      agent_name: "Lifecycle Agent",
      task_description: "Create or update agents",
    });

    expect(text).toContain('resource_type="agent"');
    expect(text).toContain("harness_list");
    expect(text).toContain("harness_get");
    expect(text).toContain("harness_create");
    expect(text).toContain("harness_update");
  });
});
