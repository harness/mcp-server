/**
 * Structural validation of all toolset definitions.
 *
 * Validates path/param consistency, bodySchema presence on write ops,
 * and general correctness across all 200+ resource types.
 */
import { describe, it, expect } from "vitest";
import { Registry, ALL_TOOLSET_NAMES } from "../../src/registry/index.js";
import type { Config } from "../../src/config.js";
import type { EndpointSpec, ResourceDefinition, ToolsetDefinition } from "../../src/registry/types.js";

function makeConfig(): Config {
  return {
    HARNESS_API_KEY: "pat.test.abc.xyz",
    HARNESS_ACCOUNT_ID: "test-account",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "default",
    HARNESS_PROJECT: "test-project",
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

function collectInvalidScopes(registry: Registry): string[] {
  const validScopes = new Set(["project", "org", "account"]);
  const invalid: string[] = [];
  for (const type of registry.getAllResourceTypes()) {
    const def = registry.getResource(type);
    if (!validScopes.has(def.scope)) {
      invalid.push(`${type}: scope="${def.scope}"`);
    }
  }
  return invalid;
}

describe("Toolset structural validation", () => {
  const defaultRegistry = new Registry(makeConfig());
  const fullToolsetSelection = ALL_TOOLSET_NAMES.map((name) => `+${name}`).join(",");
  /** Defaults plus every opt-in toolset. Both pipeline resource types are always registered. */
  const fullRegistry = new Registry({
    ...makeConfig(),
    HARNESS_TOOLSETS: fullToolsetSelection,
  });
  const allFullTypes = fullRegistry.getAllResourceTypes();
  const optInToolsets = fullRegistry.getAllToolsets().filter((toolset) => toolset.optIn);
  const optInTypes = optInToolsets.flatMap((toolset) =>
    toolset.resources.map((resource) => resource.resourceType),
  );

  describe("path/param consistency", () => {
    it("every path placeholder has a matching pathParams entry", () => {
      const issues: string[] = [];

      for (const type of allFullTypes) {
        const def = fullRegistry.getResource(type);
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

      for (const type of allFullTypes) {
        const def = fullRegistry.getResource(type);
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

      for (const type of allFullTypes) {
        const def = fullRegistry.getResource(type);
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
      for (const type of allFullTypes) {
        const def = fullRegistry.getResource(type);
        if (!def.identifierFields) {
          missing.push(type);
        }
      }
      expect(missing, `Missing identifierFields array: ${missing.join(", ")}`).toEqual([]);
    });

    it("get operations with empty identifierFields are filter/body-based (no resource path ID)", () => {
      const scopeOnlyParams = new Set(["org_id", "project_id", "account_id", "org", "project"]);
      const issues: string[] = [];

      for (const type of allFullTypes) {
        const def = fullRegistry.getResource(type);
        if (!def.operations.get || def.identifierFields.length > 0) continue;

        const getSpec = def.operations.get;
        const pathParams = getSpec.pathParams ?? {};
        const hasResourcePathId = Object.keys(pathParams).some((k) => !scopeOnlyParams.has(k));
        if (hasResourcePathId) {
          issues.push(`${type}: get has pathParams for resource IDs but identifierFields is empty`);
        }
      }

      expect(
        issues,
        `Resources with get + empty identifierFields must be filter/body-based:\n${issues.join("\n")}`,
      ).toEqual([]);
    });

    it("identifierFields referenced in get pathParams exist", () => {
      const issues: string[] = [];
      for (const type of allFullTypes) {
        const def = fullRegistry.getResource(type);
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
      expect(collectInvalidScopes(fullRegistry)).toEqual([]);
    });
  });

  describe("HTTP method conventions", () => {
    it("list operations use GET or POST", () => {
      const issues: string[] = [];
      for (const type of allFullTypes) {
        const def = fullRegistry.getResource(type);
        const listSpec = def.operations.list;
        if (listSpec && listSpec.method !== "GET" && listSpec.method !== "POST") {
          issues.push(`${type}.list: unexpected method ${listSpec.method}`);
        }
      }
      expect(issues).toEqual([]);
    });

    it("get operations use GET or POST (some analytics APIs use POST)", () => {
      const issues: string[] = [];
      for (const type of allFullTypes) {
        const def = fullRegistry.getResource(type);
        const getSpec = def.operations.get;
        if (getSpec && getSpec.method !== "GET" && getSpec.method !== "POST") {
          issues.push(`${type}.get: unexpected method ${getSpec.method}`);
        }
      }
      expect(issues).toEqual([]);
    });

    it("create operations use POST", () => {
      const issues: string[] = [];
      for (const type of allFullTypes) {
        const def = fullRegistry.getResource(type);
        const createSpec = def.operations.create;
        if (createSpec && createSpec.method !== "POST") {
          issues.push(`${type}.create: unexpected method ${createSpec.method}`);
        }
      }
      expect(issues).toEqual([]);
    });

    it("delete operations use DELETE", () => {
      const issues: string[] = [];
      for (const type of allFullTypes) {
        const def = fullRegistry.getResource(type);
        const deleteSpec = def.operations.delete;
        if (deleteSpec && deleteSpec.method !== "DELETE") {
          issues.push(`${type}.delete: unexpected method ${deleteSpec.method}`);
        }
      }
      expect(issues).toEqual([]);
    });

    it("update operations use PUT or PATCH", () => {
      const issues: string[] = [];
      for (const type of allFullTypes) {
        const def = fullRegistry.getResource(type);
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
      for (const type of allFullTypes) {
        const def = fullRegistry.getResource(type);
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
      for (const type of allFullTypes) {
        const def = fullRegistry.getResource(type);
        if (def.operations.create && !def.operations.create.bodyBuilder) {
          missing.push(`${type}.create`);
        }
      }
      expect(missing, `Missing bodyBuilder on create: ${missing.join(", ")}`).toEqual([]);
    });

    it("update operations have a bodyBuilder", () => {
      const missing: string[] = [];
      for (const type of allFullTypes) {
        const def = fullRegistry.getResource(type);
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
      for (const ts of fullRegistry.getAllToolsets()) {
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
      for (const ts of fullRegistry.getAllToolsets()) {
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

  describe("operationPolicy contract", () => {
    const VALID_RISK_LEVELS = new Set(["read", "low_write", "medium_write", "high_write", "destructive"]);
    const VALID_RETRY_POLICIES = new Set(["safe", "idempotency_key_required", "do_not_retry"]);

    it("every operation endpoint spec has operationPolicy", () => {
      const missing: string[] = [];
      for (const type of allFullTypes) {
        const def = fullRegistry.getResource(type);
        for (const [op, spec] of Object.entries(def.operations)) {
          if (!spec.operationPolicy) {
            missing.push(`${type}.${op}`);
          }
        }
      }
      expect(missing, `Missing operationPolicy:\n${missing.join("\n")}`).toEqual([]);
    });

    it("every executeAction endpoint spec has operationPolicy", () => {
      const missing: string[] = [];
      for (const type of allFullTypes) {
        const def = fullRegistry.getResource(type);
        for (const [action, spec] of Object.entries(def.executeActions ?? {})) {
          if (!spec.operationPolicy) {
            missing.push(`${type}.${action}`);
          }
        }
      }
      expect(missing, `Missing operationPolicy on executeActions:\n${missing.join("\n")}`).toEqual([]);
    });

    it("operationPolicy.risk is a valid RiskLevel", () => {
      const issues: string[] = [];
      for (const type of allFullTypes) {
        const def = fullRegistry.getResource(type);
        for (const [op, spec] of Object.entries(def.operations)) {
          if (spec.operationPolicy && !VALID_RISK_LEVELS.has(spec.operationPolicy.risk)) {
            issues.push(`${type}.${op}: invalid risk "${spec.operationPolicy.risk}"`);
          }
        }
        for (const [action, spec] of Object.entries(def.executeActions ?? {})) {
          if (spec.operationPolicy && !VALID_RISK_LEVELS.has(spec.operationPolicy.risk)) {
            issues.push(`${type}.${action}: invalid risk "${spec.operationPolicy.risk}"`);
          }
        }
      }
      expect(issues, `Invalid risk levels:\n${issues.join("\n")}`).toEqual([]);
    });

    it("operationPolicy.retryPolicy is a valid RetryPolicy", () => {
      const issues: string[] = [];
      for (const type of allFullTypes) {
        const def = fullRegistry.getResource(type);
        for (const [op, spec] of Object.entries(def.operations)) {
          if (spec.operationPolicy && !VALID_RETRY_POLICIES.has(spec.operationPolicy.retryPolicy)) {
            issues.push(`${type}.${op}: invalid retryPolicy "${spec.operationPolicy.retryPolicy}"`);
          }
        }
        for (const [action, spec] of Object.entries(def.executeActions ?? {})) {
          if (spec.operationPolicy && !VALID_RETRY_POLICIES.has(spec.operationPolicy.retryPolicy)) {
            issues.push(`${type}.${action}: invalid retryPolicy "${spec.operationPolicy.retryPolicy}"`);
          }
        }
      }
      expect(issues, `Invalid retry policies:\n${issues.join("\n")}`).toEqual([]);
    });

    it("all delete operations have risk: destructive", () => {
      const issues: string[] = [];
      for (const type of allFullTypes) {
        const def = fullRegistry.getResource(type);
        const deleteSpec = def.operations.delete;
        if (deleteSpec?.operationPolicy && deleteSpec.operationPolicy.risk !== "destructive") {
          issues.push(`${type}.delete: risk is "${deleteSpec.operationPolicy.risk}", expected "destructive"`);
        }
      }
      expect(issues, `Delete ops without destructive risk:\n${issues.join("\n")}`).toEqual([]);
    });

    it("all list and get operations have risk: read", () => {
      const issues: string[] = [];
      for (const type of allFullTypes) {
        const def = fullRegistry.getResource(type);
        for (const op of ["list", "get"] as const) {
          const spec = def.operations[op];
          if (spec?.operationPolicy && spec.operationPolicy.risk !== "read") {
            issues.push(`${type}.${op}: risk is "${spec.operationPolicy.risk}", expected "read"`);
          }
        }
      }
      expect(issues, `Read ops without read risk:\n${issues.join("\n")}`).toEqual([]);
    });

    it("no endpoint spec has blockWithoutConfirmation (removed field)", () => {
      const found: string[] = [];
      for (const type of allFullTypes) {
        const def = fullRegistry.getResource(type);
        for (const [op, spec] of Object.entries(def.operations)) {
          if ("blockWithoutConfirmation" in spec) {
            found.push(`${type}.${op}`);
          }
        }
        for (const [action, spec] of Object.entries(def.executeActions ?? {})) {
          if ("blockWithoutConfirmation" in spec) {
            found.push(`${type}.${action}`);
          }
        }
      }
      expect(found, `Specs still have blockWithoutConfirmation:\n${found.join("\n")}`).toEqual([]);
    });
  });

  describe("write quality contract", () => {
    it("every create operation has bodySchema", () => {
      const missing: string[] = [];
      for (const type of allFullTypes) {
        const def = fullRegistry.getResource(type);
        if (def.operations.create && !def.operations.create.bodySchema) {
          missing.push(`${type}.create`);
        }
      }
      expect(missing, `Missing bodySchema on create:\n${missing.join("\n")}`).toEqual([]);
    });

    it("every update operation has bodySchema", () => {
      const missing: string[] = [];
      for (const type of allFullTypes) {
        const def = fullRegistry.getResource(type);
        if (def.operations.update && !def.operations.update.bodySchema) {
          missing.push(`${type}.update`);
        }
      }
      expect(missing, `Missing bodySchema on update:\n${missing.join("\n")}`).toEqual([]);
    });

    it("every medium_write/high_write/destructive execute action has actionDescription", () => {
      const missing: string[] = [];
      const RISKY = new Set(["medium_write", "high_write", "destructive"]);
      for (const type of allFullTypes) {
        const def = fullRegistry.getResource(type);
        for (const [action, spec] of Object.entries(def.executeActions ?? {})) {
          const risk = spec.operationPolicy?.risk;
          if (risk && RISKY.has(risk) && !spec.actionDescription) {
            missing.push(`${type}.${action}`);
          }
        }
      }
      expect(missing, `Missing actionDescription on medium/high-risk actions:\n${missing.join("\n")}`).toEqual([]);
    });

    it("every medium_write/high_write/destructive execute action has bodySchema", () => {
      const missing: string[] = [];
      const RISKY = new Set(["medium_write", "high_write", "destructive"]);
      for (const type of allFullTypes) {
        const def = fullRegistry.getResource(type);
        for (const [action, spec] of Object.entries(def.executeActions ?? {})) {
          const risk = spec.operationPolicy?.risk;
          if (risk && RISKY.has(risk) && !spec.bodySchema) {
            missing.push(`${type}.${action}`);
          }
        }
      }
      expect(missing, `Missing bodySchema on risky execute actions:\n${missing.join("\n")}`).toEqual([]);
    });

    it("every execute action has actionDescription or description", () => {
      const missing: string[] = [];
      for (const type of allFullTypes) {
        const def = fullRegistry.getResource(type);
        for (const [action, spec] of Object.entries(def.executeActions ?? {})) {
          if (!spec.actionDescription && !spec.description) {
            missing.push(`${type}.${action}`);
          }
        }
      }
      expect(missing, `Missing description on execute actions:\n${missing.join("\n")}`).toEqual([]);
    });
  });

  describe("description completeness", () => {
    it("every resource type has a non-empty description", () => {
      const empty: string[] = [];
      for (const type of allFullTypes) {
        const def = fullRegistry.getResource(type);
        if (!def.description || def.description.trim() === "") {
          empty.push(type);
        }
      }
      expect(empty).toEqual([]);
    });

    it("every resource type has a non-empty displayName", () => {
      const empty: string[] = [];
      for (const type of allFullTypes) {
        const def = fullRegistry.getResource(type);
        if (!def.displayName || def.displayName.trim() === "") {
          empty.push(type);
        }
      }
      expect(empty).toEqual([]);
    });
  });

  describe("full-registry coverage regression", () => {
    it("covers defaults, all toolsets (incl. opt-in), and both pipeline resource types", () => {
      const loadedToolsets = fullRegistry.getAllToolsets().map((t) => t.name).sort();
      expect(loadedToolsets).toEqual([...ALL_TOOLSET_NAMES].sort());
      expect(allFullTypes).toEqual(expect.arrayContaining(defaultRegistry.getAllResourceTypes()));
      expect(optInTypes.length).toBeGreaterThan(0);
      expect(allFullTypes).toEqual(expect.arrayContaining(optInTypes));
      expect(allFullTypes).toEqual(expect.arrayContaining(["pipeline", "pipeline_v1"]));
    });

    it("rejects an invalid opt-in resource added through the Registry", () => {
      const invalidToolset: ToolsetDefinition = {
        name: "invalid-structural-fixture",
        displayName: "Invalid Structural Fixture",
        description: "Test-only opt-in toolset with an invalid resource definition.",
        optIn: true,
        resources: [
          {
            resourceType: "invalid_scope_fixture",
            displayName: "Invalid Scope Fixture",
            description: "Test-only resource used to prove full-registry validation.",
            toolset: "invalid-structural-fixture",
            scope: "invalid" as ResourceDefinition["scope"],
            identifierFields: [],
            operations: {},
          },
        ],
      };
      const invalidRegistry = new Registry(
        {
          ...makeConfig(),
          HARNESS_TOOLSETS: `${fullToolsetSelection},+invalid-structural-fixture`,
        },
        { additionalToolsets: [invalidToolset] },
      );

      const invalidTypes = invalidRegistry.getAllResourceTypes();
      expect(invalidTypes).toEqual(expect.arrayContaining(allFullTypes));
      expect(invalidTypes).toContain("invalid_scope_fixture");
      expect(collectInvalidScopes(invalidRegistry)).toEqual([
        'invalid_scope_fixture: scope="invalid"',
      ]);
    });
  });

  describe("default/opt-in exposure semantics", () => {
    // These checks intentionally compare default visibility with the expanded
    // registry; structural quality is validated above for every full-registry resource.
    it("default registry loads exactly the non-opt-in toolsets", () => {
      const expectedNames = fullRegistry.getAllToolsets()
        .filter((toolset) => !toolset.optIn)
        .map((toolset) => toolset.name)
        .sort();
      const actualNames = defaultRegistry.getAllToolsets().map((toolset) => toolset.name).sort();

      expect(actualNames).toEqual(expectedNames);
    });

    it("default registry excludes every declared opt-in resource type", () => {
      const defaultTypes = new Set(defaultRegistry.getAllResourceTypes());
      const unexpectedlyExposed = optInTypes.filter((type) => defaultTypes.has(type));

      expect(unexpectedlyExposed).toEqual([]);
    });
  });
});
