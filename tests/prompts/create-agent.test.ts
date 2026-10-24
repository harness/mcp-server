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
    expect(text).toContain("`agent.step.group.steps` present → **Legacy Format**");
    expect(text).toContain("Never convert a Legacy Format agent to Current Format (or vice versa) during a routine update");
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

  it("documents that expression syntax differs by format and must not be mixed", async () => {
    const text = await getPromptText({
      agent_name: "Syntax Agent",
      task_description: "Check expression syntax guidance",
    });

    expect(text).toContain("Use `<+inputs.fieldName>` in Current Format and `${{inputs.fieldName}}` in Legacy Format");
    expect(text).toContain("never mix the two");
  });

  it("documents ca_ uid generation from agent name with concrete examples", async () => {
    const text = await getPromptText({
      agent_name: "Code Coverage Agent",
      task_description: "Measure coverage",
    });

    expect(text).toContain('prefix with `ca_`');
    expect(text).toContain('"Code Coverage Agent" → `ca_code_coverage_agent`');
    expect(text).toContain('"PR Reviewer" → `ca_pr_reviewer`');
    expect(text).toContain("Do not omit it or rely on API-side auto-generation");
  });

  it("forbids rewriting legacy spec when agent-docs resource cannot be read", async () => {
    const text = await getPromptText({
      agent_name: "Legacy Guard Agent",
      task_description: "Update legacy agent safely",
    });

    expect(text).toContain("If you cannot read MCP resources");
    expect(text).toContain("do not rewrite or modify the `spec` at all");
    expect(text).toContain("Do not guess the Legacy Format structure from memory");
    expect(text).toContain("non-spec field updates (`name`, `description`, `wiki`)");
  });
});
