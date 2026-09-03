import type { ToolsetDefinition, FilterFieldSpec, ParamsSchema } from "../types.js";
import { passthrough, stoExemptionsExtract, stoRemediationDiffExtract, scsCleanExtract, scsListExtract } from "../extractors.js";
import { HarnessApiError } from "../../utils/errors.js";
import { isRecord, asString, asNumber } from "../../utils/type-guards.js";

/**
 * Injects a redirect hint into every application_security_issue list response.
 * When the LLM lands here while trying to approve/reject an exemption, it sees
 * the hint in the response and pivots to application_security_exemption on the next call.
 */
const securityIssueListExtract = (raw: unknown): unknown => {
  const base = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    ...base,
    _action_hint:
      "If the user asked to APPROVE, REJECT, or PROMOTE an exemption — even by mentioning a CVE or package name — " +
      "STOP using this resource. " +
      "The correct workflow is: " +
      "(1) harness_list(resource_type='application_security_exemption', filters={status:'Pending', search:'<keyword from user prompt>'}). " +
      "(2) Get the exemption_id from _action_id_by_row. " +
      "(3) harness_execute(resource_type='application_security_exemption', action='approve', resource_id=<exemption_id>, body={scope:'CURRENT'|'ORG'|'ACCOUNT'|'PROJECT'}).",
  };
};

/**
 * STO scope override — STO API uses accountId / orgId / projectId
 * instead of the standard NG accountIdentifier / orgIdentifier / projectIdentifier.
 *
 * NOTE: The STO gateway may have auth limitations with x-api-key PATs.
 * If auth errors occur, this may be a Harness platform limitation,
 * not an MCP server issue.
 */
const STO_SCOPE = { account: "accountId", org: "orgId", project: "projectId" } as const;

/**
 * Normalize RemAgentScopeFilters list fields to string[].
 * sto-core goa decodes ArrayOf(String) via repeated query params
 * (`issueTypes=SAST&issueTypes=SECRET`), matching rem-agent's `list(...)` clients.
 * Registry queryParams already forwards arrays as string[]; comma-joined strings
 * would arrive as one enum value and fail goa validation.
 * Accepts array or comma-separated string; returns undefined when empty/unset.
 */
function normalizeRemAgentEnumList(raw: unknown): string[] | undefined {
  if (raw === undefined || raw === null || raw === "") return undefined;
  const parts = Array.isArray(raw)
    ? raw.map((v) => String(v))
    : String(raw).split(",");
  const normalized = parts
    .map((t) => t.trim().toUpperCase())
    .filter((t) => t.length > 0);
  return normalized.length > 0 ? normalized : undefined;
}


function filterFieldsToParamsSchema(fields: FilterFieldSpec[]): ParamsSchema {
  return {
    fields: fields.map((f) => ({
      name: f.name,
      required: f.required ?? false,
      description: f.description,
    })),
  };
}

/**
 * Normalize a PURL for duplicate-detection comparisons.
 *
 * PURL spec: `scheme:type/namespace/name@version?qualifiers#subpath`
 * We want two PURLs that describe the same package (ignoring version,
 * qualifiers, and subpath) to produce the same key.
 *
 * Approach:
 *   1. Drop the subpath (`#...`) and qualifiers (`?...`).
 *   2. Find the version separator `@`, but only if it appears AFTER the
 *      last `/` — this prevents mis-splitting on an encoded/unencoded `@`
 *      that might appear earlier in a namespace or qualifier value.
 *   3. Lowercase for case-insensitive match.
 *
 * Spec-compliant scoped npm purls encode the `@` in the namespace as `%40`
 * (e.g. `pkg:npm/%40angular/core@1.0.0`), so the last-slash heuristic is safe.
 */
export function normalizePurl(s: string): string {
  if (!s) return "";
  const noFragment = s.split("#", 1)[0]!;
  const noQualifiers = noFragment.split("?", 1)[0]!;
  const lastSlash = noQualifiers.lastIndexOf("/");
  const atAfterSlash = noQualifiers.indexOf("@", lastSlash >= 0 ? lastSlash : 0);
  const base = atAfterSlash === -1 ? noQualifiers : noQualifiers.slice(0, atAfterSlash);
  return base.toLowerCase();
}

/**
 * Remediation PR statuses that represent an ACTIVE, blocking PR. An existing
 * PR in one of these states for the same component should prevent a new
 * remediation PR from being created (supersede/close the old one first).
 *
 * Closed / merged / dismissed / error PRs are historical — they must NOT
 * block a later attempt (e.g. a new CVE on the same component, or a
 * superseded upgrade targeting a different version).
 */
const ACTIVE_REMEDIATION_PR_STATUSES = new Set([
  "open",
  "created",
  "pending",
  "in_progress",
  "in-progress",
  "draft",
  "queued",
]);

/** Bounded pagination for the duplicate-PR preflight. */
const PREFLIGHT_PAGE_SIZE = 100;
const PREFLIGHT_MAX_PAGES = 5;

// ── P2-2: Per-resource field lists for list extractors ─────────────────────
// Only actionable fields are retained in list responses to reduce token usage.
// Get operations keep scsCleanExtract (full detail for single-item views).
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

/**
 * Custom extractor for application_security_artifact list responses.
 * Wraps scsListExtract and injects a `_next_step` hint on each artifact that
 * has policy violations, guiding the LLM to call application_security_bom_violation with the
 * correct enforcement_id. Follows the same pattern as runtimeInputExtract._hint.
 */
const artifactSecurityListExtract = (raw: unknown): unknown => {
  const cleaned = scsListExtract(ARTIFACT_SECURITY_LIST_FIELDS)(raw);
  if (!Array.isArray(cleaned)) return cleaned;
  return cleaned.map(item => {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      const rec = item as Record<string, unknown>;
      const pe = rec.policy_enforcement as Record<string, unknown> | undefined;
      if (pe?.id) {
        const total = (Number(pe.allow_list_violation_count) || 0)
                    + (Number(pe.deny_list_violation_count) || 0);
        if (total > 0) {
          rec._next_step = `${total} policy violations (summary only). `
                + `MUST call harness_list(resource_type='application_security_bom_violation', enforcement_id='${pe.id}') for details. `
                + `Do NOT present violation data without that call.`;
        }
      }
    }
    return item;
  });
};

/**
 * Custom extractor for application_security_artifact_source list responses.
 * Appends a `_summary` with item count and breakdown by artifact_type
 * so the LLM doesn't need to manually count large lists.
 */
const artifactSourceListExtract = (raw: unknown): unknown => {
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

/**
 * Custom extractor for application_security_component_dependencies.
 * When the API returns an empty list the agent tends to fabricate dependencies
 * from training data. Inject an explicit "no results" message to prevent this.
 */
const componentDependenciesExtract = (raw: unknown): unknown => {
  const cleaned = scsListExtract(COMPONENT_DEPENDENCY_LIST_FIELDS)(raw);
  if (Array.isArray(cleaned) && cleaned.length === 0) {
    return { _result: "EMPTY", _message: "Zero sub-dependencies found. Do NOT fabricate — report as-is." };
  }
  return cleaned;
};

/**
 * Custom extractor for application_security_component_vulnerability.
 * The agent often supplements real CVE results with CVEs from training data
 * (e.g. fabricating CVE IDs or CVSS scores). Append a count + reminder.
 */
const componentVulnerabilityExtract = (raw: unknown): unknown => {
  const cleaned = scsCleanExtract(raw);
  if (Array.isArray(cleaned)) {
    if (cleaned.length === 0) {
      return { _result: "EMPTY", _message: "No CVEs found. If 2+ components return empty, stop querying — enrichment pipeline has not processed this artifact. "
        + "Report aggregate counts from application_security_artifact instead. NEVER supplement with training-data CVEs." };
    }
    return [...cleaned, { _total_cves: cleaned.length, _reminder: "Report ONLY these CVEs. Do NOT add CVEs from training knowledge." }];
  }
  return cleaned;
};

/**
 * Custom extractor for application_security_component_remediation.
 * The API sometimes returns "remediation guidance is not available" warnings.
 * The agent then invents upgrade versions from training data.
 */
const componentRemediationExtract = (raw: unknown): unknown => {
  const cleaned = scsCleanExtract(raw);
  if (cleaned && typeof cleaned === "object" && !Array.isArray(cleaned)) {
    const rec = cleaned as Record<string, unknown>;
    const warnings = rec.remediation_warnings as Array<Record<string, unknown>> | undefined;
    const hasUnavailable = warnings?.some(w => typeof w.message === "string" && w.message.includes("not available"));
    if (hasUnavailable) {
      rec._reminder = "Remediation not available. Do NOT fabricate versions. Suggest checking upstream project.";
    } else if (rec.recommended_version || rec.current_version) {
      rec._reminder = "Report ONLY these versions. Do NOT supplement from training knowledge.";
    }
  }
  return cleaned;
};

/**
 * Chain of custody get returns a top-level JSON array. MCP harness_get declares an
 * output schema that requires structuredContent (objects only) — wrap as { items, total }.
 */
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

/**
 * Custom extractor for application_security_project_overview.
 * The agent tends to calculate percentages and invent total component counts
 * that are not present in the API response.
 */
const projectSecurityOverviewExtract = (raw: unknown): unknown => {
  const cleaned = scsCleanExtract(raw);
  if (cleaned && typeof cleaned === "object" && !Array.isArray(cleaned)) {
    (cleaned as Record<string, unknown>)._reminder = "Report ONLY these numbers. Do NOT calculate percentages, infer trends, or invent metrics.";
  }
  return cleaned;
};

/**
 * Custom extractor for application_security_bom_violation list responses.
 * The agent confuses allow-list and deny-list violation types.
 */
const bomViolationListExtract = (raw: unknown): unknown => {
  const cleaned = scsListExtract(BOM_VIOLATION_LIST_FIELDS)(raw);
  if (Array.isArray(cleaned) && cleaned.length > 0) {
    const types = new Set<string>();
    for (const item of cleaned) {
      const vt = (item as Record<string, unknown>)?.violation_type
        ?? (item as Record<string, unknown>)?.violationType;
      if (typeof vt === "string") types.add(vt);
    }
    const typeStr = [...types].join(", ");
    return [...cleaned, {
      _total: cleaned.length,
      _violation_types_found: typeStr,
      _reminder: `Results contain ONLY: ${typeStr}. Report exact violation_type. Do NOT reclassify allow-list as deny-list or vice versa.`,
    }];
  }
  return cleaned;
};

/**
 * Custom extractor for application_security_code_repo list responses.
 * Adds a _summary count so both LLM and ref judge have explicit total.
 */
const codeRepoListExtract = (raw: unknown): unknown => {
  const cleaned = scsListExtract(CODE_REPO_LIST_FIELDS)(raw);
  if (Array.isArray(cleaned) && cleaned.length > 0) {
    return [...cleaned, { _total: cleaned.length, _note: `This page contains exactly ${cleaned.length} code repositories.` }];
  }
  return cleaned;
};

/**
 * Custom extractor for application_security_artifact_component list responses.
 * When any returned component has outdated or EOL indicators, append a _next_step
 * hint pointing the LLM toward application_security_component_enrichment and application_security_component_remediation.
 */
const artifactComponentListExtract = (raw: unknown): unknown => {
  const cleaned = scsListExtract(ARTIFACT_COMPONENT_LIST_FIELDS)(raw);
  if (Array.isArray(cleaned) && cleaned.length > 0) {
    const hasRisk = cleaned.some((c) => {
      const rec = c as Record<string, unknown>;
      return rec.is_outdated === true || rec.is_unmaintained === true
        || (typeof rec.eol_status === "string" && rec.eol_status !== "NONE" && rec.eol_status !== "");
    });
    if (hasRisk) {
      return [...cleaned, {
        _next_step: "Components with risk detected. Use application_security_component_enrichment (purl) for details, application_security_component_remediation (purl) for upgrades.",
      }];
    }
  }
  return cleaned;
};

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

const COMPONENT_ENRICHMENT_FIELDS = [
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

const COMPONENT_DRIFT_LIST_FIELDS = [
  "status", "old_component", "new_component",
];

const REMEDIATION_PR_LIST_FIELDS = [
  "id", "purl", "package_name", "current_version", "target_version",
  "pr_url", "pr_number", "pr_status", "repo_name",
  "base_branch", "remediation_branch",
  "created_at", "updated_at", "trigger_type", "created_by",
];

/**
 * Custom extractor for application_security_remediation_pr list responses.
 * The API returns { items: [ {rich PR fields} ] }. If we kept the { items }
 * wrapper, harness-list's post-processing would apply compactItems() which
 * strips non-whitelisted PR fields (purl, pr_number, pr_url, target_version,
 * trigger_type, etc.) and collapse each PR to {}. Flatten to a bare array
 * — matching other SCS list extractors — so compactItems is bypassed, and
 * pick PR-specific fields explicitly.
 */
const remediationPrListExtract = (raw: unknown): unknown => {
  const items = (raw && typeof raw === "object" && !Array.isArray(raw))
    ? (raw as Record<string, unknown>).items
    : raw;
  return scsListExtract(REMEDIATION_PR_LIST_FIELDS)(items);
};

/**
 * Normalize a value to an array. LLMs frequently send scalar strings
 * (e.g. "CIS") instead of arrays (["CIS"]) for array-typed parameters.
 * The upstream SCS API rejects bare strings with a 400.
 */
function ensureArray(val: unknown): unknown[] | undefined {
  if (val === undefined || val === null) return undefined;
  return Array.isArray(val) ? val : [val];
}

/**
 * SCS (Software Supply Chain Security) API base path.
 * The SSCA manager API embeds org/project in the URL path rather than query params.
 * Endpoints use /v1/ (most) or /v2/ (chain of custody).
 */
const SCS = "/ssca-manager";

/** Presigned SBOM download URL — surface download_url to the user; do not fetch the blob. */
export function sbomDownloadExtract(raw: unknown): Record<string, unknown> {
  if (!isRecord(raw)) return {};
  const out: Record<string, unknown> = {};
  if (asString(raw.download_url)) out.download_url = raw.download_url;
  if (asNumber(raw.expires_at) !== undefined) out.expires_at = raw.expires_at;
  out._display_hint =
    "ALWAYS show download_url as a clickable download link to the user. "
    + "Do not omit it or only summarize. The URL expires at expires_at (epoch ms).";
  return out;
}

export const applicationSecurityToolset: ToolsetDefinition = {
  name: "application_security",
  aliases: ["sto", "scs"],
  displayName: "Application Security",
  description:
    "Harness Application Security — unified Security Testing Orchestration (STO) and Software Supply Chain Assurance (SCS). " +
    "STO: scan security issues, vulnerabilities, exemptions (single + bulk), per-pipeline security views, and remediation diffs. " +
    "SCS: artifact sources, artifact/code-repo security posture, SBOMs and SBOM drift, components and dependency trees, OSS risk, " +
    "CIS/OWASP compliance, BOM enforcement (policy) violations, remediation suggestions, and remediation PR creation/auto-PR config. " +
    "To modify SBOM/SCS pipeline steps (e.g., change SBOM tool from Syft to CycloneDX, update source image), use the pipeline resource from the pipelines toolset: " +
    "harness_get(resource_type='pipeline') → edit YAML → harness_update(resource_type='pipeline'). " +
    "SCS step types: SscaOrchestration, SscaEnforcement, SscaCompliance, SscaArtifactSigning, SscaArtifactVerification.",
  resources: [
    // ── Security Issues ────────────────────────────────────────────────
    {
      resourceType: "application_security_issue",
      aliases: ["security_issue"],
      searchAliases: ["sto"],
      displayName: "Security Issue",
      description:
        "STOP — IF THE USER WANTS TO APPROVE, REJECT, OR PROMOTE AN EXEMPTION, USE resource_type='application_security_exemption' INSTEAD. " +
        "This 'application_security_issue' resource only lists raw vulnerabilities from scans — it has NO approve/reject/promote actions. " +
        "Security vulnerability/issue from scan results. Supports list with extensive filtering by severity, type, target, pipeline, and scan tool.",
      toolset: "application_security",
      scope: "project",
      scopeParams: STO_SCOPE,
      identifierFields: ["issue_id"],
      listFilterFields: [
        { name: "search", description: "Free-text search (issue ID, CVE, component name, keyword)" },
        { name: "severity_codes", description: "Comma-separated severity levels", enum: ["Critical", "High", "Medium", "Low", "Info"] },
        { name: "issue_types", description: "Comma-separated issue types", enum: ["SAST", "DAST", "SCA", "IAC", "SECRET", "MISCONFIG"] },
        { name: "target_ids", description: "Comma-separated target IDs" },
        { name: "target_types", description: "Comma-separated target types", enum: ["configuration", "container", "instance", "repository"] },
        { name: "pipeline_ids", description: "Comma-separated pipeline IDs" },
        { name: "scan_tools", description: "Comma-separated scan tools (e.g. aqua-trivy, semgrep)" },
        { name: "exemption_statuses", description: "Comma-separated statuses", enum: ["None", "Pending", "Approved", "Rejected", "Expired"] },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/sto/issues/{issueId}",
      operations: {
        list: {
          method: "GET",
          path: "/sto/api/v2/frontend/all-issues/issues",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            search: "search",
            severity_codes: "severityCodes",
            issue_types: "issueTypes",
            target_ids: "targetIds",
            target_types: "targetTypes",
            pipeline_ids: "pipelineIds",
            scan_tools: "scanTools",
            exemption_statuses: "exemptionStatuses",
            page: "page",
            size: "pageSize",
          },
          preflight: async ({ input }) => {
            // LLMs sometimes pass scope keywords as literal org_id/project_id
            // values (e.g. "approve for org" → org_id="org"). These are never
            // valid Harness identifiers, so strip them and fall back to config
            // defaults rather than letting the request fail with a confusing 500.
            const SCOPE_KEYWORDS = new Set(["org", "account", "project", "organization"]);
            if (typeof input.org_id === "string" && SCOPE_KEYWORDS.has(input.org_id.toLowerCase())) {
              delete input.org_id;
            }
            if (typeof input.project_id === "string" && SCOPE_KEYWORDS.has(input.project_id.toLowerCase())) {
              delete input.project_id;
            }
          },
          responseExtractor: securityIssueListExtract,
          description: "List security issues with filtering by severity, type, target, pipeline, and scan tool",
        },
      },
    },

    // ── Security Issue Filters ─────────────────────────────────────────
    {
      resourceType: "application_security_issue_filter",
      aliases: ["security_issue_filter"],
      searchAliases: ["sto"],
      displayName: "Security Issue Filter",
      description:
        "Available filter values (targets, scan tools, pipelines) for security issues. Use this to discover valid filter values before listing issues.",
      toolset: "application_security",
      scope: "project",
      scopeParams: STO_SCOPE,
      identifierFields: [],
      operations: {
        list: {
          method: "GET",
          path: "/sto/api/v2/frontend/all-issues/filters",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            page: "page",
            size: "pageSize",
          },
          responseExtractor: passthrough,
          description: "Get available filter values for security issues (targets, scan tools, pipelines)",
        },
      },
    },

    // ── Pipeline Security Issues (per-execution view) ─────────────────
    {
      resourceType: "application_security_pipeline_issue",
      aliases: ["pipeline_security_issue"],
      displayName: "Pipeline Security Issue",
      description:
        "Security issues from STO's per-execution **Pipeline Security view** — the issues shown on a "
        + "specific pipeline execution's Security tab. Keyed by REQUIRED `execution_id`. Use this "
        + "(not `application_security_issue`, which is the cross-execution Issues page) when the user asks about "
        + "issues that caused a specific pipeline run to fail, or when correlating to a policy "
        + "evaluation. Response merges `existing` + `new` issue summaries into a single `items[]` "
        + "(each row tagged with `_partition`) and exposes per-partition counts + matching-step "
        + "metadata as side-channels. PAGINATION: this endpoint uses DIFF pagination — not standard "
        + "`page`/`size`. Use `page_existing` / `page_size_existing` (for the 'existing' partition) "
        + "and `page_new` / `page_size_new` (for the 'new' partition) independently. Each defaults to "
        + "page 0, size 50 (max 100). For most chat-driven workflows, calling once with both sizes "
        + "set to 100 returns the full page of each partition.",
      searchAliases: ["pipeline security", "execution issues", "security tab", "issues for execution", "issues that failed pipeline", "sto"],
      relatedResources: [
        { resourceType: "application_security_pipeline_step", relationship: "sibling", description: "REQUIRED when creating target-scoped exemptions: issue rows here only carry `targetVariantName` (a display string like 'repo:branch'), NOT a raw `target_id`. List application_security_pipeline_step for the same execution_id and join on `targetName:targetVariant === issue.targetVariantName` to resolve the raw `target_id` you need for harness_create body.target_id. Also used to attribute an issue to its source scanner." },
        { resourceType: "application_security_exemption", relationship: "child", description: "Create exemptions for issues from this view (one per issue_id). For target-scope, first resolve target_id via application_security_pipeline_step (see sibling above)." },
        { resourceType: "application_security_exemption_bulk", relationship: "child", description: "Bulk-create exemptions for many issues from this view in a single all-or-none transaction (≤100 items). For target-scope, pre-resolve target_id via application_security_pipeline_step." },
        { resourceType: "policy_evaluation", relationship: "sibling", description: "Find OPA policy evaluations that ran on the same execution_id to learn why the pipeline was denied." },
      ],
      toolset: "application_security",
      scope: "project",
      scopeParams: STO_SCOPE,
      identifierFields: ["issue_id"],
      listFilterFields: [
        { name: "execution_id", description: "REQUIRED. Pipeline plan execution ID (e.g. 'ehsPKtczTRO5CUDAt-NR'). Identifies which execution's Pipeline Security view to read.", required: true },
        { name: "stages", description: "Comma-separated stage identifiers (or parent.stage). Narrows issues to specific pipeline stages." },
        { name: "steps", description: "Comma-separated step identifiers as 'stage.step' or 'parent.stage.step'. Narrows issues to specific scan steps (Trivy / Semgrep / …)." },
        { name: "target_ids", description: "Comma-separated 22-char target IDs." },
        { name: "target_types", description: "Comma-separated target types.", enum: ["repository", "container", "instance", "configuration"] },
        { name: "product_names", description: "Comma-separated scanner product names (e.g. 'owasp,zap')." },
        { name: "severity_codes", description: "Comma-separated severities.", enum: ["Critical", "High", "Medium", "Low", "Info"] },
        { name: "include_exempted", type: "boolean", description: "Include already-exempted issues. Defaults to true on the API; pass false when looking for unexempted candidates." },
        { name: "search", description: "Free-text search across issue title / CWE / CVE." },
        { name: "issue_types", description: "Comma-separated issue types.", enum: ["SAST", "DAST", "SCA", "IAC", "SECRET", "MISCONFIG", "BUG_SMELLS", "CODE_SMELLS", "CODE_COVERAGE", "EXTERNAL_POLICY", "UNKNOWN"] },
        { name: "status", description: "Comma-separated issue statuses.", enum: ["ACTIVE", "REMEDIATED", "PENDING_EXEMPTION", "EXEMPTED", "PARTIALLY_EXEMPTED", "REJECTED"] },
        { name: "origins", description: "Comma-separated origin layers.", enum: ["app", "base", "no_layer"] },
        { name: "origin_statuses", description: "Comma-separated origin statuses.", enum: ["approved", "unapproved"] },
        { name: "epss", description: "EPSS probability bucket (single select).", enum: ["all", "gte_15", "gte_5", "gte_1", "na"] },
        { name: "epss_percentile", description: "EPSS percentile bucket (single select).", enum: ["all", "gte_99", "gte_90", "gte_80", "na"] },
        { name: "severity_overridden", description: "Filter by whether severity was manually overridden.", enum: ["Yes", "No"] },
        { name: "reachability", description: "Reachability filter.", enum: ["reachable", "unknown-reachability"] },
        { name: "exploitability", description: "Exploitability filter.", enum: ["yes", "no"] },
        // Diff pagination — this endpoint paginates `existing` and `new` partitions independently.
        // See DiffPaginationRequestParams in sto-core/design/frontend.go.
        { name: "page_existing", type: "number", description: "0-indexed page number for the 'existing' issue partition (defaults to 0). The endpoint paginates existing and new issues independently — NOT a single combined cursor." },
        { name: "page_size_existing", type: "number", description: "Page size for the 'existing' partition (1–100, default 50)." },
        { name: "page_new", type: "number", description: "0-indexed page number for the 'new' issue partition (defaults to 0)." },
        { name: "page_size_new", type: "number", description: "Page size for the 'new' partition (1–100, default 50)." },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/sto/executions/{executionId}/pipeline",
      operations: {
        list: {
          method: "GET",
          path: "/sto/api/v2/frontend/pipeline-security/issues",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            execution_id: "executionId",
            stages: "stages",
            steps: "steps",
            target_ids: "targetIds",
            target_types: "targetTypes",
            product_names: "productNames",
            severity_codes: "severityCodes",
            include_exempted: "includeExempted",
            search: "search",
            issue_types: "issueTypes",
            status: "status",
            origins: "origins",
            origin_statuses: "originStatuses",
            epss: "epss",
            epss_percentile: "epssPercentile",
            severity_overridden: "severityOverridden",
            reachability: "reachability",
            exploitability: "exploitability",
            // Diff pagination — NOT standard page/pageSize. This endpoint splits
            // pagination between the 'existing' and 'new' partitions.
            page_existing: "pageExisting",
            page_size_existing: "pageSizeExisting",
            page_new: "pageNew",
            page_size_new: "pageSizeNew",
          },
          responseExtractor: (raw: unknown): unknown => {
            // Pipeline Security endpoint (sto-core PipelineSecurityIssuesResult) returns:
            //   { existing: { issues: [...], pagination: { totalItems, ... } },
            //     new:      { issues: [...], pagination: { totalItems, ... } },
            //     counts: {...}, matchingSteps: [...] }
            // NOTE: the partition payload key is `issues` (not `items`) and totals live
            // under `pagination.totalItems` (not a top-level `totalItems`). We flatten
            // existing+new into a single items[] for prompt consumption and preserve
            // the partitioned counts + matchingSteps as side-channels.
            if (raw === null || raw === undefined || typeof raw !== "object") return raw;
            type Partition = {
              issues?: unknown[];
              items?: unknown[]; // defensive: handle older or alternate shapes
              pagination?: { totalItems?: number };
              totalItems?: number; // defensive
            };
            const r = raw as {
              existing?: Partition;
              new?: Partition;
              counts?: unknown;
              matchingSteps?: unknown;
            };
            const partitionItems = (p: Partition | undefined): unknown[] => {
              if (!p) return [];
              if (Array.isArray(p.issues)) return p.issues;
              if (Array.isArray(p.items)) return p.items;
              return [];
            };
            const partitionTotal = (p: Partition | undefined, fallback: number): number => {
              if (!p) return fallback;
              if (typeof p.pagination?.totalItems === "number") return p.pagination.totalItems;
              if (typeof p.totalItems === "number") return p.totalItems;
              return fallback;
            };
            const existingItems = partitionItems(r.existing);
            const newItems = partitionItems(r.new);
            // Tag each row so the prompt can tell which partition it came from.
            const tagged = [
              ...existingItems.map(it => (typeof it === "object" && it !== null ? { ...it, _partition: "existing" } : it)),
              ...newItems.map(it => (typeof it === "object" && it !== null ? { ...it, _partition: "new" } : it)),
            ];
            const existingTotal = partitionTotal(r.existing, existingItems.length);
            const newTotal = partitionTotal(r.new, newItems.length);
            // Surface one-line breadcrumbs for the two IDs that are NOT on the
            // issue row but ARE required for narrower-scope exemptions. Without
            // these hints, agents spend multiple turns chasing the raw IDs
            // through unrelated endpoints (application_security_issue_filter, harness_get
            // on the issue, etc).
            const targetIdHint =
              "Each row carries `targetVariantName` (display string like 'repo:branch') but NOT a raw `target_id`. " +
              "For target-scoped exemptions, also call harness_list(resource_type='application_security_pipeline_step', " +
              "filters={execution_id:<same id>}) and join on `targetName:targetVariant === issue.targetVariantName` " +
              "to resolve the `target_id` you pass to harness_create body.target_id.";
            const pipelineIdHint =
              "Issue rows do NOT carry `pipeline_id` either. For pipeline-scoped exemptions: " +
              "(1) if a Harness pipeline execution URL was pasted, `pipeline_id` is already auto-extracted from the URL path; " +
              "(2) otherwise call harness_get(resource_type='execution', resource_id=<execution_id>) once and read `pipelineIdentifier`. " +
              "Do NOT iterate through harness_list(resource_type='pipeline') — the execution-to-pipeline link is 1:1.";
            return {
              items: tagged,
              total: existingTotal + newTotal,
              existing_total: existingTotal,
              new_total: newTotal,
              counts: r.counts,
              matching_steps: r.matchingSteps,
              _target_id_lookup_hint: targetIdHint,
              _pipeline_id_lookup_hint: pipelineIdHint,
            };
          },
          skipCompact: true,
          description: "List the security issues shown on a specific pipeline execution's Security tab. Requires execution_id. Flattens existing + new partitions into items[]; each item is tagged with _partition.",
        },
      },
    },

    // ── Pipeline Security Steps (scan steps for an execution) ─────────
    {
      resourceType: "application_security_pipeline_step",
      aliases: ["pipeline_security_step"],
      displayName: "Pipeline Security Scan Step",
      description:
        "STO scan steps (Trivy / Semgrep / Snyk / …) that ran inside a specific pipeline execution. "
        + "Use to attribute Pipeline Security issues to their source scanner, or to narrow a "
        + "`application_security_pipeline_issue` query by `steps`. Keyed by REQUIRED `execution_id`. Response also "
        + "carries `reachabilityFlag` / `exploitabilityFlag` indicating whether reachability or "
        + "exploitability analysis is available for this execution.",
      searchAliases: ["scan steps", "sto steps", "pipeline scan steps", "execution scan steps", "sto"],
      relatedResources: [
        { resourceType: "application_security_pipeline_issue", relationship: "sibling", description: "List issues for the same execution; filter by 'steps' to scope to one scanner." },
        { resourceType: "application_security_exemption", relationship: "sibling", description: "Use this resource to look up `target_id` when creating target-scoped exemptions: application_security_pipeline_issue rows expose `targetVariantName` (a display string) but not the raw `target_id`. Build a `{targetName:targetVariant → targetId}` map from this response and join against each issue row's `targetVariantName`." },
        { resourceType: "application_security_exemption_bulk", relationship: "sibling", description: "Same target_id lookup pattern when bulk-exempting from a specific execution." },
      ],
      toolset: "application_security",
      scope: "project",
      scopeParams: STO_SCOPE,
      identifierFields: [],
      listFilterFields: [
        { name: "execution_id", description: "REQUIRED. Pipeline plan execution ID.", required: true },
      ],
      operations: {
        list: {
          method: "GET",
          path: "/sto/api/v2/frontend/pipeline-security/steps",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            execution_id: "executionId",
          },
          responseExtractor: (raw: unknown): unknown => {
            // Response: { steps: [...], reachabilityFlag: bool, exploitabilityFlag: bool }
            if (raw === null || raw === undefined || typeof raw !== "object") return raw;
            const r = raw as { steps?: unknown[]; reachabilityFlag?: boolean; exploitabilityFlag?: boolean };
            const steps = Array.isArray(r.steps) ? r.steps : [];
            return {
              items: steps,
              total: steps.length,
              reachability_flag: r.reachabilityFlag ?? false,
              exploitability_flag: r.exploitabilityFlag ?? false,
            };
          },
          skipCompact: true,
          description: "List STO scan steps that ran in a given pipeline execution. Use to map issues back to their source scanner.",
        },
      },
    },

    // ── Security Exemptions ────────────────────────────────────────────
    {
      resourceType: "application_security_exemption",
      aliases: ["security_exemption"],
      displayName: "Security Exemption",
      searchAliases: ["approve", "reject", "promote", "waiver", "exception", "exempt", "approval", "sto"],
      description: "Security issue exemption/waiver. THIS is the resource for exemption approval/rejection workflows — even when the user mentions a vulnerability title like 'SQL Injection'. Supports list (POST with status filter), create, and approve/reject actions. Approval with body.scope='ACCOUNT', 'ORG', or 'PROJECT' routes through STO promotion internally. " +
        "CRITICAL SCOPE DISTINCTION: There are TWO different scope concepts that must NOT be confused: " +
        "(1) LISTING scope — application_security_exemption ALWAYS lists at project scope. NEVER pass resource_scope='account' or resource_scope='org' to harness_list. " +
        "When HARNESS_ORG / HARNESS_PROJECT defaults are unset (common in multi-user HTTP mode), pass org_id and project_id on every harness_list call — use the caller's current org/project when available. " +
        "(2) APPROVAL scope — the scope the exemption is approved AT, passed as body.scope to harness_execute. This CAN be 'ACCOUNT', 'ORG', 'PROJECT', or 'CURRENT'. " +
        "If harness_list returns an error about 'account scope not supported', that means you passed resource_scope='account' to the LIST call — NOT that account-level approval is impossible. Fix: remove resource_scope from the list call, keep project org_id/project_id, then approve with body={scope:'ACCOUNT'}. " +
        "Phrases like 'for org' or 'for account' refer to the APPROVAL SCOPE (body.scope on execute), NOT to resource_scope on list. " +
        "LIST FILTER: use filters.status (not exemption_statuses — that field belongs to application_security_issue). " +
        "PAGINATION CONTRACT: (1) Pass `size: 5` explicitly inside `filters` for the first call — the recommended default for this resource is 5, not the global 20. (2) Page is 0-indexed: page=0 → items 1–5, page=1 → items 6–10. (3) CRITICAL — `size` AND all other filters (status, search, …) MUST stay identical across every page in a session. The backend computes offset = page × size, so altering either silently shifts the dataset. (4) For 'next N' requests, increment `page` by 1 and keep `size` constant. If the user asks for 'next 10' after showing 5, make TWO sequential calls with the same size=5 — do NOT bump size mid-session. (5) After each response, read `_nextPageHint` — it spells out the exact follow-up call to make.",
      toolset: "application_security",
      scope: "project",
      scopeParams: STO_SCOPE,
      identifierFields: ["exemption_id"],
      listFilterFields: [
        { name: "status", description: "Exemption status filter — SINGLE value only, not comma-separated. Make separate calls for each status.", enum: ["Pending", "Approved", "Rejected", "Expired", "Canceled"], required: true },
        { name: "search", description: "Free-text search for issue/exemption titles" },
        { name: "size", type: "number", description: "Exemptions per page (recommended: 5, max: 50). Always pass explicitly inside `filters` — `harness_list`'s global default of 20 is too large for this resource. Must remain constant across pages in a session." },
        { name: "page", type: "number", description: "0-indexed page number. Increment by 1 for each 'next' request — never repeat the same value." },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/sto/exemptions",
      operations: {
        list: {
          method: "POST",
          path: "/sto/api/v2/frontend/exemptions",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            status: "status",
            search: "search",
            page: "page",
            size: "pageSize",
          },
          bodyBuilder: () => ({}),
          preflight: async ({ input }) => {
            // Security exemptions ALWAYS list at project scope.
            // Strip resource_scope='account'/'org' silently — these are
            // approval scope intents (for harness_execute), not list scopes.
            // Without this, the registry rejects the call with "account scope
            // not supported" which causes the LLM to forget the user's
            // original account-level approval intent and fall back to CURRENT.
            const wideScopes = new Set(["account", "org", "organization"]);
            if (typeof input.resource_scope === "string" && wideScopes.has(input.resource_scope.toLowerCase())) {
              delete input.resource_scope;
            }

            const SCOPE_KEYWORDS = new Set(["org", "account", "project", "organization"]);
            const rawOrg = input.org_id;
            if (typeof rawOrg === "string" && SCOPE_KEYWORDS.has(rawOrg.toLowerCase())) {
              delete input.org_id;
            }
            const rawProject = input.project_id;
            if (typeof rawProject === "string" && SCOPE_KEYWORDS.has(rawProject.toLowerCase())) {
              delete input.project_id;
            }

            const STO_EXEMPTION_SIZE_MAX = 50;
            const rawSize = input.size;
            if (rawSize !== undefined) {
              if (typeof rawSize !== "number" || !Number.isInteger(rawSize)) {
                throw new Error(`application_security_exemption: 'size' must be an integer, got ${typeof rawSize}.`);
              }
              if (rawSize < 1) {
                throw new Error(`application_security_exemption: 'size' must be >= 1, got ${rawSize}.`);
              }
              if (rawSize > STO_EXEMPTION_SIZE_MAX) {
                throw new Error(
                  `application_security_exemption: 'size' must be <= ${STO_EXEMPTION_SIZE_MAX}, got ${rawSize}. ` +
                    `harness_list allows size up to 100 globally, but this STO endpoint caps at ${STO_EXEMPTION_SIZE_MAX} ` +
                    `(recommended: 5). Pass size inside filters and keep it constant across pages.`,
                );
              }
            }
            const rawPage = input.page;
            if (rawPage !== undefined) {
              if (typeof rawPage !== "number" || !Number.isInteger(rawPage)) {
                throw new Error(`application_security_exemption: 'page' must be an integer, got ${typeof rawPage}.`);
              }
              if (rawPage < 0) {
                throw new Error(`application_security_exemption: 'page' must be >= 0 (0-indexed), got ${rawPage}.`);
              }
            }
          },
          responseExtractor: stoExemptionsExtract,
          skipCompact: true,
          description: "List security exemptions filtered by status. ALWAYS uses project scope — NEVER pass resource_scope='account' or resource_scope='org'. When defaults are unset, pass org_id and project_id explicitly. Use filters.status, not exemption_statuses. Recommended `size`: 5 (pass explicitly via `filters` — the shared default of 20 is too large for this resource). Response includes items[], total, page, pageSize, totalPages and `_nextPageHint`. ALWAYS read `_nextPageHint` — it spells out the exact follow-up call, including all active filters. NEVER re-use the same page for a 'next' request, NEVER drop filters between pages, and NEVER change size mid-session.",
        },
        create: {
          method: "POST",
          path: "/sto/api/v2/exemptions",
          operationPolicy: { risk: "high_write", retryPolicy: "do_not_retry" },
          preflight: async ({ client, input }) => {
            const body = (input.body as Record<string, unknown> | undefined) ?? {};
            // Validate required fields here against raw input (snake_case) rather
            // than relying on the generic registry check which runs on the built body.
            const requiredFields = ["issue_id", "type", "reason"] as const;
            const missing = requiredFields.filter(f => body[f] === undefined);
            if (missing.length > 0) {
              throw new Error(
                `Missing required fields for application_security_exemption: ${missing.join(", ")}. ` +
                `Use harness_describe(resource_type="application_security_exemption") to see the schema.`
              );
            }
            body.requester_id = await client.getCurrentUserId();
            input.body = body;
          },
          bodyBuilder: (input) => {
            const b = (input.body as Record<string, unknown> | undefined) ?? {};
            return {
              issueId: b.issue_id,
              type: b.type,
              reason: b.reason,
              requesterId: b.requester_id,
              exemptFutureOccurrences: true,
              pendingChanges: { durationDays: b.duration_days ?? 30 },
              ...(b.occurrences ? { occurrences: b.occurrences } : {}),
              ...(b.scan_id ? { scanId: b.scan_id } : {}),
              ...(b.pipeline_id ? { pipelineId: b.pipeline_id } : {}),
              ...(b.target_id ? { targetId: b.target_id } : {}),
              ...(b.search ? { search: b.search } : {}),
              ...(b.link ? { link: b.link } : {}),
              ...(b.expiration ? { expiration: b.expiration } : {}),
            };
          },
          responseExtractor: passthrough,
          description: "Create a new security exemption for an issue. requesterId is always derived from the authenticated PAT and exemptFutureOccurrences is always true.",
          bodySchema: {
            description: "Exemption creation fields. Required: issue_id, type, reason.",
            fields: [
              { name: "issue_id", type: "string", required: false, description: "REQUIRED. Issue ID to exempt (22-char Harness ID)." },
              { name: "type", type: "string", required: false, description: "REQUIRED. Exemption type: Compensating Controls | Acceptable Use | Acceptable Risk | False Positive | Fix Unavailable | Other." },
              { name: "reason", type: "string", required: false, description: "REQUIRED. Text justification for the exemption (max 1024 chars)." },
              { name: "duration_days", type: "number", required: false, description: "Exemption duration in days (default: 30)." },
              { name: "occurrences", type: "array", required: false, description: "Specific occurrence IDs (integers) to exempt.", itemType: "number" },
              { name: "scan_id", type: "string", required: false, description: "Scan ID — exempts all occurrences in that scan." },
              { name: "pipeline_id", type: "string", required: false, description: "Pipeline ID scope. Use with org/project scope." },
              { name: "target_id", type: "string", required: false, description: "Target ID scope. Cannot be combined with pipeline scope fields." },
              { name: "search", type: "string", required: false, description: "Search filter for issue occurrences (e.g. component/CWE expressions)." },
              { name: "link", type: "string", required: false, description: "Related ticket or reference URL." },
              { name: "expiration", type: "number", required: false, description: "Unix timestamp at which this exemption expires." },
            ],
          },
        },
      },
      executeActions: {
        approve: {
          method: "PUT",
          path: "/sto/api/v2/exemptions/{exemptionId}/approve",
          operationPolicy: { risk: "high_write", retryPolicy: "do_not_retry" },
          pathParams: { exemption_id: "exemptionId" },
          // pathBuilder dynamically picks /approve vs /promote based on body.scope.
          // 'CURRENT' (or missing) → /approve; anything else → /promote.
          pathBuilder: (input) => {
            const exemptionId = encodeURIComponent(String(input.exemption_id ?? ""));
            const b = (input.body as Record<string, unknown> | undefined) ?? {};
            const scope = ((b.scope ?? input.scope) as string | undefined)?.toUpperCase();
            const elevating = scope && scope !== "CURRENT";
            const endpoint = elevating ? "promote" : "approve";
            return `/sto/api/v2/exemptions/${exemptionId}/${endpoint}`;
          },
          preflight: async ({ client, input }) => {
            const b = ((input.body as Record<string, unknown> | undefined) ?? {});
            const rawScope = ((b.scope ?? input.scope) as string | undefined)?.toUpperCase();

            if (!rawScope) {
              throw new Error(
                "application_security_exemption approve: body.scope is required. " +
                "Pass one of: 'CURRENT' (approve at the exemption's existing scope) | 'ORG' | 'ACCOUNT' | 'PROJECT' (elevate + approve). " +
                "If the user said plain 'approve this exemption', pass body={scope:'CURRENT'}. " +
                "If the user said 'approve for org' / 'org-wide', pass body={scope:'ORG'}. " +
                "If the user said 'approve for account' / 'account-wide', pass body={scope:'ACCOUNT'}.",
              );
            }
            const allowed = ["CURRENT", "ACCOUNT", "ORG", "PROJECT"] as const;
            if (!(allowed as readonly string[]).includes(rawScope)) {
              throw new Error(
                `application_security_exemption approve: invalid scope '${rawScope}'. Must be one of: ${allowed.join(", ")}.`,
              );
            }

            if (rawScope === "ACCOUNT") {
              input.org_id = "";
              input.project_id = "";
            } else if (rawScope === "ORG") {
              input.project_id = "";
            }

            if (!b.approver_id) {
              b.approver_id = await client.getCurrentUserId();
              input.body = b;
            }
          },
          bodyBuilder: (input) => {
            const b = (input.body as Record<string, unknown> | undefined) ?? {};
            const rawScope = ((b.scope ?? input.scope) as string | undefined)?.toUpperCase();
            const elevating = rawScope && rawScope !== "CURRENT";
            return {
              approverId: b.approver_id,
              ...(elevating ? { scope: rawScope } : {}),
              ...(b.comment ? { comment: b.comment } : {}),
            };
          },
          responseExtractor: passthrough,
          actionDescription:
        "Approve a security exemption. body.scope is REQUIRED — pick one of: " +
        "'CURRENT' (approve at the exemption's existing scope, no elevation), " +
        "'ORG' (elevate + approve at organization scope), " +
        "'ACCOUNT' (elevate + approve at account scope), " +
        "'PROJECT' (elevate + approve at project scope, only valid when source is TARGET/PIPELINE). " +
        "MAPPING — scan the user's prompt and pick scope accordingly: " +
        "plain 'approve this' → 'CURRENT'; " +
        "'approve for org' / 'org-wide' / 'at org level' → 'ORG'; " +
        "'approve for account' / 'account-wide' / 'account level' → 'ACCOUNT'; " +
        "'promote to project' → 'PROJECT'. " +
        "IMPORTANT: If harness_list returned an error saying 'account scope not supported', that error was about the LIST call scope — it does NOT mean account-level approval is impossible. " +
        "The listing always uses project scope; the approval scope (body.scope) is independent and CAN be 'ACCOUNT'.",
          bodySchema: {
            // scope is REQUIRED at the call layer (enforced by preflight with a fail-loud
            // error), but declared required:false here because bodySchema validates the
            // BUILT body — and the bodyBuilder strips scope='CURRENT' from the wire payload
            // (the /approve endpoint doesn't accept scope). Preflight is authoritative.
            description: "Exemption approval details. body.scope is REQUIRED (validated by preflight).",
            fields: [
              { name: "scope",       type: "string", required: false, description: "REQUIRED (enforced by preflight). One of: 'CURRENT' | 'ORG' | 'ACCOUNT' | 'PROJECT'. Use 'CURRENT' to approve at the exemption's existing scope. Use ORG/ACCOUNT/PROJECT to elevate (calls the /promote endpoint internally). MUST be passed on every call." },
              { name: "approver_id", type: "string", required: false, description: "User UUID of the approver. Auto-derived from the authenticated PAT via /ng/api/user/currentUser if omitted." },
              { name: "comment",     type: "string", required: false, description: "Optional approval comment" },
            ],
          },
        },
        reject: {
          method: "PUT",
          path: "/sto/api/v2/exemptions/{exemptionId}/reject",
          operationPolicy: { risk: "high_write", retryPolicy: "do_not_retry" },
          pathParams: { exemption_id: "exemptionId" },
          preflight: async ({ client, input }) => {
            const body = ((input.body as Record<string, unknown> | undefined) ?? {});
            if (!body.approver_id) {
              body.approver_id = await client.getCurrentUserId();
              input.body = body;
            }
          },
          bodyBuilder: (input) => {
            const b = (input.body as Record<string, unknown> | undefined) ?? {};
            return {
              approverId: b.approver_id,
              ...(b.comment ? { comment: b.comment } : {}),
            };
          },
          responseExtractor: passthrough,
          actionDescription: "Reject a security exemption. approver_id is auto-derived from the authenticated user when not supplied.",
          bodySchema: {
            description: "Exemption rejection details",
            fields: [
              { name: "approver_id", type: "string", required: false, description: "User UUID of the rejector. Auto-derived from the authenticated PAT via /ng/api/user/currentUser if omitted." },
              { name: "comment",     type: "string", required: false, description: "Optional rejection comment" },
            ],
          },
        },
      },
    },

    // ── Bulk Security Exemption Creation ───────────────────────────────
    // Wraps POST /sto/api/v2/exemptions/bulk. Modeled as its own resource
    // (rather than an executeAction on `application_security_exemption`) so the standard
    // `harness_create` dispatcher handles it without a new MCP tool.
    //
    // Semantics (per sto-core/docs/STO-8977-bulk-exemption-api.md): the bulk
    // endpoint is ALL-OR-NONE. If any item fails validation or insertion, the
    // whole batch is rolled back and every item in the response carries the
    // same error message. We document this loudly so the LLM does not retry
    // partial batches assuming per-item independence.
    {
      resourceType: "application_security_exemption_bulk",
      aliases: ["security_exemption_bulk"],
      displayName: "Security Exemption (Bulk)",
      searchAliases: ["bulk exempt", "bulk waiver", "exempt many", "exempt multiple", "batch exemption", "sto"],
      description:
        "Create up to 100 security exemptions in a single ALL-OR-NONE transaction. " +
        "Use this instead of looping `harness_create resource_type=application_security_exemption` when the user wants " +
        "to exempt multiple issues at once — it produces one audit row and one DB transaction for the whole batch. " +
        "ALL-OR-NONE: if any single item fails validation or insert (e.g. unknown issue_id, target/pipeline " +
        "mutual-exclusion violation, latest-scan lookup miss), the entire batch is rolled back and every item in " +
        "the response is marked failed with the same error. Never retry a partial batch — re-send the full corrected list. " +
        "Per-item fields: `issue_id` (required), and optionally `target_id` XOR `pipeline_id` (mutually exclusive), " +
        "`scan_id`, `occurrences[]`, `search`. Top-level fields apply to every item: `type`, `reason`, `duration_days` (default 30), " +
        "`link`, `expiration`. `requester_id` is auto-derived from the authenticated PAT.",
      toolset: "application_security",
      scope: "project",
      scopeParams: STO_SCOPE,
      identifierFields: [],
      relatedResources: [
        { resourceType: "application_security_exemption", relationship: "sibling", description: "Single-item create path. Use this when exempting just one issue, or when you need per-item independence (the bulk endpoint is all-or-none)." },
        { resourceType: "application_security_pipeline_issue", relationship: "parent", description: "Source of issue_ids when exempting from the Vuln tab of a specific execution." },
        { resourceType: "application_security_issue", relationship: "parent", description: "Source of issue_ids when exempting from the All Issues / baseline page (Project scope only)." },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/sto/exemptions",
      operations: {
        create: {
          method: "POST",
          path: "/sto/api/v2/exemptions/bulk",
          operationPolicy: { risk: "high_write", retryPolicy: "do_not_retry" },
          preflight: async ({ client, input }) => {
            const body = (input.body as Record<string, unknown> | undefined) ?? {};

            // Top-level required fields. Validated against raw snake_case input
            // (not the built body) so the error message points at the field the
            // caller passed.
            const requiredFields = ["type", "reason", "items"] as const;
            const missing = requiredFields.filter(f => body[f] === undefined);
            if (missing.length > 0) {
              throw new Error(
                `Missing required fields for application_security_exemption_bulk: ${missing.join(", ")}. ` +
                `Use harness_describe(resource_type="application_security_exemption_bulk") to see the schema.`,
              );
            }

            // Items array sanity — matches the API contract (1..100).
            const items = body.items;
            if (!Array.isArray(items) || items.length < 1) {
              throw new Error("application_security_exemption_bulk: 'items' must be a non-empty array.");
            }
            if (items.length > 100) {
              throw new Error(
                `application_security_exemption_bulk: 'items' must contain at most 100 entries (got ${items.length}). ` +
                `Split the request into multiple bulk calls.`,
              );
            }

            // Per-item validation. Fail loudly with the offending index so the
            // LLM can surface "item 3 is missing issue_id" to the user instead
            // of getting an opaque 400 from the server.
            items.forEach((raw, idx) => {
              if (raw === null || typeof raw !== "object") {
                throw new Error(`application_security_exemption_bulk: items[${idx}] must be an object.`);
              }
              const it = raw as Record<string, unknown>;
              if (typeof it.issue_id !== "string" || it.issue_id.length === 0) {
                throw new Error(`application_security_exemption_bulk: items[${idx}].issue_id is required (string).`);
              }
              const hasTarget = typeof it.target_id === "string" && it.target_id.length > 0;
              const hasPipeline = typeof it.pipeline_id === "string" && it.pipeline_id.length > 0;
              if (hasTarget && hasPipeline) {
                throw new Error(
                  `application_security_exemption_bulk: items[${idx}] sets both target_id and pipeline_id — they are mutually exclusive. ` +
                  `Pick exactly one scope per item.`,
                );
              }
            });

            // Auto-derive requester from the authenticated PAT, same as the
            // single-create path.
            body.requester_id = await client.getCurrentUserId();
            input.body = body;
          },
          bodyBuilder: (input) => {
            const b = (input.body as Record<string, unknown> | undefined) ?? {};
            const items = (b.items as Array<Record<string, unknown>>).map((it) => ({
              issueId: it.issue_id,
              ...(it.target_id   ? { targetId:    it.target_id }   : {}),
              ...(it.pipeline_id ? { pipelineId:  it.pipeline_id } : {}),
              ...(it.scan_id     ? { scanId:      it.scan_id }     : {}),
              ...(it.occurrences ? { occurrences: it.occurrences } : {}),
              ...(it.search      ? { search:      it.search }      : {}),
            }));
            return {
              type: b.type,
              reason: b.reason,
              requesterId: b.requester_id,
              exemptFutureOccurrences: true,
              pendingChanges: { durationDays: b.duration_days ?? 30 },
              ...(b.link       ? { link:       b.link }       : {}),
              ...(b.expiration ? { expiration: b.expiration } : {}),
              items,
            };
          },
          responseExtractor: (raw: unknown): unknown => {
            // Surface the all-or-none outcome at the top level so the LLM
            // doesn't have to inspect every item to know what happened.
            // Server returns: { results: [{issueId, id?, error?, statusCode}], succeeded, failed }
            if (raw === null || typeof raw !== "object") return raw;
            const r = raw as { results?: unknown[]; succeeded?: number; failed?: number };
            const succeeded = typeof r.succeeded === "number" ? r.succeeded : 0;
            const failed = typeof r.failed === "number" ? r.failed : 0;
            const total = succeeded + failed;
            const allOrNone =
              total === 0
                ? "EMPTY"
                : failed === 0
                  ? "ALL_SUCCEEDED"
                  : succeeded === 0
                    ? "ALL_FAILED"
                    : "MIXED_UNEXPECTED";
            return {
              status: allOrNone,
              succeeded,
              failed,
              total,
              results: r.results ?? [],
              ...(allOrNone === "ALL_FAILED"
                ? {
                    _action_hint:
                      "The entire bulk request was rolled back. Inspect results[0].error for the cause, " +
                      "fix the offending item(s), and re-send the FULL corrected list — never retry only the failed items.",
                  }
                : {}),
              ...(allOrNone === "MIXED_UNEXPECTED"
                ? {
                    _action_hint:
                      "Bulk endpoint returned a mixed succeeded/failed result, which violates the all-or-none contract. " +
                      "Treat this as a server-side bug and surface the raw results[] to the user.",
                  }
                : {}),
            };
          },
          description:
            "Bulk-create security exemptions (1..100 items) in a single all-or-none transaction. " +
            "Auto-derives requesterId from the authenticated PAT and always sets exemptFutureOccurrences=true.",
          bodySchema: {
            description:
              "Bulk exemption creation. Top-level fields apply to every item. Required: type, reason, items. " +
              "Per-item: issue_id (required); optionally one of target_id XOR pipeline_id, plus scan_id, occurrences, search.",
            fields: [
              { name: "type",          type: "string", required: true,  description: "REQUIRED. Applies to every item. One of: Compensating Controls | Acceptable Use | Acceptable Risk | False Positive | Fix Unavailable | Other." },
              { name: "reason",        type: "string", required: true,  description: "REQUIRED. Applies to every item. Max 1024 chars." },
              { name: "duration_days", type: "number", required: false, description: "Applies to every item. Default 30." },
              { name: "link",          type: "string", required: false, description: "Optional ticket / reference URL applied to every item." },
              { name: "expiration",    type: "number", required: false, description: "Optional unix timestamp at which every item expires." },
              {
                name: "items",
                type: "array",
                required: true,
                description: "REQUIRED. 1..100 per-item entries. Each item: { issue_id (required), target_id? XOR pipeline_id?, scan_id?, occurrences?, search? }. target_id and pipeline_id are mutually exclusive per item.",
                itemType: "object",
              },
            ],
          },
        },
      },
    },

    // ── Remediation Diff (validation vs original scan) ─────────────────
    {
      resourceType: "application_security_remediation_diff",
      aliases: ["remediation_diff"],
      displayName: "Remediation Diff",
      description:
        "Diff validation-scan occurrences against the original scan's ignore set (STO DiffOccurrences / "
        + "GET /sto/api/v2/remediation-agent/diff-occurrences). "
        + "Requires BOTH `scan_id` (original scan) and `validation_execution_id` (validation pipeline execution). "
        + "Scope filters match sto-core RemAgentScopeFilters: issue_types, only_true_positive_issue_types, "
        + "exclude_unreachable, limit, severity_codes, exclude_repo_patterns. "
        + "Removes ignored fingerprints from the validation scan (server-side), then splits remaining occurrences into "
        + "`existing` (still present from original in-scope) and `new` (introduced by the remediations). "
        + "Response flattens both partitions into `items[]` tagged with `_partition`. "
        + "Fingerprint is not returned on items — matching stays inside STO Core.",
      searchAliases: [
        "remediation diff",
        "remediation agent validation diff",
        "remediation agent diff",
        "validation scan diff",
        "sast rem diff",
        "agent remediation validation", "sto"],
      relatedResources: [
        {
          resourceType: "application_security_pipeline_issue",
          relationship: "sibling",
          description: "Per-execution Pipeline Security issue view (existing/new partitions for a run).",
        },
        {
          resourceType: "application_security_issue",
          relationship: "sibling",
          description: "Cross-execution Issues page listing.",
        },
      ],
      toolset: "application_security",
      scope: "project",
      scopeParams: STO_SCOPE,
      identifierFields: [],
      listFilterFields: [
        { name: "scan_id", description: "REQUIRED. Original STO scan id the agent remediated.", required: true },
        {
          name: "validation_execution_id",
          description:
            "REQUIRED (or legacy alias execution_id). Validation pipeline execution id "
            + "(sto-core query param validationExecutionId).",
          required: false,
        },
        {
          name: "execution_id",
          description:
            "Legacy alias for validation_execution_id. Prefer validation_execution_id.",
          required: false,
        },
        // RemAgentScopeFilters (design/remediation_agent.go) — keep in sync with sto-core.
        {
          name: "issue_types",
          description:
            "Issue types to scope (sto-core issueTypes). Array or comma-separated string. Filters i.type. "
            + "v1: SAST,SECRET. Empty/omit — sto-core defaults to SAST+SECRET.",
          enum: ["SAST", "SECRET"],
        },
        {
          name: "only_true_positive_issue_types",
          description:
            "Issue types that must have a TRUE_POSITIVE triage verdict to stay in scope "
            + "(sto-core onlyTruePositiveIssueTypes). Array or comma-separated string. "
            + "Other scoped types are not TP-filtered. Empty/omit → no TP filter.",
          enum: ["SAST", "SECRET"],
        },
        {
          name: "exclude_unreachable",
          type: "boolean",
          description:
            "When true (sto-core excludeUnreachable, default false), exclude occurrences whose reachability is "
            + "'unreachable' (SAST). Missing/unknown reachability stays in scope. Must match the remediation scope step.",
        },
        {
          name: "limit",
          type: "number",
          description: "Max occurrences to return (sto-core limit; 1–10000, default 1000).",
        },
        {
          name: "severity_codes",
          description:
            "Severities (sto-core severityCodes). Array or comma-separated string. Empty means all. "
            + "CRITICAL, HIGH, MEDIUM, LOW, INFO.",
          enum: ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"],
        },
        {
          name: "exclude_repo_patterns",
          description:
            "Glob patterns matching target.name on repository targets (sto-core excludeRepoPatterns). "
            + "Array or comma-separated string.",
        },
      ],
      operations: {
        list: {
          method: "GET",
          path: "/sto/api/v2/remediation-agent/diff-occurrences",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            scan_id: "scanId",
            validation_execution_id: "validationExecutionId",
            // Legacy alias — prefer validation_execution_id.
            execution_id: "validationExecutionId",
            issue_types: "issueTypes",
            only_true_positive_issue_types: "onlyTruePositiveIssueTypes",
            exclude_unreachable: "excludeUnreachable",
            limit: "limit",
            severity_codes: "severityCodes",
            exclude_repo_patterns: "excludeRepoPatterns",
          },
          preflight: async ({ input }) => {
            if (typeof input.scan_id !== "string" || input.scan_id.length === 0) {
              throw new Error(
                "application_security_remediation_diff: 'scan_id' is required (original STO scan id).",
              );
            }
            const validationExecutionId =
              (typeof input.validation_execution_id === "string" && input.validation_execution_id)
              || (typeof input.execution_id === "string" && input.execution_id)
              || "";
            if (!validationExecutionId) {
              throw new Error(
                "application_security_remediation_diff: 'validation_execution_id' is required "
                  + "(validation pipeline execution id; alias: execution_id).",
              );
            }
            // Normalize so queryParams maps a single canonical key.
            input.validation_execution_id = validationExecutionId;
            delete input.execution_id;

            // RemAgentScopeFilters ArrayOf(String) → keep as string[] so registry
            // emits repeated query params (goa + rem-agent wire shape).
            // Omit when unset — sto-core owns defaults (issueTypes → SAST+SECRET;
            // excludeUnreachable → false; limit → 1000).
            for (const key of [
              "issue_types",
              "only_true_positive_issue_types",
              "severity_codes",
            ] as const) {
              const normalized = normalizeRemAgentEnumList(input[key]);
              if (normalized === undefined) {
                delete input[key];
              } else {
                input[key] = normalized;
              }
            }
          },
          responseExtractor: stoRemediationDiffExtract,
          skipCompact: true,
          description:
            "Diff validation-scan occurrences vs original scan ignore set (sto-core DiffOccurrences). "
            + "Requires scan_id + validation_execution_id. Scope filters match RemAgentScopeFilters. "
            + "Flattens existingOccurrences + newOccurrences into items[]; each item tagged with _partition.",
        },
      },
    },
    // ── Artifact Sources ───────────────────────────────────────────────
    {
      resourceType: "application_security_artifact_source",
      aliases: ["scs_artifact_source"],
      displayName: "SCS Artifact Source",
      description: "Software supply chain artifact source (registry) registered in the project. Supports list. "
        + "NOT the same as 'artifact' (Artifact Registry) or 'registry' — use this for supply chain security queries. "
        + "Retain source_id from responses — it is required to list artifacts within a source. "
        + "Two-step flow: first list sources to get source_id, then list artifacts within that source. "
        + "PATH SELECTION: Use this drill-in (application_security_artifact_source → application_security_artifact → application_security_artifact_component) "
        + "when you need canonical artifact_id values for downstream remediation, enrichment, or dependency calls. "
        + "For 'find component X across all artifacts' discovery WITHOUT needing canonical IDs, PREFER application_security_component_search "
        + "(single call, cross-artifact) instead of iterating this drill-in for every source.",
      diagnosticHint: "If you get a 404: use harness_list(resource_type='application_security_artifact_source') to discover valid source IDs. "
        + "Source IDs are required before querying artifacts, components, or compliance.",
      searchAliases: ["artifact source", "artifact registry security", "supply chain artifact", "scs artifact", "docker image source", "container registry", "scs"],
      relatedResources: [
        { resourceType: "application_security_artifact", relationship: "child", description: "List artifacts within this source (requires source_id)" },
        { resourceType: "application_security_artifact_component", relationship: "grandchild", description: "List dependencies within an artifact (requires artifact_id from application_security_artifact)" },
        { resourceType: "application_security_compliance_result", relationship: "grandchild", description: "Compliance results for an artifact" },
      ],
      toolset: "application_security",
      scope: "project",
      identifierFields: ["source_id"],
      listFilterFields: [
        { name: "search_term", description: "Search artifact sources by name" },
        { name: "artifact_type", description: "Filter by artifact type (e.g., CONTAINER, FILE)" },
      ],
      operations: {
        list: {
          method: "POST",
          path: `${SCS}/v1/orgs/{org}/projects/{project}/artifact-sources`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { org_id: "org", project_id: "project" },
          queryParams: {
            page: "page",
            size: "limit",
          },
          bodyBuilder: (input) => ({
            ...(input.search_term ? { search_term: input.search_term } : {}),
            ...(input.artifact_type ? { artifact_type: ensureArray(input.artifact_type) } : {}),
          }),
          defaultQueryParams: { limit: "10" },
          responseExtractor: artifactSourceListExtract,
          description: "List artifact sources in the project",
        },
      },
    },

    // ── Artifacts ──────────────────────────────────────────────────────
    {
      resourceType: "application_security_artifact",
      aliases: ["artifact_security"],
      displayName: "Artifact Security",
      description: "Supply chain artifact security posture — vulnerabilities, compliance, SBOM. "
        + "NOT the same as 'artifact' (Artifact Registry) — use this for security/vulnerability/compliance queries about artifacts. "
        + "List artifacts from a source, or get an artifact overview. "
        + "Retain artifact_id and source_id from responses — they are required for follow-up queries "
        + "(compliance, components, chain of custody, SBOM, remediation). "
        + "IMPORTANT: source_id is required to list artifacts. Get it from harness_list(resource_type='application_security_artifact_source') first. "
        + "IMPORTANT: For policy violation DETAILS (component names, license types, deny-list vs allow-list), "
        + "you MUST continue to application_security_bom_violation using enforcement_id from violations.enforcementId in this response. "
        + "This resource only shows violation counts — not the actual violation details.",
      diagnosticHint: "If you get a 404: verify source_id is correct. Use harness_list(resource_type='application_security_artifact_source') to find valid source IDs. "
        + "For artifact details, use harness_get with both source_id and artifact_id. "
        + "When comparing artifacts with other entities (e.g. repos), summarize key metrics "
        + "(vulnerability counts, compliance score, scorecard, component count) in a concise "
        + "side-by-side table rather than dumping full details for each — keeps the response readable.",
      searchAliases: ["artifact vulnerability", "artifact security posture", "artifact overview", "supply chain artifact", "scs artifact", "artifact sbom", "scs"],
      relatedResources: [
        { resourceType: "application_security_artifact_source", relationship: "parent", description: "Get source_id needed to list artifacts" },
        { resourceType: "application_security_bom_violation", relationship: "child", description: "BOM enforcement policy violations — deny-list/allow-list/OPA violations (requires enforcement_id from violations.enforcementId). Use for ANY 'policy violation' or 'enforcement' query." },
        { resourceType: "application_security_artifact_component", relationship: "child", description: "List dependencies/components within this artifact" },
        { resourceType: "application_security_sbom_drift", relationship: "child", description: "SBOM drift — compare this artifact's SBOM against previous version. Use orchestration.id from artifact response. PREFERRED over manually fetching and diffing component lists." },
        { resourceType: "application_security_compliance_result", relationship: "child", description: "CIS/OWASP benchmark checks ONLY — NOT for BOM enforcement or policy violations" },
        { resourceType: "application_security_chain_of_custody", relationship: "child", description: "Chain of custody events for this artifact" },
        { resourceType: "application_security_sbom", relationship: "child", description: "SBOM download (requires orchestration_id from chain of custody)" },
        { resourceType: "application_security_artifact_remediation", relationship: "child", description: "Remediation advice for components (requires purl)" },
        { resourceType: "application_security_component_remediation", relationship: "child", description: "Safe upgrade suggestions with dependency impact analysis (requires purl)" },
        { resourceType: "application_security_remediation_pr", relationship: "child", description: "Create/list remediation PRs for component upgrades" },
      ],
      toolset: "application_security",
      scope: "project",
      identifierFields: ["source_id", "artifact_id"],
      listFilterFields: [
        { name: "source_id", description: "Artifact source ID (get from harness_list resource_type=application_security_artifact_source)", required: true },
        { name: "search_term", description: "Filter artifacts by name or keyword" },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/supply-chain/artifacts/{artifactId}",
      operations: {
        list: {
          method: "POST",
          path: `${SCS}/v1/orgs/{org}/projects/{project}/artifact-sources/{source}/artifacts`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { org_id: "org", project_id: "project", source_id: "source" },
          queryParams: {
            page: "page",
            size: "limit",
            sort: "sort",
            order: "order",
          },
          bodyBuilder: (input) => ({
            ...(input.search_term ? { search_term: input.search_term } : {}),
          }),
          defaultQueryParams: { limit: "10" },
          elkFallback: true,
          responseExtractor: artifactSecurityListExtract,
          description: "List artifacts from an artifact source with pagination",
        },
        get: {
          method: "GET",
          path: `${SCS}/v1/orgs/{org}/projects/{project}/artifact-sources/{source}/artifacts/{artifact}/overview`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: {
            org_id: "org",
            project_id: "project",
            source_id: "source",
            artifact_id: "artifact",
          },
          responseExtractor: scsCleanExtract,
          description: "Get artifact security overview including vulnerability summary",
        },
      },
    },

    // ── Artifact Components ────────────────────────────────────────────
    {
      resourceType: "application_security_artifact_component",
      aliases: ["scs_artifact_component"],
      displayName: "SCS Artifact Component",
      description: "Flat inventory of software components present in an artifact — SBOM component list. Supports list. "
        + "Returns components co-located in the artifact; this is NOT a dependency graph and does NOT imply "
        + "dependency relationships among the listed components. Two components appearing in the same list "
        + "does not mean one depends on the other. "
        + "Use this for dependency queries (e.g., 'show dependencies', 'find lodash', 'list direct dependencies'). "
        + "Also use this to find which components have known vulnerabilities (check vulnerability_count field in response). "
        + "Retain purl from responses — it is required for remediation lookups and dependency tree queries.",
      diagnosticHint: "If you get a 404: verify artifact_id is correct. Get artifact IDs from harness_list(resource_type='application_security_artifact', source_id='...'). "
        + "Use dependency_type='DIRECT' to filter for direct dependencies only. "
        + "For dependency TREE (what a specific component depends on, transitive deps), use application_security_component_dependencies instead — this resource only returns a flat list. "
        + "REVERSE dependencies (what depends on component X) are NOT available from any SCS endpoint. "
        + "If asked 'what depends on X' or 'what breaks if I upgrade X', state that reverse dependency lookup is unavailable — "
        + "do NOT infer impact from the component list, and do NOT fabricate dependency relationships from training knowledge.",
      searchAliases: ["dependency", "sbom component", "package", "library", "component list", "direct dependency", "transitive dependency", "scs"],
      relatedResources: [
        { resourceType: "application_security_artifact", relationship: "parent", description: "Get artifact_id needed to list components" },
        { resourceType: "application_security_component_dependencies", relationship: "child", description: "Get dependency tree for a specific component (pass purl)" },
        { resourceType: "application_security_component_remediation", relationship: "sibling", description: "Safe upgrade suggestions with dependency impact analysis (pass purl) — preferred over application_security_artifact_remediation" },
        { resourceType: "application_security_component_enrichment", relationship: "sibling", description: "OSS risk / EOL / outdated status for a component (pass purl)" },
        { resourceType: "application_security_component_vulnerability", relationship: "sibling", description: "Individual CVE details (severity, CVSS, fix versions) for a component (pass purl)" },
        { resourceType: "application_security_oss_risk_summary", relationship: "sibling", description: "Project-level OSS risk overview across all artifacts" },
      ],
      toolset: "application_security",
      scope: "project",
      identifierFields: ["artifact_id"],
      listFilterFields: [
        { name: "artifact_id", description: "Artifact ID to list components for", required: true },
        { name: "search_term", description: "Search components by name or package identifier" },
        { name: "dependency_type", description: "Filter by dependency type (DIRECT or TRANSITIVE)" },
        { name: "oss_risk_filter", description: "Filter by OSS risk category. Comma-separated values from: DEFINITE_EOL, DERIVED_EOL, CLOSE_TO_EOL, UNMAINTAINED, OUTDATED" }
      ],
      operations: {
        list: {
          method: "POST",
          path: `${SCS}/v1/orgs/{org}/projects/{project}/artifacts/{artifact}/components`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { org_id: "org", project_id: "project", artifact_id: "artifact" },
          queryParams: {
            page: "page",
            size: "limit",
            sort: "sort",
            order: "order",
          },
          bodyBuilder: (input) => ({
            ...(input.search_term ? { search_term: input.search_term } : {}),
            ...(input.dependency_type ? { dependency_type_filter: [input.dependency_type] } : {}),
            ...(input.oss_risk_filter ? { oss_risk_filter: (input.oss_risk_filter as string).split(",").map(s => s.trim()) } : {}),
          }),
          defaultQueryParams: { limit: "10" },
          elkFallback: true,
          responseExtractor: artifactComponentListExtract,
          description: "List components (dependencies) in an artifact",
        },
      },
    },

    // ── Cross-Artifact Component Search ────────────────────────────────
    {
      resourceType: "application_security_component_search",
      aliases: ["scs_component_search"],
      displayName: "Cross-Artifact Component Search",
      description: "PREFERRED path for cross-artifact component discovery — search for a component by name across ALL artifacts "
        + "(images and repos) in the project in a single call. "
        + "Returns matching components with their parent artifact info (artifactId, artifactName). "
        + "Use this when the user asks 'which repos/artifacts contain dependency X', 'find lodash across all artifacts', "
        + "'list all components containing log4j', or any similar broad discovery question. "
        + "Prefer this over iterating application_security_artifact_source → application_security_artifact → application_security_artifact_component for every source — "
        + "that drill-in is only needed when you require canonical artifact_id for follow-up remediation/enrichment calls. "
        + "IMPORTANT: search_term is required. Org/project scope is resolved automatically from session context — "
        + "you do not need to pass org_id or project_id explicitly. "
        + "WARNING: The artifactId returned here is a search-index ID. "
        + "For remediation, enrichment, or dependency lookups you MUST resolve the artifact through "
        + "harness_list(application_security_artifact_source) → harness_list(application_security_artifact) first, then use THAT artifact_id.",
      diagnosticHint: "If you get empty results: the component may not exist in any scanned artifact. "
        + "Verify the component name is spelled correctly. Search is case-insensitive prefix match. "
        + "If a subsequent remediation/dependency call returns 404, the artifactId from search results is a search-index ID — "
        + "use the canonical chain: application_security_artifact_source → application_security_artifact → application_security_artifact_component → remediation.",
      searchAliases: ["cross-artifact search", "find dependency", "which repos use", "component across artifacts", "dependency search", "scs"],
      relatedResources: [
        { resourceType: "application_security_artifact_component", relationship: "sibling", description: "List all components within a specific artifact (requires artifact_id)" },
        { resourceType: "application_security_component_enrichment", relationship: "child", description: "OSS risk / EOL status for a found component (pass purl from results)" },
        { resourceType: "application_security_component_vulnerability", relationship: "child", description: "CVE details for a found component (pass purl from results)" },
      ],
      toolset: "application_security",
      scope: "project",
      identifierFields: [],
      listFilterFields: [
        { name: "search_term", description: "Component name to search for (case-insensitive prefix match)", required: true },
      ],
      operations: {
        list: {
          method: "GET",
          path: `${SCS}/v1/orgs/{org}/projects/{project}/components/search`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { org_id: "org", project_id: "project" },
          queryParams: {
            page: "page",
            size: "limit",
            order: "order",
            search_term: "search_term",
          },
          defaultQueryParams: { limit: "20" },
          elkFallback: true,
          responseExtractor: scsListExtract([
            "name", "version", "purl", "packageManager", "license", "artifactId", "artifactName",
          ]),
          description: "Search components across all artifacts in the project",
        },
      },
    },

    // ── Component Dependencies / Dependency Tree (P3-8) ──────────────
    {
      resourceType: "application_security_component_dependencies",
      aliases: ["scs_component_dependencies"],
      displayName: "Component Dependency Tree",
      description: "Dependency tree for a specific component within an artifact — shows what a component DEPENDS ON (forward dependencies only). "
        + "Returns direct and indirect (transitive) dependencies with their relationship paths and vulnerability counts. "
        + "Input: artifact_id (as resource_id) + component purl (required). "
        + "Use this when the user asks about: dependency tree, dependency chain, transitive dependencies, what X depends on, full dependency graph, or dependency impact. "
        + "This is DIFFERENT from application_security_artifact_component which lists all components IN an artifact (flat list). "
        + "This resource shows what a SINGLE component depends on (tree structure). "
        + "IMPORTANT: This does NOT show reverse dependencies (what depends on X). If the result is empty, the component has no sub-dependencies — report this accurately, do NOT fabricate or infer dependencies.",
      diagnosticHint: "If you get a 404: verify artifact_id and purl are correct. "
        + "Get purl values from harness_list(resource_type='application_security_artifact_component', artifact_id='...'). "
        + "This endpoint works for both code repo and container image artifacts. "
        + "IMPORTANT: This API shows FORWARD dependencies only (what this component depends on). "
        + "It does NOT show REVERSE dependencies (what other components use this one). "
        + "If the user asks 'what depends on X' or 'what breaks if I upgrade X', state that reverse dependency lookup is not available — "
        + "do NOT fabricate dependency relationships from training knowledge.",
      searchAliases: ["dependency tree", "dependency graph", "transitive dependencies", "component tree", "depends on", "dependency chain", "scs"],
      relatedResources: [
        { resourceType: "application_security_artifact_component", relationship: "parent", description: "Get purl values needed for dependency tree lookup" },
        { resourceType: "application_security_component_remediation", relationship: "sibling", description: "NEXT STEP for upgrade questions: returns recommended version and dependency impact analysis — data NOT available in the dependency tree" },
      ],
      toolset: "application_security",
      scope: "project",
      identifierFields: ["artifact_id"],
      operations: {
        get: {
          method: "GET",
          path: `${SCS}/v1/orgs/{org}/projects/{project}/artifacts/{artifact}/component/dependencies`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { org_id: "org", project_id: "project", artifact_id: "artifact" },
          queryParams: {
            purl: "purl",
          },
          responseExtractor: componentDependenciesExtract,
          description: "Get dependency tree for a component by PURL",
          paramsSchema: filterFieldsToParamsSchema([
            { name: "purl", description: "Package URL of the component (e.g. pkg:npm/express@4.18.0) — required", required: true },
          ]),
        },
      },
    },

    // ── Artifact Remediation ───────────────────────────────────────────
    {
      resourceType: "application_security_artifact_remediation",
      aliases: ["scs_artifact_remediation"],
      displayName: "SCS Artifact Remediation (Legacy)",
      description: "Legacy remediation advice endpoint. PREFER application_security_component_remediation instead — it returns structured upgrade suggestions with dependency impact analysis (added/removed/modified dependencies). "
        + "This resource returns the same data but application_security_component_remediation has richer descriptions and is the recommended resource for all remediation queries. "
        + "Works for code repository artifacts only — not available for container images. "
        + "Pass artifact_id as resource_id and purl via params.",
      diagnosticHint: "If you get a 404: (1) verify artifact_id and purl are correct, (2) remediation only works for code repo artifacts, not container images. "
        + "Get purl values from harness_list(resource_type='application_security_artifact_component', artifact_id='...').",
      searchAliases: ["remediation", "fix vulnerability", "upgrade component", "patch", "scs"],
      relatedResources: [
        { resourceType: "application_security_artifact_component", relationship: "parent", description: "Get purl values needed for remediation lookup" },
      ],
      toolset: "application_security",
      scope: "project",
      identifierFields: ["artifact_id"],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/supply-chain/artifacts/{artifactId}",
      operations: {
        get: {
          method: "GET",
          path: `${SCS}/v1/orgs/{org}/projects/{project}/artifacts/{artifact}/component/remediation`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { org_id: "org", project_id: "project", artifact_id: "artifact" },
          queryParams: {
            purl: "purl",
            target_version: "targetVersion",
          },
          responseExtractor: scsCleanExtract,
          description: "Get remediation advice for a component by package URL (purl)",
          paramsSchema: filterFieldsToParamsSchema([
            { name: "purl", description: "Package URL of the component (e.g. pkg:npm/express@4.18.0) — required for remediation lookup", required: true },
          ]),
        },
      },
    },

    // ── Chain of Custody ───────────────────────────────────────────────
    {
      resourceType: "application_security_chain_of_custody",
      aliases: ["scs_chain_of_custody"],
      displayName: "SCS Chain of Custody",
      description: "Chain of custody (event history) for an artifact. Supports get. "
        + "Returns orchestration IDs needed to download SBOMs.",
      diagnosticHint: "If you get a 404: verify artifact_id is correct. Get artifact IDs from harness_list(resource_type='application_security_artifact', source_id='...').",
      searchAliases: ["chain of custody", "provenance", "attestation", "signing", "slsa", "scs"],
      relatedResources: [
        { resourceType: "application_security_artifact", relationship: "parent", description: "Get artifact_id needed for chain of custody" },
        { resourceType: "application_security_sbom", relationship: "child", description: "Download SBOM using orchestration_id from chain of custody" },
      ],
      toolset: "application_security",
      scope: "project",
      identifierFields: ["artifact_id"],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/supply-chain/artifacts/{artifactId}",
      operations: {
        get: {
          method: "GET",
          path: `${SCS}/v2/orgs/{org}/projects/{project}/artifacts/{artifact}/chain-of-custody`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { org_id: "org", project_id: "project", artifact_id: "artifact" },
          responseExtractor: chainOfCustodyExtract,
          description: "Get chain of custody events for an artifact",
        },
      },
    },

    // ── Compliance Results ─────────────────────────────────────────────
    {
      resourceType: "application_security_compliance_result",
      aliases: ["scs_compliance_result"],
      displayName: "SCS Compliance Result",
      description: "CIS and OWASP benchmark compliance scan results for an artifact. "
        + "Use ONLY for CIS/OWASP compliance checks (e.g. 'Is my artifact CIS compliant?', 'Show OWASP results'). "
        + "NOT for BOM enforcement violations, deny-list/allow-list violations, or OPA policy violations — use application_security_bom_violation for those.",
      diagnosticHint: "If you get a 404: verify artifact_id is correct. Get artifact IDs from harness_list(resource_type='application_security_artifact', source_id='...'). "
        + "Filter by standards (e.g. 'CIS', 'OWASP') and status ('PASSED', 'FAILED', 'WARNING'). "
        + "IMPORTANT: For BOM enforcement / OPA policy violations, use application_security_bom_violation instead.",
      searchAliases: ["compliance", "cis", "owasp", "compliance check", "cis benchmark", "owasp check", "scs"],
      relatedResources: [
        { resourceType: "application_security_artifact", relationship: "parent", description: "Get artifact_id needed for compliance queries" },
        { resourceType: "policy", relationship: "sibling", description: "OPA policies (deny-list/allow-list) evaluated during enforcement — use governance toolset to create/manage" },
        { resourceType: "policy_set", relationship: "sibling", description: "OPA policy sets controlling enforcement rules — use governance toolset to create/manage" },
      ],
      toolset: "application_security",
      scope: "project",
      identifierFields: ["artifact_id"],
      listFilterFields: [
        { name: "artifact_id", description: "Artifact ID to list compliance results for", required: true },
        { name: "standards", description: "Filter by compliance standard (e.g., CIS, OWASP)" },
        { name: "status", description: "Filter by result status (e.g., PASSED, FAILED, WARNING)" }
      ],
      operations: {
        list: {
          method: "POST",
          path: `${SCS}/v1/orgs/{org}/projects/{project}/artifact/{artifact}/compliance-results/list`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { org_id: "org", project_id: "project", artifact_id: "artifact" },
          queryParams: {
            page: "page",
            size: "limit",
          },
          bodyBuilder: (input) => ({
            ...(input.standards ? { standards: ensureArray(input.standards) } : {}),
            ...(input.status ? { status: ensureArray(input.status) } : {}),
          }),
          defaultQueryParams: { limit: "10" },
          elkFallback: true,
          responseExtractor: scsCleanExtract,
          description: "List compliance results for an artifact",
        },
      },
    },

    // ── BOM Enforcement Violations (P3-1) ────────────────────────────
    {
      resourceType: "application_security_bom_violation",
      aliases: ["scs_bom_violation"],
      displayName: "BOM Enforcement Violation",
      description: "BOM (Bill of Materials) enforcement policy violations — shows which OPA policies failed and why. "
        + "Use this for ANY query about policy violations, enforcement violations, deny-list violations, allow-list violations, or BOM enforcement results. "
        + "Surfaces both deny-list and allow-list violations, including exempted violations (shown with isExempted flag). "
        + "NOT for CIS/OWASP benchmark checks — use application_security_compliance_result for those. "
        + "Two-step flow: first get artifact overview via harness_list(resource_type='application_security_artifact') to find enforcement_id from violations.enforcementId, "
        + "then harness_list(resource_type='application_security_bom_violation', enforcement_id=<id>) for violation details. "
        + "For COUNTS or SUMMARY of violations: use harness_get(resource_type='application_security_bom_violation', enforcement_id=<id>) — returns total counts by violation type (deny-list vs allow-list) without listing individual violations. "
        + "For DETAILS of individual violations (names, licenses, purls): use harness_list.",
      diagnosticHint: "If you get a 404: verify enforcement_id is correct. "
        + "Get enforcement_id from harness_list(resource_type='application_security_artifact', filters={source_id:'...', artifact_id:'...'}) — "
        + "look for violations.enforcementId in the response. "
        + "If the artifact has no enforcement results, enforcement_id will be absent. "
        + "IMPORTANT: Do NOT use application_security_compliance_result for BOM/OPA enforcement violations — that resource is only for CIS/OWASP checks. "
        + "ANTI-FABRICATION: Report each violation's exact violation_type (allow-list vs deny-list) as returned. "
        + "Do NOT reclassify allow-list as deny-list or vice versa. If the user asks for one type, filter to only that type — "
        + "do NOT mix types or infer a violation's classification from the license name.",
      searchAliases: ["bom violation", "policy violation", "enforcement violation", "deny list violation", "allow list violation", "sbom violation", "bom enforcement violation", "enforcement", "enforcement summary", "enforcement status", "violation counts", "violation summary", "bom enforcement", "sbom enforcement", "scs"],
      relatedResources: [
        { resourceType: "application_security_artifact", relationship: "parent", description: "Get enforcement_id from artifact overview (violations.enforcementId)" },
        { resourceType: "application_security_compliance_result", relationship: "sibling", description: "Compliance scan results (CIS/OWASP checks) — different from BOM enforcement violations" },
        { resourceType: "policy_set", relationship: "sibling", description: "OPA policy set that fired this violation — the set referenced by the policySetRef on each violation. List via governance toolset with filter type='sbom' (NOT 'sbom_enforcement' or 'ssca_enforcement' — those return an empty list for policy sets)." },
        { resourceType: "policy", relationship: "sibling", description: "Individual OPA policies bound to the firing policy set. List via governance toolset with filter type='sbom_enforcement'." },
      ],
      toolset: "application_security",
      scope: "project",
      identifierFields: ["enforcement_id"],
      listFilterFields: [
        { name: "enforcement_id", description: "Enforcement ID (from artifact overview violations.enforcementId)", required: true },
        { name: "search_term", description: "Search violations by component name or purl" },
      ],
      operations: {
        list: {
          method: "GET",
          path: `${SCS}/v1/org/{org}/project/{project}/enforcement/{enforcement}/policy-violations`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { org_id: "org", project_id: "project", enforcement_id: "enforcement" },
          queryParams: {
            page: "page",
            size: "limit",
            sort: "sort",
            order: "order",
            search_term: "searchText",
          },
          defaultQueryParams: { limit: "10" },
          responseExtractor: bomViolationListExtract,
          description: "List BOM enforcement policy violations for an enforcement run",
        },
        get: {
          method: "GET",
          path: `${SCS}/v1/org/{org}/project/{project}/enforcement/{enforcement}/summary`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { org_id: "org", project_id: "project", enforcement_id: "enforcement" },
          responseExtractor: scsCleanExtract,
          description: "Get enforcement summary with violation counts by type",
        },
      },
    },

    // ── Code Repositories ──────────────────────────────────────────────
    {
      resourceType: "application_security_code_repo",
      aliases: ["code_repo_security"],
      displayName: "Code Repository Security",
      description: "Code repository security posture — vulnerabilities, compliance, SBOM for source code repos. "
        + "NOT the same as 'repository' (Harness Code) — use this for security/vulnerability queries about code repos. "
        + "Supports list and get (overview). "
        + "Retain repo_id from responses — it is required to get the repository security overview. "
        + "repo_id IS an artifact_id (repos are artifacts of type REPOSITORY). "
        + "To list repo dependencies: harness_list(resource_type='application_security_artifact_component', artifact_id=<repo_id>, dependency_type='DIRECT'). "
        + "To get remediation for a repo dependency: harness_get(resource_type='application_security_component_remediation', artifact_id=<repo_id>, purl=<purl>).",
      diagnosticHint: "If you get a 404: use harness_list(resource_type='application_security_code_repo') to discover valid repo IDs. "
        + "Code repos are also artifacts (ArtifactType.REPOSITORY) — repo_id can be used as artifact_id for component queries.",
      searchAliases: ["repo security", "repository security", "code repo vulnerability", "repo compliance", "source code security", "scs"],
      relatedResources: [
        { resourceType: "application_security_artifact_component", relationship: "child", description: "List repo dependencies (use repo_id as artifact_id, dependency_type=DIRECT)" },
        { resourceType: "application_security_compliance_result", relationship: "child", description: "Compliance results for this repo" },
      ],
      toolset: "application_security",
      scope: "project",
      identifierFields: ["repo_id"],
      listFilterFields: [
        { name: "search_term", description: "Filter repositories by name or keyword" },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/supply-chain/repositories/{repoId}",
      operations: {
        list: {
          method: "POST",
          path: `${SCS}/v1/orgs/{org}/projects/{project}/code-repos/list`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { org_id: "org", project_id: "project" },
          queryParams: {
            page: "page",
            size: "limit",
          },
          bodyBuilder: (input) => ({
            ...(input.search_term ? { search_term: input.search_term } : {}),
          }),
          defaultQueryParams: { limit: "10" },
          elkFallback: true,
          responseExtractor: codeRepoListExtract,
          description: "List scanned code repositories",
        },
        get: {
          method: "GET",
          path: `${SCS}/v1/orgs/{org}/projects/{project}/code-repos/{codeRepo}/overview`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { org_id: "org", project_id: "project", repo_id: "codeRepo" },
          responseExtractor: scsCleanExtract,
          description: "Get code repository security overview",
        },
      },
    },

    // ── Component Remediation (P3-6: upgrade suggestions + impact analysis) ─
    {
      resourceType: "application_security_component_remediation",
      aliases: ["scs_component_remediation"],
      displayName: "Component Remediation Suggestion",
      description: "Safe upgrade suggestions for a vulnerable OSS component — returns the specific version to upgrade to and what dependencies change. "
        + "DO NOT use for status checks (is it outdated? is it EOL? risk score?) — use application_security_component_enrichment for those. "
        + "ONLY call this resource when the user explicitly asks about upgrade versions, safe versions, remediation advice, or dependency impact of upgrades — "
        + "this data comes from a dedicated API and CANNOT be inferred from component lists or dependency trees. "
        + "Returns: recommended_version (the specific safe version to upgrade to), warnings, dependency_changes (added/removed/modified dependencies), and code_preview. "
        + "Input: artifact_id (as resource_id) + component purl (required). "
        + "To create a PR with the suggested upgrade, use application_security_remediation_pr.",
      diagnosticHint: "If you get a 404: (1) verify artifact_id and purl are correct, (2) remediation works for code repo artifacts only — not container images. "
        + "Get purl values from harness_list(resource_type='application_security_artifact_component', artifact_id='...'). "
        + "Optionally pass target_version to get upgrade suggestions for a specific version. "
        + "ANTI-FABRICATION: Report ONLY the recommended_version returned by this endpoint. Do NOT supplement with 'latest' versions from training knowledge, "
        + "do NOT infer versions from semver patterns, and if the response contains remediation_warnings indicating guidance is unavailable, "
        + "say 'remediation not available — check the upstream project' rather than inventing a target version.",
      searchAliases: ["upgrade suggestion", "safe upgrade", "component upgrade", "fix vulnerability", "remediation suggestion", "dependency impact", "scs"],
      relatedResources: [
        { resourceType: "application_security_artifact_component", relationship: "parent", description: "Get purl values needed for remediation lookup" },
        { resourceType: "application_security_remediation_pr", relationship: "child", description: "Create a PR to apply the suggested upgrade" },
      ],
      toolset: "application_security",
      scope: "project",
      identifierFields: ["artifact_id"],
      operations: {
        get: {
          method: "GET",
          path: `${SCS}/v1/orgs/{org}/projects/{project}/artifacts/{artifact}/component/remediation`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { org_id: "org", project_id: "project", artifact_id: "artifact" },
          queryParams: {
            purl: "purl",
            target_version: "targetVersion",
          },
          responseExtractor: componentRemediationExtract,
          description: "Get safe upgrade suggestions and dependency impact analysis for a component",
          paramsSchema: filterFieldsToParamsSchema([
            { name: "purl", description: "Package URL of the component (e.g. pkg:npm/express@4.18.0) — required", required: true },
            { name: "target_version", description: "Specific target version to evaluate upgrade to (optional)" },
          ]),
        },
      },
    },

    // ── Remediation Pull Requests (P3-6: PR creation + tracking) ──────
    {
      resourceType: "application_security_remediation_pr",
      aliases: ["scs_remediation_pr"],
      displayName: "Remediation Pull Request",
      description: "Create and list remediation pull requests that upgrade vulnerable/outdated components. "
        + "WRITE OPERATION: create will open a real PR in the source repository. "
        + "Requires artifact_id. For create, also requires component purl and target_version in the body. "
        + "\n\nREQUIRED WORKFLOW BEFORE CREATING A PR (follow IN ORDER):\n"
        + "  1. harness_list(resource_type='application_security_remediation_pr', artifact_id='<id>') — list existing PRs for this artifact.\n"
        + "  2. Inspect the list: if ANY existing PR has the same component purl (or matching package_name) as the one you intend to upgrade, STOP. Do NOT call harness_create. Instead, report the existing PR (its number/URL/status) to the user and ask whether they want to supersede or discard it before creating a new one.\n"
        + "  3. Only if NO existing PR covers this component: call harness_get(resource_type='application_security_component_remediation', ...) to confirm the recommended target_version.\n"
        + "  4. Then call harness_create(resource_type='application_security_remediation_pr', ...).\n\n"
        + "Skipping step 1-2 and creating a duplicate PR for a component that already has one is a known failure mode — always check first. "
        + "Merging or dismissing PRs is done in the source repository (or generic pull-request tools), not via this SCS resource. "
        + "USAGE: harness_create(resource_type='application_security_remediation_pr', params={artifact_id: '<id>'}, body={purl: '<purl>', target_version: '<ver>'}). "
        + "Do NOT put purl/target_version in params — they must be in body.",
      diagnosticHint: "If you get a 404: verify artifact_id is correct. Use harness_get(resource_type='application_security_component_remediation', artifact_id='...', purl='...') to verify the component exists. "
        + "For create: ensure purl and target_version are provided.",
      searchAliases: ["remediation pr", "fix pr", "upgrade pr", "pull request", "create pr", "remediation pull request", "scs"],
      relatedResources: [
        { resourceType: "application_security_component_remediation", relationship: "parent", description: "Review upgrade suggestion before creating PR" },
        { resourceType: "application_security_auto_pr_config", relationship: "sibling", description: "Configure automatic PR creation rules" },
      ],
      toolset: "application_security",
      scope: "project",
      identifierFields: ["artifact_id"],
      listFilterFields: [
        { name: "artifact_id", description: "Artifact ID to list/create remediation PRs for", required: true },
      ],
      operations: {
        list: {
          method: "GET",
          path: `${SCS}/v1/orgs/{org}/projects/{project}/artifacts/{artifact}/component/remediation/pull-requests`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { org_id: "org", project_id: "project", artifact_id: "artifact" },
          queryParams: {
            page: "page",
            size: "limit",
          },
          defaultQueryParams: { limit: "10" },
          responseExtractor: remediationPrListExtract,
          description: "List remediation pull requests for an artifact",
        },
        create: {
          method: "POST",
          path: `${SCS}/v1/orgs/{org}/projects/{project}/artifacts/{artifact}/component/remediation/create-pull-request`,
          operationPolicy: { risk: "medium_write", retryPolicy: "do_not_retry" },
          pathParams: { org_id: "org", project_id: "project", artifact_id: "artifact" },
          bodyBuilder: (input) => {
            const body = (input.body && typeof input.body === "object" ? input.body : {}) as Record<string, unknown>;
            return {
              ...(body.purl || input.purl ? { purl: (body.purl || input.purl) as string } : {}),
              ...(body.target_version || input.target_version ? { target_version: (body.target_version || input.target_version) as string } : {}),
            };
          },
          /**
           * Duplicate-PR preflight for application_security_remediation_pr.create.
           *
           * INTENT: prevent creating a second remediation PR for a component
           * that already has an active PR in flight on the same artifact.
           *
           * POLICY SUMMARY (product-facing — confirm matches intent before merge):
           *   • Block when an ACTIVE PR (OPEN / CREATED / PENDING / IN_PROGRESS /
           *     DRAFT / QUEUED) exists with the same normalized PURL or a
           *     matching `package_name` on the target artifact.
           *   • IGNORE historical PRs in terminal states (CLOSED / MERGED /
           *     DISMISSED / REJECTED / FAILED / ERROR) — those don't prevent a
           *     later upgrade for the same component.
           *   • Missing status ⇒ treat as active (err on the side of preventing
           *     duplicates rather than silently letting them through).
           *
           * LIST-CALL FAILURE POLICY:
           *   • HTTP 4xx  ⇒ fail CLOSED (throw). A client-side error (bad args,
           *                 auth, scope) indicates a real problem; proceeding
           *                 would silently bypass the duplicate invariant.
           *   • HTTP 5xx / network / non-HarnessApiError ⇒ fail OPEN silently.
           *                 The check is best-effort and transient upstream issues
           *                 must not permanently block legitimate remediation creation.
           *
           * SCOPE: the preflight's inner list call inherits `org_id` /
           * `project_id` from the outer create input; it does NOT fall back
           * to server config defaults, to prevent scanning the wrong project.
           *
           * PAGINATION: capped at PREFLIGHT_MAX_PAGES × PREFLIGHT_PAGE_SIZE
           * (500 PRs) to bound worst-case preflight latency.
           *
           * NORMALIZATION: `normalizePurl` strips version, qualifiers, and
           * subpath, and only splits on `@` after the last `/` so spec-compliant
           * scoped npm purls (`pkg:npm/%40angular/core@1.0.0`) compare correctly.
           */
          preflight: async ({ client, input, registry, signal }) => {
            const body = (input.body && typeof input.body === "object" ? input.body : {}) as Record<string, unknown>;
            const purl = (body.purl ?? input.purl) as string | undefined;
            const artifactId = input.artifact_id as string | undefined;
            if (!purl || !artifactId) return; // let the downstream validators report missing fields

            const reg = registry as {
              dispatch: (
                client: unknown,
                resourceType: string,
                operation: "list",
                input: Record<string, unknown>,
                signal?: AbortSignal,
              ) => Promise<unknown>;
            };

            // Tolerate the many shapes our SCS extractors produce: array, { items }, { data }, { content }.
            const pickItems = (raw: unknown): Record<string, unknown>[] => {
              if (Array.isArray(raw)) {
                return raw.filter((x): x is Record<string, unknown> => !!x && typeof x === "object");
              }
              if (raw && typeof raw === "object") {
                for (const key of ["items", "data", "content", "results", "pull_requests"]) {
                  const val = (raw as Record<string, unknown>)[key];
                  if (Array.isArray(val)) {
                    return val.filter((x): x is Record<string, unknown> => !!x && typeof x === "object");
                  }
                }
              }
              return [];
            };

            // Paginate up to PREFLIGHT_MAX_PAGES × PREFLIGHT_PAGE_SIZE entries.
            // Bounded to cap worst-case preflight latency; artifacts with more
            // remediation PRs than this cap are exceptionally rare and, if they
            // exist, the active-status filter below will still reject obvious
            // duplicates from the pages we do scan.
            // Propagate scope from the outer create call. Without this, the
            // preflight's list dispatch would fall back to server config
            // defaults for org_id / project_id and potentially list PRs from
            // the wrong project — silently missing duplicates.
            const scopedListInput: Record<string, unknown> = {
              artifact_id: artifactId,
              size: PREFLIGHT_PAGE_SIZE,
            };
            if (input.org_id !== undefined) scopedListInput.org_id = input.org_id;
            if (input.project_id !== undefined) scopedListInput.project_id = input.project_id;

            const collected: Record<string, unknown>[] = [];
            for (let page = 0; page < PREFLIGHT_MAX_PAGES; page++) {
              let raw: unknown;
              try {
                raw = await reg.dispatch(
                  client,
                  "application_security_remediation_pr",
                  "list",
                  { ...scopedListInput, page },
                  signal,
                );
              } catch (err) {
                // Duplicate-prevention policy on preflight list failure:
                //   4xx → fail CLOSED. A client-side error (bad args, auth, scope)
                //         indicates a real problem — creating through it would
                //         silently bypass the duplicate invariant.
                //   5xx / network / timeout → fail OPEN silently.
                //         The check is best-effort; transient upstream issues
                //         should not permanently block remediation creation.
                const status = err instanceof HarnessApiError ? err.statusCode : undefined;
                if (status !== undefined && status >= 400 && status < 500) {
                  throw new Error(
                    `Duplicate-PR preflight check failed (HTTP ${status}): ${(err as Error).message}. `
                    + `Refusing to create a remediation PR for ${purl} on artifact ${artifactId} because existing PRs could not be listed. `
                    + `Resolve the list error (verify artifact_id and scope) before retrying create.`,
                  );
                }
                return;
              }
              const batch = pickItems(raw);
              collected.push(...batch);
              // Exhausted — last page was partial (or empty).
              if (batch.length < PREFLIGHT_PAGE_SIZE) break;
            }

            const targetKey = normalizePurl(purl);
            const conflict = collected.find((pr) => {
              // Only ACTIVE PRs block creation. A closed/merged/dismissed PR for
              // the same component is historical and must not prevent a later
              // remediation attempt (e.g. new CVE, or upgrade to a different
              // version). If status is missing, fall through to the purl/pkg
              // check — missing status is treated as "assume active" so we err
              // on the side of the duplicate invariant rather than silently
              // letting potential duplicates through.
              const rawStatus = pr.pr_status ?? pr.status;
              const statusLower = typeof rawStatus === "string" ? rawStatus.toLowerCase().trim() : "";
              if (statusLower && !ACTIVE_REMEDIATION_PR_STATUSES.has(statusLower)) return false;

              const prPurl = typeof pr.purl === "string" ? pr.purl : "";
              const prPkg = typeof pr.package_name === "string" ? pr.package_name : "";
              if (prPurl && normalizePurl(prPurl) === targetKey) return true;
              if (prPkg && targetKey.endsWith(`/${prPkg.toLowerCase()}`)) return true;
              return false;
            });

            if (conflict) {
              // Field names must match REMEDIATION_PR_LIST_FIELDS above — the list
              // extractor whitelists pr_url/pr_number/pr_status, so any other
              // alias would be stripped before we see it here.
              const prUrl = conflict.pr_url ?? conflict.pull_request_url;
              const prNumber = conflict.pr_number ?? conflict.pull_request_number;
              const prStatus = conflict.pr_status ?? conflict.status;
              const ref = [
                prUrl ? `url=${String(prUrl)}` : "",
                prNumber ? `#${String(prNumber)}` : "",
                prStatus ? `status=${String(prStatus)}` : "",
              ].filter(Boolean).join(" ");
              throw new Error(
                `Duplicate remediation PR blocked: an existing PR already covers ${purl} on artifact ${artifactId} (${ref}). `
                + `Close or supersede the existing PR before creating a new one, or confirm with the user that they want a second PR for the same component. `
                + `Use harness_list(resource_type='application_security_remediation_pr', artifact_id='${artifactId}') to review existing PRs.`,
              );
            }
          },
          responseExtractor: scsCleanExtract,
          description: "Create a remediation PR to upgrade a vulnerable component. "
            + "MCP preflight: automatically lists existing remediation PRs for this artifact and blocks the create "
            + "if any ACTIVE PR (OPEN/CREATED/PENDING/IN_PROGRESS/DRAFT/QUEUED) already covers the same purl or package_name. "
            + "Historical PRs in terminal states (CLOSED/MERGED/DISMISSED/REJECTED/FAILED/ERROR) are IGNORED and will not block a later upgrade. "
            + "If the list call fails with 4xx the create is refused (fail-closed); 5xx / network errors skip the check with a warning (fail-open).",
          bodySchema: {
            description: "Remediation PR creation payload — component PURL and target upgrade version",
            fields: [
              { name: "purl", type: "string", required: true, description: "Package URL of the component to upgrade (e.g. pkg:npm/express@4.18.0)" },
              { name: "target_version", type: "string", required: true, description: "Target version to upgrade to (from application_security_component_remediation suggestions)" },
            ],
          },
        },
      },
    },

    // ── Auto PR Configuration (P3-12) ─────────────────────────────────
    {
      resourceType: "application_security_auto_pr_config",
      aliases: ["scs_auto_pr_config"],
      displayName: "Auto PR Configuration",
      description: "Automatic pull request configuration for OSS remediation. "
        + "Controls when PRs are automatically created to upgrade vulnerable or outdated components. "
        + "Use get to view current config, update to modify rules. "
        + "WRITE OPERATION: update changes automated behavior — a misconfigured rule could flood repositories with PRs.",
      diagnosticHint: "Use harness_get(resource_type='application_security_auto_pr_config') to view current configuration before making changes. "
        + "This is a project-level configuration — no artifact_id needed.",
      searchAliases: ["auto pr", "automatic pull request", "auto remediation", "pr config", "auto pr configuration", "scs"],
      relatedResources: [
        { resourceType: "application_security_remediation_pr", relationship: "sibling", description: "Manual PR creation for individual components" },
        { resourceType: "application_security_component_remediation", relationship: "sibling", description: "Review upgrade suggestions" },
      ],
      toolset: "application_security",
      scope: "project",
      scopeParams: { org: "org_id", project: "project_id" },
      identifierFields: [],
      operations: {
        get: {
          method: "GET",
          path: `${SCS}/v1/ssca-config/auto-pr-config`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          responseExtractor: scsCleanExtract,
          description: "Get current auto-PR configuration",
        },
        update: {
          method: "PUT",
          path: `${SCS}/v1/ssca-config/auto-pr-config`,
          operationPolicy: { risk: "medium_write", retryPolicy: "safe" },
          bodyBuilder: (input) => input.body,
          responseExtractor: scsCleanExtract,
          description: "Save or update auto-PR configuration",
          bodySchema: {
            description: "Auto-PR configuration — controls automatic remediation PR creation rules",
            fields: [
              { name: "body", type: "object", required: true, description: "Auto-PR configuration object. Use harness_get first to see the current shape, then modify and pass back." },
            ],
          },
        },
      },
    },

    // ── Component Enrichment / OSS Risk Lookup (P3-11) ────────────────
    {
      resourceType: "application_security_component_enrichment",
      aliases: ["scs_component_enrichment"],
      displayName: "Component OSS Risk & Enrichment",
      description: "OSS risk ASSESSMENT and enrichment data for a component by Package URL (PURL). "
        + "This is the STATUS CHECK resource — call it BEFORE application_security_component_remediation. "
        + "Returns: end-of-life (EOL) status and risk score, whether the version is outdated or unmaintained, "
        + "latest available version, license info, and vulnerability count. "
        + "ALWAYS use this when the user asks: 'Is this library safe?', 'Is component X end-of-life?', "
        + "'Is my version of Y outdated?', 'What is the latest version of Z?', 'What is the risk?', 'Check OSS risk status'. "
        + "Input: purl (Package URL, e.g. pkg:npm/express@4.18.0). "
        + "Two modes: (1) Account-scoped — pass purl only. Works for any known component. "
        + "(2) Project-scoped — pass artifact_id + purl. Returns richer data: dependency type (direct/transitive), parent components, STO vulnerability source. "
        + "For individual CVE/vulnerability DETAILS (CVE IDs, CVSS scores, fix versions), use application_security_component_vulnerability instead — this resource covers OSS risk only.",
      diagnosticHint: "If you get empty results: the component may not have been enriched yet (only components seen in scanned SBOMs are enriched). "
        + "Get purl values from harness_list(resource_type='application_security_artifact_component', artifact_id='...'). "
        + "PURL format: pkg:<type>/<namespace>/<name>@<version> (e.g. pkg:npm/express@4.18.0, pkg:golang/stdlib@1.20.0). "
        + "For richer data (dependency type, parents), always pass artifact_id when available.",
      searchAliases: [
        "oss risk", "end of life", "eol", "outdated", "unmaintained",
        "component risk", "library risk", "package risk", "version risk",
        "is it safe", "latest version", "component enrichment",
        "still maintained", "actively maintained", "is it maintained",
        "risk level", "risk score", "maintenance status",
        "deprecated", "abandoned", "stale dependency", "scs"],
      relatedResources: [
        { resourceType: "application_security_artifact_component", relationship: "parent", description: "List components in an artifact to get purl values and artifact_id" },
        { resourceType: "application_security_component_remediation", relationship: "sibling", description: "Get upgrade suggestions if the component is outdated/at-risk" },
        { resourceType: "application_security_oss_risk_summary", relationship: "parent", description: "Project-level OSS risk overview — start here for broad risk assessment" },
        { resourceType: "application_security_component_vulnerability", relationship: "sibling", description: "Individual CVE details (severity, CVSS, fix versions) — use for specific CVE/vulnerability queries" },
      ],
      toolset: "application_security",
      scope: "project",
      scopeOptional: true,
      identifierFields: ["artifact_id"],
      operations: {
        get: {
          method: "GET",
          path: `${SCS}/v1/components/details`,
          pathBuilder: (input, config) => {
            const artifactId = input.artifact_id as string | undefined;
            if (artifactId) {
              // Project-scoped: richer response with SBOM context
              const cfg = config as Record<string, string | undefined>;
              const org = (input.org_id as string) || cfg.HARNESS_ORG || "";
              const project = (input.project_id as string) || cfg.HARNESS_PROJECT || "";
              return `${SCS}/v1/orgs/${org}/projects/${project}/artifacts/${artifactId}/component/overview`;
            }
            // Account-scoped fallback: enrichment data only
            return `${SCS}/v1/components/details`;
          },
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            purl: "purl",
          },
          responseExtractor: scsCleanExtract,
          description: "Get OSS risk and enrichment data for a component by PURL. Pass artifact_id for project-scoped results.",
          paramsSchema: filterFieldsToParamsSchema([
            { name: "purl", description: "Package URL of the component (e.g. pkg:npm/express@4.18.0) — required", required: true },
            { name: "artifact_id", description: "Artifact ID for project-scoped lookup (preferred — returns richer data including dependency type and parents)" },
          ]),
        },
      },
    },

    // ── Component Vulnerability Details (PRD §3.4 — CVE/CVSS lookup) ──
    {
      resourceType: "application_security_component_vulnerability",
      aliases: ["scs_component_vulnerability"],
      displayName: "Component Vulnerability Details",
      description: "CVE and vulnerability details for a specific OSS component by Package URL (PURL). "
        + "Returns INDIVIDUAL CVE records with severity, CVSS score, and fix/upgrade versions — "
        + "this is the ONLY resource that provides per-CVE details for a component. "
        + "Use this when the user asks: 'What CVEs affect X?', 'Show vulnerabilities for library Y', "
        + "'CVSS scores for Z', 'Security advisories for component W', 'Is this version vulnerable?'. "
        + "DO NOT use application_security_component_enrichment for CVE queries — it only returns aggregate counts (issue_count), "
        + "not individual CVE IDs or CVSS scores. "
        + "Input: purl (Package URL, e.g. pkg:npm/express@4.18.0). Optionally pass artifact_id for artifact-scoped results. "
        + "Two modes: (1) Account-scoped — pass purl only. Returns all known CVEs for the component globally. "
        + "(2) Artifact-scoped — pass artifact_id + purl. Returns CVEs in the context of a specific artifact.",
      diagnosticHint: "If you get empty results: the vulnerability enrichment pipeline may not have processed this component yet. "
        + "IMPORTANT: Even when application_security_artifact shows aggregate vulnerability counts (e.g. 677 total), "
        + "this endpoint may return empty — that means per-CVE details are not available, NOT that there are zero vulnerabilities. "
        + "In that case, report the AGGREGATE counts from application_security_artifact and state: 'Specific CVE details are not yet available in the system.' "
        + "NEVER fill the gap with CVEs from your training knowledge — that is fabrication. "
        + "Get purl values from harness_list(resource_type='application_security_artifact_component', artifact_id='...'). "
        + "PURL format: pkg:<type>/<namespace>/<name>@<version> (e.g. pkg:npm/express@4.18.0).",
      searchAliases: [
        "cve", "vulnerability", "cvss", "security advisory", "security issue",
        "component vulnerability", "library vulnerability", "package vulnerability",
        "known vulnerabilities", "cve lookup", "vulnerability scan",
        "is it vulnerable", "security flaws", "critical vulnerability", "scs"],
      relatedResources: [
        { resourceType: "application_security_artifact_component", relationship: "parent", description: "List components in an artifact to get purl values" },
        { resourceType: "application_security_component_enrichment", relationship: "sibling", description: "OSS risk (EOL, unmaintained, outdated) — aggregate data, not individual CVEs" },
        { resourceType: "application_security_component_remediation", relationship: "sibling", description: "Safe upgrade suggestions to fix vulnerabilities" },
      ],
      toolset: "application_security",
      scope: "project",
      scopeOptional: true,
      identifierFields: ["artifact_id"],
      listFilterFields: [
        { name: "purl", description: "Package URL of the component (e.g. pkg:npm/express@4.18.0) — required", required: true },
        { name: "artifact_id", description: "Artifact ID for artifact-scoped lookup (optional — omit for global/account-scoped results)" },
      ],
      operations: {
        list: {
          method: "GET",
          path: `${SCS}/v1/components/vulnerabilities`,
          pathBuilder: (input, config) => {
            const artifactId = input.artifact_id as string | undefined;
            if (artifactId) {
              const cfg = config as Record<string, string | undefined>;
              const org = (input.org_id as string) || cfg.HARNESS_ORG || "";
              const project = (input.project_id as string) || cfg.HARNESS_PROJECT || "";
              return `${SCS}/v1/orgs/${org}/projects/${project}/artifacts/${artifactId}/component/vulnerabilities`;
            }
            return `${SCS}/v1/components/vulnerabilities`;
          },
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            purl: "purl",
            page: "page",
            size: "limit",
          },
          defaultQueryParams: { limit: "10" },
          responseExtractor: componentVulnerabilityExtract,
          description: "List CVE/vulnerability details for a component by PURL. Returns severity, CVSS, fix versions per CVE.",
        },
      },
    },

    // ── Project-Level OSS Risk Summary (P3-2) ─────────────────────────
    {
      resourceType: "application_security_oss_risk_summary",
      aliases: ["scs_oss_risk_summary"],
      displayName: "Project OSS Risk Summary",
      description: "Project-level OSS risk overview — aggregated counts of end-of-life, unmaintained, and outdated components across ALL artifacts in a project. "
        + "Returns: total_artifacts_scanned, total_artifacts_with_risks, aggregate risk counts (EOL, derived EOL, close-to-EOL, unmaintained, outdated), "
        + "and a per-artifact breakdown sorted by total risk count descending. "
        + "Use this for: 'What is the OSS risk in my project?', 'Which artifacts have the most risk?', 'How many EOL components do we have?', "
        + "'Show me a project security overview', 'OSS health summary'. "
        + "This is a READ-ONLY summary — for individual component risk details, follow up with application_security_component_enrichment (pass purl). "
        + "For remediation advice on specific components, use application_security_component_remediation.",
      diagnosticHint: "If you get a 404: the SCS_COMPONENT_ENRICHMENT feature flag may not be enabled for this account. "
        + "If total_artifacts_scanned is 0: no artifacts in this project have SBOM data — ensure SBOM generation steps are configured in pipelines.",
      searchAliases: [
        "oss risk summary", "project risk", "eol summary", "outdated summary",
        "unmaintained summary", "project security overview", "oss health",
        "risk overview", "component risk summary", "project oss risk", "scs"],
      relatedResources: [
        { resourceType: "application_security_component_enrichment", relationship: "child", description: "Drill into individual component risk by purl" },
        { resourceType: "application_security_artifact_component", relationship: "child", description: "List components for a specific artifact" },
        { resourceType: "application_security_component_remediation", relationship: "sibling", description: "Get upgrade suggestions for at-risk components" },
        { resourceType: "application_security_artifact", relationship: "parent", description: "List artifacts in the project" },
      ],
      toolset: "application_security",
      scope: "project",
      identifierFields: [],
      operations: {
        get: {
          method: "GET",
          path: `${SCS}/v1/orgs/{org}/projects/{project}/oss-risks/summary`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { org_id: "org", project_id: "project" },
          responseExtractor: scsCleanExtract,
          description: "Get project-level OSS risk summary with aggregate counts and per-artifact breakdown",
        },
      },
    },

    // ── Project Security Overview (P3-5) ────────────────────────────────
    {
      resourceType: "application_security_project_overview",
      aliases: ["scs_project_security_overview"],
      displayName: "Project Security Overview",
      description: "Comprehensive project-level security posture overview — aggregates SBOM coverage, vulnerability counts, "
        + "compliance check results, enforcement violations, and deployment summary across ALL artifacts (container images and code repositories). "
        + "Use this for: 'Give me a security overview of my project', 'What is the security posture?', 'How many vulnerabilities in my project?', "
        + "'Show compliance status', 'SBOM coverage', 'How many artifacts are deployed to production?'. "
        + "Returns six sections: artifact_count (total/images/repositories), vulnerability_summary (critical/high/medium/low), "
        + "compliance_summary (passed/failed checks with severity breakdown), enforcement_summary (deny-list/allow-list violations), "
        + "sbom_coverage (artifacts with/without SBOM, total components), deployment_summary (prod/non-prod artifact counts). "
        + "This is a READ-ONLY summary endpoint — for drill-down, use the specific SCS resources (application_security_artifact, application_security_compliance_result, application_security_bom_violation, etc.).",
      diagnosticHint: "If you get a 404: ensure the project has SCS enabled and artifacts have been scanned. "
        + "If all counts are zero: no artifacts have been onboarded — ensure SBOM generation steps are configured in pipelines. "
        + "For individual artifact details, use harness_list(resource_type='application_security_artifact', source_id='...'). "
        + "ANTI-FABRICATION: Report ONLY the numbers returned by this endpoint. Do NOT calculate percentages, infer trends across time, "
        + "or invent metrics (e.g. 'risk score', 'health grade') that are not present in the response.",
      searchAliases: [
        "security overview", "project security", "security posture", "security summary",
        "vulnerability summary", "compliance summary", "enforcement summary",
        "sbom coverage", "deployment summary", "project health",
        "how secure is my project", "security status", "scs"],
      relatedResources: [
        { resourceType: "application_security_artifact_source", relationship: "child", description: "List artifact sources for drill-down into specific registries" },
        { resourceType: "application_security_artifact", relationship: "child", description: "List individual artifacts with vulnerability and compliance details" },
        { resourceType: "application_security_compliance_result", relationship: "child", description: "Drill into compliance check results for a specific artifact" },
        { resourceType: "application_security_bom_violation", relationship: "child", description: "Drill into BOM enforcement violations for a specific artifact" },
        { resourceType: "application_security_oss_risk_summary", relationship: "sibling", description: "OSS risk summary — EOL, outdated, unmaintained component counts" },
      ],
      toolset: "application_security",
      scope: "project",
      identifierFields: [],
      operations: {
        get: {
          method: "GET",
          path: `${SCS}/v1/orgs/{org}/projects/{project}/security-overview`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { org_id: "org", project_id: "project" },
          responseExtractor: projectSecurityOverviewExtract,
          description: "Get comprehensive project-level security posture overview",
        },
      },
    },

    // ── SBOM Drift (server-side diff between two SBOM versions) ───────
    {
      resourceType: "application_security_sbom_drift",
      aliases: ["scs_sbom_drift"],
      displayName: "SBOM Drift",
      description: "Server-side SBOM drift calculation — compares two SBOM versions and returns a summary of component and license changes. "
        + "FAR more efficient than fetching all components for both artifacts and diffing in-context. "
        + "Use this for ANY query about: new dependencies between versions, removed packages, SBOM diff, dependency changes, what changed between builds. "
        + "Two-step flow: (1) get orchestration_id from application_security_artifact list response (orchestration.id field), "
        + "(2) harness_execute(resource_type='application_security_sbom_drift', action='calculate', orchestration_id=<id>, base='last_generated_sbom'). "
        + "The 'base' parameter controls what to compare against: 'last_generated_sbom' (previous SBOM for same artifact source), "
        + "'baseline' (the pinned baseline version), or 'repository' (a specific tag/version). "
        + "Returns: drift_id (for detailed drill-down), total_drifts, component_drift_summary (added/deleted/modified counts), license_drift_summary. "
        + "For detailed component-level diffs, use application_security_component_drift with the returned drift_id.",
      diagnosticHint: "If you get 'Could not find activity': the orchestration_id may be expired or invalid. "
        + "Get fresh orchestration IDs from harness_list(resource_type='application_security_artifact', source_id='...') — look for orchestration.id in each artifact. "
        + "The 'base' field is required. Use 'last_generated_sbom' to compare against the previous version of the same artifact source.",
      searchAliases: [
        "sbom diff", "sbom drift", "dependency diff", "dependency changes",
        "new dependencies", "removed dependencies", "what changed",
        "component changes", "version diff", "sbom comparison",
        "compare versions", "compare artifacts", "changes between versions",
        "what was added", "what was removed", "new packages",
        "introduced dependencies", "diff between builds", "scs"],
      relatedResources: [
        { resourceType: "application_security_artifact", relationship: "parent", description: "Get orchestration_id from artifact list (orchestration.id field)" },
        { resourceType: "application_security_component_drift", relationship: "child", description: "Drill into component-level diffs using drift_id from calculate response" },
      ],
      toolset: "application_security",
      scope: "project",
      identifierFields: ["orchestration_id"],
      executeHint: "To calculate SBOM drift: "
        + "(1) List artifacts: harness_list(resource_type='application_security_artifact', source_id='...'). "
        + "(2) Pick the most recent artifact's orchestration.id. "
        + "(3) harness_execute(resource_type='application_security_sbom_drift', action='calculate', orchestration_id=<id>, base='last_generated_sbom'). "
        + "The server compares against the previous SBOM automatically. No need to fetch component lists manually.",
      operations: {},
      executeActions: {
        calculate: {
          method: "POST",
          path: `${SCS}/v1/orgs/{org}/projects/{project}/orchestration/{orchestration}/sbom-drift`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { org_id: "org", project_id: "project", orchestration_id: "orchestration" },
          bodyBuilder: (input) => ({
            base: (input.base as string) || "last_generated_sbom",
            ...(input.variant ? { variant: input.variant } : {}),
          }),
          responseExtractor: scsCleanExtract,
          actionDescription: "Calculate SBOM drift between an orchestration step and its baseline. "
            + "Required: orchestration_id (path), base (body: 'last_generated_sbom', 'baseline', or 'repository'). "
            + "Returns drift_id + summary with component/license change counts.",
          bodySchema: {
            description: "SBOM drift calculation request — specify what to compare against",
            fields: [
              { name: "base", type: "string", required: true, description: "Baseline to compare against: 'last_generated_sbom' (previous version), 'baseline' (pinned baseline), or 'repository' (specific tag)" },
              { name: "variant", type: "object", required: false, description: "Only for base='repository': { type: 'tag', value: '<tag_name>' } — specifies which tag to compare against" },
            ],
          },
        },
      },
    },

    // ── Component Drift (detailed component-level diffs from a drift) ─
    {
      resourceType: "application_security_component_drift",
      aliases: ["scs_component_drift"],
      displayName: "SBOM Component Drift",
      description: "Component-level drift details from a server-side SBOM comparison. Shows exactly which packages were added, deleted, or modified between two SBOM versions. "
        + "Requires drift_id from harness_execute(resource_type='application_security_sbom_drift', action='calculate'). "
        + "Each result includes: status (added/modified/deleted), old_component, new_component — with package name, version, license, purl, supplier. "
        + "Filter by status to see only additions, deletions, or modifications. "
        + "This replaces the need to fetch full component lists and diff them manually — saving tokens and improving accuracy.",
      diagnosticHint: "If you get a 404: verify drift_id is correct. "
        + "Get drift_id from harness_execute(resource_type='application_security_sbom_drift', action='calculate', orchestration_id='...', base='last_generated_sbom'). "
        + "If total_drifts was 0 in the calculate response, there are no component drifts to list.",
      searchAliases: [
        "component diff", "package diff", "added components", "removed components",
        "modified components", "dependency additions", "dependency removals", "scs"],
      relatedResources: [
        { resourceType: "application_security_sbom_drift", relationship: "parent", description: "Calculate drift first to get drift_id" },
        { resourceType: "application_security_artifact", relationship: "parent", description: "Get orchestration_id needed to trigger drift calculation" },
      ],
      toolset: "application_security",
      scope: "project",
      identifierFields: ["drift_id"],
      listFilterFields: [
        { name: "drift_id", description: "Drift ID from application_security_sbom_drift calculate response", required: true },
        { name: "status", description: "Filter by drift status: 'added', 'modified', or 'deleted'" },
        { name: "search_term", description: "Search components by name" },
      ],
      operations: {
        list: {
          method: "GET",
          path: `${SCS}/v1/orgs/{org}/projects/{project}/sbom-drift/{drift}/components`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { org_id: "org", project_id: "project", drift_id: "drift" },
          queryParams: {
            page: "page",
            size: "limit",
            status: "status",
            search_term: "search_term",
          },
          defaultQueryParams: { limit: "10" },
          responseExtractor: scsListExtract(COMPONENT_DRIFT_LIST_FIELDS),
          description: "List component-level drifts (added/modified/deleted packages) for a drift ID",
        },
      },
    },

    // ── SBOM Download ──────────────────────────────────────────────────
    {
      resourceType: "application_security_sbom",
      aliases: ["scs_sbom"],
      displayName: "SBOM",
      description: "Software Bill of Materials download via a time-limited pre-signed URL. "
        + "Requires an orchestration ID from artifact chain of custody: "
        + "harness_get(resource_type='application_security_chain_of_custody', artifact_id='...') then "
        + "harness_get(resource_type='application_security_sbom', orchestration_id=...). "
        + "Returns download_url + expires_at — ALWAYS show download_url as a clickable download link to the user; "
        + "do not fetch or dump the SBOM blob into the conversation.",
      diagnosticHint: "If you get a 404: verify orchestration_id is correct. "
        + "Get orchestration IDs from harness_get(resource_type='application_security_chain_of_custody', artifact_id='...'). "
        + "Confirm the orchestration run produced an SBOM.",
      searchAliases: ["sbom", "software bill of materials", "bom", "sbom download", "scs"],
      relatedResources: [
        { resourceType: "application_security_chain_of_custody", relationship: "parent", description: "Get orchestration_id needed for SBOM download" },
      ],
      toolset: "application_security",
      scope: "project",
      identifierFields: ["orchestration_id"],
      operations: {
        get: {
          method: "GET",
          // Note: this endpoint uses singular org/project (no 's') — API inconsistency
          path: `${SCS}/v1/org/{org}/project/{project}/orchestration/{orchestrationId}/download-sbom`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { org_id: "org", project_id: "project", orchestration_id: "orchestrationId" },
          responseExtractor: sbomDownloadExtract,
          description: "Get a time-limited pre-signed URL for the SBOM object. "
            + "ALWAYS show download_url as a clickable link to the user; do not omit it or only summarize.",
        },
      },
    },
  ],
};
