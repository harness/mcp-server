import { describe, it, expect } from "vitest";
import { formatTagsForEmbedding, buildResourceIndexContent } from "../../src/search/embedding-content.js";

describe("formatTagsForEmbedding", () => {
  it("flattens key-value tag maps to key:value pairs", () => {
    expect(formatTagsForEmbedding({ env: "prod", team: "platform" })).toBe(
      "env:prod team:platform",
    );
  });

  it("uses key only when value is empty", () => {
    expect(formatTagsForEmbedding({ flagged: "" })).toBe("flagged");
  });

  it("joins string tag arrays", () => {
    expect(formatTagsForEmbedding(["env:prod", "team:platform"])).toBe(
      "env:prod team:platform",
    );
  });

  it("does not stringify objects as [object Object]", () => {
    const text = formatTagsForEmbedding({ env: "prod" });
    expect(text).not.toContain("[object Object]");
    expect(text).toBe("env:prod");
  });

  it("returns empty string for nullish tags", () => {
    expect(formatTagsForEmbedding(null)).toBe("");
    expect(formatTagsForEmbedding(undefined)).toBe("");
  });
});

describe("buildResourceIndexContent", () => {
  it("includes flattened tags in embedding text", () => {
    const content = buildResourceIndexContent("pipeline", {
      name: "Deploy",
      description: "Prod deploy",
      identifier: "deploy_prod",
      tags: { env: "prod" },
    });
    expect(content).toBe("pipeline Deploy Prod deploy deploy_prod env:prod");
    expect(content).not.toContain("[object Object]");
  });

  it("builds content from identifier-only items", () => {
    const content = buildResourceIndexContent("service", {
      identifier: "payments_svc",
    });
    expect(content).toBe("service payments_svc");
  });
});
