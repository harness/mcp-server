import { describe, it, expect } from "vitest";
import {
  applyListFilterAliases,
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

describe("applyListFilterAliases", () => {
  it("maps exemption_statuses array to status", () => {
    const input: Record<string, unknown> = { exemption_statuses: ["pending"] };
    applyListFilterAliases(input, { exemption_statuses: "status" });
    expect(input.status).toBe("pending");
    expect(input.exemption_statuses).toBeUndefined();
  });

  it("maps exemption_statuses string to status", () => {
    const input: Record<string, unknown> = { exemption_statuses: "Pending" };
    applyListFilterAliases(input, { exemption_statuses: "status" });
    expect(input.status).toBe("Pending");
  });

  it("does not overwrite an explicit status", () => {
    const input: Record<string, unknown> = {
      status: "Approved",
      exemption_statuses: ["pending"],
    };
    applyListFilterAliases(input, { exemption_statuses: "status" });
    expect(input.status).toBe("Approved");
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
