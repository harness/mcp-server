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

  it("registers featureFlagName plus dual-mode scope arguments", async () => {
    const client = await createTestClient();
    const { prompts } = await client.listPrompts();
    const prompt = prompts.find((p) => p.name === "feature-flag-rollout")!;

    const argNames = prompt.arguments!.map((a) => a.name);
    expect(argNames).toEqual(
      expect.arrayContaining(["featureFlagName", "workspaceId", "orgId", "projectId"]),
    );

    expect(prompt.arguments!.find((a) => a.name === "featureFlagName")!.required).toBe(true);
    expect(prompt.arguments!.find((a) => a.name === "workspaceId")!.required).toBeFalsy();
    expect(prompt.arguments!.find((a) => a.name === "orgId")!.required).toBeFalsy();
    expect(prompt.arguments!.find((a) => a.name === "projectId")!.required).toBeFalsy();
  });

  it("legacy mode interpolates workspace_id scope args and omits Harness-native caveat", async () => {
    const client = await createTestClient();
    const result = await client.getPrompt({
      name: "feature-flag-rollout",
      arguments: {
        featureFlagName: "dark_mode",
        workspaceId: "ws-legacy-1",
      },
    });

    const text = promptText(result);
    expect(text).toContain('feature flag "dark_mode"');
    expect(text).toContain('workspace_id="ws-legacy-1"');
    expect(text).not.toContain('org_id="');
    expect(text).not.toContain("Harness-native mode");
    expect(text).toContain('resource_type="fme_feature_flag"');
    expect(text).toContain('action="kill"');
    expect(text).toContain('action="restore"');
  });

  it("Harness-native mode interpolates org_id/project_id and surfaces NYI caveat", async () => {
    const client = await createTestClient();
    const result = await client.getPrompt({
      name: "feature-flag-rollout",
      arguments: {
        featureFlagName: "checkout_v2",
        orgId: "default",
        projectId: "payments",
      },
    });

    const text = promptText(result);
    expect(text).toContain('feature flag "checkout_v2"');
    expect(text).toContain('org_id="default", project_id="payments"');
    expect(text).not.toContain('workspace_id="');
    expect(text).toContain("Harness-native mode");
    expect(text).toContain("fme_feature_flag_definition");
    expect(text).toContain("fme_rollout_status");
    expect(text).toContain("kill/restore execute action are not yet implemented");
  });

  it("rejects when neither workspaceId nor orgId+projectId are provided", async () => {
    const client = await createTestClient();

    await expect(
      client.getPrompt({
        name: "feature-flag-rollout",
        arguments: { featureFlagName: "orphan_flag" },
      }),
    ).rejects.toThrow(/Provide either workspaceId \(deprecated\) or orgId \+ projectId/i);
  });

  it("rejects a partial Harness-native scope pair", async () => {
    const client = await createTestClient();

    await expect(
      client.getPrompt({
        name: "feature-flag-rollout",
        arguments: { featureFlagName: "orphan_flag", orgId: "default" },
      }),
    ).rejects.toThrow(/Provide either workspaceId \(deprecated\) or orgId \+ projectId/i);

    await expect(
      client.getPrompt({
        name: "feature-flag-rollout",
        arguments: { featureFlagName: "orphan_flag", projectId: "payments" },
      }),
    ).rejects.toThrow(/Provide either workspaceId \(deprecated\) or orgId \+ projectId/i);
  });

  it("guides agents through environment discovery and rollout phases", async () => {
    const client = await createTestClient();
    const result = await client.getPrompt({
      name: "feature-flag-rollout",
      arguments: {
        featureFlagName: "beta_ui",
        orgId: "default",
        projectId: "frontend",
      },
    });

    const text = promptText(result);
    expect(text).toContain('resource_type="fme_environment"');
    expect(text).toContain('resource_type="fme_feature_flag_definition"');
    expect(text).toContain("Phase 1:");
    expect(text).toContain("Rollback plan");
  });
});
