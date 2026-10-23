import { describe, expect, it } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerRunEvaluationPrompt } from "../../src/prompts/run-evaluation.js";

describe("run-evaluation prompt", () => {
  it("guides prompt discovery through eval_prompt without inventing a response path", async () => {
    let handler: ((args: { goal: string; org_id?: string; project_id?: string }) => Promise<unknown>) | undefined;
    const server = {
      registerPrompt: (_name: string, _definition: unknown, callback: typeof handler) => {
        handler = callback;
      },
    } as unknown as McpServer;

    registerRunEvaluationPrompt(server);
    const result = await handler!({ goal: "Evaluate support-answer quality" }) as {
      messages: Array<{ content: { text: string } }>;
    };
    const text = result.messages[0].content.text;

    expect(text).toContain('resource_type="eval_prompt"');
    expect(text).not.toContain("eval_registry_item");
    expect(text).toContain("only when the target contract requires one");
    expect(text).not.toContain("request template, and response path");
  });
});
