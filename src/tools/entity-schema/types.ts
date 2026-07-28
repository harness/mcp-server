export type HarnessYamlScope = "account" | "org" | "project";

/** Where an entity schema was loaded from at runtime. */
export type EntitySchemaSource = "bundled" | "ng-yaml-schema";

export interface LiveEntitySchemaDefinition {
  entityType: string;
  description: string;
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
