/**
 * Zero-boilerplate `ResourceCodeSpec` resolver + declarative YAML tree grammars.
 *
 * Long-term maintainability principle:
 *  - Toolset authors should NOT have to copy-paste `codeSpec` blocks across 300+
 *    resources. Whenever a `ResourceDefinition` has a known bundled schema (`SCHEMAS`),
 *    live entity schema (`LIVE_ENTITY_SCHEMAS`), a `type: "yaml"` field in `bodySchema`,
 *    or standard JSON `get`/`update` operations, `resolveEffectiveCodeSpec(def)` derives
 *    a safe default `ResourceCodeSpec` automatically.
 *  - Explicit `def.codeSpec` on a `ResourceDefinition` overrides or enriches the default
 *    with domain collections, DSL formats (`rego`, `antlr4`), or tree grammars.
 */

import { SCHEMAS } from "../data/schemas/index.js";
import type { ResourceDefinition } from "../registry/types.js";
import { LIVE_ENTITY_SCHEMAS } from "../tools/entity-schema/live.js";
import type { ResourceCodeSpec, YamlTreeGrammarSpec } from "./types.js";

/**
 * Pure-data declarative tree grammar for Harness v0 pipelines (`pipeline`).
 * Handles stages, parallel stages, stepGroups, nested stepGroups, parallel steps,
 * execution steps, rollbackSteps, and pipeline variables with zero hardcoded AST logic.
 */
export const PIPELINE_V0_TREE_GRAMMAR: YamlTreeGrammarSpec = {
  rootWrapperKey: "pipeline",
  rootSegment: "pipeline",
  rootIdFields: ["identifier"],
  containers: [
    {
      sequencePath: "stages",
      passThroughKeys: ["parallel"],
      variants: [
        {
          segment: "stage",
          wrapperKey: "stage",
          idFields: ["identifier"],
          typeFields: ["type"],
          childContainers: [
            {
              sequencePath: "spec.execution.steps",
              passThroughKeys: ["parallel"],
              variants: [
                {
                  segment: "group",
                  wrapperKey: "stepGroup",
                  idFields: ["identifier"],
                  recurseSameLevelOn: [
                    { sequencePath: "steps" },
                    { sequencePath: "rollbackSteps", overrideSegment: "rollback_step" },
                  ],
                },
                {
                  segment: "step",
                  wrapperKey: "step",
                  idFields: ["identifier"],
                  typeFields: ["type"],
                },
              ],
            },
            {
              sequencePath: "spec.execution.rollbackSteps",
              passThroughKeys: ["parallel"],
              variants: [
                {
                  segment: "group",
                  wrapperKey: "stepGroup",
                  idFields: ["identifier"],
                  recurseSameLevelOn: [
                    { sequencePath: "steps", overrideSegment: "rollback_step" },
                    { sequencePath: "rollbackSteps", overrideSegment: "rollback_step" },
                  ],
                },
                {
                  segment: "rollback_step",
                  wrapperKey: "step",
                  idFields: ["identifier"],
                  typeFields: ["type"],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      sequencePath: "variables",
      variants: [
        {
          segment: "variable",
          idFields: ["name"],
          typeFields: ["type"],
        },
      ],
    },
  ],
};

/**
 * Pure-data declarative tree grammar for Harness v1 / simplified pipelines (`pipeline_v1`).
 */
export const PIPELINE_V1_TREE_GRAMMAR: YamlTreeGrammarSpec = {
  rootWrapperKey: "pipeline",
  rootSegment: "pipeline",
  rootIdFields: ["id", "identifier"],
  containers: [
    {
      sequencePath: "steps",
      passThroughKeys: ["parallel.steps", "parallel"],
      variants: [
        {
          segment: "group",
          wrapperKey: "group",
          idFields: ["id", "identifier", "name"],
          recurseSameLevelOn: [{ sequencePath: "steps" }],
        },
        {
          segment: "step",
          idFields: ["id", "identifier", "name"],
          typeFields: ["type"],
          shorthandTypeKeys: ["run", "action", "template", "approval", "wait", "barrier", "background"],
        },
      ],
    },
    {
      sequencePath: "stages",
      variants: [
        {
          segment: "stage",
          idFields: ["id", "identifier", "name"],
          typeFields: ["type"],
          childContainers: [
            {
              sequencePath: "steps",
              passThroughKeys: ["parallel.steps", "parallel"],
              variants: [
                {
                  segment: "group",
                  wrapperKey: "group",
                  idFields: ["id", "identifier", "name"],
                  recurseSameLevelOn: [{ sequencePath: "steps" }],
                },
                {
                  segment: "step",
                  idFields: ["id", "identifier", "name"],
                  typeFields: ["type"],
                  shorthandTypeKeys: ["run", "action", "template", "approval", "wait", "barrier", "background"],
                },
              ],
            },
            {
              sequencePath: "spec.steps",
              passThroughKeys: ["parallel.steps", "parallel"],
              variants: [
                {
                  segment: "group",
                  wrapperKey: "group",
                  idFields: ["id", "identifier", "name"],
                  recurseSameLevelOn: [{ sequencePath: "steps" }],
                },
                {
                  segment: "step",
                  idFields: ["id", "identifier", "name"],
                  typeFields: ["type"],
                  shorthandTypeKeys: ["run", "action", "template", "approval", "wait", "barrier", "background"],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

/**
 * Resolve the effective `ResourceCodeSpec` for any `ResourceDefinition`.
 * Explicit `def.codeSpec` always wins; otherwise auto-infers from existing
 * schema/body metadata so every YAML and JSON resource works without boilerplate.
 */
export function resolveEffectiveCodeSpec(def: ResourceDefinition): ResourceCodeSpec {
  const rt = def.resourceType;
  const defaultGrammar =
    rt === "pipeline"
      ? PIPELINE_V0_TREE_GRAMMAR
      : rt === "pipeline_v1"
        ? PIPELINE_V1_TREE_GRAMMAR
        : undefined;

  if (def.codeSpec) {
    return defaultGrammar && !def.codeSpec.treeGrammar
      ? { ...def.codeSpec, treeGrammar: defaultGrammar }
      : def.codeSpec;
  }

  // 1. Live NG / RMG YAML-schema entities (service, environment, connector, secret, infrastructure, release_*)
  if (rt in LIVE_ENTITY_SCHEMAS) {
    return {
      format: "yaml",
      sourcePaths: [`${rt}.yaml`, "yaml", "yamlString"],
      writeShape: {
        field: "yaml",
        carryFields: ["identifier", "name", "description", "tags"],
        carryFromPath: rt,
      },
      schemaRef: { kind: "live_bundled", key: rt },
      dynamicExpressions: ["harness_jexl"],
    };
  }

  // 2. Bundled YAML schemas (template, template_v1, trigger, etc.)
  if (rt in SCHEMAS) {
    return {
      format: "yaml",
      sourcePaths: ["yaml", "template.yaml", "yamlPipeline", "pipeline_yaml"],
      writeShape: "raw_string",
      schemaRef: { kind: "bundled", key: rt },
      dynamicExpressions: rt.endsWith("_v1") ? ["v1_expr"] : ["harness_jexl"],
    };
  }

  // 3. Resources whose update/create `bodySchema` declares a `type: "yaml"` field
  const updateFields = def.operations.update?.bodySchema?.fields ?? def.operations.create?.bodySchema?.fields ?? [];
  const yamlField = updateFields.find((f) => f.type === "yaml");
  if (yamlField) {
    return {
      format: "yaml",
      sourcePaths: [yamlField.name, "yaml", `${rt}.yaml`],
      writeShape: {
        field: yamlField.name,
        carryFields: ["identifier", "name"],
      },
      dynamicExpressions: ["harness_jexl", "v1_expr", "idp_param"],
    };
  }

  // 4. Default JSON-tree fallback for any structured JSON resource
  return {
    format: "json",
    writeShape: "root_object",
    dynamicExpressions: ["harness_jexl"],
  };
}
