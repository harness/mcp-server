/**
 * Safety and security rules from docs/coding-standards.md §9.
 */
import { describe, it, expect } from "vitest";
import { Registry } from "../../src/registry/index.js";

const MINIMAL_CONFIG = {
  HARNESS_API_KEY: "pat.testaccount.testtoken.testsecret",
  HARNESS_BASE_URL: "https://app.harness.io",
} as const;

describe("Coding standards — secret safety", () => {
  const registry = new Registry(MINIMAL_CONFIG);
  const secret = registry.getResource("secret");

  it("secret resource is read-only (no create, update, or delete)", () => {
    expect(secret.operations.create).toBeUndefined();
    expect(secret.operations.update).toBeUndefined();
    expect(secret.operations.delete).toBeUndefined();
    expect(secret.executeActions).toBeUndefined();
  });

  it("secret list/get use shared extractors (not passthrough)", () => {
    const listExtractor = secret.operations.list?.responseExtractor?.name ?? "";
    const getExtractor = secret.operations.get?.responseExtractor?.name ?? "";

    expect(listExtractor).toBe("pageExtract");
    expect(getExtractor).toBe("ngExtract");
    expect(listExtractor).not.toBe("passthrough");
    expect(getExtractor).not.toBe("passthrough");
  });

  it("secret descriptions state that values are never exposed", () => {
    const haystack = [
      secret.description,
      secret.operations.list?.description,
      secret.operations.get?.description,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    expect(haystack).toMatch(/never/);
    expect(haystack).toMatch(/value/);
  });
});
