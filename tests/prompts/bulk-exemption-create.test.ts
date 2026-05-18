import { describe, it, expect } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { registerBulkExemptionCreatePrompt } from "../../src/prompts/bulk-exemption-create.js";

async function createTestClient(): Promise<Client> {
  const server = new McpServer(
    { name: "test-server", version: "0.0.1" },
    { capabilities: { prompts: {} } },
  );
  registerBulkExemptionCreatePrompt(server);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.0.1" });

  await Promise.all([
    client.connect(clientTransport),
    server.connect(serverTransport),
  ]);

  return client;
});

function messageText(result: Awaited<ReturnType<Client["getPrompt"]>>): string {
  return (result.messages[0].content as { type: string; text: string }).text;
}

describe("bulk-exemption-create prompt", () => {
  it("refuses to create project-wide exemptions when no selector is provided", async () => {
    const client = await createTestClient();

    const result = await client.getPrompt({
      name: "bulk-exemption-create",
      arguments: {
        projectId: "payments",
        exemption_type: "Acceptable Risk",
        reason: "temporary exception",
      },
    });

    const text = messageText(result);
    expect(text).toContain("Cannot create bulk exemptions");
    expect(text).toContain("issue_ids");
    expect(text).not.toContain("harness_create(");
  });

  it("generates create instructions when explicit issue IDs are provided", async () => {
    const client = await createTestClient();

    const result = await client.getPrompt({
      name: "bulk-exemption-create",
      arguments: {
        projectId: "payments",
        issue_ids: "issue-one, issue-two",
        exemption_type: "Acceptable Risk",
        reason: "temporary exception",
      },
    });

    const text = messageText(result);
    expect(text).toContain("issue_ids input");
    expect(text).toContain("harness_create(");
  });
}
