import { describe, it, expect } from "vitest";
import { assertListScopeResolved } from "../../src/registry/list-filter-utils.js";
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

  it("accepts org_id values that match scope keyword names when used as identifiers", () => {
    expect(() =>
      assertListScopeResolved(
        "security_exemption",
        projectScoped,
        { org_id: "account", project_id: "Sanity", status: "Pending" },
        undefined,
        undefined,
      ),
    ).not.toThrow();
  });

  it("includes multi-scope hint for resources that support account/org/project", () => {
    expect(() =>
      assertListScopeResolved(
        "connector",
        {
          ...projectScoped,
          resourceType: "connector",
          supportedScopes: ["account", "org", "project"],
        },
        { type: "Github" },
        undefined,
        undefined,
      ),
    ).toThrow(/Supported scopes: account, org, project/);
  });

  it("does not include multi-scope hint for project-only resources", () => {
    expect(() =>
      assertListScopeResolved(
        "security_exemption",
        projectScoped,
        { status: "Pending" },
        undefined,
        undefined,
      ),
    ).toThrow(/requires project scope \(org_id \+ project_id\)/);
    expect(() =>
      assertListScopeResolved(
        "security_exemption",
        projectScoped,
        { status: "Pending" },
        undefined,
        undefined,
      ),
    ).not.toThrow(/resource_scope/);
  });

  it("defers to executeSpec when resource_scope is explicit", () => {
    expect(() =>
      assertListScopeResolved(
        "connector",
        { ...projectScoped, resourceType: "connector", supportedScopes: ["account", "org", "project"] },
        { resource_scope: "org" },
        undefined,
        undefined,
      ),
    ).not.toThrow();
  });

  it("treats whitespace-only org_id and project_id as unresolved scope", () => {
    expect(() =>
      assertListScopeResolved(
        "security_exemption",
        projectScoped,
        { org_id: "   ", project_id: "\t" },
        undefined,
        undefined,
      ),
    ).toThrow(/requires project scope \(org_id \+ project_id\)/i);
  });

  it("treats whitespace-only config defaults as unresolved scope", () => {
    expect(() =>
      assertListScopeResolved(
        "security_exemption",
        projectScoped,
        { status: "Pending" },
        "  ",
        "  ",
      ),
    ).toThrow(/requires project scope \(org_id \+ project_id\)/i);
  });
});
