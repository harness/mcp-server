import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import {
  SCHEMAS,
  VALID_SCHEMAS,
  V0_SCHEMA_KEYS,
  V1_SCHEMA_KEYS,
} from "../../src/data/schemas/index.js";

const ROOT = join(import.meta.dirname, "../..");

/** Parse `new Set(["a", "b"])` or `["a", "b"]` array literals from build scripts. */
function extractStringSet(source: string, constName: string): Set<string> {
  const setMatch = source.match(
    new RegExp(`const ${constName} = new Set\\(\\[([^\\]]*)\\]\\)`),
  );
  const arrayMatch = source.match(
    new RegExp(`const ${constName} = \\[([^\\]]*)\\]`),
  );
  const raw = setMatch?.[1] ?? arrayMatch?.[1];
  if (raw == null) {
    throw new Error(`Could not find ${constName} in script source`);
  }
  const names = [...raw.matchAll(/"([^"]+)"/g)].map((m) => m[1]!);
  return new Set(names);
}

const REMOVED_V1_SCHEMAS = ["trigger", "service", "infra"] as const;
const REMOVED_V1_KEYS = REMOVED_V1_SCHEMAS.map((name) => `${name}_v1`);

describe("schema bundle contract", () => {
  it("keeps sync-schemas.js and check-schema-coverage.js v1 lists aligned", () => {
    const syncScript = readFileSync(join(ROOT, "scripts/sync-schemas.js"), "utf8");
    const coverageScript = readFileSync(join(ROOT, "scripts/check-schema-coverage.js"), "utf8");

    const syncedInSync = extractStringSet(syncScript, "V1_SCHEMAS");
    const syncedInCoverage = extractStringSet(coverageScript, "SYNCED_V1");

    expect(syncedInSync).toEqual(syncedInCoverage);
  });

  it("does not list v1 schemas removed from harness-schema upstream", () => {
    const coverageScript = readFileSync(join(ROOT, "scripts/check-schema-coverage.js"), "utf8");
    const syncedV1 = extractStringSet(coverageScript, "SYNCED_V1");

    for (const name of REMOVED_V1_SCHEMAS) {
      expect(syncedV1.has(name)).toBe(false);
    }
  });

  it("bundles only the expected v1 schema modules on disk", () => {
    const v1Dir = join(ROOT, "src/data/schemas/v1");
    const files = readdirSync(v1Dir)
      .filter((name) => name.endsWith(".ts"))
      .map((name) => name.replace(/\.ts$/, ""))
      .sort();

    expect(files).toEqual(["inputSet", "overlayInputSet", "pipeline", "template"]);
  });

  it("exports schema keys that match bundled modules", () => {
    expect(V0_SCHEMA_KEYS.sort()).toEqual(["pipeline", "template", "trigger"]);
    expect(V1_SCHEMA_KEYS.sort()).toEqual([
      "inputSet_v1",
      "overlayInputSet_v1",
      "pipeline_v1",
      "template_v1",
    ]);
    expect(VALID_SCHEMAS.sort()).toEqual(
      [...V0_SCHEMA_KEYS, ...V1_SCHEMA_KEYS, "agent-pipeline"].sort(),
    );
    expect(Object.keys(SCHEMAS).sort()).toEqual(VALID_SCHEMAS.sort());
  });

  it("does not expose removed v1 schema keys in the bundled index", () => {
    for (const key of REMOVED_V1_KEYS) {
      expect(VALID_SCHEMAS).not.toContain(key);
      expect(SCHEMAS).not.toHaveProperty(key);
    }
  });

  it("rewrites v1 pipeline definitions to the public schema key namespace", () => {
    const definitions = SCHEMAS.pipeline_v1.definitions as Record<string, unknown>;
    expect(definitions).toHaveProperty("pipeline_v1");
    expect(definitions).not.toHaveProperty("pipeline");
    expect(SCHEMAS.pipeline_v1.title).toBe("pipeline_v1");
  });

  it("rewrites v1 template definitions to the public schema key namespace", () => {
    const definitions = SCHEMAS.template_v1.definitions as Record<string, unknown>;
    expect(definitions).toHaveProperty("template_v1");
    expect(definitions).not.toHaveProperty("pipeline");
    expect(SCHEMAS.template_v1.title).toBe("template_v1");
  });

  it("includes upstream K8sProgressiveCanaryRollback step definitions in v0 pipeline", () => {
    const pipelineDefs = SCHEMAS.pipeline.definitions as Record<string, Record<string, unknown>>;
    const cdSteps = pipelineDefs.pipeline.steps.cd as Record<string, unknown>;

    expect(cdSteps).toHaveProperty("K8sProgressiveCanaryRollbackStepNode");
    expect(cdSteps).toHaveProperty("K8sProgressiveCanaryRollbackStepInfo");

    const stepNode = cdSteps.K8sProgressiveCanaryRollbackStepNode as {
      properties: { type: { enum: string[] } };
    };
    expect(stepNode.properties.type.enum).toContain("K8sProgressiveCanaryRollback");
  });

  it("includes upstream K8sProgressiveCanaryRollback step definitions in v0 template", () => {
    const templateDefs = SCHEMAS.template.definitions as Record<string, Record<string, unknown>>;
    const cdSteps = templateDefs.pipeline.steps.cd as Record<string, unknown>;

    expect(cdSteps).toHaveProperty("K8sProgressiveCanaryRollbackStepNode");
    expect(cdSteps).toHaveProperty("K8sProgressiveCanaryRollbackStepNode_template");
  });

  it("includes upstream clone user field in v1 pipeline and template Clone definitions", () => {
    for (const key of ["pipeline_v1", "template_v1"] as const) {
      const defs = SCHEMAS[key].definitions as Record<string, Record<string, unknown>>;
      const ns = key;
      const clone = defs[ns].Clone as { properties: Record<string, { description?: string }> };

      expect(clone.properties).toHaveProperty("user");
      expect(clone.properties.user.description).toContain("clone container");
    }
  });

  it("includes upstream DeployGoogleAgentRuntimeRevision step definitions in v0 pipeline", () => {
    const pipelineDefs = SCHEMAS.pipeline.definitions as Record<string, Record<string, unknown>>;
    const cdSteps = pipelineDefs.pipeline.steps.cd as Record<string, unknown>;

    expect(cdSteps).toHaveProperty("DeployGoogleAgentRuntimeRevisionStepNode");
    expect(cdSteps).toHaveProperty("DeployGoogleAgentRuntimeRevisionStepInfo");

    const stepNode = cdSteps.DeployGoogleAgentRuntimeRevisionStepNode as {
      properties: { type: { enum: string[] } };
    };
    expect(stepNode.properties.type.enum).toContain("DeployGoogleAgentRuntimeRevision");

    const stepInfo = cdSteps.DeployGoogleAgentRuntimeRevisionStepInfo as {
      properties: Record<string, unknown>;
    };
    expect(stepInfo.properties).toHaveProperty("connectorRef");
    expect(stepInfo.properties).toHaveProperty("waitReady");
  });

  it("includes upstream DeployGoogleAgentRuntimeRevision step definitions in v0 template", () => {
    const templateDefs = SCHEMAS.template.definitions as Record<string, Record<string, unknown>>;
    const cdSteps = templateDefs.pipeline.steps.cd as Record<string, unknown>;

    expect(cdSteps).toHaveProperty("DeployGoogleAgentRuntimeRevisionStepNode");
    expect(cdSteps).toHaveProperty("DeployGoogleAgentRuntimeRevisionStepNode_template");
    expect(cdSteps).toHaveProperty("DeployGoogleAgentRuntimeRevisionStepInfo");
  });

  it("includes upstream DeployAwsAgentCoreRevision step definitions in v0 pipeline", () => {
    const pipelineDefs = SCHEMAS.pipeline.definitions as Record<string, Record<string, unknown>>;
    const cdSteps = pipelineDefs.pipeline.steps.cd as Record<string, unknown>;

    expect(cdSteps).toHaveProperty("DeployAwsAgentCoreRevisionStepNode");
    expect(cdSteps).toHaveProperty("DeployAwsAgentCoreRevisionStepInfo");

    const stepNode = cdSteps.DeployAwsAgentCoreRevisionStepNode as {
      properties: { type: { enum: string[] } };
    };
    expect(stepNode.properties.type.enum).toContain("DeployAwsAgentCoreRevision");

    const stepInfo = cdSteps.DeployAwsAgentCoreRevisionStepInfo as {
      properties: Record<string, unknown>;
    };
    expect(stepInfo.properties).toHaveProperty("connectorRef");
    expect(stepInfo.properties).toHaveProperty("waitReady");
  });

  it("includes upstream DeployAwsAgentCoreRevision step definitions in v0 template", () => {
    const templateDefs = SCHEMAS.template.definitions as Record<string, Record<string, unknown>>;
    const cdSteps = templateDefs.pipeline.steps.cd as Record<string, unknown>;

    expect(cdSteps).toHaveProperty("DeployAwsAgentCoreRevisionStepNode");
    expect(cdSteps).toHaveProperty("DeployAwsAgentCoreRevisionStepNode_template");
    expect(cdSteps).toHaveProperty("DeployAwsAgentCoreRevisionStepInfo");
  });

  it("includes upstream IdentitiesConfig and IdentitySpec in v0 pipeline common definitions", () => {
    const pipelineDefs = SCHEMAS.pipeline.definitions as Record<string, Record<string, unknown>>;
    const common = pipelineDefs.pipeline.common as Record<string, unknown>;

    expect(common).toHaveProperty("IdentitiesConfig");
    expect(common).toHaveProperty("IdentitySpec");

    const identitiesConfig = common.IdentitiesConfig as {
      maxProperties?: number;
      description?: string;
      additionalProperties?: { $ref?: string };
    };
    expect(identitiesConfig.maxProperties).toBe(10);
    expect(identitiesConfig.description).toContain("IdentitySpec");
    expect(identitiesConfig.additionalProperties?.$ref).toContain("IdentitySpec");

    const identitySpec = common.IdentitySpec as {
      properties?: Record<string, unknown>;
    };
    expect(identitySpec.properties).toHaveProperty("audience");
    expect(identitySpec.properties).toHaveProperty("subjectTemplate");
  });

  it("includes upstream DynamicStageNodeV1 in v1 pipeline unified stages", () => {
    const pipelineDefs = SCHEMAS.pipeline_v1.definitions as Record<string, Record<string, unknown>>;
    const unified = pipelineDefs.pipeline_v1.stages.unified as Record<string, unknown>;

    expect(unified).toHaveProperty("DynamicStageNodeV1");

    const node = unified.DynamicStageNodeV1 as {
      required?: string[];
      properties?: Record<string, unknown>;
      description?: string;
    };
    expect(node.required).toContain("dynamic");
    expect(node.properties).toHaveProperty("dynamic");
    expect(node.description).toContain("child pipeline");
  });

  it("includes upstream DynamicStageNodeV1 in v1 template unified stages", () => {
    const templateDefs = SCHEMAS.template_v1.definitions as Record<string, Record<string, unknown>>;
    const unified = templateDefs.template_v1.stages.unified as Record<string, unknown>;

    expect(unified).toHaveProperty("DynamicStageNodeV1");
  });

  it("includes upstream GoogleCloudRunDeploy step definitions in v0 pipeline (#597)", () => {
    const pipelineDefs = SCHEMAS.pipeline.definitions as Record<string, Record<string, unknown>>;
    const cdSteps = pipelineDefs.pipeline.steps.cd as Record<string, unknown>;

    expect(cdSteps).toHaveProperty("GoogleCloudRunDeployStepNode");
    expect(cdSteps).toHaveProperty("GoogleCloudRunDeployStepInfo");

    const stepNode = cdSteps.GoogleCloudRunDeployStepNode as {
      properties: { type: { enum: string[] } };
    };
    expect(stepNode.properties.type.enum).toContain("GoogleCloudRunDeploy");

    const stepInfo = cdSteps.GoogleCloudRunDeployStepInfo as {
      properties: Record<string, unknown>;
    };
    expect(stepInfo.properties).toHaveProperty("connectorRef");
    expect(stepInfo.properties).toHaveProperty("image");
  });

  it("includes upstream ShiftGoogleAgentRuntimeTraffic step definitions in v0 pipeline (#597)", () => {
    const pipelineDefs = SCHEMAS.pipeline.definitions as Record<string, Record<string, unknown>>;
    const cdSteps = pipelineDefs.pipeline.steps.cd as Record<string, unknown>;

    expect(cdSteps).toHaveProperty("ShiftGoogleAgentRuntimeTrafficStepNode");
    expect(cdSteps).toHaveProperty("ShiftGoogleAgentRuntimeTrafficStepInfo");

    const stepNode = cdSteps.ShiftGoogleAgentRuntimeTrafficStepNode as {
      properties: { type: { enum: string[] } };
    };
    expect(stepNode.properties.type.enum).toContain("ShiftGoogleAgentRuntimeTraffic");
  });

  it("includes upstream RollbackGoogleAgentRuntimeRevision step definitions in v0 pipeline (#597)", () => {
    const pipelineDefs = SCHEMAS.pipeline.definitions as Record<string, Record<string, unknown>>;
    const cdSteps = pipelineDefs.pipeline.steps.cd as Record<string, unknown>;

    expect(cdSteps).toHaveProperty("RollbackGoogleAgentRuntimeRevisionStepNode");
    expect(cdSteps).toHaveProperty("RollbackGoogleAgentRuntimeRevisionStepInfo");

    const stepNode = cdSteps.RollbackGoogleAgentRuntimeRevisionStepNode as {
      properties: { type: { enum: string[] } };
    };
    expect(stepNode.properties.type.enum).toContain("RollbackGoogleAgentRuntimeRevision");
  });

  it("includes upstream ShiftAwsAgentCoreTraffic step definitions in v0 pipeline (#597)", () => {
    const pipelineDefs = SCHEMAS.pipeline.definitions as Record<string, Record<string, unknown>>;
    const cdSteps = pipelineDefs.pipeline.steps.cd as Record<string, unknown>;

    expect(cdSteps).toHaveProperty("ShiftAwsAgentCoreTrafficStepNode");
    expect(cdSteps).toHaveProperty("ShiftAwsAgentCoreTrafficStepInfo");

    const stepNode = cdSteps.ShiftAwsAgentCoreTrafficStepNode as {
      properties: { type: { enum: string[] } };
    };
    expect(stepNode.properties.type.enum).toContain("ShiftAwsAgentCoreTraffic");
  });

  it("includes upstream llmConnectorRef on AiEvalStepInfo in v0 pipeline (#597)", () => {
    const pipelineDefs = SCHEMAS.pipeline.definitions as Record<string, Record<string, unknown>>;
    const ciSteps = pipelineDefs.pipeline.steps.ci as Record<string, unknown>;
    const aiEval = ciSteps.AiEvalStepInfo as {
      allOf: Array<{ properties?: Record<string, { description?: string }> }>;
    };

    const props = aiEval.allOf.find((part) => part.properties?.llmConnectorRef)?.properties;
    expect(props?.llmConnectorRef?.description).toContain("LLM connector");
  });
});
