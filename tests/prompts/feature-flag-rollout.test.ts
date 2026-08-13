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

  it("interpolates legacy workspaceId scope args", async () => {
    const client = await createTestClient();
    const result = await client.getPrompt({
      name: "feature-flag-rollout",
      arguments: {
        featureFlagName: "dark_mode",
        workspaceId: "ws-legacy",
      },
    });

    const text = promptText(result);
    expect(text).toContain('feature flag "dark_mode" (workspace_id="ws-legacy")');
    expect(text).toContain('resource_type="fme_feature_flag", feature_flag_name="dark_mode", workspace_id="ws-legacy"');
    expect(text).not.toContain("org_id=");
    expect(text).not.toContain("not yet implemented");
  });

  it("interpolates Harness-native orgId+projectId scope args and adds the NYI caveat", async () => {
    const client = await createTestClient();
    const result = await client.getPrompt({
      name: "feature-flag-rollout",
      arguments: {
        featureFlagName: "dark_mode",
        orgId: "my-org",
        projectId: "my-project",
      },
    });

    const text = promptText(result);
    expect(text).toContain('org_id="my-org", project_id="my-project"');
    expect(text).toContain('resource_type="fme_environment", org_id="my-org", project_id="my-project"');
    expect(text).toContain("fme_feature_flag_definition");
    expect(text).toContain("fme_rollout_status");
    expect(text).toContain("kill/restore execute action are not yet implemented");
    expect(text).not.toContain("workspace_id=");
  });

  it("rejects calls with no scope identifiers", async () => {
    const client = await createTestClient();

    await expect(
      client.getPrompt({
        name: "feature-flag-rollout",
        arguments: { featureFlagName: "dark_mode" },
      }),
    ).rejects.toThrow("Provide either workspaceId (deprecated) or orgId + projectId.");
  });

  it("rejects a partial orgId without projectId", async () => {
    const client = await createTestClient();

    await expect(
      client.getPrompt({
        name: "feature-flag-rollout",
        arguments: { featureFlagName: "dark_mode", orgId: "my-org" },
      }),
    ).rejects.toThrow("Provide either workspaceId (deprecated) or orgId + projectId.");
  });
});
