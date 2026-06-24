import { describe, it, expect } from "vitest";
import {
  buildBundledSchemaKey,
  buildLiveSchemaCacheKey,
} from "../../src/tools/entity-schema/cache-keys.js";

describe("entity-schema cache keys", () => {
  const accountId = "acct-123";

  it("buildBundledSchemaKey joins resource type and scope", () => {
    expect(buildBundledSchemaKey("connector", "project")).toBe("connector.project");
  });

  it("buildLiveSchemaCacheKey omits org/project for account scope", () => {
    expect(buildLiveSchemaCacheKey("connector", accountId, "account")).toBe(
      JSON.stringify(["connector", "account", accountId]),
    );
  });

  it("buildLiveSchemaCacheKey includes orgId for org scope", () => {
    expect(
      buildLiveSchemaCacheKey("environment", accountId, "org", { orgId: "org-a" }),
    ).toBe(JSON.stringify(["environment", "org", accountId, "org-a"]));
  });

  it("buildLiveSchemaCacheKey includes orgId and projectId for project scope", () => {
    expect(
      buildLiveSchemaCacheKey("environment", accountId, "project", {
        orgId: "org-a",
        projectId: "proj-a",
      }),
    ).toBe(JSON.stringify(["environment", "project", accountId, "org-a", "proj-a"]));
  });

  it("produces distinct keys for different org identifiers at org scope", () => {
    const orgA = buildLiveSchemaCacheKey("connector", accountId, "org", { orgId: "org-a" });
    const orgB = buildLiveSchemaCacheKey("connector", accountId, "org", { orgId: "org-b" });
    expect(orgA).not.toBe(orgB);
  });

  it("produces distinct keys for different project identifiers at project scope", () => {
    const projectA = buildLiveSchemaCacheKey("connector", accountId, "project", {
      orgId: "org-a",
      projectId: "proj-a",
    });
    const projectB = buildLiveSchemaCacheKey("connector", accountId, "project", {
      orgId: "org-a",
      projectId: "proj-b",
    });
    expect(projectA).not.toBe(projectB);
  });

  it("uses empty string placeholders when org/project identifiers are omitted", () => {
    expect(buildLiveSchemaCacheKey("connector", accountId, "org")).toBe(
      JSON.stringify(["connector", "org", accountId, ""]),
    );
    expect(buildLiveSchemaCacheKey("connector", accountId, "project", { orgId: "org-a" })).toBe(
      JSON.stringify(["connector", "project", accountId, "org-a", ""]),
    );
  });
});
