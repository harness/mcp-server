/**
 * Parse Harness runtime-input expressions and extract pipeline variable metadata
 * (defaults, allowed values) and resolved-pipeline stage deployment metadata.
 */
import YAML from "yaml";
import { isRecord, asString } from "./type-guards.js";

const RUNTIME_INPUT_PREFIX = /^<\+input>/;

export type RuntimeInputVariableMetadata = {
  runtimeExpression: string;
  default?: string;
  allowedValues?: string[];
};

/** Extract the argument string from `.methodName(...)` handling nested parens. */
function extractMethodArg(suffix: string, methodName: string): string | undefined {
  const prefix = `.${methodName}(`;
  const startIdx = suffix.indexOf(prefix);
  if (startIdx === -1) return undefined;

  let depth = 1;
  let i = startIdx + prefix.length;
  while (i < suffix.length && depth > 0) {
    const ch = suffix[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    i++;
  }
  if (depth !== 0) return undefined;
  return suffix.slice(startIdx + prefix.length, i - 1).trim();
}

/** Split comma-separated args at top level (respects quotes and nested parens). */
function splitTopLevelArgs(argString: string): string[] {
  const parts: string[] = [];
  let current = "";
  let depth = 0;
  let inQuote: "\"" | "'" | null = null;

  for (let i = 0; i < argString.length; i++) {
    const ch = argString[i];
    if (inQuote) {
      current += ch;
      if (ch === inQuote && argString[i - 1] !== "\\") inQuote = null;
      continue;
    }
    if (ch === "\"" || ch === "'") {
      inQuote = ch;
      current += ch;
      continue;
    }
    if (ch === "(") {
      depth++;
      current += ch;
      continue;
    }
    if (ch === ")") {
      depth--;
      current += ch;
      continue;
    }
    if (ch === "," && depth === 0) {
      const trimmed = current.trim();
      if (trimmed) parts.push(trimmed);
      current = "";
      continue;
    }
    current += ch;
  }

  const trimmed = current.trim();
  if (trimmed) parts.push(trimmed);
  return parts;
}

function unquoteHarnessArg(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\""))
    || (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/** Parse `<+input>.default(x).selectOneFrom(a,b)` / `.allowedValues(...)` suffixes. */
export function parseRuntimeInputExpression(value: unknown): RuntimeInputVariableMetadata | null {
  if (typeof value !== "string" || !RUNTIME_INPUT_PREFIX.test(value)) {
    return null;
  }

  const runtimeExpression = value;
  const suffix = value.replace(/^<\+input>/, "");

  let defaultValue: string | undefined;
  const defaultArg = extractMethodArg(suffix, "default");
  if (defaultArg && defaultArg !== "*") {
    defaultValue = unquoteHarnessArg(defaultArg);
  }

  let allowedValues: string[] | undefined;
  const selectOneArg = extractMethodArg(suffix, "selectOneFrom");
  if (selectOneArg) {
    allowedValues = splitTopLevelArgs(selectOneArg)
      .map(unquoteHarnessArg)
      .filter((part) => part.length > 0);
  }

  const allowedArg = extractMethodArg(suffix, "allowedValues");
  if (allowedArg) {
    allowedValues = splitTopLevelArgs(allowedArg)
      .map(unquoteHarnessArg)
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

export type StageMetadata = {
  deploymentType: string;
  environmentRef: string;
};

function stageMetadataFromStage(stage: Record<string, unknown>): StageMetadata {
  const spec = (stage.spec ?? {}) as Record<string, unknown>;
  const deploymentType = typeof spec.deploymentType === "string" ? spec.deploymentType : "";
  const environment = (spec.environment ?? {}) as Record<string, unknown>;
  const environmentRef = typeof environment.environmentRef === "string" ? environment.environmentRef : "";
  return { deploymentType, environmentRef };
}

function hasStageMetadata(metadata: StageMetadata): boolean {
  return metadata.deploymentType !== "" || metadata.environmentRef !== "";
}

function collectStageMetadata(
  stage: Record<string, unknown>,
  stageMap: Record<string, StageMetadata>,
): void {
  const stageId = typeof stage.identifier === "string" ? stage.identifier : "";
  if (stageId) {
    const metadata = stageMetadataFromStage(stage);
    if (hasStageMetadata(metadata)) {
      stageMap[stageId] = metadata;
    }
  }
  if (Array.isArray(stage.stages)) {
    walkPipelineStageEntries(stage.stages, stageMap);
  }
}

/** Walk v0 pipeline stage entries including parallel blocks and nested stage groups. */
export function walkPipelineStageEntries(
  entries: unknown,
  stageMap: Record<string, StageMetadata>,
): void {
  if (!Array.isArray(entries)) return;

  for (const entry of entries) {
    if (!isRecord(entry)) continue;

    if (isRecord(entry.stage)) {
      collectStageMetadata(entry.stage, stageMap);
      continue;
    }

    if (entry.parallel !== undefined) {
      const parallel = entry.parallel;
      if (Array.isArray(parallel)) {
        walkPipelineStageEntries(parallel, stageMap);
      } else if (isRecord(parallel) && Array.isArray(parallel.stages)) {
        walkPipelineStageEntries(parallel.stages, stageMap);
      }
      continue;
    }

    if (typeof entry.identifier === "string") {
      collectStageMetadata(entry, stageMap);
    }
  }
}

/** Parse resolved pipeline YAML into per-stage deployment metadata. */
export function buildStageMetadataMap(resolvedYaml: string | null | undefined): Record<string, StageMetadata> {
  const stageMap: Record<string, StageMetadata> = {};
  if (!resolvedYaml) return stageMap;

  try {
    const pipelineDoc = YAML.parse(resolvedYaml) as {
      pipeline?: { stages?: unknown[] };
    } | null;
    walkPipelineStageEntries(pipelineDoc?.pipeline?.stages ?? [], stageMap);
  } catch {
    // Malformed YAML — return empty map; caller can still use resolvedTemplatesPipelineYaml.
  }
  return stageMap;
}
