import { describe, it, expect } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { registerAccessControlAuditPrompt } from "../../src/prompts/access-control-audit.js";

async function createTestClient(): Promise<Client> {
  const server = new McpServer(
    { name: "test-server", version: "0.0.1" },
    { capabilities: { prompts: {} } },
  );
  registerAccessControlAuditPrompt(server);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.0.1" });

  await Promise.all([
    client.connect(clientTransport),
    server.connect(serverTransport),
  ]);

  return client;
}

describe("access-control-audit prompt", () => {
  it("appears in the prompt list with least-privilege description", async () => {
    const client = await createTestClient();
    const { prompts } = await client.listPrompts();

    const prompt = prompts.find((p) => p.name === "access-control-audit");
    expect(prompt).toBeDefined();
    expect(prompt!.description).toContain("least-privilege");
  });

  it("documents account-scoped service account listing for audits", async () => {
    const client = await createTestClient();
    const result = await client.getPrompt({ name: "access-control-audit", arguments: {} });
    const text = result.messages[0]?.content;
    expect(text?.type).toBe("text");
    if (text?.type !== "text") {
      throw new Error("expected text prompt content");
    }

    expect(text.text).toContain('resource_type="service_account"');
    expect(text.text).toContain('resource_scope="account"');
    expect(text.text).toContain("Account-level service accounts are omitted from a project list");
    expect(text.text).toContain("no org_id or project_id when the audit needs them");
  });

  it("threads org and project filters into harness_list examples", async () => {
    const client = await createTestClient();
    const result = await client.getPrompt({
      name: "access-control-audit",
      arguments: { orgId: "platform", projectId: "cd-demo" },
    });
    const text = result.messages[0]?.content;
    expect(text?.type).toBe("text");
    if (text?.type !== "text") {
      throw new Error("expected text prompt content");
    }

    expect(text.text).toContain('org_id="platform"');
    expect(text.text).toContain('project_id="cd-demo"');
    expect(text.text).toContain(
      'harness_list with resource_type="service_account", org_id="platform", project_id="cd-demo"',
    );
  });
});
