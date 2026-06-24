import { describe, expect, it } from "vitest";
import { buildLiveSchemaCacheKey } from "../../src/tools/entity-schema/cache-keys.js";

describe("buildLiveSchemaCacheKey", () => {
  it("keys account scope by resource type, scope, and account only", () => {
    const key = buildLiveSchemaCacheKey("connector", "acct-1", "account");
    expect(key).toBe(JSON.stringify(["connector", "account", "acct-1"]));
  });

  it("includes orgId for org scope", () => {
    const keyA = buildLiveSchemaCacheKey("connector", "acct-1", "org", { orgId: "org-a" });
    const keyB = buildLiveSchemaCacheKey("connector", "acct-1", "org", { orgId: "org-b" });
    expect(keyA).not.toBe(keyB);
    expect(keyA).toBe(JSON.stringify(["connector", "org", "acct-1", "org-a"]));
  });

  it("includes orgId and projectId for project scope", () => {
    const keyA = buildLiveSchemaCacheKey("connector", "acct-1", "project", {
      orgId: "org-a",
      projectId: "proj-a",
    });
    const keyB = buildLiveSchemaCacheKey("connector", "acct-1", "project", {
      orgId: "org-a",
      projectId: "proj-b",
    });
    expect(keyA).not.toBe(keyB);
    expect(keyA).toBe(JSON.stringify(["connector", "project", "acct-1", "org-a", "proj-a"]));
  });

  it("isolates cache entries across accounts at the same scope", () => {
    const keyA = buildLiveSchemaCacheKey("service", "acct-a", "account");
    const keyB = buildLiveSchemaCacheKey("service", "acct-b", "account");
    expect(keyA).not.toBe(keyB);
  });
});
