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

  it("documents the current-format allowed_domains network access contract", async () => {
    const text = await getPromptText({
      agent_name: "Network Agent",
      task_description: "Call external APIs",
    });

    expect(text).toContain('allowed_domains: "github.com,api.github.com"');
    expect(text).toContain("with.allowed_domains");
    expect(text).toContain('default `"harness.io"`');
    expect(text).toContain("comma-separated hosts/wildcards/regexes");
  });

  it("uses agent.uses/agent.with structure with no layout block for current format", async () => {
    const text = await getPromptText({
      agent_name: "Structure Agent",
      task_description: "Verify current-format structure",
    });

    expect(text).toContain("agent.uses: harnessAI@1.0.0");
    expect(text).toContain("agent.with");
    expect(text).toContain("There is **no** per-agent `layout` block in Current Format");
  });

  it("includes the current-format example agent YAML using uses/with, not step.group.steps", async () => {
    const text = await getPromptText({
      agent_name: "Example Agent",
      task_description: "Review pull requests",
    });

    expect(text).toContain("## Example: Code Review Agent (Current Format)");
    expect(text).toMatch(/uses: harnessAI@1\.0\.0/);
    expect(text).toMatch(/with:\s*\n\s+prompt: \|/);

    // The example block itself (up to the next section) must be pure Current Format —
    // legacy strings are allowed elsewhere in the prompt (detection logic, guidelines table).
    const exampleSection = text.slice(
      text.indexOf("## Example: Code Review Agent (Current Format)"),
      text.indexOf("## CRITICAL GUIDELINES"),
    );
    expect(exampleSection).not.toContain("agent.step.group.steps");
    expect(exampleSection).not.toContain("PLUGIN_TASK");
  });

  it("instructs the model to detect existing agent spec format before updating", async () => {
    const text = await getPromptText({
      agent_name: "Update Agent",
      task_description: "Update an existing agent",
    });

    expect(text).toContain("Detect the spec format before doing anything else");
    expect(text).toContain("`agent.uses` present (e.g. `uses: harnessAI@1.0.0`) → **Current Format**");
    expect(text).toContain("**Anything else → Legacy Format.**");
    expect(text).toContain("Never convert a Legacy Format agent to Current Format (or vice versa) during a routine update");
  });

  it("treats non-`agent.uses` specs as legacy, including the agent.step.run shape", async () => {
    const text = await getPromptText({
      agent_name: "Legacy Variant Agent",
      task_description: "Update an agent that has no step group",
    });

    expect(text).toContain("`agent.step.run`");
    expect(text).toContain("A `with:` block on its own is **not** a Current Format signal");
  });

  it("points to the agent-docs:///legacy-format resource for legacy-format details", async () => {
    const text = await getPromptText({
      agent_name: "Legacy Pointer Agent",
      task_description: "Update a legacy agent",
    });

    expect(text).toContain("agent-docs:///legacy-format");
    // The prompt itself should not need to inline the full legacy PLUGIN_TASK spec-generation steps —
    // that content lives in the resource, only the pointer + syntax contrast should remain inline.
    expect(text).toContain("PLUGIN_TASK");
    expect(text).toContain("${{inputs.fieldName}}");
  });

  it("keeps legacy expression syntax guidance non-destructive", async () => {
    const text = await getPromptText({
      agent_name: "Syntax Agent",
      task_description: "Check expression syntax guidance",
    });

    expect(text).toContain("Use `<+inputs.fieldName>` in Current Format");
    expect(text).toContain("Legacy specs resolve both `${{inputs.fieldName}}` and `<+inputs.fieldName>`");
    expect(text).toContain("instead of rewriting working expressions");
    expect(text).not.toContain("never mix the two");
  });
});
