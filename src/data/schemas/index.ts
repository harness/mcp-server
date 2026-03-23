// Auto-generated index of schemas
import pipeline from "./pipeline.js";
import template from "./template.js";
import trigger from "./trigger.js";

export const SCHEMAS = {
  pipeline,
  template,
  trigger,
} as const;

export const VALID_SCHEMAS = Object.keys(SCHEMAS) as (keyof typeof SCHEMAS)[];
export type SchemaName = keyof typeof SCHEMAS;
