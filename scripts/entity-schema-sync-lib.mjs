/**
 * Shared logic for scripts/sync-entity-schemas.js.
 * Keep behavior aligned with src/tools/entity-schema/{normalize,live}.ts.
 */

export const LIVE_ENTITY_SCHEMAS = {
  connector: { entityType: "Connectors" },
  environment: { entityType: "Environment" },
  service: { entityType: "Service" },
  secret: { entityType: "Secrets" },
  infrastructure: { entityType: "Infrastructure" },
};

export const ENTITY_SCOPES = ["account", "org", "project"];

const RESPONSE_SCHEMA_KEYS = [
  "schema",
  "yamlSchema",
  "jsonSchema",
  "yaml_schema",
  "json_schema",
];

function isRecord(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function looksLikeJsonSchema(value) {
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

function parseSchemaCandidate(value) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function collectSchemaCandidates(response) {
  const candidates = [response];
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

export function extractLiveSchema(response) {
  for (const candidate of collectSchemaCandidates(response)) {
    const parsed = parseSchemaCandidate(candidate);
    if (looksLikeJsonSchema(parsed)) return parsed;
  }

  throw new Error("yaml-schema response did not contain a JSON Schema object");
}

export function removeIdentifierConstFromSchema(schema) {
  const copy = structuredClone(schema);

  function walk(obj) {
    if (!isRecord(obj)) return;

    const properties = obj.properties;
    if (isRecord(properties)) {
      for (const propName of ["orgIdentifier", "projectIdentifier"]) {
        const propDef = properties[propName];
        if (isRecord(propDef) && "const" in propDef) {
          delete propDef.const;
        }
      }
    }

    for (const value of Object.values(obj)) {
      if (isRecord(value)) walk(value);
      else if (Array.isArray(value)) {
        for (const item of value) {
          if (isRecord(item)) walk(item);
        }
      }
    }
  }

  walk(copy);
  return copy;
}

function trimScopeRequired(schema, orgId, projectId) {
  const result = structuredClone(schema);
  if (!Array.isArray(result.required)) return result;

  const required = [...result.required];
  if (!projectId) {
    const idx = required.indexOf("projectIdentifier");
    if (idx >= 0) required.splice(idx, 1);
  }
  if (!orgId) {
    const idx = required.indexOf("orgIdentifier");
    if (idx >= 0) required.splice(idx, 1);
  }
  result.required = required;
  return result;
}

function fixConnectorIdentifierPattern(schema) {
  const definitions = schema.definitions;
  if (!isRecord(definitions)) return schema;
  const dto = definitions.ConnectorInfoDTO;
  if (!isRecord(dto) || !isRecord(dto.properties)) return schema;

  const result = structuredClone(schema);
  const connectorDto = result.definitions.ConnectorInfoDTO;
  connectorDto.properties.identifier = {
    type: "string",
    pattern: "^[a-zA-Z_][a-zA-Z0-9_$]{0,127}$",
    description: "Identifier can be up to 128 characters long.",
  };
  return result;
}

export function normalizeEntitySchema(resourceType, schema, orgId, projectId) {
  let normalized = removeIdentifierConstFromSchema(schema);
  normalized = trimScopeRequired(normalized, orgId, projectId);
  if (resourceType === "connector") {
    normalized = fixConnectorIdentifierPattern(normalized);
  }
  return normalized;
}

export function buildYamlSchemaQuery(definition, scope, orgId, projectId) {
  const query = new URLSearchParams({
    entityType: definition.entityType,
    scope,
  });

  if (scope === "org" || scope === "project") {
    if (!orgId) throw new Error(`HARNESS_ORG is required to sync scope '${scope}'`);
    query.set("orgIdentifier", orgId);
  }

  if (scope === "project") {
    if (!projectId) throw new Error(`HARNESS_PROJECT is required to sync scope '${scope}'`);
    query.set("projectIdentifier", projectId);
  }

  return query;
}

export async function fetchEntitySchemaFromHarness({
  baseUrl,
  apiKey,
  accountId,
  resourceType,
  scope,
  orgId,
  projectId,
}) {
  const definition = LIVE_ENTITY_SCHEMAS[resourceType];
  if (!definition) throw new Error(`Unknown resource type: ${resourceType}`);

  const query = buildYamlSchemaQuery(definition, scope, orgId, projectId);
  query.set("accountIdentifier", accountId);

  const url = `${baseUrl.replace(/\/$/, "")}/ng/api/yaml-schema?${query.toString()}`;
  const res = await fetch(url, {
    headers: {
      "x-api-key": apiKey,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GET ${url} failed: HTTP ${res.status} ${body.slice(0, 300)}`);
  }

  const json = await res.json();
  const raw = extractLiveSchema(json);
  return normalizeEntitySchema(resourceType, raw, orgId, projectId);
}

export function bundledSchemaKey(resourceType, scope) {
  return `${resourceType}.${scope}`;
}
