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

  it("declares dual-mode scope arguments", async () => {
    const client = await createTestClient();
    const { prompts } = await client.listPrompts();
    const prompt = prompts.find((p) => p.name === "feature-flag-rollout")!;

    const argNames = prompt.arguments!.map((a) => a.name);
    expect(argNames).toEqual(
      expect.arrayContaining(["featureFlagName", "workspaceId", "orgId", "projectId"]),
    );

    const featureFlagName = prompt.arguments!.find((a) => a.name === "featureFlagName")!;
    expect(featureFlagName.required).toBe(true);
  });

  it("rejects prompts when neither workspaceId nor orgId+projectId is provided", async () => {
    const client = await createTestClient();

    await expect(
      client.getPrompt({
        name: "feature-flag-rollout",
        arguments: { featureFlagName: "my_flag" },
      }),
    ).rejects.toThrow("Provide either workspaceId (deprecated) or orgId + projectId.");
  });

  it("uses legacy workspace_id scope in rollout instructions", async () => {
    const client = await createTestClient();
    const result = await client.getPrompt({
      name: "feature-flag-rollout",
      arguments: {
        featureFlagName: "checkout_v2",
        workspaceId: "ws-legacy-99",
      },
    });

    const text = promptText(result);
    expect(text).toContain('feature flag "checkout_v2"');
    expect(text).toContain('workspace_id="ws-legacy-99"');
    expect(text).not.toContain('org_id=');
    expect(text).not.toContain('project_id=');
  });

  it("uses Harness-native org_id+project_id scope in rollout instructions", async () => {
    const client = await createTestClient();
    const result = await client.getPrompt({
      name: "feature-flag-rollout",
      arguments: {
        featureFlagName: "checkout_v2",
        orgId: "my-org",
        projectId: "my-project",
      },
    });

    const text = promptText(result);
    expect(text).toContain('org_id="my-org", project_id="my-project"');
    expect(text).not.toContain("workspace_id=");
  });

  it("guides agents through native FME rollout workflow resources", async () => {
    const client = await createTestClient();
    const result = await client.getPrompt({
      name: "feature-flag-rollout",
      arguments: {
        featureFlagName: "dark_launch",
        orgId: "o1",
        projectId: "p1",
      },
    });

    const text = promptText(result);
    expect(text).toContain('resource_type="fme_feature_flag"');
    expect(text).toContain('resource_type="fme_environment"');
    expect(text).toContain('resource_type="fme_feature_flag_definition"');
    expect(text).toContain('resource_type="fme_rollout_status"');
    expect(text).toContain('action="kill" or action="restore"');
  });

  it("does not warn that native-mode fme_rollout_status is unavailable", async () => {
    const client = await createTestClient();
    const result = await client.getPrompt({
      name: "feature-flag-rollout",
      arguments: {
        featureFlagName: "dark_launch",
        orgId: "o1",
        projectId: "p1",
      },
    });

    const text = promptText(result);
    expect(text).not.toMatch(/not yet implemented server-side/i);
    expect(text).not.toMatch(/only works today with workspace_id/i);
  });
});
