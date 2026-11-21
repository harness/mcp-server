// Auto-generated — do not edit manually. Run `pnpm sync-schemas` to regenerate.

export type V0SchemaKey = "pipeline" | "template" | "trigger";
export type V1SchemaKey = "pipeline_v1" | "template_v1" | "inputSet_v1" | "overlayInputSet_v1";
export type LocalSchemaKey = "agent-pipeline";
export type AllSchemaKeys = V0SchemaKey | V1SchemaKey | LocalSchemaKey;
export type SchemaName = AllSchemaKeys;

export const V0_SCHEMA_KEYS: V0SchemaKey[] = ["pipeline", "template", "trigger"];
export const V1_SCHEMA_KEYS: V1SchemaKey[] = ["pipeline_v1", "template_v1", "inputSet_v1", "overlayInputSet_v1"];

/** Lightweight schema catalog; importing it does not load any schema body. */
export const VALID_SCHEMAS: AllSchemaKeys[] = ["pipeline", "template", "trigger", "pipeline_v1", "template_v1", "inputSet_v1", "overlayInputSet_v1", "agent-pipeline"];
