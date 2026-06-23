import { describe, expect, it } from "vitest";
import { templateV1BasePathFromScope } from "../../src/registry/scope-utils.js";
import type { PathBuilderConfig } from "../../src/registry/types.js";

const config: PathBuilderConfig = {
  HARNESS_ORG: "default-org",
  HARNESS_PROJECT: "default-project",
};

describe("templateV1BasePathFromScope", () => {
  it("uses account path when resource_scope is account", () => {
    expect(templateV1BasePathFromScope({ resource_scope: "account" }, config)).toBe("/v1/templates");
  });

  it("uses org path when resource_scope is org", () => {
    expect(templateV1BasePathFromScope({ resource_scope: "org", org_id: "my-org" }, config)).toBe(
      "/v1/orgs/my-org/templates",
    );
  });

  it("uses project path when resource_scope is project", () => {
    expect(
      templateV1BasePathFromScope({
        resource_scope: "project",
        org_id: "my-org",
        project_id: "my-project",
      }, config),
    ).toBe("/v1/orgs/my-org/projects/my-project/templates");
  });

  it("infers project path from org_id and project_id when resource_scope is omitted", () => {
    expect(
      templateV1BasePathFromScope({ org_id: "org-a", project_id: "proj-b" }, config),
    ).toBe("/v1/orgs/org-a/projects/proj-b/templates");
  });

  it("infers org path when only org_id is present", () => {
    expect(templateV1BasePathFromScope({ org_id: "org-only" }, config)).toBe("/v1/orgs/org-only/templates");
  });

  it("falls back to account path when no scope hints are present", () => {
    expect(templateV1BasePathFromScope({}, config)).toBe("/v1/templates");
  });

  it("throws when org scope is requested without org_id or config default", () => {
    expect(() =>
      templateV1BasePathFromScope({ resource_scope: "org" }, { HARNESS_PROJECT: "p" }),
    ).toThrow('resource_scope "org" requires org_id or HARNESS_ORG.');
  });

  it("throws when project scope is requested without project_id or config default", () => {
    expect(() =>
      templateV1BasePathFromScope({ resource_scope: "project", org_id: "org-a" }, { HARNESS_ORG: "org-a" }),
    ).toThrow('resource_scope "project" requires project_id or HARNESS_PROJECT.');
  });

  it("URL-encodes org and project identifiers", () => {
    expect(
      templateV1BasePathFromScope({
        resource_scope: "project",
        org_id: "org/with space",
        project_id: "proj&special",
      }, config),
    ).toBe("/v1/orgs/org%2Fwith%20space/projects/proj%26special/templates");
  });
});
