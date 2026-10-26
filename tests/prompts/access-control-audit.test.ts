import { describe, expect, it } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAccessControlAuditPrompt } from "../../src/prompts/access-control-audit.js";

describe("access-control-audit prompt", () => {
  it("documents account-level service account listing for least-privilege audits", async () => {
    let handler:
      | ((args: { projectId?: string; orgId?: string }) => Promise<unknown>)
      | undefined;
    const server = {
      registerPrompt: (_name: string, _definition: unknown, callback: typeof handler) => {
        handler = callback;
      },
    } as unknown as McpServer;

    registerAccessControlAuditPrompt(server);
    const result = (await handler!({ orgId: "platform", projectId: "dev" })) as {
      messages: Array<{ content: { text: string } }>;
    };
    const text = result.messages[0].content.text;

    expect(text).toContain('resource_type="service_account"');
    expect(text).toContain('org_id="platform"');
    expect(text).toContain('project_id="dev"');
    expect(text).toContain('resource_scope="account"');
    expect(text).toMatch(/no org_id or project_id/);
    expect(text).toContain("Account-level service accounts are omitted from a project list");
  });
});
