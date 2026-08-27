import { describe, it, expect } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { registerFeatureFlagRolloutPrompt } from "../../src/prompts/feature-flag-rollout.js";
import { registerAllPrompts } from "../../src/prompts/index.js";

async function createTestClient(
  register: (server: McpServer) => void = registerFeatureFlagRolloutPrompt,
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

describe("feature-flag-rollout prompt", () => {
  it("appears in the prompt list", async () => {
    const client = await createTestClient();
    const { prompts } = await client.listPrompts();

    const prompt = prompts.find((p) => p.name === "feature-flag-rollout");
    expect(prompt).toBeDefined();
    expect(prompt!.description).toContain("progressive");
  });

  it("is wired into registerAllPrompts", async () => {
    const client = await createTestClient(registerAllPrompts);
    const { prompts } = await client.listPrompts();
    expect(prompts.find((p) => p.name === "feature-flag-rollout")).toBeDefined();
  });

  it("requires featureFlagName and accepts dual-mode scope arguments", async () => {
    const client = await createTestClient();
    const { prompts } = await client.listPrompts();
    const prompt = prompts.find((p) => p.name === "feature-flag-rollout")!;

    const argNames = prompt.arguments!.map((a) => a.name);
    expect(argNames).toEqual(
      expect.arrayContaining(["featureFlagName", "workspaceId", "orgId", "projectId"]),
    );

    const featureFlagName = prompt.arguments!.find((a) => a.name === "featureFlagName")!;
    expect(featureFlagName.required).toBeTruthy();
  });

  it("throws when neither workspaceId nor orgId+projectId is provided", async () => {
    const client = await createTestClient();

    await expect(
      client.getPrompt({
        name: "feature-flag-rollout",
        arguments: { featureFlagName: "dark-mode" },
      }),
    ).rejects.toThrow(/Provide either workspaceId \(deprecated\) or orgId \+ projectId/);
  });

  it("throws when only orgId is provided without projectId", async () => {
    const client = await createTestClient();

    await expect(
      client.getPrompt({
        name: "feature-flag-rollout",
        arguments: { featureFlagName: "dark-mode", orgId: "platform" },
      }),
    ).rejects.toThrow(/Provide either workspaceId \(deprecated\) or orgId \+ projectId/);
  });

  it("interpolates legacy workspace_id scope into rollout steps", async () => {
    const client = await createTestClient();
    const result = await client.getPrompt({
      name: "feature-flag-rollout",
      arguments: { featureFlagName: "dark-mode", workspaceId: "ws-123" },
    });

    const text = (result.messages[0].content as { type: string; text: string }).text;
    expect(text).toContain('workspace_id="ws-123"');
    expect(text).not.toContain('org_id="');
    expect(text).toContain('feature_flag_name="dark-mode"');
    expect(text).toContain('resource_type="fme_rollout_status"');
  });

  it("interpolates Harness-native org/project scope into rollout steps", async () => {
    const client = await createTestClient();
    const result = await client.getPrompt({
      name: "feature-flag-rollout",
      arguments: {
        featureFlagName: "checkout-v2",
        orgId: "platform",
        projectId: "checkout",
      },
    });

    const text = (result.messages[0].content as { type: string; text: string }).text;
    expect(text).toContain('org_id="platform", project_id="checkout"');
    expect(text).not.toContain('workspace_id="');
    expect(text).toContain('resource_type="fme_rollout_status"');
    expect(text).not.toContain("not yet implemented");
  });

  it("documents kill/restore execute actions for rollback", async () => {
    const client = await createTestClient();
    const result = await client.getPrompt({
      name: "feature-flag-rollout",
      arguments: {
        featureFlagName: "checkout-v2",
        orgId: "platform",
        projectId: "checkout",
      },
    });

    const text = (result.messages[0].content as { type: string; text: string }).text;
    expect(text).toContain('action="kill" or action="restore"');
    expect(text).toContain('resource_type="fme_feature_flag"');
    expect(text).toContain('resource_type="fme_feature_flag_definition"');
    expect(text).toContain('resource_type="fme_environment"');
  });
});
