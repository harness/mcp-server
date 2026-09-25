import { describe, expect, it, vi } from "vitest";
import {
  AGENT_LEGACY_FORMAT_CONTENT,
  registerAgentLegacyFormatResource,
} from "../../src/resources/agent-legacy-format.js";

describe("agent-legacy-format resource", () => {
  it("registers a static resource at agent-docs:///legacy-format", () => {
    const server = { registerResource: vi.fn() } as any;

    registerAgentLegacyFormatResource(server);

    expect(server.registerResource).toHaveBeenCalledOnce();
    const [name, uri, meta] = server.registerResource.mock.calls[0];
    expect(name).toBe("agent-legacy-format");
    expect(uri).toBe("agent-docs:///legacy-format");
    expect(meta.mimeType).toBe("text/markdown");
  });

  it("returns the legacy-format markdown content when read", async () => {
    const server = { registerResource: vi.fn() } as any;
    registerAgentLegacyFormatResource(server);

    const readHandler = server.registerResource.mock.calls[0][3] as (
      uri: URL,
    ) => Promise<{ contents: Array<{ uri: string; mimeType: string; text: string }> }>;

    const result = await readHandler(new URL("agent-docs:///legacy-format"));

    expect(result.contents).toHaveLength(1);
    expect(result.contents[0].mimeType).toBe("text/markdown");
    expect(result.contents[0].text).toBe(AGENT_LEGACY_FORMAT_CONTENT);
  });

  it("documents the legacy agent.step.group.steps structure", () => {
    expect(AGENT_LEGACY_FORMAT_CONTENT).toContain("agent.step.group.steps");
    expect(AGENT_LEGACY_FORMAT_CONTENT).toContain("PLUGIN_TASK");
    expect(AGENT_LEGACY_FORMAT_CONTENT).toContain("${{inputs.fieldName}}".replace("fieldName", "llmConnector.id"));
  });

  it("documents the legacy worked example with placeholder connector ids", () => {
    expect(AGENT_LEGACY_FORMAT_CONTENT).toContain("default: your_llm_connector_id");
    expect(AGENT_LEGACY_FORMAT_CONTENT).not.toContain('"llmConnector": "your_llm_connector_id"');
  });

  it("never instructs migrating a legacy agent automatically", () => {
    expect(AGENT_LEGACY_FORMAT_CONTENT).toContain("Never migrate silently");
  });
});
