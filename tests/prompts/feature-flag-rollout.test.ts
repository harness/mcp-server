import { describe, it, expect } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { registerFeatureFlagRolloutPrompt } from "../../src/prompts/feature-flag-rollout.js";

async function createTestClient(): Promise<Client> {
  const server = new McpServer(
    { name: "test-server", version: "0.0.1" },
    { capabilities: { prompts: {} } },
  );
  registerFeatureFlagRolloutPrompt(server);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.0.1" });

  await Promise.all([
    client.connect(clientTransport),
    server.connect(serverTransport),
  ]);

  return client;
}

function promptText(result: Awaited<ReturnType<Client["getPrompt"]>>): string {
  return (result.messages[0].content as { type: string; text: string }).text;
}

describe("feature-flag-rollout prompt", () => {
  it("appears in the prompt list", async () => {
    const client = await createTestClient();
    const { prompts } = await client.listPrompts();

    const prompt = prompts.find((p) => p.name === "feature-flag-rollout");
    expect(prompt).toBeDefined();
    expect(prompt!.description).toContain("progressive FME feature flag rollout");
  });

  it("requires workspaceId or orgId+projectId", async () => {
    const client = await createTestClient();

    await expect(
      client.getPrompt({
        name: "feature-flag-rollout",
        arguments: { featureFlagName: "my_flag" },
      }),
    ).rejects.toThrow(/workspaceId.*orgId.*projectId/i);
  });

  it("native mode uses org_id and project_id scope args", async () => {
    const client = await createTestClient();
    const result = await client.getPrompt({
      name: "feature-flag-rollout",
      arguments: {
        featureFlagName: "checkout_v2",
        orgId: "myorg",
        projectId: "myproj",
      },
    });

    const text = promptText(result);
    expect(text).toContain('feature flag "checkout_v2"');
    expect(text).toContain('org_id="myorg", project_id="myproj"');
    expect(text).not.toContain("workspace_id");
  });

  it("legacy mode uses workspace_id scope args", async () => {
    const client = await createTestClient();
    const result = await client.getPrompt({
      name: "feature-flag-rollout",
      arguments: {
        featureFlagName: "checkout_v2",
        workspaceId: "ws-abc",
      },
    });

    const text = promptText(result);
    expect(text).toContain('workspace_id="ws-abc"');
    expect(text).not.toContain('org_id="');
  });

  it("does not warn that native fme_rollout_status is unavailable", async () => {
    const client = await createTestClient();
    const result = await client.getPrompt({
      name: "feature-flag-rollout",
      arguments: {
        featureFlagName: "checkout_v2",
        orgId: "myorg",
        projectId: "myproj",
      },
    });

    const text = promptText(result);
    expect(text).not.toMatch(/not yet implemented/i);
    expect(text).not.toMatch(/will error/i);
    expect(text).toContain('resource_type="fme_rollout_status"');
  });

  it("references harness_execute kill and restore actions", async () => {
    const client = await createTestClient();
    const result = await client.getPrompt({
      name: "feature-flag-rollout",
      arguments: {
        featureFlagName: "checkout_v2",
        orgId: "myorg",
        projectId: "myproj",
      },
    });

    const text = promptText(result);
    expect(text).toContain("harness_execute");
    expect(text).toContain('resource_type="fme_feature_flag"');
    expect(text).toContain('action="kill"');
    expect(text).toContain('action="restore"');
  });
});
