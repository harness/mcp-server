// Auto-generated — do not edit manually. Run `pnpm sync-schemas` to regenerate.
// @ts-nocheck
import pipeline from "./v0/pipeline.js";
import template from "./v0/template.js";
import trigger from "./v0/trigger.js";
import pipelineV1 from "./v1/pipeline.js";
import templateV1 from "./v1/template.js";
import inputSetV1 from "./v1/inputSet.js";
import overlayInputSetV1 from "./v1/overlayInputSet.js";
import agentPipeline from "./local/agent-pipeline.js";
import type { AllSchemaKeys } from "./catalog.js";

export type { V0SchemaKey, V1SchemaKey, LocalSchemaKey, AllSchemaKeys, SchemaName } from "./catalog.js";
export { VALID_SCHEMAS, V0_SCHEMA_KEYS, V1_SCHEMA_KEYS } from "./catalog.js";

export const SCHEMAS: Record<AllSchemaKeys, Record<string, any>> = {
  "pipeline": pipeline,
  "template": template,
  "trigger": trigger,
  "pipeline_v1": pipelineV1,
  "template_v1": templateV1,
  "inputSet_v1": inputSetV1,
  "overlayInputSet_v1": overlayInputSetV1,
  "agent-pipeline": agentPipeline,
};
