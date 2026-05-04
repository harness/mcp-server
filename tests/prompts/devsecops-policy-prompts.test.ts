import { describe, expect, it } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { registerSbomCompliancePrompt } from "../../src/prompts/sbom-compliance.js";
import { registerSupplyChainAuditPrompt } from "../../src/prompts/supply-chain-audit.js";

type PromptResult = {
  messages: Array<{
    content: {
      text: string;
    };
  }>;
};

type PromptHandler = (args: {
  artifactId?: string;
  projectId?: string;
}) => Promise<PromptResult>;

class PromptCapture {
  private handlers = new Map<string, PromptHandler>();

  registerPrompt(name: string, _config: unknown, handler: PromptHandler): void {
    this.handlers.set(name, handler);
  }

  async render(name: string, args: Parameters<PromptHandler>[0] = {}): Promise<string> {
    const handler = this.handlers.get(name);
    if (!handler) {
      throw new Error(`Prompt "${name}" was not registered`);
    }

    const result = await handler(args);
    return result.messages.map((message) => message.content.text).join("\n");
  }
}

describe("DevSecOps policy prompts", () => {
  it("directs SBOM compliance checks to registered governance policy resources", async () => {
    const server = new PromptCapture();
    registerSbomCompliancePrompt(server as unknown as McpServer);

    const prompt = await server.render("sbom-compliance-check", { projectId: "project" });

    expect(prompt).toContain('resource_type="policy"');
    expect(prompt).toContain('resource_type="policy_set"');
    expect(prompt).not.toContain("scs_opa_policy");
  });

  it("directs supply chain audits to registered governance policy resources", async () => {
    const server = new PromptCapture();
    registerSupplyChainAuditPrompt(server as unknown as McpServer);

    const prompt = await server.render("supply-chain-audit", { projectId: "project" });

    expect(prompt).toContain('resource_type="policy"');
    expect(prompt).toContain('resource_type="policy_set"');
    expect(prompt).not.toContain("scs_opa_policy");
  });
});
