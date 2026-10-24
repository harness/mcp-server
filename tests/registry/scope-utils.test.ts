import { describe, expect, it } from "vitest";
import { templateV1BasePathFromScope, requireFmeIdentifier, isFmeHarnessNativeSelected, requireHarnessNativeSegmentScope, requireFmeHarnessNativeScope } from "../../src/registry/scope-utils.js";
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

describe("requireFmeHarnessNativeScope", () => {
  it("does not throw when org_id and project_id are both present", () => {
    expect(() => requireFmeHarnessNativeScope({ org_id: "o1", project_id: "p1" }, "fme_feature_flag")).not.toThrow();
  });

  it("silently ignores a stray workspace_id when org_id and project_id are present", () => {
    expect(() =>
      requireFmeHarnessNativeScope({ workspace_id: "ws1", org_id: "o1", project_id: "p1" }, "fme_feature_flag"),
    ).not.toThrow();
  });

  it("throws when org_id is missing", () => {
    expect(() => requireFmeHarnessNativeScope({ project_id: "p1" }, "fme_feature_flag")).toThrow(
      "fme_feature_flag: org_id and project_id are required (account is taken from config).",
    );
  });

  it("throws when project_id is missing", () => {
    expect(() => requireFmeHarnessNativeScope({ org_id: "o1" }, "fme_feature_flag")).toThrow(
      "fme_feature_flag: org_id and project_id are required (account is taken from config).",
    );
  });

  it("throws when both are missing, even with a stray workspace_id", () => {
    expect(() => requireFmeHarnessNativeScope({ workspace_id: "ws1" }, "fme_feature_flag")).toThrow(
      "fme_feature_flag: org_id and project_id are required (account is taken from config).",
    );
  });
});

describe("requireHarnessNativeSegmentScope", () => {
  it("does not throw when org_id and project_id are both present", () => {
    expect(() => requireHarnessNativeSegmentScope({ org_id: "o1", project_id: "p1" }, "fme_segment")).not.toThrow();
  });

  it("throws when org_id is missing", () => {
    expect(() => requireHarnessNativeSegmentScope({ project_id: "p1" }, "fme_segment")).toThrow(
      "fme_segment: org_id and project_id are required (account is taken from config).",
    );
  });

  it("throws when project_id is missing", () => {
    expect(() => requireHarnessNativeSegmentScope({ org_id: "o1" }, "fme_segment")).toThrow(
      "fme_segment: org_id and project_id are required (account is taken from config).",
    );
  });

  it("throws when both are missing", () => {
    expect(() => requireHarnessNativeSegmentScope({}, "fme_segment")).toThrow(
      "fme_segment: org_id and project_id are required (account is taken from config).",
    );
  });
});

describe("requireFmeIdentifier", () => {
  it("returns the stringified value when present", () => {
    expect(requireFmeIdentifier({ feature_flag_name: "my_flag" }, "feature_flag_name", "fme_feature_flag")).toBe("my_flag");
    expect(requireFmeIdentifier({ traffic_type_id: 42 }, "traffic_type_id", "fme_feature_flag")).toBe("42");
  });

  it.each([undefined, null, ""])("throws for %p", (value) => {
    expect(() => requireFmeIdentifier({ feature_flag_name: value }, "feature_flag_name", "fme_feature_flag")).toThrow(
      'fme_feature_flag: "feature_flag_name" is required.',
    );
  });

  it("throws when the field is absent entirely", () => {
    expect(() => requireFmeIdentifier({}, "segment_name", "fme_segment")).toThrow(
      'fme_segment: "segment_name" is required.',
    );
  });
});

describe("isFmeHarnessNativeSelected", () => {
  it("returns true for a complete org_id+project_id pair", () => {
    expect(isFmeHarnessNativeSelected({ org_id: "o1", project_id: "p1" }, "fme_identity.create")).toBe(true);
  });

  it("returns false when neither is provided (legacy contract)", () => {
    expect(isFmeHarnessNativeSelected({ environment_id: "env" }, "fme_identity.create")).toBe(false);
  });

  it("throws for a lone org_id", () => {
    expect(() => isFmeHarnessNativeSelected({ org_id: "o1" }, "fme_identity.create")).toThrow(
      "fme_identity.create: project_id is required when org_id is provided.",
    );
  });

  it("throws for a lone project_id", () => {
    expect(() => isFmeHarnessNativeSelected({ project_id: "p1" }, "fme_identity.create")).toThrow(
      "fme_identity.create: org_id is required when project_id is provided.",
    );
  });
});
