/**
 * Load saved pipeline input sets and build runtime YAML for pipeline execute.
 * Used when callers pass input_set_ids without inline `inputs`, so execution
 * does not depend on Harness honoring `inputSetIdentifiers` query params alone.
 */
import YAML from "yaml";
import type { HarnessClient } from "../client/harness-client.js";
import { HarnessApiError } from "./errors.js";
import { asRecord, asString } from "./type-guards.js";

export interface MaterializeParams {
  pipelineId: string;
  orgId: string;
  projectId: string;
  inputSetIds: string[];
}

function mergeVariableLists(
  a: Array<Record<string, unknown>>,
  b: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  const byName = new Map<string, Record<string, unknown>>();
  for (const v of a) {
    const n = asString(v.name);
    if (n) byName.set(n, { ...v });
  }
  for (const v of b) {
    const n = asString(v.name);
    if (n) {
      const prev = byName.get(n);
      byName.set(n, prev ? { ...prev, ...v } : { ...v });
    }
  }
  return [...byName.values()];
}

function getStageId(stageItem: unknown): string | undefined {
  const o = asRecord(stageItem);
  const st = asRecord(o?.stage);
  return asString(st?.identifier);
}

function mergeStages(a: unknown[], b: unknown[]): unknown[] {
  const out = [...a];
  for (const nextItem of b) {
    const id = getStageId(nextItem);
    if (!id) {
      out.push(nextItem);
      continue;
    }
    const idx = out.findIndex((x) => getStageId(x) === id);
    if (idx < 0) {
      out.push(nextItem);
      continue;
    }
    const baseItem = asRecord(out[idx]);
    const nextRec = asRecord(nextItem);
    const baseStage = asRecord(baseItem?.stage);
    const nextStage = asRecord(nextRec?.stage);
    const mergedStage: Record<string, unknown> = { ...baseStage, ...nextStage };
    const baseVars = Array.isArray(baseStage?.variables)
      ? (baseStage.variables as unknown[]).map((x) => asRecord(x)).filter((x): x is Record<string, unknown> => !!x)
      : [];
    const nextVars = Array.isArray(nextStage?.variables)
      ? (nextStage.variables as unknown[]).map((x) => asRecord(x)).filter((x): x is Record<string, unknown> => !!x)
      : [];
    if (baseVars.length > 0 || nextVars.length > 0) {
      mergedStage.variables = mergeVariableLists(baseVars, nextVars);
    }
    out[idx] = { stage: mergedStage };
  }
  return out;
}

/** Merge two `pipeline` fragments from input sets (later ids override by variable / stage id). */
export function mergeRuntimePipelineFragments(
  base: Record<string, unknown>,
  next: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base, ...next };
  if (next.identifier !== undefined) out.identifier = next.identifier;

  const bv = Array.isArray(base.variables)
    ? (base.variables as unknown[]).map((x) => asRecord(x)).filter((x): x is Record<string, unknown> => !!x)
    : [];
  const nv = Array.isArray(next.variables)
    ? (next.variables as unknown[]).map((x) => asRecord(x)).filter((x): x is Record<string, unknown> => !!x)
    : [];
  if (nv.length > 0 || bv.length > 0) {
    out.variables = mergeVariableLists(bv, nv);
  }

  const bs = Array.isArray(base.stages) ? (base.stages as unknown[]) : [];
  const ns = Array.isArray(next.stages) ? (next.stages as unknown[]) : [];
  if (ns.length > 0 || bs.length > 0) {
    out.stages = mergeStages(bs, ns);
  }
  return out;
}

async function fetchInputSetPipelineFragment(
  client: HarnessClient,
  pipelineId: string,
  orgId: string,
  projectId: string,
  inputSetId: string,
): Promise<Record<string, unknown> | undefined> {
  const raw = await client.request<unknown>({
    method: "GET",
    path: `/pipeline/api/inputSets/${encodeURIComponent(inputSetId)}`,
    params: {
      orgIdentifier: orgId,
      projectIdentifier: projectId,
      pipelineIdentifier: pipelineId,
    },
  });
  const r = asRecord(raw);
  const st = asString(r?.status);
  if (st === "ERROR" || st === "FAILURE") {
    const msg = asString(r?.message) ?? "Input set GET returned ERROR";
    throw new HarnessApiError(msg, 400, asString(r?.code), asString(r?.correlationId));
  }
  const entity = asRecord(r?.data) ?? r;
  const yamlStr = asString(entity?.inputSetYaml);
  if (!yamlStr) return undefined;

  const doc = YAML.parse(yamlStr) as unknown;
  const root = asRecord(doc);
  const inputSet = asRecord(root?.inputSet) ?? root;
  const pipeline = asRecord(inputSet?.pipeline);
  return pipeline ?? undefined;
}

/**
 * Returns YAML string `{ pipeline: ... }` suitable for pipeline execute body,
 * or undefined if no ids.
 */
export async function materializeInputSetsToRuntimeYaml(
  client: HarnessClient,
  params: MaterializeParams,
): Promise<string | undefined> {
  if (params.inputSetIds.length === 0) return undefined;

  let merged: Record<string, unknown> | undefined;
  for (const id of params.inputSetIds) {
    const fragment = await fetchInputSetPipelineFragment(
      client,
      params.pipelineId,
      params.orgId,
      params.projectId,
      id,
    );
    if (!fragment) {
      throw new HarnessApiError(
        `Input set "${id}" not found or has no pipeline fragment for pipeline "${params.pipelineId}".`,
        404,
      );
    }
    merged = merged ? mergeRuntimePipelineFragments(merged, fragment) : fragment;
  }

  return YAML.stringify({ pipeline: merged });
}
