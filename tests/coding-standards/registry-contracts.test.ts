/**
 * Runtime registry contract checks from docs/coding-standards.md.
 *
 * Validates that every registered resource/endpoint follows scoping,
 * operationPolicy, and identifier field conventions.
 */
import { describe, it, expect } from "vitest";
import { Registry } from "../../src/registry/index.js";
import { ConfigSchema } from "../../src/config.js";
import type { ResourceDefinition, EndpointSpec } from "../../src/registry/types.js";

const VALID_SCOPES = new Set(["account", "org", "project"]);

/** Params the registry/client inject from scope — not resource identifiers. */
const SCOPE_PARAM_ALIASES = new Set([
  "accountIdentifier",
  "orgIdentifier",
  "organizationIdentifier",
  "projectIdentifier",
  "org",
  "project",
  "account_id",
  "org_id",
  "project_id",
]);

function makeTestConfig() {
  return ConfigSchema.parse({
    HARNESS_API_KEY: "pat.testacct.token.secret",
    HARNESS_ACCOUNT_ID: "testacct",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "default-org",
    HARNESS_PROJECT: "default-project",
  });
}

function collectEndpoints(def: ResourceDefinition): Array<{ operation: string; spec: EndpointSpec }> {
  const endpoints: Array<{ operation: string; spec: EndpointSpec }> = [];

  for (const [operation, spec] of Object.entries(def.operations)) {
    if (spec) endpoints.push({ operation, spec });
  }

  if (def.executeActions) {
    for (const [action, spec] of Object.entries(def.executeActions)) {
      endpoints.push({ operation: `execute:${action}`, spec });
    }
  }

  return endpoints;
}

function getNonScopePathParams(spec: EndpointSpec): string[] {
  const params = new Set<string>();

  if (spec.pathParams) {
    for (const [inputKey, apiKey] of Object.entries(spec.pathParams)) {
      if (!SCOPE_PARAM_ALIASES.has(inputKey) && !SCOPE_PARAM_ALIASES.has(apiKey)) {
        params.add(inputKey);
      }
    }
  }

  const braceParams = spec.path.match(/\{([^}]+)\}/g) ?? [];
  for (const token of braceParams) {
    const apiKey = token.slice(1, -1);
    if (!SCOPE_PARAM_ALIASES.has(apiKey)) {
      const inputKey =
        spec.pathParams &&
        Object.entries(spec.pathParams).find(([, v]) => v === apiKey)?.[0];
      if (inputKey && !SCOPE_PARAM_ALIASES.has(inputKey)) {
        params.add(inputKey);
      }
    }
  }

  return [...params];
}

describe("Coding standards — registry resource contracts", () => {
  const registry = new Registry(makeTestConfig());
  const resourceTypes = registry.getAllResourceTypes();

  it("declares a valid scope on every resource", () => {
    const violations: string[] = [];

    for (const resourceType of resourceTypes) {
      const def = registry.getResource(resourceType);
      if (!VALID_SCOPES.has(def.scope)) {
        violations.push(`${resourceType}: invalid scope "${String(def.scope)}"`);
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("declares identifierFields on every resource definition", () => {
    const violations: string[] = [];

    for (const resourceType of resourceTypes) {
      const def = registry.getResource(resourceType);
      if (!Array.isArray(def.identifierFields)) {
        violations.push(`${resourceType}: identifierFields must be an array (use [] for singleton gets)`);
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("maps non-scope path params to identifierFields for get operations", () => {
    const violations: string[] = [];

    for (const resourceType of resourceTypes) {
      const def = registry.getResource(resourceType);
      const get = def.operations.get;
      if (!get) continue;

      const requiredParams = getNonScopePathParams(get);
      if (requiredParams.length === 0) continue;

      const declared = new Set(def.identifierFields ?? []);
      const missing = requiredParams.filter((param) => !declared.has(param));
      if (missing.length > 0) {
        violations.push(
          `${resourceType}.get requires identifierFields for path params: ${missing.join(", ")}`,
        );
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("declares operationPolicy.risk and retryPolicy on every endpoint", () => {
    const violations: string[] = [];

    for (const resourceType of resourceTypes) {
      const def = registry.getResource(resourceType);
      for (const { operation, spec } of collectEndpoints(def)) {
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

  it("does not hardcode scope query params in endpoint specs", () => {
    const violations: string[] = [];
    const forbiddenApiKeys = new Set([
      "accountIdentifier",
      "orgIdentifier",
      "organizationIdentifier",
      "projectIdentifier",
    ]);

    for (const resourceType of resourceTypes) {
      const def = registry.getResource(resourceType);
      for (const { operation, spec } of collectEndpoints(def)) {
        const queryParams = spec.queryParams ?? {};
        for (const [inputKey, apiKey] of Object.entries(queryParams)) {
          if (!forbiddenApiKeys.has(apiKey)) continue;

          // Global template reads override accountIdentifier via account_id when global=true.
          if (resourceType === "template" && inputKey === "account_id" && apiKey === "accountIdentifier") {
            continue;
          }

          // Registry injects scope when scopeOptional or injectOrgQueryFallback is set.
          if (
            def.scopeOptional &&
            (inputKey === "org_id" || inputKey === "project_id")
          ) {
            continue;
          }
          if (spec.injectOrgQueryFallback && inputKey === "org_id") {
            continue;
          }

          violations.push(
            `${resourceType}.${operation}: queryParams.${inputKey} maps to auto-injected scope param "${apiKey}"`,
          );
        }
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });
});
