/**
 * Post-process NG yaml-schema responses (aligned with ml-infra schema_base.py).
 */

export type JsonObject = Record<string, unknown>;

function isRecord(value: unknown): value is JsonObject {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/** Strip scope-pinned const values from orgIdentifier / projectIdentifier. */
export function removeIdentifierConstFromSchema(schema: JsonObject): JsonObject {
  const copy = structuredClone(schema);

  function walk(obj: unknown): void {
    if (!isRecord(obj)) return;

    const properties = obj.properties;
    if (isRecord(properties)) {
      for (const propName of ["orgIdentifier", "projectIdentifier"] as const) {
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

function trimScopeRequired(
  schema: JsonObject,
  orgId?: string,
  projectId?: string,
): JsonObject {
  const result = structuredClone(schema);
  if (!Array.isArray(result.required)) return result;

  const required = [...(result.required as string[])];
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

/** Connector-specific identifier pattern (ml-infra fix_connector_schema). */
function fixConnectorIdentifierPattern(schema: JsonObject): JsonObject {
  const definitions = schema.definitions;
  if (!isRecord(definitions)) return schema;
  const dto = definitions.ConnectorInfoDTO;
  if (!isRecord(dto) || !isRecord(dto.properties)) return schema;

  const result = structuredClone(schema);
  const resultDefs = result.definitions as JsonObject;
  const connectorDto = resultDefs.ConnectorInfoDTO as JsonObject;
  const properties = connectorDto.properties as JsonObject;
  properties.identifier = {
    type: "string",
    pattern: "^[a-zA-Z_][a-zA-Z0-9_$]{0,127}$",
    description: "Identifier can be up to 128 characters long.",
  };
  return result;
}

export function normalizeEntitySchema(
  resourceType: string,
  schema: JsonObject,
  orgId?: string,
  projectId?: string,
): JsonObject {
  let normalized = removeIdentifierConstFromSchema(schema);
  normalized = trimScopeRequired(normalized, orgId, projectId);
  if (resourceType === "connector") {
    normalized = fixConnectorIdentifierPattern(normalized);
  }
  return normalized;
}
