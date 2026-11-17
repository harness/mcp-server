import { scsCleanExtract, scsListExtract } from "../extractors.js";
import { asNumber, asRecord, asString, isRecord } from "../../utils/type-guards.js";

const ARTIFACT_SOURCE_LIST_FIELDS = [
  "id", "source_id", "identifier", "name", "artifact_type", "source_type",
  "registry_type", "registry_url", "artifact_count", "created", "updated",
];

const ARTIFACT_SECURITY_LIST_FIELDS = [
  "id", "artifact_id", "identifier", "name", "tag", "url", "digest",
  "components_count", "vulnerability_count", "sto_issue_count",
  "scorecard", "orchestration", "policy_enforcement",
  "slsa_verification", "signing_status", "updated", "created",
];

const ARTIFACT_COMPONENT_LIST_FIELDS = [
  "purl", "packageUrl", "package_name", "name", "package_version", "version",
  "package_license", "license", "dependency_type",
  "vulnerability_count", "supplier",
  "is_outdated", "is_unmaintained", "eol_status", "eol_score", "latest_version",
];

const COMPONENT_DEPENDENCY_LIST_FIELDS = [
  "name", "version", "purl", "relationship", "relationship_path",
  "vulnerabilities_count",
];

const CODE_REPO_LIST_FIELDS = [
  "id", "repo_id", "identifier", "name", "repo_name", "repo_url",
  "branch", "default_branch", "components_count",
  "vulnerability_count", "updated",
];

export const COMPONENT_ENRICHMENT_FIELDS = [
  "purl", "package_name", "package_version", "version",
  "is_outdated", "is_unmaintained", "is_deprecated", "latest_version",
  "eol_status", "eol_score", "eol_findings", "eol_recommendation",
  "package_license", "vulnerability_count",
  "description",
];

const BOM_VIOLATION_LIST_FIELDS = [
  "name", "version", "purl", "license",
  "violation_type", "violationType", "violation_details", "violationDetails",
  "supplier", "supplier_type", "supplierType", "package_manager", "packageManager",
  "is_exempted", "isExempted", "exemption_id", "exemptionId",
];

export const COMPONENT_DRIFT_LIST_FIELDS = [
  "status", "old_component", "new_component",
];

const REMEDIATION_PR_LIST_FIELDS = [
  "id", "purl", "package_name", "current_version", "target_version",
  "pr_url", "pr_number", "pr_status", "repo_name",
  "base_branch", "remediation_branch",
  "created_at", "updated_at", "trigger_type", "created_by",
];

export const artifactSecurityListExtract = (raw: unknown): unknown => {
  const cleaned = scsListExtract(ARTIFACT_SECURITY_LIST_FIELDS)(raw);
  if (!Array.isArray(cleaned)) return cleaned;
  return cleaned.map((item) => {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      const rec = item as Record<string, unknown>;
      const pe = rec.policy_enforcement as Record<string, unknown> | undefined;
      if (pe?.id) {
        const total =
          (Number(pe.allow_list_violation_count) || 0) +
          (Number(pe.deny_list_violation_count) || 0);
        if (total > 0) {
          rec._next_step =
            `${total} policy violations (summary only). ` +
            `MUST call harness_list(resource_type='scs_bom_violation', enforcement_id='${pe.id}') for details. ` +
            `Do NOT present violation data without that call.`;
        }
      }
    }
    return item;
  });
};

export const artifactSourceListExtract = (raw: unknown): unknown => {
  const cleaned = scsListExtract(ARTIFACT_SOURCE_LIST_FIELDS)(raw);
  if (!Array.isArray(cleaned) || cleaned.length === 0) return cleaned;
  const byType: Record<string, number> = {};
  for (const item of cleaned) {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      const rec = item as Record<string, unknown>;
      const at = rec.artifact_type as Record<string, unknown> | undefined;
      const typeName = (at?.type as string) ?? "UNKNOWN";
      byType[typeName] = (byType[typeName] || 0) + 1;
    }
  }
  return [...cleaned, { _summary: { total: cleaned.length, by_type: byType } }];
};

export const componentDependenciesExtract = (raw: unknown): unknown => {
  const cleaned = scsListExtract(COMPONENT_DEPENDENCY_LIST_FIELDS)(raw);
  if (Array.isArray(cleaned) && cleaned.length === 0) {
    return { _result: "EMPTY", _message: "Zero sub-dependencies found. Do NOT fabricate — report as-is." };
  }
  return cleaned;
};

export const componentVulnerabilityExtract = (raw: unknown): unknown => {
  const cleaned = scsCleanExtract(raw);
  if (Array.isArray(cleaned)) {
    if (cleaned.length === 0) {
      return {
        _result: "EMPTY",
        _message:
          "No CVEs found. If 2+ components return empty, stop querying — enrichment pipeline has not processed this artifact. " +
          "Report aggregate counts from artifact_security instead. NEVER supplement with training-data CVEs.",
      };
    }
    return [...cleaned, { _total_cves: cleaned.length, _reminder: "Report ONLY these CVEs. Do NOT add CVEs from training knowledge." }];
  }
  return cleaned;
};

export const componentRemediationExtract = (raw: unknown): unknown => {
  const cleaned = scsCleanExtract(raw);
  if (cleaned && typeof cleaned === "object" && !Array.isArray(cleaned)) {
    const rec = cleaned as Record<string, unknown>;
    const warnings = rec.remediation_warnings as Array<Record<string, unknown>> | undefined;
    const hasUnavailable = warnings?.some((w) => typeof w.message === "string" && w.message.includes("not available"));
    if (hasUnavailable) {
      rec._reminder = "Remediation not available. Do NOT fabricate versions. Suggest checking upstream project.";
    } else if (rec.recommended_version || rec.current_version) {
      rec._reminder = "Report ONLY these versions. Do NOT supplement from training knowledge.";
    }
  }
  return cleaned;
};

export function chainOfCustodyExtract(raw: unknown): Record<string, unknown> {
  const cleaned = scsCleanExtract(raw);
  if (Array.isArray(cleaned)) {
    return { items: cleaned, total: cleaned.length };
  }
  if (cleaned !== null && typeof cleaned === "object") {
    return cleaned as Record<string, unknown>;
  }
  return { items: [], total: 0 };
}

export const projectSecurityOverviewExtract = (raw: unknown): unknown => {
  const cleaned = scsCleanExtract(raw);
  if (cleaned && typeof cleaned === "object" && !Array.isArray(cleaned)) {
    (cleaned as Record<string, unknown>)._reminder =
      "Report ONLY these numbers. Do NOT calculate percentages, infer trends, or invent metrics.";
  }
  return cleaned;
};

export const bomViolationListExtract = (raw: unknown): unknown => {
  const cleaned = scsListExtract(BOM_VIOLATION_LIST_FIELDS)(raw);
  if (Array.isArray(cleaned) && cleaned.length > 0) {
    const types = new Set<string>();
    for (const item of cleaned) {
      const vt =
        (item as Record<string, unknown>)?.violation_type ??
        (item as Record<string, unknown>)?.violationType;
      if (typeof vt === "string") types.add(vt);
    }
    const typeStr = [...types].join(", ");
    return [
      ...cleaned,
      {
        _total: cleaned.length,
        _violation_types_found: typeStr,
        _reminder: `Results contain ONLY: ${typeStr}. Report exact violation_type. Do NOT reclassify allow-list as deny-list or vice versa.`,
      },
    ];
  }
  return cleaned;
};

export const codeRepoListExtract = (raw: unknown): unknown => {
  const cleaned = scsListExtract(CODE_REPO_LIST_FIELDS)(raw);
  if (Array.isArray(cleaned) && cleaned.length > 0) {
    return [...cleaned, { _total: cleaned.length, _note: `This page contains exactly ${cleaned.length} code repositories.` }];
  }
  return cleaned;
};

export const artifactComponentListExtract = (raw: unknown): unknown => {
  const cleaned = scsListExtract(ARTIFACT_COMPONENT_LIST_FIELDS)(raw);
  if (Array.isArray(cleaned) && cleaned.length > 0) {
    const hasRisk = cleaned.some((c) => {
      const rec = c as Record<string, unknown>;
      return (
        rec.is_outdated === true ||
        rec.is_unmaintained === true ||
        (typeof rec.eol_status === "string" && rec.eol_status !== "NONE" && rec.eol_status !== "")
      );
    });
    if (hasRisk) {
      return [
        ...cleaned,
        {
          _next_step:
            "Components with risk detected. Use scs_component_enrichment (purl) for details, scs_component_remediation (purl) for upgrades.",
        },
      ];
    }
  }
  return cleaned;
};

export const remediationPrListExtract = (raw: unknown): unknown => {
  const items =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>).items
      : raw;
  return scsListExtract(REMEDIATION_PR_LIST_FIELDS)(items);
};

export function sbomDownloadExtract(raw: unknown): Record<string, unknown> {
  if (!isRecord(raw)) return {};
  const out: Record<string, unknown> = {};
  if (asString(raw.download_url)) out.download_url = raw.download_url;
  if (asNumber(raw.expires_at) !== undefined) out.expires_at = raw.expires_at;
  out._display_hint =
    "ALWAYS show download_url as a clickable download link to the user. " +
    "Do not omit it or only summarize. The URL expires at expires_at (epoch ms).";
  return out;
}

export function projectAttestationListItem(raw: unknown): Record<string, unknown> {
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
      "When showing attestations in a table, ALWAYS include gitoid_sha256 as a column " +
      "(plus type, source, org, project, created_at, description; subject_name when present). " +
      "Never omit gitoid_sha256.",
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

export function attestationDownloadExtract(raw: unknown): Record<string, unknown> {
  if (!isRecord(raw)) return {};
  const out: Record<string, unknown> = {};
  if (asString(raw.download_url)) out.download_url = raw.download_url;
  if (asNumber(raw.expires_at) !== undefined) out.expires_at = raw.expires_at;
  out._display_hint =
    "ALWAYS show download_url as a clickable download link to the user. " +
    "Do not omit it or only summarize. The URL expires at expires_at (epoch ms).";
  return out;
}
