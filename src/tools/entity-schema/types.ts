export type HarnessYamlScope = "account" | "org" | "project";

/** Where an entity schema was loaded from at runtime. */
export type EntitySchemaSource = "bundled" | "ng-yaml-schema" | "rmg-yaml-schema";

/** Backend that serves live YAML JSON Schema for a resource type. */
export type LiveEntitySchemaApi = "ng" | "rmg";

export interface LiveEntitySchemaDefinition {
  entityType: string;
  description: string;
  /** Default `ng` — Harness NG `/ng/api/yaml-schema`. `rmg` uses Release Management `/api/yamlSchema`. */
  api?: LiveEntitySchemaApi;
  /** Top-level YAML wrapper key in RMG schemas (e.g. `process`, `activity`). */
  rootProperty?: string;
}

export interface LiveSchemaFetchParams {
  scope?: HarnessYamlScope;
  orgId?: string;
  projectId?: string;
  /** Override NG yaml-schema identifier — use for entity-specific service/infrastructure schemas. */
  identifier?: string;
}

export interface EntitySchemaFetchResult {
  schema: Record<string, unknown>;
  source: EntitySchemaSource;
}

export interface EntitySchemaCacheEntry {
  schema: Record<string, unknown>;
  source: EntitySchemaSource;
}
