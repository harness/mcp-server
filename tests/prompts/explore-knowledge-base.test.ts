import { describe, it, expect, vi } from "vitest";
import { registerExploreKnowledgeBasePrompt } from "../../src/prompts/explore-knowledge-base.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

describe("explore-knowledge-base prompt", () => {
  it("registers a prescriptive MCP-only workflow prompt", async () => {
    const prompts = new Map<string, { description?: string; handler: (args: Record<string, string>) => Promise<{ messages: Array<{ content: { text: string } }> }> }>();
    const server = {
      registerPrompt: vi.fn((name: string, meta: { description?: string }, handler: (args: Record<string, string>) => Promise<{ messages: Array<{ content: { text: string } }> }>) => {
        prompts.set(name, { description: meta.description, handler });
      }),
    } as unknown as McpServer;

    registerExploreKnowledgeBasePrompt(server);
    expect(prompts.has("explore-knowledge-base")).toBe(true);

    const entry = prompts.get("explore-knowledge-base")!;
    expect(entry.description).toMatch(/kb_crawl/);
    const result = await entry.handler({
      goal: "list pages from the latest crawl",
      test_environment_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    });
    const text = result.messages[0]!.content.text;
    expect(text).toContain("HARD RULES");
    expect(text).toContain("ait-java-api-service");
    expect(text).toContain("ait_test_environment");
    expect(text).toContain("Do not");
    expect(text).toContain("harness_list");
    expect(text).toContain("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    expect(text).toContain("pages_discovered");
    expect(text).toContain("started_at");
    expect(text).toContain(
      "elapsed_ms * (max_pages - pages_discovered) / pages_discovered",
    );
    expect(text).toContain("finish early");
  });
});
