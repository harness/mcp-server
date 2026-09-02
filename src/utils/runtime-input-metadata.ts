/**
 * Parse Harness runtime-input expressions and enrich template YAML with pipeline
 * definition metadata (defaults, allowed values) for release-activity authoring.
 */
import YAML from "yaml";
import { isRecord, asString } from "./type-guards.js";

const RUNTIME_INPUT_PREFIX = /^<\+input>/;

export type RuntimeInputVariableMetadata = {
  runtimeExpression: string;
  default?: string;
  allowedValues?: string[];
};

/** Parse `<+input>.default(x).selectOneFrom(a,b)` / `.allowedValues(...)` suffixes. */
export function parseRuntimeInputExpression(value: unknown): RuntimeInputVariableMetadata | null {
  if (typeof value !== "string" || !RUNTIME_INPUT_PREFIX.test(value)) {
    return null;
  }

  const runtimeExpression = value;
  const suffix = value.replace(/^<\+input>/, "");

  let defaultValue: string | undefined;
  const defaultMatch = suffix.match(/\.default\(([^)]*)\)/);
  if (defaultMatch) {
    const raw = defaultMatch[1]?.trim();
    if (raw && raw !== "*") {
      defaultValue = raw;
    }
  }

  let allowedValues: string[] | undefined;
  const selectOneMatch = suffix.match(/\.selectOneFrom\(([^)]*)\)/);
  if (selectOneMatch?.[1]) {
    allowedValues = selectOneMatch[1]
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
  }

  const allowedMatch = suffix.match(/\.allowedValues\(([^)]*)\)/);
  if (allowedMatch?.[1]) {
    allowedValues = allowedMatch[1]
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part.length > 0 && part !== "*");
  }

  if (defaultValue === undefined && (!allowedValues || allowedValues.length === 0)) {
    return null;
  }

  return {
    runtimeExpression,
    ...(defaultValue !== undefined ? { default: defaultValue } : {}),
    ...(allowedValues && allowedValues.length > 0 ? { allowedValues } : {}),
  };
}

function collectPipelineVariables(pipelineYaml: string): Map<string, string> {
  const variables = new Map<string, string>();
  if (!pipelineYaml.trim()) return variables;

  try {
    const doc = YAML.parse(pipelineYaml) as unknown;
    const pipeline = isRecord(doc) ? doc.pipeline : undefined;
    const varList = isRecord(pipeline) ? pipeline.variables : undefined;
    if (!Array.isArray(varList)) return variables;

    for (const entry of varList) {
      if (!isRecord(entry)) continue;
      const name = asString(entry.name);
      const value = entry.value;
      if (name && typeof value === "string") {
        variables.set(name, value);
      }
    }
  } catch {
    // Malformed YAML — return empty map.
  }
  return variables;
}

/** Extract per-variable defaults / allowed values from pipeline definition YAML. */
export function extractVariableInputMetadata(
  pipelineYaml: string | null | undefined,
): Record<string, RuntimeInputVariableMetadata> {
  const metadata: Record<string, RuntimeInputVariableMetadata> = {};
  if (!pipelineYaml) return metadata;

  for (const [name, value] of collectPipelineVariables(pipelineYaml)) {
    const parsed = parseRuntimeInputExpression(value);
    if (parsed && (parsed.default !== undefined || parsed.allowedValues?.length)) {
      metadata[name] = parsed;
    }
  }
  return metadata;
}

/**
 * Merge richer pipeline-variable expressions from definition YAML into the
 * input-set template (template API often strips `.default()` / `.selectOneFrom()`).
 */
export function mergeTemplateYamlWithDefinitionVariables(
  templateYaml: string | null | undefined,
  pipelineYaml: string | null | undefined,
): string | null {
  if (!templateYaml) return templateYaml ?? null;
  if (!pipelineYaml) return templateYaml;

  const definitionVars = collectPipelineVariables(pipelineYaml);
  if (definitionVars.size === 0) return templateYaml;

  try {
    const doc = YAML.parse(templateYaml) as Record<string, unknown>;
    const pipeline = doc.pipeline;
    if (!isRecord(pipeline)) return templateYaml;
    const variables = pipeline.variables;
    if (!Array.isArray(variables)) return templateYaml;

    for (const entry of variables) {
      if (!isRecord(entry)) continue;
      const name = asString(entry.name);
      if (!name) continue;
      const templateValue = entry.value;
      const definitionValue = definitionVars.get(name);
      if (
        templateValue === "<+input>"
        && typeof definitionValue === "string"
        && definitionValue.startsWith("<+input>")
        && definitionValue.length > "<+input>".length
      ) {
        entry.value = definitionValue;
      }
    }

    return YAML.stringify(doc);
  } catch {
    return templateYaml;
  }
}
