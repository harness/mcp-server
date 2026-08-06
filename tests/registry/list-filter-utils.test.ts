import { describe, it, expect } from "vitest";
import {
  assertListFilterMiskeys,
  assertListScopeResolved,
} from "../../src/registry/list-filter-utils.js";
import type { ResourceDefinition } from "../../src/registry/types.js";

const projectScoped: ResourceDefinition = {
  resourceType: "security_exemption",
  displayName: "Security Exemption",
  description: "test",
  toolset: "sto",
  scope: "project",
  identifierFields: ["exemption_id"],
  operations: {},
};

describe("assertListFilterMiskeys", () => {
  const miskeys = {
    exemption_statuses:
      "Invalid filter 'exemption_statuses' — use filters.status for security_exemption (that key is for security_issue).",
  };

  it("throws when a commonly confused filter key is present", () => {
    expect(() =>
      assertListFilterMiskeys(
        "security_exemption",
        { exemption_statuses: ["pending"] },
        miskeys,
      ),
    ).toThrow(/use filters\.status for security_exemption/i);
  });

  it("passes when only valid filter keys are present", () => {
    expect(() =>
      assertListFilterMiskeys("security_exemption", { status: "Pending" }, miskeys),
    ).not.toThrow();
  });

  it("no-ops when miskeys config is undefined", () => {
    expect(() =>
      assertListFilterMiskeys("security_exemption", { exemption_statuses: "Pending" }, undefined),
    ).not.toThrow();
  });
});

describe("assertListScopeResolved", () => {
  it("passes when org_id and project_id are on the input", () => {
    expect(() =>
      assertListScopeResolved(
        "security_exemption",
        projectScoped,
        { org_id: "AI_Devops", project_id: "Sanity", status: "Pending" },
        undefined,
        undefined,
      ),
    ).not.toThrow();
  });

  it("passes when config defaults are set", () => {
    expect(() =>
      assertListScopeResolved(
        "security_exemption",
        projectScoped,
        { status: "Pending" },
        "AI_Devops",
        "Sanity",
      ),
    ).not.toThrow();
  });

  it("throws a clear error when project scope cannot be resolved", () => {
    expect(() =>
      assertListScopeResolved(
        "security_exemption",
        projectScoped,
        { status: "Pending" },
        undefined,
        undefined,
      ),
    ).toThrow(/requires project scope \(org_id \+ project_id\)/i);
  });

  it("ignores scope-keyword org_id values mistaken for identifiers", () => {
    expect(() =>
      assertListScopeResolved(
        "security_exemption",
        projectScoped,
        { org_id: "account", project_id: "Sanity", status: "Pending" },
        undefined,
        undefined,
      ),
    ).toThrow(/requires project scope/i);
  });
});
