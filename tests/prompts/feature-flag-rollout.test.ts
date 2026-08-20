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

async function getPromptText(args: Record<string, string>): Promise<string> {
  const client = await createTestClient();
  const result = await client.getPrompt({
    name: "feature-flag-rollout",
    arguments: args,
  });
  return (result.messages[0].content as { type: string; text: string }).text;
}

describe("feature-flag-rollout prompt", () => {
  it("appears in the prompt list with rollout workflow description", async () => {
    const client = await createTestClient();
    const { prompts } = await client.listPrompts();

    const prompt = prompts.find((p) => p.name === "feature-flag-rollout");
    expect(prompt).toBeDefined();
    expect(prompt!.description).toContain("progressive FME feature flag rollout");
  });

  it("documents workspaceId, orgId, and projectId as optional dual-mode scope args", async () => {
    const client = await createTestClient();
    const { prompts } = await client.listPrompts();
    const prompt = prompts.find((p) => p.name === "feature-flag-rollout")!;

    const argNames = prompt.arguments!.map((a) => a.name);
    expect(argNames).toEqual(
      expect.arrayContaining(["featureFlagName", "workspaceId", "orgId", "projectId"]),
    );

    const workspaceId = prompt.arguments!.find((a) => a.name === "workspaceId")!;
    const orgId = prompt.arguments!.find((a) => a.name === "orgId")!;
    const projectId = prompt.arguments!.find((a) => a.name === "projectId")!;

    expect(workspaceId.required).toBeFalsy();
    expect(orgId.required).toBeFalsy();
    expect(projectId.required).toBeFalsy();
  });

  it("requires featureFlagName", async () => {
    const client = await createTestClient();
    const { prompts } = await client.listPrompts();
    const prompt = prompts.find((p) => p.name === "feature-flag-rollout")!;

    const featureFlagName = prompt.arguments!.find((a) => a.name === "featureFlagName")!;
    expect(featureFlagName.required).toBe(true);
  });

  it("rejects when neither workspaceId nor orgId+projectId are provided", async () => {
    const client = await createTestClient();

    await expect(
      client.getPrompt({
        name: "feature-flag-rollout",
        arguments: { featureFlagName: "my_flag" },
      }),
    ).rejects.toThrow(/Provide either workspaceId.*or orgId \+ projectId/);
  });

  it("rejects partial Harness-native scope (orgId only)", async () => {
    const client = await createTestClient();

    await expect(
      client.getPrompt({
        name: "feature-flag-rollout",
        arguments: { featureFlagName: "my_flag", orgId: "default" },
      }),
    ).rejects.toThrow(/Provide either workspaceId.*or orgId \+ projectId/);
  });

  it("legacy mode: interpolates workspace_id scope args and omits Harness-native caveat", async () => {
    const text = await getPromptText({
      featureFlagName: "checkout_v2",
      workspaceId: "ws-legacy-1",
    });

    expect(text).toContain('feature flag "checkout_v2"');
    expect(text).toContain('workspace_id="ws-legacy-1"');
    expect(text).not.toContain('org_id=');
    expect(text).not.toContain("Harness-native mode");
    expect(text).toContain('resource_type="fme_feature_flag"');
    expect(text).toContain('action="kill"');
    expect(text).toContain('action="restore"');
  });

  it("Harness-native mode: interpolates org_id/project_id and includes native rollout workflow steps", async () => {
    const text = await getPromptText({
      featureFlagName: "checkout_v2",
      orgId: "default",
      projectId: "payments",
    });

    expect(text).toContain('org_id="default", project_id="payments"');
    expect(text).not.toContain('workspace_id=');
    expect(text).toContain("fme_feature_flag_definition");
    expect(text).toContain('resource_type="fme_rollout_status"');
    expect(text).not.toMatch(/not yet implemented/i);
    expect(text).not.toMatch(/step 4 only works today with workspace_id/i);
  });

  it("legacy mode: omits Harness-native rollout-status NYI caveat", async () => {
    const text = await getPromptText({
      featureFlagName: "checkout_v2",
      workspaceId: "ws-legacy-1",
    });

    expect(text).not.toMatch(/not yet implemented/i);
    expect(text).not.toMatch(/step 4 only works today with workspace_id/i);
  });
});
