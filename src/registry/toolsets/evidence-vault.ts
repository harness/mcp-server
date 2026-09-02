import type { ToolsetDefinition } from "../types.js";
import { isRecord, asString, asNumber, asRecord } from "../../utils/type-guards.js";

const SCS = "/ssca-manager";
const SEARCH_MAX_LEN = 100;

const ATTESTATION_TYPES = [
  "Code",
  "Build",
  "Test",
  "Security",
  "SecurityScan",
  "Deploy",
  "Custom",
  "AIAgent",
] as const;

const ATTESTATION_SOURCES = [
  "Harness",
  "GithubActions",
  "Jenkins",
  "Gitlab",
  "Others",
] as const;

function ensureArray(val: unknown): unknown[] | undefined {
  if (val === undefined || val === null || val === "") return undefined;
  return Array.isArray(val) ? val : [val];
}

function asEpochMs(val: unknown): number | undefined {
  if (typeof val === "number" && Number.isFinite(val)) return val;
  if (typeof val === "string" && val.trim() !== "") {
    const n = Number(val);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

/** Cap search_term so queryParams (`search_term` → `search`) match backend's 100-char limit. */
function normalizeSearchTerm(input: Record<string, unknown>): void {
  const raw = input.search_term;
  if (typeof raw !== "string") return;
  const trimmed = raw.trim();
  input.search_term = trimmed.length > SEARCH_MAX_LEN ? trimmed.slice(0, SEARCH_MAX_LEN) : trimmed;
  if (input.search_term === "") delete input.search_term;
}

/** Build list body. Singular free-text stays on query `search` via search_term. */
export function buildAttestationListBody(input: Record<string, unknown>): Record<string, unknown> {
  normalizeSearchTerm(input);

  const subjectFilter: Array<Record<string, string>> = [];
  const subjectName = asString(input.subject_name);
  if (subjectName) {
    subjectFilter.push({ field_name: "Name", operator: "Contains", value: subjectName });
  }
  const subjectDigest = asString(input.subject_digest);
  if (subjectDigest) {
    subjectFilter.push({ field_name: "Digest", operator: "Equals", value: subjectDigest });
  }

  const body: Record<string, unknown> = {};
  const types = ensureArray(input.types);
  if (types) body.types = types;
  const sources = ensureArray(input.sources);
  if (sources) body.sources = sources;
  const startTime = asEpochMs(input.start_time);
  const endTime = asEpochMs(input.end_time);
  if (startTime !== undefined) body.start_time = startTime;
  if (endTime !== undefined) body.end_time = endTime;
  if (subjectFilter.length > 0) body.subject_filter = subjectFilter;
  if (isRecord(input.scopes)) body.scopes = input.scopes;
  return body;
}

/** Slim list row — drops status, updated_at, raw subjects/execution_context. */
function projectAttestationListItem(raw: unknown): Record<string, unknown> {
  if (!isRecord(raw)) return {};
  const subject = asRecord(raw.subject);
  const digest = subject ? asRecord(subject.digest) : undefined;
  const exec = asRecord(raw.execution_context);

  const out: Record<string, unknown> = {};
  if (raw.id !== undefined) out.id = raw.id;
  if (raw.type !== undefined) out.type = raw.type;
  if (raw.source !== undefined) out.source = raw.source;
  if (asString(raw.description)) out.description = raw.description;
  if (asNumber(raw.created_at) !== undefined) out.created_at = raw.created_at;
  if (asString(raw.org)) out.org = raw.org;
  if (asString(raw.project)) out.project = raw.project;

  const subjectName = asString(raw.subject_name) ?? (subject ? asString(subject.name) : undefined);
  if (subjectName) out.subject_name = subjectName;

  const subjectDigest =
    asString(raw.subject_digest) ??
    (digest ? asString(digest.value) : undefined) ??
    (subject ? asString(subject.sha256) : undefined);
  if (subjectDigest) out.subject_digest = subjectDigest;

  if (asNumber(raw.additional_subject_count) !== undefined) {
    out.additional_subject_count = raw.additional_subject_count;
  }
  if (asString(raw.gitoid_sha256)) out.gitoid_sha256 = raw.gitoid_sha256;

  const pipelineId = asString(raw.pipeline_id) ?? (exec ? asString(exec.pipeline_id) : undefined);
  if (pipelineId) out.pipeline_id = pipelineId;
  const pipelineName = asString(raw.pipeline_name) ?? (exec ? asString(exec.pipeline_name) : undefined);
  if (pipelineName) out.pipeline_name = pipelineName;
  const pipelineExecutionId =
    asString(raw.pipeline_execution_id) ?? (exec ? asString(exec.pipeline_execution_id) : undefined);
  if (pipelineExecutionId) out.pipeline_execution_id = pipelineExecutionId;

  return out;
}

/** Bare array → `{ items, total }` with slim rows (page-length total). */
export function attestationListExtract(raw: unknown): {
  items: unknown[];
  total: number;
  _display_hint: string;
} {
  const items = (Array.isArray(raw) ? raw : []).map(projectAttestationListItem);
  return {
    items,
    total: items.length,
    _display_hint:
      "When showing attestations in a table, ALWAYS include gitoid_sha256 as a column "
      + "(plus type, source, org, project, created_at, description; subject_name when present). "
      + "Never omit gitoid_sha256.",
  };
}

function projectAttestationSubject(raw: unknown): Record<string, unknown> {
  if (!isRecord(raw)) return {};
  const out: Record<string, unknown> = {};
  if (asString(raw.name)) out.name = raw.name;
  const digest = asRecord(raw.digest);
  if (!digest) return out;
  const algorithm = asString(digest.algorithm);
  const value = asString(digest.value);
  if (algorithm) out.digest_algorithm = algorithm;
  if (value) out.digest_value = value;
  return out;
}

/** Slim details — all subjects + signature; pipeline flatten like list; drops artifact_id/payload_type/updated_at. */
export function attestationDetailsExtract(raw: unknown): Record<string, unknown> {
  if (!isRecord(raw)) return {};
  const exec = asRecord(raw.execution_context);

  const out: Record<string, unknown> = {};
  if (raw.type !== undefined) out.type = raw.type;
  if (raw.source !== undefined) out.source = raw.source;
  if (asString(raw.description)) out.description = raw.description;
  if (asString(raw.gitoid_sha256)) out.gitoid_sha256 = raw.gitoid_sha256;
  if (asNumber(raw.created_at) !== undefined) out.created_at = raw.created_at;
  if (asString(raw.signature)) out.signature = raw.signature;

  const subjectsRaw = Array.isArray(raw.subjects) ? raw.subjects : [];
  out.subjects = subjectsRaw.map(projectAttestationSubject);

  const pipelineId = asString(raw.pipeline_id) ?? (exec ? asString(exec.pipeline_id) : undefined);
  if (pipelineId) out.pipeline_id = pipelineId;
  const pipelineName = asString(raw.pipeline_name) ?? (exec ? asString(exec.pipeline_name) : undefined);
  if (pipelineName) out.pipeline_name = pipelineName;
  const pipelineExecutionId =
    asString(raw.pipeline_execution_id) ?? (exec ? asString(exec.pipeline_execution_id) : undefined);
  if (pipelineExecutionId) out.pipeline_execution_id = pipelineExecutionId;

  return out;
}

/** Presigned download URL — surface download_url to the user; do not fetch the blob. */
export function attestationDownloadExtract(raw: unknown): Record<string, unknown> {
  if (!isRecord(raw)) return {};
  const out: Record<string, unknown> = {};
  if (asString(raw.download_url)) out.download_url = raw.download_url;
  if (asNumber(raw.expires_at) !== undefined) out.expires_at = raw.expires_at;
  out._display_hint =
    "ALWAYS show download_url as a clickable download link to the user. "
    + "Do not omit it or only summarize. The URL expires at expires_at (epoch ms).";
  return out;
}

export const evidenceVaultToolset: ToolsetDefinition = {
  name: "evidence_vault",
  aliases: ["evidence-vault"],
  displayName: "Evidence Vault",
  description:
    "Harness Evidence Vault — in-toto attestations (evidences) for SDLC processes "
    + "(build, PR, security scans, signing, deployment, and more).",
  resources: [
    {
      resourceType: "attestation",
      displayName: "Attestation",
      description:
        "Evidence Vault attestation (in-toto evidence). "
        + "List: always show gitoid_sha256 in tables; retain gitoid_sha256 + org + project for get/download. "
        + "Get: harness_get(resource_id=<gitoid_sha256>, org_id, project_id) — lookup by gitoid only. "
        + "Download: harness_execute(action='download', resource_id=<gitoid_sha256>, org_id, project_id) — "
        + "returns a time-limited download_url; ALWAYS show that URL as a clickable link to the user. "
        + "Singular free-text (pipeline, artifact alone, gitoid) → search_term; additional Name → filters.subject_name; "
        + "subject digest → filters.subject_digest (not gitoid). Use item `description` to explain a single attestation. "
        + "Default list scope is account; get/download require org_id and project_id. Requires SCS_EVIDENCE_VAULT.",
      searchAliases: [
        "evidence vault",
        "attestation",
        "evidence",
        "in-toto",
        "SDLC evidence",
        "gitoid",
      ],
      toolset: "evidence_vault",
      scope: "account",
      supportedScopes: ["account", "org", "project"],
      scopeParams: { org: "org", project: "project" },
      identifierFields: ["gitoid_sha256"],
      listFilterFields: [
        { name: "search_term", description: "Singular free-text filter (pipeline, artifact, gitoid, keyword) → query search" },
        { name: "subject_name", description: "Additional Name filter → subject_filter Name/Contains" },
        { name: "subject_digest", description: "Subject content digest → subject_filter Digest/Equals (not gitoid)" },
        { name: "types", description: "Filter by attestation type(s)", enum: [...ATTESTATION_TYPES] },
        { name: "sources", description: "Filter by attestation source(s)", enum: [...ATTESTATION_SOURCES] },
        { name: "start_time", type: "number", description: "Inclusive creation-time start (epoch ms UTC)" },
        { name: "end_time", type: "number", description: "Inclusive creation-time end (epoch ms UTC)" },
        {
          name: "scopes",
          description: "Account/org narrow: org id → project id arrays (empty array = all projects under org)",
        },
        { name: "sort", description: "Sort field", enum: ["created_at", "updated_at"] },
        { name: "order", description: "Sort order", enum: ["ASC", "DESC"] },
      ],
      compactItem: projectAttestationListItem,
      operations: {
        list: {
          method: "POST",
          path: `${SCS}/v2/attestations`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          skipScopeBodyInjection: true,
          queryParams: {
            page: "page",
            size: "limit",
            search_term: "search",
            sort: "sort",
            order: "order",
          },
          defaultQueryParams: {
            sort: "created_at",
            order: "DESC",
          },
          bodyBuilder: buildAttestationListBody,
          responseExtractor: attestationListExtract,
          description: "List attestations (default sort created_at DESC)",
        },
        get: {
          method: "GET",
          path: `${SCS}/v2/orgs/{org}/projects/{project}/attestations/{attestation}/details`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: {
            org_id: "org",
            project_id: "project",
            gitoid_sha256: "attestation",
          },
          defaultQueryParams: { identifier_type: "gitoid_sha256" },
          responseExtractor: attestationDetailsExtract,
          description: "Get attestation details by gitoid_sha256",
        },
      },
      executeActions: {
        download: {
          method: "GET",
          path: `${SCS}/v2/orgs/{org}/projects/{project}/attestations/download-attestation/{digest}`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: {
            org_id: "org",
            project_id: "project",
            gitoid_sha256: "digest",
          },
          responseExtractor: attestationDownloadExtract,
          actionDescription:
            "Get a time-limited pre-signed URL for the DSSE attestation blob. "
            + "ALWAYS show download_url as a clickable link to the user; do not omit it or only summarize.",
          bodySchema: { description: "No body", fields: [] },
        },
      },
    },
  ],
};
