/**
 * Structural validation of all toolset definitions.
 *
 * Validates path/param consistency, bodySchema presence on write ops,
 * and general correctness across all 60+ resource types.
 */
import { describe, it, expect } from "vitest";
import { Registry } from "../../src/registry/index.js";
import type { Config } from "../../src/config.js";
import type { EndpointSpec, ResourceDefinition } from "../../src/registry/types.js";

function makeConfig(): Config {
  return {
    HARNESS_API_KEY: "pat.test.abc.xyz",
    HARNESS_ACCOUNT_ID: "test-account",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_DEFAULT_ORG_ID: "default",
    HARNESS_DEFAULT_PROJECT_ID: "test-project",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 3,
    LOG_LEVEL: "info",
  };
}

/** Extract {placeholders} from a path template. */
function extractPathPlaceholders(path: string): string[] {
  const matches = path.match(/\{([^}]+)\}/g);
  return matches ? matches.map((m) => m.slice(1, -1)) : [];
}

describe("Toolset structural validation", () => {
  const registry = new Registry(makeConfig());
  const allTypes = registry.getAllResourceTypes();

  describe("path/param consistency", () => {
    it("every path placeholder has a matching pathParams entry", () => {
      const issues: string[] = [];

      for (const type of allTypes) {
        const def = registry.getResource(type);
        const allSpecs: [string, EndpointSpec][] = [
          ...Object.entries(def.operations) as [string, EndpointSpec][],
          ...Object.entries(def.executeActions ?? {}) as [string, EndpointSpec][],
        ];

        for (const [opName, spec] of allSpecs) {
          // pathBuilder dynamically constructs the URL — static path placeholders don't apply
          if (spec.pathBuilder) continue;

          const placeholders = extractPathPlaceholders(spec.path);
          if (placeholders.length === 0) continue;

          // accountId is injected automatically, not via pathParams
          const nonAccountPlaceholders = placeholders.filter((p) => p !== "accountId");

          for (const placeholder of nonAccountPlaceholders) {
            const pathParams = spec.pathParams ?? {};
            const paramValues = Object.values(pathParams);
            if (!paramValues.includes(placeholder)) {
              // Check if it could be a scope param (org/project) handled by the
              // registry dispatch layer directly for some v1 APIs
              const isScopeParam = placeholder === "org" || placeholder === "project";
              if (!isScopeParam) {
                issues.push(`${type}.${opName}: path placeholder {${placeholder}} has no pathParams mapping`);
              }
            }
          }
        }
      }

      expect(issues, `Path/param mismatches:\n${issues.join("\n")}`).toEqual([]);
    });

    it("every pathParams value corresponds to a path placeholder", () => {
      const issues: string[] = [];

      for (const type of allTypes) {
        const def = registry.getResource(type);
        const allSpecs: [string, EndpointSpec][] = [
          ...Object.entries(def.operations) as [string, EndpointSpec][],
          ...Object.entries(def.executeActions ?? {}) as [string, EndpointSpec][],
        ];

        for (const [opName, spec] of allSpecs) {
          if (!spec.pathParams) continue;
          // When pathBuilder is set, path is not used for URL construction —
          // pathParams are only retained for deep link resolution.
          if (spec.pathBuilder) continue;
          const placeholders = new Set(extractPathPlaceholders(spec.path));

          for (const [inputKey, pathPlaceholder] of Object.entries(spec.pathParams)) {
            if (!placeholders.has(pathPlaceholder)) {
              issues.push(
                `${type}.${opName}: pathParams["${inputKey}"] = "${pathPlaceholder}" but {${pathPlaceholder}} not found in path "${spec.path}"`,
              );
            }
          }
        }
      }

      expect(issues, `Dangling pathParams:\n${issues.join("\n")}`).toEqual([]);
    });

    it("pathParams keys use snake_case (matching tool input conventions)", () => {
      const issues: string[] = [];

      for (const type of allTypes) {
        const def = registry.getResource(type);
        const allSpecs: [string, EndpointSpec][] = [
          ...Object.entries(def.operations) as [string, EndpointSpec][],
          ...Object.entries(def.executeActions ?? {}) as [string, EndpointSpec][],
        ];

        for (const [opName, spec] of allSpecs) {
          if (!spec.pathParams) continue;
          for (const inputKey of Object.keys(spec.pathParams)) {
            if (inputKey !== inputKey.toLowerCase() || inputKey.includes("-")) {
              issues.push(`${type}.${opName}: pathParams key "${inputKey}" is not snake_case`);
            }
          }
        }
      }

      expect(issues, `Non-snake_case pathParams:\n${issues.join("\n")}`).toEqual([]);
    });
  });

  describe("identifierFields consistency", () => {
    it("every resource type has identifierFields defined", () => {
      const missing: string[] = [];
      for (const type of allTypes) {
        const def = registry.getResource(type);
        if (!def.identifierFields) {
          missing.push(type);
        }
      }
      expect(missing, `Missing identifierFields array: ${missing.join(", ")}`).toEqual([]);
    });

    it("most resource types with a get operation have at least one identifierField", () => {
      const issues: string[] = [];
      for (const type of allTypes) {
        const def = registry.getResource(type);
        // Only check resources that have a get operation — they need an ID to fetch
        if (def.operations.get && def.identifierFields.length === 0) {
          issues.push(type);
        }
      }
      // Allow some dashboard/analytics types that use body-based get
      expect(issues.length).toBeLessThan(allTypes.length * 0.3);
    });

    it("identifierFields referenced in get pathParams exist", () => {
      const issues: string[] = [];
      for (const type of allTypes) {
        const def = registry.getResource(type);
        const getSpec = def.operations.get;
        if (!getSpec?.pathParams) continue;

        // The primary identifier field should be in pathParams
        const primaryField = def.identifierFields[0];
        if (primaryField && !getSpec.pathParams[primaryField]) {
          // Check queryParams as fallback (some resources use query params for IDs)
          if (!getSpec.queryParams?.[primaryField]) {
            issues.push(`${type}: primary identifierField "${primaryField}" not in get.pathParams or get.queryParams`);
          }
        }
      }
      expect(issues, `identifierField/pathParam mismatches:\n${issues.join("\n")}`).toEqual([]);
    });
  });

  describe("scope consistency", () => {
    it("every resource has a valid scope", () => {
      const validScopes = new Set(["project", "org", "account"]);
      const invalid: string[] = [];
      for (const type of allTypes) {
        const def = registry.getResource(type);
        if (!validScopes.has(def.scope)) {
          invalid.push(`${type}: scope="${def.scope}"`);
        }
      }
      expect(invalid).toEqual([]);
    });
  });

  describe("HTTP method conventions", () => {
    it("list operations use GET or POST", () => {
      const issues: string[] = [];
      for (const type of allTypes) {
        const def = registry.getResource(type);
        const listSpec = def.operations.list;
        if (listSpec && listSpec.method !== "GET" && listSpec.method !== "POST") {
          issues.push(`${type}.list: unexpected method ${listSpec.method}`);
        }
      }
      expect(issues).toEqual([]);
    });

    it("get operations use GET or POST (some analytics APIs use POST)", () => {
      const issues: string[] = [];
      for (const type of allTypes) {
        const def = registry.getResource(type);
        const getSpec = def.operations.get;
        if (getSpec && getSpec.method !== "GET" && getSpec.method !== "POST") {
          issues.push(`${type}.get: unexpected method ${getSpec.method}`);
        }
      }
      expect(issues).toEqual([]);
    });

    it("create operations use POST", () => {
      const issues: string[] = [];
      for (const type of allTypes) {
        const def = registry.getResource(type);
        const createSpec = def.operations.create;
        if (createSpec && createSpec.method !== "POST") {
          issues.push(`${type}.create: unexpected method ${createSpec.method}`);
        }
      }
      expect(issues).toEqual([]);
    });

    it("delete operations use DELETE", () => {
      const issues: string[] = [];
      for (const type of allTypes) {
        const def = registry.getResource(type);
        const deleteSpec = def.operations.delete;
        if (deleteSpec && deleteSpec.method !== "DELETE") {
          issues.push(`${type}.delete: unexpected method ${deleteSpec.method}`);
        }
      }
      expect(issues).toEqual([]);
    });

    it("update operations use PUT or PATCH", () => {
      const issues: string[] = [];
      for (const type of allTypes) {
        const def = registry.getResource(type);
        const updateSpec = def.operations.update;
        if (updateSpec && updateSpec.method !== "PUT" && updateSpec.method !== "PATCH") {
          issues.push(`${type}.update: unexpected method ${updateSpec.method}`);
        }
      }
      expect(issues).toEqual([]);
    });
  });

  describe("responseExtractor presence", () => {
    it("every operation has a responseExtractor", () => {
      const missing: string[] = [];
      for (const type of allTypes) {
        const def = registry.getResource(type);
        for (const [op, spec] of Object.entries(def.operations)) {
          if (!spec.responseExtractor) {
            missing.push(`${type}.${op}`);
          }
        }
        for (const [action, spec] of Object.entries(def.executeActions ?? {})) {
          if (!spec.responseExtractor) {
            missing.push(`${type}.${action}`);
          }
        }
      }
      expect(missing, `Missing responseExtractor: ${missing.join(", ")}`).toEqual([]);
    });
  });

  describe("write operations require bodyBuilder or bodySchema", () => {
    it("create operations have a bodyBuilder", () => {
      const missing: string[] = [];
      for (const type of allTypes) {
        const def = registry.getResource(type);
        if (def.operations.create && !def.operations.create.bodyBuilder) {
          missing.push(`${type}.create`);
        }
      }
      expect(missing, `Missing bodyBuilder on create: ${missing.join(", ")}`).toEqual([]);
    });

    it("update operations have a bodyBuilder", () => {
      const missing: string[] = [];
      for (const type of allTypes) {
        const def = registry.getResource(type);
        if (def.operations.update && !def.operations.update.bodyBuilder) {
          missing.push(`${type}.update`);
        }
      }
      expect(missing, `Missing bodyBuilder on update: ${missing.join(", ")}`).toEqual([]);
    });
  });

  describe("toolset/resource cross-references", () => {
    it("every resource's toolset field matches its parent toolset name", () => {
      const issues: string[] = [];
      for (const ts of registry.getAllToolsets()) {
        for (const res of ts.resources) {
          if (res.toolset !== ts.name) {
            issues.push(`${res.resourceType}: toolset="${res.toolset}" but parent toolset is "${ts.name}"`);
          }
        }
      }
      expect(issues).toEqual([]);
    });

    it("no duplicate resource type names across toolsets", () => {
      const seen = new Map<string, string>();
      const dupes: string[] = [];
      for (const ts of registry.getAllToolsets()) {
        for (const res of ts.resources) {
          const existing = seen.get(res.resourceType);
          if (existing) {
            dupes.push(`${res.resourceType} in both "${existing}" and "${ts.name}"`);
          }
          seen.set(res.resourceType, ts.name);
        }
      }
      expect(dupes).toEqual([]);
    });
  });

  describe("description completeness", () => {
    it("every resource type has a non-empty description", () => {
      const empty: string[] = [];
      for (const type of allTypes) {
        const def = registry.getResource(type);
        if (!def.description || def.description.trim() === "") {
          empty.push(type);
        }
      }
      expect(empty).toEqual([]);
    });

    it("every resource type has a non-empty displayName", () => {
      const empty: string[] = [];
      for (const type of allTypes) {
        const def = registry.getResource(type);
        if (!def.displayName || def.displayName.trim() === "") {
          empty.push(type);
        }
      }
      expect(empty).toEqual([]);
    });
  });
});
