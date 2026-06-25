import { describe, it, expect } from "vitest";
import { buildLiveSchemaCacheKey, buildBundledSchemaKey } from "../../src/tools/entity-schema/cache-keys.js";
import { bundledSnapshotMatchesScope } from "../../src/tools/entity-schema/bundled.js";
import { ENTITY_BUNDLED_META } from "../../src/data/schemas/entities/index.js";

describe("buildBundledSchemaKey", () => {
  it("joins resource type and scope with a dot", () => {
    expect(buildBundledSchemaKey("connector", "project")).toBe("connector.project");
    expect(buildBundledSchemaKey("environment", "org")).toBe("environment.org");
  });
});

describe("buildLiveSchemaCacheKey", () => {
  it("account scope keys only resource type, scope, and account id", () => {
    expect(buildLiveSchemaCacheKey("connector", "acct-1", "account")).toBe(
      JSON.stringify(["connector", "account", "acct-1"]),
    );
  });

  it("org scope differentiates cache entries by org id", () => {
    const orgA = buildLiveSchemaCacheKey("connector", "acct-1", "org", { orgId: "org-a" });
    const orgB = buildLiveSchemaCacheKey("connector", "acct-1", "org", { orgId: "org-b" });
    expect(orgA).not.toBe(orgB);
    expect(orgA).toBe(JSON.stringify(["connector", "org", "acct-1", "org-a"]));
  });

  it("project scope differentiates cache entries by org and project id", () => {
    const projectA = buildLiveSchemaCacheKey("environment", "acct-1", "project", {
      orgId: "org-a",
      projectId: "proj-a",
    });
    const projectB = buildLiveSchemaCacheKey("environment", "acct-1", "project", {
      orgId: "org-b",
      projectId: "proj-b",
    });
    expect(projectA).not.toBe(projectB);
    expect(projectA).toBe(JSON.stringify(["environment", "project", "acct-1", "org-a", "proj-a"]));
  });

  it("uses empty strings for missing org/project identifiers", () => {
    expect(buildLiveSchemaCacheKey("connector", "acct-1", "project", {})).toBe(
      JSON.stringify(["connector", "project", "acct-1", "", ""]),
    );
  });
});

describe("bundledSnapshotMatchesScope", () => {
  const projectMeta = ENTITY_BUNDLED_META["connector.project"]!;
  const orgMeta = ENTITY_BUNDLED_META["connector.org"]!;

  it("accepts bundled project snapshot when org and project match vendored meta", () => {
    expect(
      bundledSnapshotMatchesScope(
        "connector",
        "project",
        projectMeta.orgId,
        projectMeta.projectId,
      ),
    ).toBe(true);
  });

  it("rejects bundled project snapshot when org differs from vendored meta", () => {
    expect(
      bundledSnapshotMatchesScope("connector", "project", "other-org", projectMeta.projectId),
    ).toBe(false);
  });

  it("rejects bundled project snapshot when project differs from vendored meta", () => {
    expect(
      bundledSnapshotMatchesScope("connector", "project", projectMeta.orgId, "other-project"),
    ).toBe(false);
  });

  it("accepts account-scoped bundled snapshots without org/project identifiers", () => {
    expect(bundledSnapshotMatchesScope("connector", "account")).toBe(true);
  });

  it("rejects bundled org snapshot when org differs from vendored meta", () => {
    expect(
      bundledSnapshotMatchesScope("connector", "org", "other-org"),
    ).toBe(false);
  });

  it("accepts bundled org snapshot when org matches vendored meta", () => {
    expect(
      bundledSnapshotMatchesScope("connector", "org", orgMeta.orgId),
    ).toBe(true);
  });
});
