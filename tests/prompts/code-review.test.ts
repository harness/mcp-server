import { describe, it, expect } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { registerCodeReviewPrompt } from "../../src/prompts/code-review.js";

async function createTestClient(): Promise<Client> {
  const server = new McpServer(
    { name: "test-server", version: "0.0.1" },
    { capabilities: { prompts: {} } },
  );
  registerCodeReviewPrompt(server);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.0.1" });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  return client;
}

describe("code-review prompt", () => {
  it("reads existing comments via pr_activity with comment + code-comment filters", async () => {
    const client = await createTestClient();
    const result = await client.getPrompt({
      name: "code-review",
      arguments: { repoId: "my_repo", prNumber: "42", projectId: "Sanity" },
    });

    const text = (result.messages[0].content as { type: string; text: string }).text;
    expect(text).toContain('resource_type="pr_activity"');
    expect(text).toContain('filters={type: ["comment", "code-comment"]}');
    expect(text).toContain('params={repo_id: "my_repo", pr_number: "42"}');
    expect(text).toContain('project_id="Sanity"');
    expect(text).not.toContain('resource_type="pr_comment"');
  });
});
