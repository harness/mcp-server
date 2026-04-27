// Auto-generated — do not edit manually. Run `pnpm sync-schemas` to regenerate.
// @ts-nocheck
import pipeline from "./v0/pipeline.js";
import template from "./v0/template.js";
import trigger from "./v0/trigger.js";
import pipelineV1 from "./v1/pipeline.js";
import templateV1 from "./v1/template.js";
import triggerV1 from "./v1/trigger.js";
import inputSetV1 from "./v1/inputSet.js";
import overlayInputSetV1 from "./v1/overlayInputSet.js";
import serviceV1 from "./v1/service.js";
import infraV1 from "./v1/infra.js";
import agentPipeline from "./local/agent-pipeline.js";

type V0SchemaKey = "pipeline" | "template" | "trigger";
type V1SchemaKey = "pipeline_v1" | "template_v1" | "trigger_v1" | "inputSet_v1" | "overlayInputSet_v1" | "service_v1" | "infra_v1";
type LocalSchemaKey = "agent-pipeline";
type AllSchemaKeys = V0SchemaKey | V1SchemaKey | LocalSchemaKey;

export const SCHEMAS: Record<AllSchemaKeys, Record<string, any>> = {
  "pipeline": pipeline,
  "template": template,
  "trigger": trigger,
  "pipeline_v1": pipelineV1,
  "template_v1": templateV1,
  "trigger_v1": triggerV1,
  "inputSet_v1": inputSetV1,
  "overlayInputSet_v1": overlayInputSetV1,
  "service_v1": serviceV1,
  "infra_v1": infraV1,
  "agent-pipeline": agentPipeline,
};

export const VALID_SCHEMAS = Object.keys(SCHEMAS) as AllSchemaKeys[];
export type SchemaName = AllSchemaKeys;

export const V0_SCHEMA_KEYS: V0SchemaKey[] = ["pipeline", "template", "trigger"];
export const V1_SCHEMA_KEYS: V1SchemaKey[] = ["pipeline_v1", "template_v1", "trigger_v1", "inputSet_v1", "overlayInputSet_v1", "service_v1", "infra_v1"];
