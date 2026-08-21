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

  it("throws when neither workspaceId nor orgId+projectId is provided", async () => {
    const client = await createTestClient();

    await expect(
      client.getPrompt({
        name: "feature-flag-rollout",
        arguments: { featureFlagName: "my_flag" },
      }),
    ).rejects.toThrow("Provide either workspaceId (deprecated) or orgId + projectId.");
  });

  it("interpolates Harness-native scope args and warns about fme_rollout_status", async () => {
    const client = await createTestClient();
    const result = await client.getPrompt({
      name: "feature-flag-rollout",
      arguments: {
        featureFlagName: "checkout_v2",
        orgId: "myOrg",
        projectId: "myProj",
      },
    });

    const text = promptText(result);
    expect(text).toContain('feature_flag_name="checkout_v2"');
    expect(text).toContain('org_id="myOrg", project_id="myProj"');
    expect(text).toContain('resource_type="fme_rollout_status"');
    expect(text).toContain("fme_rollout_status is not yet implemented server-side");
    expect(text).not.toContain('workspace_id="');
  });

  it("interpolates legacy workspace scope without native-mode caveat", async () => {
    const client = await createTestClient();
    const result = await client.getPrompt({
      name: "feature-flag-rollout",
      arguments: {
        featureFlagName: "checkout_v2",
        workspaceId: "ws-legacy-1",
      },
    });

    const text = promptText(result);
    expect(text).toContain('workspace_id="ws-legacy-1"');
    expect(text).not.toContain("fme_rollout_status is not yet implemented");
    expect(text).not.toContain('org_id="');
  });

  it("references harness_execute kill and restore actions", async () => {
    const client = await createTestClient();
    const result = await client.getPrompt({
      name: "feature-flag-rollout",
      arguments: {
        featureFlagName: "dark_mode",
        orgId: "o1",
        projectId: "p1",
      },
    });

    const text = promptText(result);
    expect(text).toContain('action="kill"');
    expect(text).toContain('action="restore"');
    expect(text).toContain("harness_execute");
  });
});
