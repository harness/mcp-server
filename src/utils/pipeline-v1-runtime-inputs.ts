import YAML from "yaml";
import { asRecord } from "./type-guards.js";

export function normalizeV1PipelineRunInputs(input: Record<string, unknown>): string | undefined {
  const body = asRecord(input.body);
  const candidates: Array<{ name: string; value: unknown }> = [];
  if (input.inputs !== undefined) candidates.push({ name: "inputs", value: input.inputs });
  if (body?.inputs !== undefined) candidates.push({ name: "body.inputs", value: body.inputs });
  if (body?.inputs_yaml !== undefined) {
    candidates.push({ name: "body.inputs_yaml", value: body.inputs_yaml });
  }

  if (candidates.length > 1) {
    return `Conflicting pipeline_v1 runtime inputs were provided via ${candidates.map(({ name }) => name).join(", ")}. Provide only one source; prefer the top-level inputs argument.`;
  }
  if (candidates.length === 0) return undefined;

  const candidate = candidates[0]!;
  if (candidate.name === "body.inputs_yaml" && typeof candidate.value !== "string") {
    return "body.inputs_yaml must be a YAML string for pipeline_v1 execution.";
  }
  if (
    typeof candidate.value !== "string"
    && (!candidate.value || typeof candidate.value !== "object" || Array.isArray(candidate.value))
  ) {
    return `${candidate.name} must be a YAML string or key-value object for pipeline_v1 execution.`;
  }

  input.inputs = candidate.value;
  return undefined;
}

export function buildV1RuntimeInputsBody(input: Record<string, unknown>): Record<string, unknown> {
  const runtimeInputs = input.inputs;
  if (runtimeInputs === undefined || runtimeInputs === null) return {};

  if (typeof runtimeInputs === "string") {
    const parsed = YAML.parse(runtimeInputs) as unknown;
    const parsedRecord = asRecord(parsed);
    if (!parsedRecord) {
      throw new Error("pipeline_v1 inputs YAML must contain a mapping");
    }
    if (!("inputs" in parsedRecord)) {
      return { inputs_yaml: YAML.stringify({ inputs: parsedRecord }) };
    }
    if (Object.keys(parsedRecord).length !== 1) {
      throw new Error("pipeline_v1 inputs YAML must contain only the inputs root");
    }
    if (!asRecord(parsedRecord.inputs)) {
      throw new Error("pipeline_v1 inputs YAML root must contain a key-value mapping");
    }
    return { inputs_yaml: runtimeInputs };
  }

  const inputsRecord = asRecord(runtimeInputs);
  if (!inputsRecord) {
    throw new Error("pipeline_v1 inputs must be a YAML string or key-value object");
  }

  return { inputs_yaml: YAML.stringify({ inputs: inputsRecord }) };
}
