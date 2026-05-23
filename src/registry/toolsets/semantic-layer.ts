import type { ToolsetDefinition, FilterFieldSpec } from "../types.js";
import { stripInternalMeta } from "../../utils/strip-meta.js";

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

/**
 * List extractor — compact-safe projection for type selection.
 * Returns only fields that survive harness_list compaction:
 * identifier, name, description, kind (TYPE_FIELDS), category (TYPE_FIELDS).
 * Full field metadata (fields, join_predicates, enrichment_fields) is only
 * returned by the get operation.
 */
const schemaTypesExtract = (raw: unknown): { items: unknown[]; total: number } => {
  const r = raw as Record<string, unknown>;
  const items: unknown[] = [];
  const categoryMap: Record<string, string> = {
    entity_types: "entity",
    relationship_types: "relationship",
    event_types: "event",
    metric_types: "metric",
    view_types: "view",
    config_types: "config",
    data_model_types: "data_model",
  };

  const MAX_DESC = 120;

  for (const [key, category] of Object.entries(categoryMap)) {
    const arr = r[key];
    if (Array.isArray(arr)) {
      for (const type of arr) {
        const typeObj = type as Record<string, unknown>;
        const id = (typeObj.id ?? typeObj.identifier) as string | undefined;
        if (!id) continue;

        const rawDesc = (typeObj.description as string) ?? "";
        const description = rawDesc.length > MAX_DESC ? rawDesc.slice(0, MAX_DESC) + "..." : rawDesc;

        const item: Record<string, unknown> = {
          identifier: id,
          name: typeObj.name ?? id,
          category,           // "entity" | "relationship" | "event" | "metric" | "view" | "config" | "data_model"
          kind: typeObj.kind, // OBJECT_KIND_* when present
        };
        if (description) item.description = description;

        items.push(item);
      }
    }
  }
  return { items, total: items.length };
};

const schemaTypeExtract = (raw: unknown): unknown => {
  const r = raw as { type?: Record<string, unknown> };
  if (!r.type) return raw;
  const typeObj = r.type;
  const oneofKeys = [
    "entity_type", "relationship_type", "event_type",
    "metric_type", "config_type", "view_type", "data_model_type",
  ];
  for (const key of oneofKeys) {
    if (typeObj[key]) {
      const cleaned = stripInternalMeta(typeObj[key]) as Record<string, unknown>;

      if (key === "relationship_type") {
        const relObj = typeObj[key] as Record<string, unknown>;
        const annotations = relObj.annotations as Record<string, unknown>[] | undefined;
        const hasDcsEnrichment = (annotations ?? []).some(
          (a) => (a.key as string) === "dcs_enrichment",
        );
        if (hasDcsEnrichment) {
          cleaned.dcs_enrichment = true;
          cleaned.join_predicates = relObj.join_predicates;
          cleaned.left_reference = relObj.left_reference;
          cleaned.right_reference = relObj.right_reference;
          if (relObj.fields) cleaned.enrichment_fields = relObj.fields;
        }
      }

      return cleaned;
    }
  }
  return stripInternalMeta(typeObj);
};

/**
 * Extract related types, preserving dcs_enrichment relationship data.
 */
const relatedTypesExtract = (raw: unknown): unknown => {
  const r = raw as Record<string, unknown>;
  const cleaned = stripInternalMeta(r) as Record<string, unknown>;

  const relationships = r.relationship_types ?? r.relationships;
  if (Array.isArray(relationships)) {
    const enrichments: unknown[] = [];
    for (const rel of relationships) {
      const relObj = rel as Record<string, unknown>;
      const annotations = relObj.annotations as Record<string, unknown>[] | undefined;
      const hasDcsEnrichment = (annotations ?? []).some(
        (a) => (a.key as string) === "dcs_enrichment",
      );
      if (hasDcsEnrichment) {
        enrichments.push({
          id: relObj.id,
          description: relObj.description,
          annotations: annotations?.map((a) => a.key),
          left_reference: relObj.left_reference,
          right_reference: relObj.right_reference,
          join_predicates: relObj.join_predicates,
          fields: relObj.fields,
        });
      }
    }
    if (enrichments.length > 0) {
      cleaned.dcs_enrichments = enrichments;
    }
  }

  return cleaned;
};

// ─── Body builders ───────────────────────────────────────────────────────────

function schemaTypesBody(input: Record<string, unknown>) {
  const objectKind = input.object_kind as string | string[] | undefined;
  if (!objectKind) return {};
  const kinds = Array.isArray(objectKind) ? objectKind : [objectKind];
  return { filter: { objectKind: kinds } };
}

function schemaTypeGetBody(input: Record<string, unknown>) {
  return {
    kind: (input.kind as string) ?? "OBJECT_KIND_ENTITY",
    id: input.type_id as string,
  };
}

function relatedTypesBody(input: Record<string, unknown>) {
  return {
    type_reference: {
      object_kind: (input.kind as string) ?? "OBJECT_KIND_ENTITY",
      id: input.type_id as string,
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

const KG_RELATED_FILTERS: FilterFieldSpec[] = [
  {
    name: "kind",
    description: "Object kind of the source type (default: OBJECT_KIND_ENTITY)",
    enum: OBJECT_KINDS,
  },
  {
    name: "include_transitive",
    description: "Include transitive relationships (default: false)",
    type: "boolean",
  },
];

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
            "Get a single schema type by kind and ID. Pass kind via params (default: OBJECT_KIND_ENTITY).",
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
      listFilterFields: KG_RELATED_FILTERS,
      operations: {
        get: {
          method: "POST",
          path: `${SCHEMA_SVC}/getRelatedTypes`,
          headers: {},
          bodyBuilder: relatedTypesBody,
          responseExtractor: relatedTypesExtract,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          description:
            "Get types related to a source type. Pass type_id (resource_id) and optionally " +
            "kind (default: OBJECT_KIND_ENTITY) and include_transitive (default: false).",
        },
      },
    },
  ],
};
