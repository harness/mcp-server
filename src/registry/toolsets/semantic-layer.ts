import type { ToolsetDefinition, FilterFieldSpec, ParamsSchema } from "../types.js";
import { relatedTypesExtract, schemaTypeExtract, schemaTypesExtract } from "../extractors.js";

const SCHEMA_SVC =
  "/schema-service/grpc/io.harness.platform.schema.service.api.v1.SchemaServiceGrpc";

const OBJECT_KINDS = [
  "OBJECT_KIND_ENTITY",
  "OBJECT_KIND_RELATIONSHIP",
  "OBJECT_KIND_EVENT",
  "OBJECT_KIND_METRIC",
  "OBJECT_KIND_CONFIG",
  "OBJECT_KIND_VIEW",
  "OBJECT_KIND_DATA_MODEL",
];

// ─── Body builders ───────────────────────────────────────────────────────────

function schemaTypesBody(input: Record<string, unknown>) {
  const objectKind = input.object_kind as string | string[] | undefined;
  if (!objectKind) return {};
  const kinds = Array.isArray(objectKind) ? objectKind : [objectKind];
  return { filter: { objectKind: kinds } };
}

function requireTypeId(input: Record<string, unknown>): string {
  const id = input.type_id;
  if (id === undefined || id === "") {
    throw new Error(
      "Missing required identifier for kg_type/kg_related_type. Pass the type id as resource_id " +
        "(e.g. harness_get(resource_type='kg_type', resource_id='<id>', params={kind: '<kind>'})).",
    );
  }
  return String(id);
}

function schemaTypeGetBody(input: Record<string, unknown>) {
  return {
    kind: input.kind as string,
    id: requireTypeId(input),
  };
}

function relatedTypesBody(input: Record<string, unknown>) {
  return {
    type_reference: {
      object_kind: input.kind as string,
      id: requireTypeId(input),
    },
    include_transitive: input.include_transitive === true,
  };
}

// ─── Filter fields ───────────────────────────────────────────────────────────

const KG_TYPE_FILTERS: FilterFieldSpec[] = [
  {
    name: "object_kind",
    description: "Filter by type kind",
    enum: OBJECT_KINDS,
  },
];

// ─── Params schemas (surfaced via harness_describe) ──────────────────────────

const KG_TYPE_GET_PARAMS: ParamsSchema = {
  fields: [
    {
      name: "kind",
      required: true,
      description:
        "Object kind of the type. One of OBJECT_KIND_*. The same identifier can exist under multiple " +
        "kinds with different fields — use the exact kind returned by kg_queryable_type_summary (for " +
        "queryable types) or kg_type list, not a guess.",
    },
  ],
};

const KG_RELATED_GET_PARAMS: ParamsSchema = {
  fields: [
    {
      name: "kind",
      required: true,
      description:
        "Object kind of the source type. One of OBJECT_KIND_*. The same identifier can exist under " +
        "multiple kinds with different fields — use the exact kind returned by kg_queryable_type_summary " +
        "(for queryable types) or kg_type list, not a guess.",
    },
    {
      name: "include_transitive",
      required: false,
      description: "Include transitive relationships (default: false).",
    },
  ],
};

// ─── Toolset definition ─────────────────────────────────────────────────────

export const semanticLayerToolset: ToolsetDefinition = {
  name: "semantic-layer",
  displayName: "Semantic Layer",
  description:
    "Harness Knowledge Graph schema exploration — all schema types (including non-queryable), " +
    "type details, and relationship discovery. Use for understanding the data model structure. " +
    "For building HQL queries, use the knowledge-graph toolset instead.",
  resources: [
    {
      resourceType: "kg_type",
      displayName: "Schema Type",
      description:
        "A type in the Harness Knowledge Graph schema (entity, event, metric, view, relationship, " +
        "config, or data model). List returns a compact summary (identifier, name, category, kind, description) " +
        "for all types including non-queryable ones. Use get for full field metadata. " +
        "For HQL query building, use kg_queryable_type_summary instead.",
      toolset: "semantic-layer",
      scope: "account",
      identifierFields: ["type_id"],
      listFilterFields: KG_TYPE_FILTERS,
      operations: {
        list: {
          method: "POST",
          path: `${SCHEMA_SVC}/getTypes`,
          headers: {},
          bodyBuilder: schemaTypesBody,
          responseExtractor: schemaTypesExtract,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          description: "List all schema types, optionally filtered by kind. Returns id, name, category, kind, description. Use get for full field metadata.",
        },
        get: {
          method: "POST",
          path: `${SCHEMA_SVC}/getType`,
          headers: {},
          bodyBuilder: schemaTypeGetBody,
          responseExtractor: schemaTypeExtract,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          description:
            "Get a single schema type by kind and ID. Pass the type id as resource_id and the required kind via params.",
          paramsSchema: KG_TYPE_GET_PARAMS,
        },
      },
    },

    {
      resourceType: "kg_related_type",
      displayName: "Related Types",
      description:
        "Related types for a given source type in the Knowledge Graph. Shows which types are " +
        "connected via relationships. Use for understanding the data model structure. " +
        "Pass the type ID as resource_id and kind via params.",
      toolset: "semantic-layer",
      scope: "account",
      identifierFields: ["type_id"],
      // No listFilterFields: kg_related_type only supports `get`. `kind` and
      // `include_transitive` are documented via the get operation's paramsSchema,
      // not as list filters (which harness_list would otherwise advertise globally).
      operations: {
        get: {
          method: "POST",
          path: `${SCHEMA_SVC}/getRelatedTypes`,
          headers: {},
          bodyBuilder: relatedTypesBody,
          responseExtractor: relatedTypesExtract,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          description:
            "Get types related to a source type. Pass the type id as resource_id, the required kind, " +
            "and optionally include_transitive (default: false) via params.",
          paramsSchema: KG_RELATED_GET_PARAMS,
        },
      },
    },
  ],
};
