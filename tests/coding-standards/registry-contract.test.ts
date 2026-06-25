/**
 * Runtime contract checks for ResourceDefinition and EndpointSpec fields
 * required by docs/coding-standards.md.
 */
import { describe, it, expect } from "vitest";
import { Registry } from "../../src/registry/index.js";
import type { ResourceScope } from "../../src/registry/types.js";

const VALID_SCOPES = new Set<ResourceScope>(["account", "org", "project"]);

const MINIMAL_CONFIG = {
  HARNESS_API_KEY: "pat.testaccount.testtoken.testsecret",
  HARNESS_BASE_URL: "https://app.harness.io",
} as const;

describe("Coding standards — registry resource contract", () => {
  const registry = new Registry(MINIMAL_CONFIG);

  it("every resource declares a valid scope", () => {
    const violations: string[] = [];

    for (const resourceType of registry.getAllResourceTypes()) {
      const def = registry.getResource(resourceType);
      if (!VALID_SCOPES.has(def.scope)) {
        violations.push(`${resourceType}: invalid scope "${String(def.scope)}"`);
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("every resource declares identifierFields (may be empty for metadata-only types)", () => {
    const violations: string[] = [];

    for (const resourceType of registry.getAllResourceTypes()) {
      const def = registry.getResource(resourceType);
      if (!Array.isArray(def.identifierFields)) {
        violations.push(`${resourceType}: identifierFields must be an array`);
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("every endpoint spec declares operationPolicy with risk and retryPolicy", () => {
    const violations: string[] = [];

    for (const resourceType of registry.getAllResourceTypes()) {
      const def = registry.getResource(resourceType);
      for (const [operation, spec] of Object.entries(def.operations)) {
        if (!spec.operationPolicy) {
          violations.push(`${resourceType}.${operation}: missing operationPolicy`);
          continue;
        }
        if (!spec.operationPolicy.risk) {
          violations.push(`${resourceType}.${operation}: missing operationPolicy.risk`);
        }
        if (!spec.operationPolicy.retryPolicy) {
          violations.push(`${resourceType}.${operation}: missing operationPolicy.retryPolicy`);
        }
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });
});
