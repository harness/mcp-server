// Auto-generated index of schemas
import pipeline from "./pipeline.js";
import template from "./template.js";
import trigger from "./trigger.js";
import agentPipeline from "./agent-pipeline.js";

export const SCHEMAS = {
  pipeline,
  template,
  trigger,
  "agent-pipeline": agentPipeline,
} as const;

export const VALID_SCHEMAS = Object.keys(SCHEMAS) as (keyof typeof SCHEMAS)[];
export type SchemaName = keyof typeof SCHEMAS;
