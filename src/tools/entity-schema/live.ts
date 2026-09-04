import type { HarnessClient } from "../../client/harness-client.js";
import { createLogger } from "../../utils/logger.js";
import {
  normalizeEntitySchema,
  type JsonObject,
} from "./normalize.js";
import { buildLiveSchemaCacheKey } from "./cache-keys.js";
import {
  bundledSnapshotMatchesScope,
  bundledSnapshotsMatchAccount,
  getBundledEntitySchema,
  preloadBundledEntitySchemas,
} from "./bundled.js";
import type {
  EntitySchemaCacheEntry,
  EntitySchemaFetchResult,
  EntitySchemaSource,
  HarnessYamlScope,
  LiveEntitySchemaDefinition,
  LiveSchemaFetchParams,
} from "./types.js";

export type { HarnessYamlScope, LiveSchemaFetchParams } from "./types.js";
export { buildLiveSchemaCacheKey } from "./cache-keys.js";

const log = createLogger("entity-schema:live");

/** Tool resource_type → NG entityType for /yaml-schema. */
export const LIVE_ENTITY_SCHEMAS: Record<string, LiveEntitySchemaDefinition> = {
  connector: {
    entityType: "Connectors",
    description: "Connector entity schema from NG yaml-schema API",
  },
  environment: {
    entityType: "Environment",
    description: "Environment entity schema from NG yaml-schema API",
  },
  service: {
    entityType: "Service",
    description: "Service entity schema from NG yaml-schema API",
  },
  secret: {
    entityType: "Secrets",
    description: "Secret entity schema from NG yaml-schema API",
  },
  infrastructure: {
    entityType: "Infrastructure",
    description: "Infrastructure entity schema from NG yaml-schema API",
  },
  release_process: {
    entityType: "PROCESS",
    api: "rmg",
    rootProperty: "process",
    description: "Release orchestration process YAML schema from RMG /api/yamlSchema",
  },
  release_activity: {
    entityType: "ACTIVITY",
    api: "rmg",
    rootProperty: "activity",
    description: "Release orchestration activity YAML schema from RMG /api/yamlSchema",
  },
};

export const LIVE_ENTITY_RESOURCE_TYPES = Object.keys(LIVE_ENTITY_SCHEMAS);

/**
 * Placeholder identifier for NG /yaml-schema on live entity types at any scope.
 * Some NG builds reject scoped requests without identifier (scopedIdentifierConfig is null).
 * A dummy value returns the generic type-level schema — the entity does not need to exist.
 */
export const YAML_SCHEMA_PLACEHOLDER_IDENTIFIER = "test";

/** Resolve NG yaml-schema identifier: explicit param wins, else placeholder for live entity types. */
export function resolveYamlSchemaIdentifier(
  resourceType: string,
  params: LiveSchemaFetchParams,
): string | undefined {
  if (params.identifier) return params.identifier;
  if (resourceType in LIVE_ENTITY_SCHEMAS) {
    return YAML_SCHEMA_PLACEHOLDER_IDENTIFIER;
  }
  return undefined;
}

const RESPONSE_SCHEMA_KEYS = [
  "schema",
  "yamlSchema",
  "jsonSchema",
  "yaml_schema",
  "json_schema",
] as const;

function isRecord(value: unknown): value is JsonObject {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function looksLikeJsonSchema(value: unknown): value is JsonObject {
  return (
    isRecord(value) &&
    ("$schema" in value ||
      "definitions" in value ||
      "properties" in value ||
      "type" in value ||
      "oneOf" in value ||
      "anyOf" in value ||
      "allOf" in value)
  );
}

function parseSchemaCandidate(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
}

function collectSchemaCandidates(response: unknown): unknown[] {
  const candidates: unknown[] = [response];
  const parsedResponse = parseSchemaCandidate(response);
  if (parsedResponse !== response) candidates.push(parsedResponse);

  for (const candidate of [...candidates]) {
    const parsed = parseSchemaCandidate(candidate);
    if (!isRecord(parsed)) continue;

    candidates.push(parsed.data);
    for (const key of RESPONSE_SCHEMA_KEYS) {
      candidates.push(parsed[key]);
    }

    const data = parseSchemaCandidate(parsed.data);
    if (isRecord(data)) {
      for (const key of RESPONSE_SCHEMA_KEYS) {
        candidates.push(data[key]);
      }
    }
  }

  return candidates;
}

export function extractLiveSchema(response: unknown): JsonObject {
  for (const candidate of collectSchemaCandidates(response)) {
    const parsed = parseSchemaCandidate(candidate);
    if (looksLikeJsonSchema(parsed)) return parsed;
  }

  throw new Error(
    "Harness yaml-schema response did not contain a JSON Schema object. " +
      "Expected a schema object or a response envelope containing data.schema.",
  );
}

function resolveScope(scope?: HarnessYamlScope): HarnessYamlScope {
  return scope ?? "account";
}

/** Build NG /yaml-schema query params. resourceType drives placeholder identifier resolution. */
function buildYamlSchemaParams(
  resourceType: string,
  definition: LiveEntitySchemaDefinition,
  params: LiveSchemaFetchParams,
): Record<string, string> {
  const scope = resolveScope(params.scope);
  const query: Record<string, string> = {
    entityType: definition.entityType,
    scope,
  };

  if (scope === "org" || scope === "project") {
    if (!params.orgId) {
      throw new Error(`org_id is required when scope is '${scope}'`);
    }
    query.orgIdentifier = params.orgId;
  }

  if (scope === "project") {
    if (!params.projectId) {
      throw new Error("project_id is required when scope is 'project'");
    }
    query.projectIdentifier = params.projectId;
  }

  const resolvedIdentifier = resolveYamlSchemaIdentifier(resourceType, params);
  if (resolvedIdentifier) {
    query.identifier = resolvedIdentifier;
  }

  return query;
}

/** Build RMG /api/yamlSchema query params (org/project only — account via Harness-Account header). */
function buildRmgYamlSchemaParams(params: LiveSchemaFetchParams): Record<string, string> {
  const scope = resolveScope(params.scope);
  const query: Record<string, string> = {};

  if (scope === "org" || scope === "project") {
    if (!params.orgId) {
      throw new Error(`org_id is required when scope is '${scope}'`);
    }
    query.orgIdentifier = params.orgId;
  }

  if (scope === "project") {
    if (!params.projectId) {
      throw new Error("project_id is required when scope is 'project'");
    }
    query.projectIdentifier = params.projectId;
  }

  return query;
}

function validateLiveSchemaParams(
  resourceType: string,
  definition: LiveEntitySchemaDefinition,
  params: LiveSchemaFetchParams,
): void {
  if ((definition.api ?? "ng") === "rmg") {
    buildRmgYamlSchemaParams(params);
    return;
  }
  buildYamlSchemaParams(resourceType, definition, params);
}

function getNestedSchemaRoot(value: unknown, preferredKey: string): JsonObject | undefined {
  if (!isRecord(value)) return undefined;
  if (looksLikeJsonSchema(value) && "properties" in value) return value;

  const preferred = value[preferredKey];
  if (looksLikeJsonSchema(preferred)) return preferred;

  for (const nested of Object.values(value)) {
    if (looksLikeJsonSchema(nested) && isRecord(nested) && ("properties" in nested || "type" in nested)) {
      return nested;
    }
  }

  return undefined;
}

export function getResourceDefinitions(
  schema: JsonObject,
  resourceType: string,
): JsonObject | undefined {
  const definitions = schema.definitions;
  if (!isRecord(definitions)) return undefined;

  const title = typeof schema.title === "string" ? schema.title : undefined;
  const keys = [
    resourceType,
    title,
    resourceType.toUpperCase(),
    resourceType[0]?.toUpperCase() + resourceType.slice(1),
    LIVE_ENTITY_SCHEMAS[resourceType]?.entityType,
  ].filter((key): key is string => !!key);

  for (const key of keys) {
    const direct = definitions[key];
    if (isRecord(direct)) return direct;
  }

  return undefined;
}

export function getRootDefinition(
  schema: JsonObject,
  resourceType: string,
  rootProperty?: string,
): JsonObject | undefined {
  if (rootProperty) {
    const wrapper = (schema.properties as JsonObject | undefined)?.[rootProperty];
    if (looksLikeJsonSchema(wrapper)) return wrapper as JsonObject;
  }

  const resourceDefs = getResourceDefinitions(schema, resourceType);
  const exactHarnessRoot = resourceDefs?.[resourceType];
  if (looksLikeJsonSchema(exactHarnessRoot)) return exactHarnessRoot;

  if (looksLikeJsonSchema(schema) && schema.properties) return schema;

  const rootFromResourceDefs = getNestedSchemaRoot(resourceDefs, resourceType);
  if (rootFromResourceDefs) return rootFromResourceDefs;

  if (!isRecord(schema.definitions)) return undefined;

  for (const definition of Object.values(schema.definitions)) {
    const root = getNestedSchemaRoot(definition, resourceType);
    if (root) return root;
  }

  return undefined;
}

export function getDefinitionSections(
  schema: JsonObject,
  resourceType: string,
  rootProperty?: string,
): string[] {
  const rootDef = getRootDefinition(schema, resourceType, rootProperty);
  if (rootProperty && rootDef?.properties) {
    return Object.keys(rootDef.properties as Record<string, unknown>);
  }

  const resourceDefs = getResourceDefinitions(schema, resourceType);
  if (resourceDefs) return Object.keys(resourceDefs);

  if (!isRecord(schema.definitions)) return [];
  return Object.keys(schema.definitions);
}

export function getEntitySchemaSummary(
  schema: JsonObject,
  resourceType: string,
  source: EntitySchemaSource,
  rootProperty?: string,
): Record<string, unknown> {
  const sections = getDefinitionSections(schema, resourceType, rootProperty);
  const rootDef = getRootDefinition(schema, resourceType, rootProperty);
  const properties = rootDef?.properties as Record<string, unknown> | undefined;
  const required = rootDef?.required as string[] | undefined;

  const fields: Array<{ name: string; type: string; required: boolean; ref?: string }> = [];
  if (properties) {
    for (const [name, spec] of Object.entries(properties)) {
      const s = spec as JsonObject;
      fields.push({
        name,
        type: (s.type as string) ?? (s.$ref ? "object ($ref)" : "unknown"),
        required: required?.includes(name) ?? false,
        ...(typeof s.$ref === "string" ? { ref: s.$ref.split("/").pop() } : {}),
      });
    }
  }

  const hint =
    source === "bundled"
      ? "Schema from vendored snapshot (pnpm sync-entity-schemas). Use scope, org_id, and project_id for org/project entities."
      : source === "rmg-yaml-schema"
        ? "Schema from live RMG /api/yamlSchema. Pass scope, org_id, and project_id when scoping to org or project."
        : "Schema from live NG /ng/api/yaml-schema. Pass scope, org_id, and project_id for org/project scoped entities.";

  return {
    resource_type: resourceType,
    source,
    fields,
    available_sections: sections,
    ...(rootProperty ? { yaml_root: rootProperty } : {}),
    hint: `Use path to drill into a section. ${hint}`,
  };
}

export function navigateEntitySchemaPath(
  schema: JsonObject,
  resourceType: string,
  path: string,
  rootProperty?: string,
): unknown {
  if (rootProperty) {
    const rootDef = getRootDefinition(schema, resourceType, rootProperty);
    if (!rootDef) return undefined;

    if (path === rootProperty) return rootDef;

    const normalizedPath = path.startsWith(`${rootProperty}.`)
      ? path.slice(rootProperty.length + 1)
      : path;
    const parts = normalizedPath.split(".").filter(Boolean);
    let current: unknown = rootDef;
    for (const part of parts) {
      if (!current || typeof current !== "object" || Array.isArray(current)) return undefined;
      const obj = current as JsonObject;
      const props = obj.properties as JsonObject | undefined;
      if (props && part in props) {
        current = props[part];
        continue;
      }
      if (part in obj) {
        current = obj[part];
        continue;
      }
      return undefined;
    }
    return current;
  }

  const resourceDefs = getResourceDefinitions(schema, resourceType);
  if (resourceDefs) {
    if (resourceDefs[path]) return resourceDefs[path];

    const parts = path.split(".");
    let current: unknown = resourceDefs;
    for (const part of parts) {
      if (current && typeof current === "object" && !Array.isArray(current)) {
        current = (current as JsonObject)[part];
      } else {
        current = undefined;
        break;
      }
    }
    if (current !== undefined) return current;
  }

  const definitions = schema.definitions;
  if (!isRecord(definitions)) return undefined;

  const parts = path.split(".");
  let current: unknown = definitions;
  for (const part of parts) {
    if (current && typeof current === "object" && !Array.isArray(current)) {
      current = (current as JsonObject)[part];
    } else {
      return undefined;
    }
  }
  return current;
}

export interface LiveSchemaFetcher {
  listResourceTypes(): string[];
  isLiveEntity(resourceType: string): boolean;
  fetch(resourceType: string, params?: LiveSchemaFetchParams): Promise<EntitySchemaFetchResult | undefined>;
}

function logBundledServe(
  resourceType: string,
  scope: HarnessYamlScope,
  accountId: string,
  cacheHit: boolean,
): void {
  log.debug("Serving entity YAML schema from bundled snapshot", {
    resource_type: resourceType,
    scope,
    account_id: accountId,
    cache_hit: cacheHit,
  });
}

export function createLiveSchemaFetcher(client: HarnessClient): LiveSchemaFetcher {
  const cache = new Map<string, EntitySchemaCacheEntry>();
  preloadBundledEntitySchemas(cache, client.account);

  return {
    listResourceTypes() {
      return LIVE_ENTITY_RESOURCE_TYPES;
    },

    isLiveEntity(resourceType: string) {
      return resourceType in LIVE_ENTITY_SCHEMAS;
    },

    async fetch(
      resourceType: string,
      params: LiveSchemaFetchParams = {},
    ): Promise<EntitySchemaFetchResult | undefined> {
      const definition = LIVE_ENTITY_SCHEMAS[resourceType];
      if (!definition) return undefined;

      const accountId = client.account;
      const scope = resolveScope(params.scope);
      const api = definition.api ?? "ng";
      validateLiveSchemaParams(resourceType, definition, params);

      const cacheKey = buildLiveSchemaCacheKey(resourceType, accountId, scope, {
        orgId: params.orgId,
        projectId: params.projectId,
        ...(params.identifier ? { identifier: params.identifier } : {}),
      });

      const cached = cache.get(cacheKey);
      if (cached) {
        if (cached.source === "bundled") {
          logBundledServe(resourceType, scope, accountId, true);
        }
        return cached;
      }

      if (api === "rmg") {
        const scopeParams = buildRmgYamlSchemaParams(params);
        log.debug("Fetching RMG YAML schema", {
          resource_type: resourceType,
          entity_type: definition.entityType,
          scope,
          account_id: accountId,
        });

        const response = await client.request<unknown>({
          method: "GET",
          path: "/gateway/rmg/api/yamlSchema",
          headerBasedScoping: true,
          params: {
            entityType: definition.entityType,
            ...scopeParams,
          },
        });

        const raw = extractLiveSchema(response);
        const entry: EntitySchemaCacheEntry = { schema: raw, source: "rmg-yaml-schema" };
        cache.set(cacheKey, entry);
        return entry;
      }

      // Explicit identifier requests entity-specific schema — bundled snapshots are type-level only.
      const bundled = params.identifier ? undefined : getBundledEntitySchema(resourceType, scope);
      if (
        bundled &&
        bundledSnapshotsMatchAccount(accountId) &&
        bundledSnapshotMatchesScope(resourceType, scope, params.orgId, params.projectId)
      ) {
        logBundledServe(resourceType, scope, accountId, false);
        const entry: EntitySchemaCacheEntry = { schema: bundled, source: "bundled" };
        cache.set(cacheKey, entry);
        return entry;
      }

      const queryParams = buildYamlSchemaParams(resourceType, definition, params);

      try {
        log.debug("Fetching live entity YAML schema", {
          resource_type: resourceType,
          entity_type: definition.entityType,
          scope,
          account_id: accountId,
          ...(queryParams.identifier
            ? {
                identifier: queryParams.identifier,
                placeholder: !params.identifier && queryParams.identifier === YAML_SCHEMA_PLACEHOLDER_IDENTIFIER,
              }
            : {}),
        });

        const response = await client.request<unknown>({
          method: "GET",
          path: "/ng/api/yaml-schema",
          params: queryParams,
        });

        const raw = extractLiveSchema(response);
        const normalized = normalizeEntitySchema(
          resourceType,
          raw,
          params.orgId,
          params.projectId,
        );

        const entry: EntitySchemaCacheEntry = { schema: normalized, source: "ng-yaml-schema" };
        cache.set(cacheKey, entry);
        return entry;
      } catch (err) {
        throw err;
      }
    },
  };
}
