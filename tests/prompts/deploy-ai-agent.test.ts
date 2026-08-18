import { describe, it, expect } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { registerDeployAiAgentPrompt } from "../../src/prompts/deploy-ai-agent.js";
import { registerAllPrompts } from "../../src/prompts/index.js";

async function createTestClient(
  register: (server: McpServer) => void = registerDeployAiAgentPrompt,
): Promise<Client> {
  const server = new McpServer(
    { name: "test-server", version: "0.0.1" },
    { capabilities: { prompts: {} } },
  );
  register(server);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.0.1" });

  await Promise.all([
    client.connect(clientTransport),
    server.connect(serverTransport),
  ]);

  return client;
}

describe("deploy-ai-agent prompt", () => {
  it("appears in the prompt list", async () => {
    const client = await createTestClient();
    const { prompts } = await client.listPrompts();

    const prompt = prompts.find((p) => p.name === "deploy-ai-agent");
    expect(prompt).toBeDefined();
    expect(prompt!.description).toContain("AI agent");
  });

  it("is wired into registerAllPrompts (guards against accidental removal)", async () => {
    const client = await createTestClient(registerAllPrompts);
    const { prompts } = await client.listPrompts();
    expect(prompts.find((p) => p.name === "deploy-ai-agent")).toBeDefined();
  });

  it("has the correct arguments, all optional", async () => {
    const client = await createTestClient();
    const { prompts } = await client.listPrompts();
    const prompt = prompts.find((p) => p.name === "deploy-ai-agent")!;

    const argNames = prompt.arguments!.map((a) => a.name);
    expect(argNames).toContain("platform");
    expect(argNames).toContain("repoUrl");
    expect(argNames).toContain("projectId");
    expect(argNames).toContain("executionRoleArn");

    for (const arg of prompt.arguments!) {
      expect(arg.required).toBeFalsy();
    }
  });

  it("prompts for platform and repo when not provided", async () => {
    const client = await createTestClient();
    const result = await client.getPrompt({ name: "deploy-ai-agent", arguments: {} });

    expect(result.messages).toHaveLength(1);
    const text = (result.messages[0].content as { type: string; text: string }).text;
    expect(text).toContain("ASK the user — GoogleAgentRuntime or AwsAgentCore");
    expect(text).toContain("inspect the local workspace for a git remote");
  });

  it("interpolates provided platform, repo, project, and role", async () => {
    const client = await createTestClient();
    const result = await client.getPrompt({
      name: "deploy-ai-agent",
      arguments: {
        platform: "AwsAgentCore",
        repoUrl: "https://github.com/acme/agent",
        projectId: "my-project",
        executionRoleArn: "arn:aws:iam::123456789012:role/agent-exec",
      },
    });

    const text = (result.messages[0].content as { type: string; text: string }).text;
    expect(text).toContain("Target platform: AwsAgentCore");
    expect(text).toContain("Source repo: https://github.com/acme/agent");
    expect(text).toContain("Project: my-project");
    expect(text).toContain("arn:aws:iam::123456789012:role/agent-exec");
  });

  it("includes all workflow phases", async () => {
    const client = await createTestClient();
    const result = await client.getPrompt({ name: "deploy-ai-agent", arguments: {} });
    const text = (result.messages[0].content as { type: string; text: string }).text;

    expect(text).toContain("Phase A — Source");
    expect(text).toContain("Phase B — Target platform");
    expect(text).toContain("Phase C — Build the image (CI) — MANDATORY");
    expect(text).toContain("Phase D — Connectors");
    expect(text).toContain("Phase E — AiAgent service");
    expect(text).toContain("Phase F — Environment + Infrastructure");
    expect(text).toContain("Phase G — Deploy stage + run");
  });

  it("embeds the CI build and CD step YAML for both platforms", async () => {
    const client = await createTestClient();
    const result = await client.getPrompt({ name: "deploy-ai-agent", arguments: {} });
    const text = (result.messages[0].content as { type: string; text: string }).text;

    expect(text).toContain("BuildAndPushGAR");
    expect(text).toContain("BuildAndPushECR");
    expect(text).toContain("DeployGoogleAgentRuntimeRevision");
    expect(text).toContain("ShiftGoogleAgentRuntimeTraffic");
    expect(text).toContain("RollbackGoogleAgentRuntimeRevision");
    expect(text).toContain("DeployAwsAgentCoreRevision");
    expect(text).toContain("ShiftAwsAgentCoreTraffic");
    expect(text).toContain("RollbackAwsAgentCoreRevision");
  });

  it("encodes the key AI-agent deployment facts", async () => {
    const client = await createTestClient();
    const result = await client.getPrompt({ name: "deploy-ai-agent", arguments: {} });
    const text = (result.messages[0].content as { type: string; text: string }).text;

    // image is a string on the service, not an artifact source
    expect(text).toContain("platform.spec.source.spec.image");
    expect(text).toContain("NOT via an artifact-source connector");
    // shared deterministic tag
    expect(text).toContain("<+pipeline.sequenceId>");
    // AWS requires executionRoleArn
    expect(text).toContain("executionRoleArn");
    // build is mandatory
    expect(text).toContain("A build step is MANDATORY");
    // source discriminator is lowercase "container" (verified against live NG yaml-schema)
    expect(text).toContain("type: container");
    expect(text).not.toContain("type: Container");
  });

  it("references correct MCP tools and confirmation/retry behavior", async () => {
    const client = await createTestClient();
    const result = await client.getPrompt({ name: "deploy-ai-agent", arguments: {} });
    const text = (result.messages[0].content as { type: string; text: string }).text;

    expect(text).toContain("harness_list");
    expect(text).toContain("harness_describe");
    expect(text).toContain("harness_schema");
    expect(text).toContain("harness_create");
    expect(text).toContain("harness_execute");
    expect(text).toContain("harness_status");
    expect(text).toContain("harness_update");

    expect(text).toContain("FAILURE RETRY LOOP (up to 3 attempts)");
    expect(text).toContain("Never create a resource without showing its YAML");
  });
});
