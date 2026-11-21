/**
 * Universal Resource-as-Code Engine Orchestrator (`src/code-engine/index.ts`).
 *
 * Connects the pluggable `CODEC_REGISTRY` (`yaml`, `json`, `rego`, `antlr4`),
 * upstream-synced `schema-validator`, and stateless HMAC `preview-token` codec
 * to `Registry.dispatch()` without bypassing auth, rate limiting, or audit sinks.
 */

import { createHash } from "node:crypto";
import YAML from "yaml";
import * as z from "zod/v4";
import type { AuditContext } from "../audit/types.js";
import type { HarnessClient } from "../client/harness-client.js";
import type { Registry } from "../registry/index.js";
import type { ResourceDefinition, ResourceScope } from "../registry/types.js";
import type { HarnessYamlScope } from "../tools/entity-schema/types.js";
import { asRecord, asString } from "../utils/type-guards.js";
import { resolveEffectiveCodeSpec } from "./auto-spec.js";
import { applyRegoPatches, inspectAntlr4Grammar, inspectRegoDocument } from "./dsl-text.js";
import { applyJsonPatches, inspectJsonDocument } from "./json-tree.js";
import {
  checkIdempotencyReceipt,
  configurePreviewSigningKey,
  issuePreviewToken,
  recordIdempotencyReceipt,
  verifyPreviewToken,
} from "./preview-token.js";
import { validateCandidateAgainstSchema } from "./schema-validator.js";
import {
  CodeEngineError,
  type ApplyEditResponse,
  type CodeCodec,
  type CodeDiagnostic,
  type CodeFormat,
  type FieldChangeSummary,
  type InspectResponse,
  type PatchOperation,
  type PreviewEditResponse,
  type ResourceCodeSpec,
  type RevisionInfo,
} from "./types.js";
import { applyYamlPatches, inspectYamlDocument } from "./yaml-cst.js";

export * from "./types.js";
export {
  PIPELINE_V0_TREE_GRAMMAR,
  PIPELINE_V1_TREE_GRAMMAR,
  resolveEffectiveCodeSpec,
} from "./auto-spec.js";
export {
  checkIdempotencyReceipt,
  clearIdempotencyStoreForTests,
  configurePreviewSigningKey,
  issuePreviewToken,
  verifyPreviewToken,
} from "./preview-token.js";

// ---------------------------------------------------------------------------
// Pluggable Codec Registry (Open/Closed Principle)
// ---------------------------------------------------------------------------

export const CODEC_REGISTRY: ReadonlyMap<CodeFormat, CodeCodec> = new Map<CodeFormat, CodeCodec>([
  [
    "yaml",
    {
      format: "yaml",
      supportsWrite: true,
      inspect: ({ sourceText, codeSpec, revPrefix, view, select, cursor, pageSize }) => {
        if (typeof sourceText !== "string") {
          throw new CodeEngineError("UNSUPPORTED_CODE_RESOURCE", "YAML codec requires string source content.");
        }
        return inspectYamlDocument({ source: sourceText, codeSpec, revPrefix, view, select, cursor, pageSize });
      },
      applyPatches: ({ sourceText, codeSpec, revPrefix, operations }) => {
        if (typeof sourceText !== "string") {
          throw new CodeEngineError("UNSUPPORTED_CODE_RESOURCE", "YAML codec requires string source content.");
        }
        const res = applyYamlPatches({ source: sourceText, codeSpec, revPrefix, operations });
        return {
          patchedText: res.patchedSource,
          changes: res.changes,
          diagnostics: res.diagnostics,
        };
      },
    },
  ],
  [
    "json",
    {
      format: "json",
      supportsWrite: true,
      inspect: ({ rawDoc, codeSpec, revPrefix, view, select, cursor, pageSize }) => {
        const rec = asRecord(rawDoc);
        if (!rec) {
          throw new CodeEngineError("UNSUPPORTED_CODE_RESOURCE", "JSON codec requires an object payload.");
        }
        return inspectJsonDocument({ doc: rec, codeSpec, revPrefix, view, select, cursor, pageSize });
      },
      applyPatches: ({ rawDoc, codeSpec, revPrefix, operations }) => {
        const rec = asRecord(rawDoc);
        if (!rec) {
          throw new CodeEngineError("UNSUPPORTED_CODE_RESOURCE", "JSON codec requires an object payload.");
        }
        const res = applyJsonPatches({ doc: rec, codeSpec, revPrefix, operations });
        return {
          patchedObject: res.patchedDoc,
          changes: res.changes,
          diagnostics: res.diagnostics,
        };
      },
    },
  ],
  [
    "rego",
    {
      format: "rego",
      supportsWrite: true,
      inspect: ({ sourceText, revPrefix, view, select }) => {
        if (typeof sourceText !== "string") {
          throw new CodeEngineError("UNSUPPORTED_CODE_RESOURCE", "Rego codec requires string `rego` content.");
        }
        return inspectRegoDocument({ source: sourceText, revPrefix, view, select });
      },
      applyPatches: ({ sourceText, revPrefix, operations }) => {
        if (typeof sourceText !== "string") {
          throw new CodeEngineError("UNSUPPORTED_CODE_RESOURCE", "Rego codec requires string `rego` content.");
        }
        const res = applyRegoPatches({ source: sourceText, revPrefix, operations });
        return {
          patchedText: res.patchedSource,
          changes: res.changes,
          diagnostics: res.diagnostics,
        };
      },
    },
  ],
  [
    "antlr4",
    {
      format: "antlr4",
      supportsWrite: false,
      inspect: ({ sourceText, revPrefix, view, select }) => {
        if (typeof sourceText !== "string") {
          throw new CodeEngineError("UNSUPPORTED_CODE_RESOURCE", "ANTLR4 codec requires string grammar content.");
        }
        return inspectAntlr4Grammar({ source: sourceText, revPrefix, view, select });
      },
    },
  ],
]);

// ---------------------------------------------------------------------------
// Input Patch Validation (Strict Zod v4 Schema kept out of tools/list budget)
// ---------------------------------------------------------------------------

const structuredStepSelectorSchema = z.object({
  stage_id: z.string().optional(),
  group_ids: z.array(z.string()).optional(),
  step_id: z.string().optional(),
  section: z.enum(["execution", "rollback"]).optional(),
});

const selectorTargetSchema = z.union([
  z.string(),
  z.object({ node_ref: z.string().min(1) }),
  z.object({ selector: z.union([z.string(), structuredStepSelectorSchema]) }),
]);

const patchOperationSchema = z.object({
  op: z.enum(["set", "unset", "upsert_item", "remove_item", "replace_block"]),
  target: selectorTargetSchema.optional(),
  field: z.string().optional(),
  value: z.unknown().optional(),
  key_field: z.string().optional(),
  key_value: z.string().optional(),
  edit_scope: z.enum(["local", "template_input"]).optional(),
  replace_dynamic: z.boolean().optional(),
  expected_hash: z.string().optional(),
});

export function parsePatchOperations(rawPatches: unknown): PatchOperation[] {
  const parsed = z.array(patchOperationSchema).min(1).max(25).safeParse(rawPatches);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const loc = issue?.path.length ? ` at patches.${issue.path.join(".")}` : "";
    throw new CodeEngineError(
      "INVALID_PATCH_OPERATION",
      `Invalid patches payload${loc}: ${issue?.message ?? "validation failed"}.`,
    );
  }
  return parsed.data as PatchOperation[];
}

// ---------------------------------------------------------------------------
// Source & Revision Extraction / Writeback Helpers
// ---------------------------------------------------------------------------

function readDotted(obj: unknown, dottedPath: string): unknown {
  let cur: unknown = obj;
  for (const part of dottedPath.split(".").filter(Boolean)) {
    const rec = asRecord(cur);
    if (!rec) return undefined;
    cur = rec[part];
  }
  return cur;
}

/** Normalize omitted and explicit scope to the same update-effective value for preview binding. */
export function resolveCodeResourceScope(
  def: ResourceDefinition,
  input: Record<string, unknown>,
): ResourceScope {
  const rawScope = asString(input.resource_scope)?.trim();
  return (rawScope ? rawScope as ResourceScope : undefined) ?? def.operations.update?.scope ?? def.scope;
}

function extractSourceAndRevision(
  getResult: unknown,
  codeSpec: ResourceCodeSpec,
): {
  sourceText?: string;
  rawDoc: unknown;
  revision: RevisionInfo;
} {
  let sourceText: string | undefined;
  let canonicalForHash: string;

  if (codeSpec.format === "json") {
    const targetObj = codeSpec.sourcePaths?.length
      ? codeSpec.sourcePaths.map((p) => readDotted(getResult, p)).find((v) => v !== undefined) ?? getResult
      : getResult;
    const stripped = stripEphemeralEnvelopeKeys(targetObj);
    canonicalForHash = stableCanonicalJson(stripped);
    return {
      rawDoc: stripped,
      revision: buildRevisionInfo(getResult, canonicalForHash),
    };
  }

  if (typeof getResult === "string") {
    sourceText = getResult;
  } else {
    for (const candidatePath of codeSpec.sourcePaths ?? ["yaml", "yamlPipeline", "pipeline_yaml", "rego", "grammar"]) {
      const val = readDotted(getResult, candidatePath);
      if (typeof val === "string") {
        sourceText = val;
        break;
      }
    }
  }

  if (sourceText === undefined) {
    throw new CodeEngineError(
      "UNSUPPORTED_CODE_RESOURCE",
      `Could not locate ${codeSpec.format} source field (${(codeSpec.sourcePaths ?? []).join(" | ")}) in GET response.`,
    );
  }

  canonicalForHash = sourceText;
  return {
    sourceText,
    rawDoc: getResult,
    revision: buildRevisionInfo(getResult, canonicalForHash),
  };
}

function stripEphemeralEnvelopeKeys(val: unknown): unknown {
  if (!val || typeof val !== "object" || Array.isArray(val)) return val;
  const clone = { ...(val as Record<string, unknown>) };
  delete clone.openInHarness;
  return clone;
}

function stableCanonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableCanonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const rec = value as Record<string, unknown>;
    return `{${Object.keys(rec)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableCanonicalJson(rec[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function buildRevisionInfo(getResult: unknown, canonicalContent: string): RevisionInfo {
  const sha256 = createHash("sha256").update(canonicalContent, "utf8").digest("hex");
  const rec = asRecord(getResult);
  const gitV0 = asRecord(rec?.gitDetails);
  const gitV1 = asRecord(rec?.git_details);
  const gitObj = asString(gitV0?.objectId) ?? asString(gitV1?.object_id);
  const gitCommit = asString(gitV0?.commitId) ?? asString(gitV1?.commit_id) ?? asString(rec?.git_commit_id);
  const gitBranch = asString(gitV0?.branch) ?? asString(gitV1?.branch_name);

  const rawStoreType = (asString(rec?.storeType) ?? asString(rec?.store_type) ?? (gitObj || gitCommit ? "REMOTE" : undefined))?.toUpperCase();
  const sourceKind: RevisionInfo["source_kind"] =
    rawStoreType === "REMOTE" ? "REMOTE" : rawStoreType === "INLINE" ? "INLINE" : "API";

  const entityVer =
    typeof rec?.version === "number" || typeof rec?.version === "string"
      ? rec.version
      : typeof asRecord(rec?.service)?.version === "number"
        ? (asRecord(rec?.service)!.version as number)
        : undefined;

  return {
    revision: `rev_${sha256.slice(0, 12)}`,
    sha256,
    source_kind: sourceKind,
    ...(gitObj ? { git_object_id: gitObj } : {}),
    ...(gitCommit ? { git_commit_id: gitCommit } : {}),
    ...(gitBranch ? { git_branch: gitBranch } : {}),
    ...(entityVer !== undefined ? { entity_version: entityVer } : {}),
  };
}

function assertExpectedRevisionMatches(expected: string | undefined, actual: RevisionInfo): void {
  if (!expected) return;
  const trimmed = expected.trim();
  if (!trimmed) return;
  const matches =
    trimmed === actual.revision ||
    trimmed === actual.sha256 ||
    (actual.git_object_id && trimmed === actual.git_object_id) ||
    (actual.git_commit_id && trimmed === actual.git_commit_id);

  if (!matches) {
    throw new CodeEngineError(
      "REVISION_CONFLICT",
      `Revision mismatch: expected "${trimmed}", but current resource is at "${actual.revision}" (sha256 ${actual.sha256.slice(0, 12)}).`,
      [
        {
          code: "REVISION_CONFLICT",
          severity: "error",
          message: `Resource changed since "${trimmed}". Current revision is "${actual.revision}".`,
          remediation: "Re-inspect the resource and create a fresh preview before applying.",
        },
      ],
    );
  }
}

function buildUpdateBodyAndLockInputs(params: {
  getResult: unknown;
  codeSpec: ResourceCodeSpec;
  patchedText?: string;
  patchedObject?: Record<string, unknown>;
  baseRevision: RevisionInfo;
  baseInput: Record<string, unknown>;
}): Record<string, unknown> {
  const { getResult, codeSpec, patchedText, patchedObject, baseRevision, baseInput } = params;
  const nextInput: Record<string, unknown> = { ...baseInput };

  // Propagate Git CAS lock fields automatically when the resource is REMOTE
  if (baseRevision.git_object_id && !nextInput.last_object_id) {
    nextInput.last_object_id = baseRevision.git_object_id;
  }
  if (baseRevision.git_commit_id && !nextInput.last_commit_id) {
    nextInput.last_commit_id = baseRevision.git_commit_id;
  }
  if (baseRevision.git_branch && !nextInput.branch && !nextInput.branch_name) {
    nextInput.branch = baseRevision.git_branch;
  }

  const writeShape = codeSpec.writeShape ?? (codeSpec.format === "json" ? "root_object" : "raw_string");
  if (writeShape === "root_object") {
    nextInput.body = patchedObject;
    return nextInput;
  }

  if (writeShape === "raw_string") {
    nextInput.body = patchedText;
    return nextInput;
  }

  // Object wrapper `{ [field]: patchedText, ...carried }`
  const bodyObj: Record<string, unknown> = {
    [writeShape.field]: patchedText,
  };
  const carrySource = writeShape.carryFromPath ? asRecord(readDotted(getResult, writeShape.carryFromPath)) : asRecord(getResult);
  for (const key of writeShape.carryFields ?? []) {
    const val = carrySource?.[key] ?? asRecord(getResult)?.[key];
    if (val !== undefined) bodyObj[key] = val;
  }
  nextInput.body = bodyObj;
  return nextInput;
}

// ---------------------------------------------------------------------------
// High-Level Public Operations: Inspect, Preview, and Apply
// ---------------------------------------------------------------------------

export async function inspectResourceCode(params: {
  registry: Registry;
  client: HarnessClient;
  def: ResourceDefinition;
  input: Record<string, unknown>;
  resourceId?: string;
  view: "outline" | "select";
  select?: string;
  cursor?: string;
  pageSize?: number;
}): Promise<InspectResponse> {
  const { registry, client, def, input, resourceId, view, select, cursor, pageSize } = params;
  const codeSpec = resolveEffectiveCodeSpec(def);
  const codec = CODEC_REGISTRY.get(codeSpec.format);
  if (!codec) {
    throw new CodeEngineError("UNSUPPORTED_CODE_RESOURCE", `Unsupported code format "${codeSpec.format}".`);
  }

  // Extract `cursor` from params if passed there
  const effectiveCursor = cursor ?? asString(input.cursor);
  const getInput = { ...input };
  delete getInput.view;
  delete getInput.select;
  delete getInput.cursor;

  const getResult = await registry.dispatch(client, def.resourceType, "get", getInput);
  const { sourceText, rawDoc, revision } = extractSourceAndRevision(getResult, codeSpec);
  const revPrefix = revision.sha256.slice(0, 10);

  const inspected = codec.inspect({
    rawDoc,
    sourceText,
    codeSpec,
    revPrefix,
    view: select ? "select" : view,
    select,
    cursor: effectiveCursor,
    pageSize,
  });

  return {
    resource_type: def.resourceType,
    ...(resourceId ? { resource_id: resourceId } : {}),
    format: codeSpec.format,
    view: select ? "select" : view,
    revision,
    total_nodes: inspected.totalNodes,
    nodes: inspected.nodes,
    ...(inspected.truncated ? { truncated: true } : {}),
    ...(inspected.nextCursor ? { next_cursor: inspected.nextCursor } : {}),
  };
}

export interface PreparedPatchCandidate {
  codeSpec: ResourceCodeSpec;
  baseRevision: RevisionInfo;
  candidateSha256: string;
  changes: FieldChangeSummary[];
  diagnostics: CodeDiagnostic[];
  updateInput: Record<string, unknown>;
  operations: readonly PatchOperation[];
}

export async function preparePatchCandidate(params: {
  registry: Registry;
  client: HarnessClient;
  def: ResourceDefinition;
  input: Record<string, unknown>;
  resourceId: string;
  operations: readonly PatchOperation[];
  expectedRevision?: string;
}): Promise<PreparedPatchCandidate> {
  const { registry, client, def, input, resourceId, operations, expectedRevision } = params;
  const codeSpec = resolveEffectiveCodeSpec(def);
  const codec = CODEC_REGISTRY.get(codeSpec.format);
  if (!codec || !codec.supportsWrite || !codec.applyPatches) {
    throw new CodeEngineError(
      "UNSUPPORTED_CODE_RESOURCE",
      `Resource "${def.resourceType}" (${codeSpec.format}) is read-only and does not support code patches.`,
    );
  }

  // Strip write-only keys from the internal GET input so path/query builders see clean read context
  const getInput: Record<string, unknown> = { ...input };
  delete getInput.body;
  delete getInput.patches;
  delete getInput.dry_run;
  delete getInput.preview_token;
  delete getInput.expected_revision;
  delete getInput.idempotency_key;

  const getResult = await registry.dispatch(client, def.resourceType, "get", getInput);
  const { sourceText, rawDoc, revision } = extractSourceAndRevision(getResult, codeSpec);
  assertExpectedRevisionMatches(expectedRevision, revision);

  const revPrefix = revision.sha256.slice(0, 10);
  const patchResult = codec.applyPatches({
    rawDoc,
    sourceText,
    codeSpec,
    revPrefix,
    operations,
  });

  const diagnostics: CodeDiagnostic[] = [...patchResult.diagnostics];

  if (patchResult.changes.length === 0) {
    return {
      codeSpec,
      baseRevision: revision,
      candidateSha256: revision.sha256,
      changes: [],
      diagnostics,
      updateInput: input,
      operations,
    };
  }

  // Run synced JSON Schema validation on candidate YAML / JSON
  const effectiveScope = resolveCodeResourceScope(def, input) as HarnessYamlScope;
  const candidateForSchema =
    codeSpec.format === "yaml" && patchResult.patchedText !== undefined
      ? YAML.parse(patchResult.patchedText)
      : patchResult.patchedObject;

  if (candidateForSchema !== undefined) {
    const schemaDiags = await validateCandidateAgainstSchema({
      candidate: candidateForSchema,
      codeSpec,
      scope: effectiveScope,
    });
    diagnostics.push(...schemaDiags);
  }

  // Optional read-only backend `validateAction` when configured on the resource
  if (
    codeSpec.validateAction &&
    def.executeActions?.[codeSpec.validateAction]?.operationPolicy.risk === "read" &&
    !diagnostics.some((d) => d.severity === "error")
  ) {
    try {
      await registry.dispatchExecute(client, def.resourceType, codeSpec.validateAction, {
        ...getInput,
        resource_id: resourceId,
        body: patchResult.patchedText ?? patchResult.patchedObject,
      });
    } catch (err) {
      diagnostics.push({
        code: "VALIDATION_FAILED",
        severity: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (diagnostics.some((d) => d.severity === "error")) {
    throw new CodeEngineError("VALIDATION_FAILED", diagnostics[0]!.message, diagnostics);
  }

  const canonicalCandidate =
    codeSpec.format === "json"
      ? stableCanonicalJson(patchResult.patchedObject)
      : (patchResult.patchedText ?? "");
  const candidateSha256 = createHash("sha256").update(canonicalCandidate, "utf8").digest("hex");

  const updateInput = buildUpdateBodyAndLockInputs({
    getResult,
    codeSpec,
    patchedText: patchResult.patchedText,
    patchedObject: patchResult.patchedObject,
    baseRevision: revision,
    baseInput: input,
  });

  return {
    codeSpec,
    baseRevision: revision,
    candidateSha256,
    changes: patchResult.changes,
    diagnostics,
    updateInput,
    operations,
  };
}

export async function previewResourcePatch(params: {
  registry: Registry;
  client: HarnessClient;
  def: ResourceDefinition;
  input: Record<string, unknown>;
  resourceId: string;
  operations: readonly PatchOperation[];
  expectedRevision?: string;
  readOnlyMode?: boolean;
  signingKey?: string;
}): Promise<PreviewEditResponse> {
  const { registry, client, def, input, resourceId, operations, expectedRevision, readOnlyMode, signingKey } = params;
  const prepared = await preparePatchCandidate({
    registry,
    client,
    def,
    input,
    resourceId,
    operations,
    expectedRevision,
  });

  if (prepared.changes.length === 0) {
    return {
      status: "no_change",
      resource_type: def.resourceType,
      resource_id: resourceId,
      base_revision: prepared.baseRevision,
      changes: [],
      diagnostics: prepared.diagnostics,
    };
  }

  if (readOnlyMode) {
    return {
      status: "preview_only",
      resource_type: def.resourceType,
      resource_id: resourceId,
      base_revision: prepared.baseRevision,
      candidate_sha256: prepared.candidateSha256,
      changes: prepared.changes,
      diagnostics: [
        ...prepared.diagnostics,
        {
          code: "POLICY_DENIED",
          severity: "info",
          message: "Server is running with HARNESS_READ_ONLY=true; preview succeeded without side effects, but apply is disabled.",
        },
      ],
    };
  }

  const accountId = registry.getAccountId() || client.account;
  const orgId = asString(input.org_id) ?? registry.orgId;
  const projectId = asString(input.project_id) ?? registry.projectId;
  const resourceScope = resolveCodeResourceScope(def, input);

  const issued = issuePreviewToken(
    {
      accountId,
      orgId,
      projectId,
      resourceScope,
      resourceType: def.resourceType,
      resourceId,
      baseRevision: prepared.baseRevision.revision,
      baseSha256: prepared.baseRevision.sha256,
      candidateSha256: prepared.candidateSha256,
      operations: prepared.operations,
    },
    { signingKey },
  );

  return {
    status: "ready",
    resource_type: def.resourceType,
    resource_id: resourceId,
    base_revision: prepared.baseRevision,
    candidate_sha256: prepared.candidateSha256,
    preview_token: issued.token,
    expires_at: issued.expiresAt,
    changes: prepared.changes,
    diagnostics: prepared.diagnostics,
  };
}

export async function commitPreparedPatch(params: {
  registry: Registry;
  client: HarnessClient;
  def: ResourceDefinition;
  resourceId: string;
  prepared: PreparedPatchCandidate;
  auditContext: AuditContext;
  idempotencyKey?: string;
  previewFingerprint: string;
  scopeContext: { accountId: string; orgId?: string; projectId?: string; resourceScope?: string };
}): Promise<ApplyEditResponse> {
  const {
    registry,
    client,
    def,
    resourceId,
    prepared,
    auditContext,
    idempotencyKey,
    previewFingerprint,
    scopeContext,
  } = params;

  if (idempotencyKey) {
    const cached = checkIdempotencyReceipt({
      ...scopeContext,
      resourceType: def.resourceType,
      resourceId,
      idempotencyKey,
      previewFingerprint,
    });
    if (cached) return cached;
  }

  const writeResult = await registry.dispatch(
    client,
    def.resourceType,
    "update",
    prepared.updateInput,
    auditContext,
  );

  const committedRevision: RevisionInfo = {
    revision: `rev_${prepared.candidateSha256.slice(0, 12)}`,
    sha256: prepared.candidateSha256,
    source_kind: prepared.baseRevision.source_kind,
    ...(() => {
      const rec = asRecord(writeResult);
      const gitV0 = asRecord(rec?.gitDetails);
      const gitV1 = asRecord(rec?.git_details);
      const objId = asString(gitV0?.objectId) ?? asString(gitV1?.object_id);
      const commitId = asString(gitV0?.commitId) ?? asString(gitV1?.commit_id);
      return {
        ...(objId ? { git_object_id: objId } : {}),
        ...(commitId ? { git_commit_id: commitId } : {}),
      };
    })(),
  };

  const response: ApplyEditResponse = {
    status: "applied",
    resource_type: def.resourceType,
    resource_id: resourceId,
    base_revision: prepared.baseRevision.revision,
    committed_revision: committedRevision,
    changes: prepared.changes,
    diagnostics: prepared.diagnostics,
    ...(asRecord(writeResult)?.openInHarness
      ? { result: { openInHarness: asRecord(writeResult)!.openInHarness } }
      : {}),
  };

  if (idempotencyKey) {
    recordIdempotencyReceipt({
      ...scopeContext,
      resourceType: def.resourceType,
      resourceId,
      idempotencyKey,
      previewFingerprint,
      response,
    });
  }

  return response;
}

/**
 * Compact human-readable diff summary shown inside interactive `confirmViaElicitation` prompts
 * instead of dumping a raw 2,000-line YAML string.
 */
export function formatPatchDiffForConfirmation(changes: readonly FieldChangeSummary[]): string {
  const lines = changes.slice(0, 12).map((c) => {
    const beforeStr =
      c.before.kind === "absent"
        ? "<absent>"
        : `${JSON.stringify(c.before.value)}${c.before.kind !== "literal" ? ` (${c.before.kind})` : ""}`;
    const afterStr =
      c.after.kind === "absent"
        ? "<removed>"
        : `${JSON.stringify(c.after.value)}${c.after.kind !== "literal" ? ` (${c.after.kind})` : ""}`;
    const tag = c.source === "template_input" ? " [template_input]" : "";
    return `• ${c.target} :: ${c.field}${tag}: ${beforeStr} → ${afterStr}`;
  });
  if (changes.length > 12) {
    lines.push(`• …and ${changes.length - 12} more field change(s)`);
  }
  return lines.join("\n");
}
