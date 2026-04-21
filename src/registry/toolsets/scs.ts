import type { ToolsetDefinition } from "../types.js";
import { scsCleanExtract, scsListExtract } from "../extractors.js";

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
 * Custom extractor for artifact_security list responses.
 * Wraps scsListExtract and injects a `_next_step` hint on each artifact that
 * has policy violations, guiding the LLM to call scs_bom_violation with the
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
                + `MUST call harness_list(resource_type='scs_bom_violation', enforcement_id='${pe.id}') for details. `
                + `Do NOT present violation data without that call.`;
        }
      }
    }
    return item;
  });
};

/**
 * Custom extractor for scs_artifact_source list responses.
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
 * Custom extractor for scs_component_dependencies.
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
 * Custom extractor for scs_component_vulnerability.
 * The agent often supplements real CVE results with CVEs from training data
 * (e.g. fabricating CVE IDs or CVSS scores). Append a count + reminder.
 */
const componentVulnerabilityExtract = (raw: unknown): unknown => {
  const cleaned = scsCleanExtract(raw);
  if (Array.isArray(cleaned)) {
    if (cleaned.length === 0) {
      return { _result: "EMPTY", _message: "No CVEs found. If 2+ components return empty, stop querying — enrichment pipeline has not processed this artifact. "
        + "Report aggregate counts from artifact_security instead. NEVER supplement with training-data CVEs." };
    }
    return [...cleaned, { _total_cves: cleaned.length, _reminder: "Report ONLY these CVEs. Do NOT add CVEs from training knowledge." }];
  }
  return cleaned;
};

/**
 * Custom extractor for scs_component_remediation.
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
 * Custom extractor for scs_project_security_overview.
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
 * Custom extractor for scs_bom_violation list responses.
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
 * Custom extractor for code_repo_security list responses.
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
 * Custom extractor for scs_artifact_component list responses.
 * When any returned component has outdated or EOL indicators, append a _next_step
 * hint pointing the LLM toward scs_component_enrichment and scs_component_remediation.
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
        _next_step: "Components with risk detected. Use scs_component_enrichment (purl) for details, scs_component_remediation (purl) for upgrades.",
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
 * Custom extractor for scs_remediation_pr list responses.
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

export const scsToolset: ToolsetDefinition = {
  name: "scs",
  displayName: "Software Supply Chain Assurance",
  description:
    "Harness SCS — artifact sources, artifact security, code repositories, SBOMs, compliance, remediation, dependency graph, PR creation, and auto-PR configuration. "
    + "To modify SBOM/SCS pipeline steps (e.g., change SBOM tool from Syft to CycloneDX, update source image), use the pipeline resource from the pipelines toolset: "
    + "harness_get(resource_type='pipeline') → edit YAML → harness_update(resource_type='pipeline'). "
    + "SCS step types: SscaOrchestration, SscaEnforcement, SscaCompliance, SscaArtifactSigning, SscaArtifactVerification.",
  resources: [
    // ── Artifact Sources ───────────────────────────────────────────────
    {
      resourceType: "scs_artifact_source",
      displayName: "SCS Artifact Source",
      description: "Software supply chain artifact source (registry) registered in the project. Supports list. "
        + "NOT the same as 'artifact' (Artifact Registry) or 'registry' — use this for supply chain security queries. "
        + "Retain source_id from responses — it is required to list artifacts within a source. "
        + "Two-step flow: first list sources to get source_id, then list artifacts within that source. "
        + "PATH SELECTION: Use this drill-in (scs_artifact_source → artifact_security → scs_artifact_component) "
        + "when you need canonical artifact_id values for downstream remediation, enrichment, or dependency calls. "
        + "For 'find component X across all artifacts' discovery WITHOUT needing canonical IDs, PREFER scs_component_search "
        + "(single call, cross-artifact) instead of iterating this drill-in for every source.",
      diagnosticHint: "If you get a 404: use harness_list(resource_type='scs_artifact_source') to discover valid source IDs. "
        + "Source IDs are required before querying artifacts, components, or compliance.",
      searchAliases: ["artifact source", "artifact registry security", "supply chain artifact", "scs artifact", "docker image source", "container registry"],
      relatedResources: [
        { resourceType: "artifact_security", relationship: "child", description: "List artifacts within this source (requires source_id)" },
        { resourceType: "scs_artifact_component", relationship: "grandchild", description: "List dependencies within an artifact (requires artifact_id from artifact_security)" },
        { resourceType: "scs_compliance_result", relationship: "grandchild", description: "Compliance results for an artifact" },
      ],
      toolset: "scs",
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
      resourceType: "artifact_security",
      displayName: "Artifact Security",
      description: "Supply chain artifact security posture — vulnerabilities, compliance, SBOM. "
        + "NOT the same as 'artifact' (Artifact Registry) — use this for security/vulnerability/compliance queries about artifacts. "
        + "List artifacts from a source, or get an artifact overview. "
        + "Retain artifact_id and source_id from responses — they are required for follow-up queries "
        + "(compliance, components, chain of custody, SBOM, remediation). "
        + "IMPORTANT: source_id is required to list artifacts. Get it from harness_list(resource_type='scs_artifact_source') first. "
        + "IMPORTANT: For policy violation DETAILS (component names, license types, deny-list vs allow-list), "
        + "you MUST continue to scs_bom_violation using enforcement_id from violations.enforcementId in this response. "
        + "This resource only shows violation counts — not the actual violation details.",
      diagnosticHint: "If you get a 404: verify source_id is correct. Use harness_list(resource_type='scs_artifact_source') to find valid source IDs. "
        + "For artifact details, use harness_get with both source_id and artifact_id. "
        + "When comparing artifacts with other entities (e.g. repos), summarize key metrics "
        + "(vulnerability counts, compliance score, scorecard, component count) in a concise "
        + "side-by-side table rather than dumping full details for each — keeps the response readable.",
      searchAliases: ["artifact vulnerability", "artifact security posture", "artifact overview", "supply chain artifact", "scs artifact", "artifact sbom"],
      relatedResources: [
        { resourceType: "scs_artifact_source", relationship: "parent", description: "Get source_id needed to list artifacts" },
        { resourceType: "scs_bom_violation", relationship: "child", description: "BOM enforcement policy violations — deny-list/allow-list/OPA violations (requires enforcement_id from violations.enforcementId). Use for ANY 'policy violation' or 'enforcement' query." },
        { resourceType: "scs_artifact_component", relationship: "child", description: "List dependencies/components within this artifact" },
        { resourceType: "scs_sbom_drift", relationship: "child", description: "SBOM drift — compare this artifact's SBOM against previous version. Use orchestration.id from artifact response. PREFERRED over manually fetching and diffing component lists." },
        { resourceType: "scs_compliance_result", relationship: "child", description: "CIS/OWASP benchmark checks ONLY — NOT for BOM enforcement or policy violations" },
        { resourceType: "scs_chain_of_custody", relationship: "child", description: "Chain of custody events for this artifact" },
        { resourceType: "scs_sbom", relationship: "child", description: "SBOM download (requires orchestration_id from chain of custody)" },
        { resourceType: "scs_artifact_remediation", relationship: "child", description: "Remediation advice for components (requires purl)" },
        { resourceType: "scs_component_remediation", relationship: "child", description: "Safe upgrade suggestions with dependency impact analysis (requires purl)" },
        { resourceType: "scs_remediation_pr", relationship: "child", description: "Create/list remediation PRs for component upgrades" },
      ],
      toolset: "scs",
      scope: "project",
      identifierFields: ["source_id", "artifact_id"],
      listFilterFields: [
        { name: "source_id", description: "Artifact source ID (get from harness_list resource_type=scs_artifact_source)", required: true },
        { name: "search_term", description: "Filter artifacts by name or keyword" },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/supply-chain/artifacts/{artifactId}",
      operations: {
        list: {
          method: "POST",
          path: `${SCS}/v1/orgs/{org}/projects/{project}/artifact-sources/{source}/artifacts`,
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
      resourceType: "scs_artifact_component",
      displayName: "SCS Artifact Component",
      description: "Flat inventory of software components present in an artifact — SBOM component list. Supports list. "
        + "Returns components co-located in the artifact; this is NOT a dependency graph and does NOT imply "
        + "dependency relationships among the listed components. Two components appearing in the same list "
        + "does not mean one depends on the other. "
        + "Use this for dependency queries (e.g., 'show dependencies', 'find lodash', 'list direct dependencies'). "
        + "Also use this to find which components have known vulnerabilities (check vulnerability_count field in response). "
        + "Retain purl from responses — it is required for remediation lookups and dependency tree queries.",
      diagnosticHint: "If you get a 404: verify artifact_id is correct. Get artifact IDs from harness_list(resource_type='artifact_security', source_id='...'). "
        + "Use dependency_type='DIRECT' to filter for direct dependencies only. "
        + "For dependency TREE (what a specific component depends on, transitive deps), use scs_component_dependencies instead — this resource only returns a flat list. "
        + "REVERSE dependencies (what depends on component X) are NOT available from any SCS endpoint. "
        + "If asked 'what depends on X' or 'what breaks if I upgrade X', state that reverse dependency lookup is unavailable — "
        + "do NOT infer impact from the component list, and do NOT fabricate dependency relationships from training knowledge.",
      searchAliases: ["dependency", "sbom component", "package", "library", "component list", "direct dependency", "transitive dependency"],
      relatedResources: [
        { resourceType: "artifact_security", relationship: "parent", description: "Get artifact_id needed to list components" },
        { resourceType: "scs_component_dependencies", relationship: "child", description: "Get dependency tree for a specific component (pass purl)" },
        { resourceType: "scs_component_remediation", relationship: "sibling", description: "Safe upgrade suggestions with dependency impact analysis (pass purl) — preferred over scs_artifact_remediation" },
        { resourceType: "scs_component_enrichment", relationship: "sibling", description: "OSS risk / EOL / outdated status for a component (pass purl)" },
        { resourceType: "scs_component_vulnerability", relationship: "sibling", description: "Individual CVE details (severity, CVSS, fix versions) for a component (pass purl)" },
        { resourceType: "scs_oss_risk_summary", relationship: "sibling", description: "Project-level OSS risk overview across all artifacts" },
      ],
      toolset: "scs",
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
      resourceType: "scs_component_search",
      displayName: "Cross-Artifact Component Search",
      description: "PREFERRED path for cross-artifact component discovery — search for a component by name across ALL artifacts "
        + "(images and repos) in the project in a single call. "
        + "Returns matching components with their parent artifact info (artifactId, artifactName). "
        + "Use this when the user asks 'which repos/artifacts contain dependency X', 'find lodash across all artifacts', "
        + "'list all components containing log4j', or any similar broad discovery question. "
        + "Prefer this over iterating scs_artifact_source → artifact_security → scs_artifact_component for every source — "
        + "that drill-in is only needed when you require canonical artifact_id for follow-up remediation/enrichment calls. "
        + "IMPORTANT: search_term is required. Org/project scope is resolved automatically from session context — "
        + "you do not need to pass org_id or project_id explicitly. "
        + "WARNING: The artifactId returned here is a search-index ID. "
        + "For remediation, enrichment, or dependency lookups you MUST resolve the artifact through "
        + "harness_list(scs_artifact_source) → harness_list(artifact_security) first, then use THAT artifact_id.",
      diagnosticHint: "If you get empty results: the component may not exist in any scanned artifact. "
        + "Verify the component name is spelled correctly. Search is case-insensitive prefix match. "
        + "If a subsequent remediation/dependency call returns 404, the artifactId from search results is a search-index ID — "
        + "use the canonical chain: scs_artifact_source → artifact_security → scs_artifact_component → remediation.",
      searchAliases: ["cross-artifact search", "find dependency", "which repos use", "component across artifacts", "dependency search"],
      relatedResources: [
        { resourceType: "scs_artifact_component", relationship: "sibling", description: "List all components within a specific artifact (requires artifact_id)" },
        { resourceType: "scs_component_enrichment", relationship: "child", description: "OSS risk / EOL status for a found component (pass purl from results)" },
        { resourceType: "scs_component_vulnerability", relationship: "child", description: "CVE details for a found component (pass purl from results)" },
      ],
      toolset: "scs",
      scope: "project",
      identifierFields: [],
      listFilterFields: [
        { name: "search_term", description: "Component name to search for (case-insensitive prefix match)", required: true },
      ],
      operations: {
        list: {
          method: "GET",
          path: `${SCS}/v1/orgs/{org}/projects/{project}/components/search`,
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
      resourceType: "scs_component_dependencies",
      displayName: "Component Dependency Tree",
      description: "Dependency tree for a specific component within an artifact — shows what a component DEPENDS ON (forward dependencies only). "
        + "Returns direct and indirect (transitive) dependencies with their relationship paths and vulnerability counts. "
        + "Input: artifact_id (as resource_id) + component purl (required). "
        + "Use this when the user asks about: dependency tree, dependency chain, transitive dependencies, what X depends on, full dependency graph, or dependency impact. "
        + "This is DIFFERENT from scs_artifact_component which lists all components IN an artifact (flat list). "
        + "This resource shows what a SINGLE component depends on (tree structure). "
        + "IMPORTANT: This does NOT show reverse dependencies (what depends on X). If the result is empty, the component has no sub-dependencies — report this accurately, do NOT fabricate or infer dependencies.",
      diagnosticHint: "If you get a 404: verify artifact_id and purl are correct. "
        + "Get purl values from harness_list(resource_type='scs_artifact_component', artifact_id='...'). "
        + "This endpoint works for both code repo and container image artifacts. "
        + "IMPORTANT: This API shows FORWARD dependencies only (what this component depends on). "
        + "It does NOT show REVERSE dependencies (what other components use this one). "
        + "If the user asks 'what depends on X' or 'what breaks if I upgrade X', state that reverse dependency lookup is not available — "
        + "do NOT fabricate dependency relationships from training knowledge.",
      searchAliases: ["dependency tree", "dependency graph", "transitive dependencies", "component tree", "depends on", "dependency chain"],
      relatedResources: [
        { resourceType: "scs_artifact_component", relationship: "parent", description: "Get purl values needed for dependency tree lookup" },
        { resourceType: "scs_component_remediation", relationship: "sibling", description: "NEXT STEP for upgrade questions: returns recommended version and dependency impact analysis — data NOT available in the dependency tree" },
      ],
      toolset: "scs",
      scope: "project",
      identifierFields: ["artifact_id"],
      listFilterFields: [
        { name: "purl", description: "Package URL of the component (e.g. pkg:npm/express@4.18.0) — required", required: true },
      ],
      operations: {
        get: {
          method: "GET",
          path: `${SCS}/v1/orgs/{org}/projects/{project}/artifacts/{artifact}/component/dependencies`,
          pathParams: { org_id: "org", project_id: "project", artifact_id: "artifact" },
          queryParams: {
            purl: "purl",
          },
          responseExtractor: componentDependenciesExtract,
          description: "Get dependency tree for a component by PURL",
        },
      },
    },

    // ── Artifact Remediation ───────────────────────────────────────────
    {
      resourceType: "scs_artifact_remediation",
      displayName: "SCS Artifact Remediation (Legacy)",
      description: "Legacy remediation advice endpoint. PREFER scs_component_remediation instead — it returns structured upgrade suggestions with dependency impact analysis (added/removed/modified dependencies). "
        + "This resource returns the same data but scs_component_remediation has richer descriptions and is the recommended resource for all remediation queries. "
        + "Works for code repository artifacts only — not available for container images. "
        + "Pass artifact_id as resource_id and purl via params.",
      diagnosticHint: "If you get a 404: (1) verify artifact_id and purl are correct, (2) remediation only works for code repo artifacts, not container images. "
        + "Get purl values from harness_list(resource_type='scs_artifact_component', artifact_id='...').",
      searchAliases: ["remediation", "fix vulnerability", "upgrade component", "patch"],
      relatedResources: [
        { resourceType: "scs_artifact_component", relationship: "parent", description: "Get purl values needed for remediation lookup" },
      ],
      toolset: "scs",
      scope: "project",
      identifierFields: ["artifact_id"],
      listFilterFields: [
        { name: "purl", description: "Package URL of the component (e.g. pkg:npm/express@4.18.0) — required for remediation lookup", required: true },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/supply-chain/artifacts/{artifactId}",
      operations: {
        get: {
          method: "GET",
          path: `${SCS}/v1/orgs/{org}/projects/{project}/artifacts/{artifact}/component/remediation`,
          pathParams: { org_id: "org", project_id: "project", artifact_id: "artifact" },
          queryParams: {
            purl: "purl",
            target_version: "targetVersion",
          },
          responseExtractor: scsCleanExtract,
          description: "Get remediation advice for a component by package URL (purl)",
        },
      },
    },

    // ── Chain of Custody ───────────────────────────────────────────────
    {
      resourceType: "scs_chain_of_custody",
      displayName: "SCS Chain of Custody",
      description: "Chain of custody (event history) for an artifact. Supports get. "
        + "Returns orchestration IDs needed to download SBOMs.",
      diagnosticHint: "If you get a 404: verify artifact_id is correct. Get artifact IDs from harness_list(resource_type='artifact_security', source_id='...').",
      searchAliases: ["chain of custody", "provenance", "attestation", "signing", "slsa"],
      relatedResources: [
        { resourceType: "artifact_security", relationship: "parent", description: "Get artifact_id needed for chain of custody" },
        { resourceType: "scs_sbom", relationship: "child", description: "Download SBOM using orchestration_id from chain of custody" },
      ],
      toolset: "scs",
      scope: "project",
      identifierFields: ["artifact_id"],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/supply-chain/artifacts/{artifactId}",
      operations: {
        get: {
          method: "GET",
          path: `${SCS}/v2/orgs/{org}/projects/{project}/artifacts/{artifact}/chain-of-custody`,
          pathParams: { org_id: "org", project_id: "project", artifact_id: "artifact" },
          responseExtractor: scsCleanExtract,
          description: "Get chain of custody events for an artifact",
        },
      },
    },

    // ── Compliance Results ─────────────────────────────────────────────
    {
      resourceType: "scs_compliance_result",
      displayName: "SCS Compliance Result",
      description: "CIS and OWASP benchmark compliance scan results for an artifact. "
        + "Use ONLY for CIS/OWASP compliance checks (e.g. 'Is my artifact CIS compliant?', 'Show OWASP results'). "
        + "NOT for BOM enforcement violations, deny-list/allow-list violations, or OPA policy violations — use scs_bom_violation for those.",
      diagnosticHint: "If you get a 404: verify artifact_id is correct. Get artifact IDs from harness_list(resource_type='artifact_security', source_id='...'). "
        + "Filter by standards (e.g. 'CIS', 'OWASP') and status ('PASSED', 'FAILED', 'WARNING'). "
        + "IMPORTANT: For BOM enforcement / OPA policy violations, use scs_bom_violation instead.",
      searchAliases: ["compliance", "cis", "owasp", "compliance check", "cis benchmark", "owasp check"],
      relatedResources: [
        { resourceType: "artifact_security", relationship: "parent", description: "Get artifact_id needed for compliance queries" },
        { resourceType: "policy", relationship: "sibling", description: "OPA policies (deny-list/allow-list) evaluated during enforcement — use governance toolset to create/manage" },
        { resourceType: "policy_set", relationship: "sibling", description: "OPA policy sets controlling enforcement rules — use governance toolset to create/manage" },
      ],
      toolset: "scs",
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
      resourceType: "scs_bom_violation",
      displayName: "BOM Enforcement Violation",
      description: "BOM (Bill of Materials) enforcement policy violations — shows which OPA policies failed and why. "
        + "Use this for ANY query about policy violations, enforcement violations, deny-list violations, allow-list violations, or BOM enforcement results. "
        + "Surfaces both deny-list and allow-list violations, including exempted violations (shown with isExempted flag). "
        + "NOT for CIS/OWASP benchmark checks — use scs_compliance_result for those. "
        + "Two-step flow: first get artifact overview via harness_list(resource_type='artifact_security') to find enforcement_id from violations.enforcementId, "
        + "then harness_list(resource_type='scs_bom_violation', enforcement_id=<id>) for violation details. "
        + "For COUNTS or SUMMARY of violations: use harness_get(resource_type='scs_bom_violation', enforcement_id=<id>) — returns total counts by violation type (deny-list vs allow-list) without listing individual violations. "
        + "For DETAILS of individual violations (names, licenses, purls): use harness_list.",
      diagnosticHint: "If you get a 404: verify enforcement_id is correct. "
        + "Get enforcement_id from harness_list(resource_type='artifact_security', filters={source_id:'...', artifact_id:'...'}) — "
        + "look for violations.enforcementId in the response. "
        + "If the artifact has no enforcement results, enforcement_id will be absent. "
        + "IMPORTANT: Do NOT use scs_compliance_result for BOM/OPA enforcement violations — that resource is only for CIS/OWASP checks. "
        + "ANTI-FABRICATION: Report each violation's exact violation_type (allow-list vs deny-list) as returned. "
        + "Do NOT reclassify allow-list as deny-list or vice versa. If the user asks for one type, filter to only that type — "
        + "do NOT mix types or infer a violation's classification from the license name.",
      searchAliases: ["bom violation", "policy violation", "enforcement violation", "deny list violation", "allow list violation", "sbom violation", "bom enforcement violation", "enforcement", "enforcement summary", "enforcement status", "violation counts", "violation summary", "bom enforcement", "sbom enforcement"],
      relatedResources: [
        { resourceType: "artifact_security", relationship: "parent", description: "Get enforcement_id from artifact overview (violations.enforcementId)" },
        { resourceType: "scs_compliance_result", relationship: "sibling", description: "Compliance scan results (CIS/OWASP checks) — different from BOM enforcement violations" },
        { resourceType: "policy", relationship: "sibling", description: "OPA policies that define enforcement rules — use governance toolset to manage" },
      ],
      toolset: "scs",
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
          pathParams: { org_id: "org", project_id: "project", enforcement_id: "enforcement" },
          responseExtractor: scsCleanExtract,
          description: "Get enforcement summary with violation counts by type",
        },
      },
    },

    // ── Code Repositories ──────────────────────────────────────────────
    {
      resourceType: "code_repo_security",
      displayName: "Code Repository Security",
      description: "Code repository security posture — vulnerabilities, compliance, SBOM for source code repos. "
        + "NOT the same as 'repository' (Harness Code) — use this for security/vulnerability queries about code repos. "
        + "Supports list and get (overview). "
        + "Retain repo_id from responses — it is required to get the repository security overview. "
        + "repo_id IS an artifact_id (repos are artifacts of type REPOSITORY). "
        + "To list repo dependencies: harness_list(resource_type='scs_artifact_component', artifact_id=<repo_id>, dependency_type='DIRECT'). "
        + "To get remediation for a repo dependency: harness_get(resource_type='scs_component_remediation', artifact_id=<repo_id>, purl=<purl>).",
      diagnosticHint: "If you get a 404: use harness_list(resource_type='code_repo_security') to discover valid repo IDs. "
        + "Code repos are also artifacts (ArtifactType.REPOSITORY) — repo_id can be used as artifact_id for component queries.",
      searchAliases: ["repo security", "repository security", "code repo vulnerability", "repo compliance", "source code security"],
      relatedResources: [
        { resourceType: "scs_artifact_component", relationship: "child", description: "List repo dependencies (use repo_id as artifact_id, dependency_type=DIRECT)" },
        { resourceType: "scs_compliance_result", relationship: "child", description: "Compliance results for this repo" },
      ],
      toolset: "scs",
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
          pathParams: { org_id: "org", project_id: "project", repo_id: "codeRepo" },
          responseExtractor: scsCleanExtract,
          description: "Get code repository security overview",
        },
      },
    },

    // ── Component Remediation (P3-6: upgrade suggestions + impact analysis) ─
    {
      resourceType: "scs_component_remediation",
      displayName: "Component Remediation Suggestion",
      description: "Safe upgrade suggestions for a vulnerable OSS component — returns the specific version to upgrade to and what dependencies change. "
        + "DO NOT use for status checks (is it outdated? is it EOL? risk score?) — use scs_component_enrichment for those. "
        + "ONLY call this resource when the user explicitly asks about upgrade versions, safe versions, remediation advice, or dependency impact of upgrades — "
        + "this data comes from a dedicated API and CANNOT be inferred from component lists or dependency trees. "
        + "Returns: recommended_version (the specific safe version to upgrade to), warnings, dependency_changes (added/removed/modified dependencies), and code_preview. "
        + "Input: artifact_id (as resource_id) + component purl (required). "
        + "To create a PR with the suggested upgrade, use scs_remediation_pr.",
      diagnosticHint: "If you get a 404: (1) verify artifact_id and purl are correct, (2) remediation works for code repo artifacts only — not container images. "
        + "Get purl values from harness_list(resource_type='scs_artifact_component', artifact_id='...'). "
        + "Optionally pass target_version to get upgrade suggestions for a specific version. "
        + "ANTI-FABRICATION: Report ONLY the recommended_version returned by this endpoint. Do NOT supplement with 'latest' versions from training knowledge, "
        + "do NOT infer versions from semver patterns, and if the response contains remediation_warnings indicating guidance is unavailable, "
        + "say 'remediation not available — check the upstream project' rather than inventing a target version.",
      searchAliases: ["upgrade suggestion", "safe upgrade", "component upgrade", "fix vulnerability", "remediation suggestion", "dependency impact"],
      relatedResources: [
        { resourceType: "scs_artifact_component", relationship: "parent", description: "Get purl values needed for remediation lookup" },
        { resourceType: "scs_remediation_pr", relationship: "child", description: "Create a PR to apply the suggested upgrade" },
      ],
      toolset: "scs",
      scope: "project",
      identifierFields: ["artifact_id"],
      listFilterFields: [
        { name: "purl", description: "Package URL of the component (e.g. pkg:npm/express@4.18.0) — required", required: true },
        { name: "target_version", description: "Specific target version to evaluate upgrade to (optional)" },
      ],
      operations: {
        get: {
          method: "GET",
          path: `${SCS}/v1/orgs/{org}/projects/{project}/artifacts/{artifact}/component/remediation`,
          pathParams: { org_id: "org", project_id: "project", artifact_id: "artifact" },
          queryParams: {
            purl: "purl",
            target_version: "targetVersion",
          },
          responseExtractor: componentRemediationExtract,
          description: "Get safe upgrade suggestions and dependency impact analysis for a component",
        },
      },
    },

    // ── Remediation Pull Requests (P3-6: PR creation + tracking) ──────
    {
      resourceType: "scs_remediation_pr",
      displayName: "Remediation Pull Request",
      description: "Create and list remediation pull requests that upgrade vulnerable/outdated components. "
        + "WRITE OPERATION: create will open a real PR in the source repository. "
        + "Requires artifact_id. For create, also requires component purl and target_version in the body. "
        + "\n\nREQUIRED WORKFLOW BEFORE CREATING A PR (follow IN ORDER):\n"
        + "  1. harness_list(resource_type='scs_remediation_pr', artifact_id='<id>') — list existing PRs for this artifact.\n"
        + "  2. Inspect the list: if ANY existing PR has the same component purl (or matching package_name) as the one you intend to upgrade, STOP. Do NOT call harness_create. Instead, report the existing PR (its number/URL/status) to the user and ask whether they want to supersede or discard it before creating a new one.\n"
        + "  3. Only if NO existing PR covers this component: call harness_get(resource_type='scs_component_remediation', ...) to confirm the recommended target_version.\n"
        + "  4. Then call harness_create(resource_type='scs_remediation_pr', ...).\n\n"
        + "Skipping step 1-2 and creating a duplicate PR for a component that already has one is a known failure mode — always check first. "
        + "Merging or dismissing PRs is done in the source repository (or generic pull-request tools), not via this SCS resource. "
        + "USAGE: harness_create(resource_type='scs_remediation_pr', params={artifact_id: '<id>'}, body={purl: '<purl>', target_version: '<ver>'}). "
        + "Do NOT put purl/target_version in params — they must be in body.",
      diagnosticHint: "If you get a 404: verify artifact_id is correct. Use harness_get(resource_type='scs_component_remediation', artifact_id='...', purl='...') to verify the component exists. "
        + "For create: ensure purl and target_version are provided.",
      searchAliases: ["remediation pr", "fix pr", "upgrade pr", "pull request", "create pr", "remediation pull request"],
      relatedResources: [
        { resourceType: "scs_component_remediation", relationship: "parent", description: "Review upgrade suggestion before creating PR" },
        { resourceType: "scs_auto_pr_config", relationship: "sibling", description: "Configure automatic PR creation rules" },
      ],
      toolset: "scs",
      scope: "project",
      identifierFields: ["artifact_id"],
      listFilterFields: [
        { name: "artifact_id", description: "Artifact ID to list/create remediation PRs for", required: true },
      ],
      operations: {
        list: {
          method: "GET",
          path: `${SCS}/v1/orgs/{org}/projects/{project}/artifacts/{artifact}/component/remediation/pull-requests`,
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
          pathParams: { org_id: "org", project_id: "project", artifact_id: "artifact" },
          bodyBuilder: (input) => {
            const body = (input.body && typeof input.body === "object" ? input.body : {}) as Record<string, unknown>;
            return {
              ...(body.purl || input.purl ? { purl: (body.purl || input.purl) as string } : {}),
              ...(body.target_version || input.target_version ? { target_version: (body.target_version || input.target_version) as string } : {}),
            };
          },
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
            let existing: unknown;
            try {
              existing = await reg.dispatch(
                client,
                "scs_remediation_pr",
                "list",
                { artifact_id: artifactId, page: 0, size: 100 },
                signal,
              );
            } catch {
              // If the list call fails (e.g. transient API error) we intentionally
              // do NOT block the create — fall through so the operator can still
              // recover. The agent will see the create outcome directly.
              return;
            }

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
            const items = pickItems(existing);
            const normalize = (s: string): string => (s.split("@")[0] ?? s).toLowerCase();
            const targetKey = normalize(purl);
            const conflict = items.find((pr) => {
              const prPurl = typeof pr.purl === "string" ? pr.purl : "";
              const prPkg = typeof pr.package_name === "string" ? pr.package_name : "";
              if (prPurl && normalize(prPurl) === targetKey) return true;
              if (prPkg && targetKey.endsWith(`/${prPkg.toLowerCase()}`)) return true;
              return false;
            });

            if (conflict) {
              const ref = [
                conflict.pull_request_url ? `url=${String(conflict.pull_request_url)}` : "",
                conflict.pull_request_number ? `#${String(conflict.pull_request_number)}` : "",
                conflict.status ? `status=${String(conflict.status)}` : "",
              ].filter(Boolean).join(" ");
              throw new Error(
                `Duplicate remediation PR blocked: an existing PR already covers ${purl} on artifact ${artifactId} (${ref}). `
                + `Close or supersede the existing PR before creating a new one, or confirm with the user that they want a second PR for the same component. `
                + `Use harness_list(resource_type='scs_remediation_pr', artifact_id='${artifactId}') to review existing PRs.`,
              );
            }
          },
          responseExtractor: scsCleanExtract,
          description: "Create a remediation PR to upgrade a vulnerable component. "
            + "MCP preflight: automatically lists existing remediation PRs for this artifact "
            + "and blocks the create with an error if any existing PR already covers the same purl/package_name.",
          bodySchema: {
            description: "Remediation PR creation payload — component PURL and target upgrade version",
            fields: [
              { name: "purl", type: "string", required: true, description: "Package URL of the component to upgrade (e.g. pkg:npm/express@4.18.0)" },
              { name: "target_version", type: "string", required: true, description: "Target version to upgrade to (from scs_component_remediation suggestions)" },
            ],
          },
        },
      },
    },

    // ── Auto PR Configuration (P3-12) ─────────────────────────────────
    {
      resourceType: "scs_auto_pr_config",
      displayName: "Auto PR Configuration",
      description: "Automatic pull request configuration for OSS remediation. "
        + "Controls when PRs are automatically created to upgrade vulnerable or outdated components. "
        + "Use get to view current config, update to modify rules. "
        + "WRITE OPERATION: update changes automated behavior — a misconfigured rule could flood repositories with PRs.",
      diagnosticHint: "Use harness_get(resource_type='scs_auto_pr_config') to view current configuration before making changes. "
        + "This is a project-level configuration — no artifact_id needed.",
      searchAliases: ["auto pr", "automatic pull request", "auto remediation", "pr config", "auto pr configuration"],
      relatedResources: [
        { resourceType: "scs_remediation_pr", relationship: "sibling", description: "Manual PR creation for individual components" },
        { resourceType: "scs_component_remediation", relationship: "sibling", description: "Review upgrade suggestions" },
      ],
      toolset: "scs",
      scope: "project",
      scopeParams: { org: "org_id", project: "project_id" },
      identifierFields: [],
      operations: {
        get: {
          method: "GET",
          path: `${SCS}/v1/ssca-config/auto-pr-config`,
          responseExtractor: scsCleanExtract,
          description: "Get current auto-PR configuration",
        },
        update: {
          method: "PUT",
          path: `${SCS}/v1/ssca-config/auto-pr-config`,
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
      resourceType: "scs_component_enrichment",
      displayName: "Component OSS Risk & Enrichment",
      description: "OSS risk ASSESSMENT and enrichment data for a component by Package URL (PURL). "
        + "This is the STATUS CHECK resource — call it BEFORE scs_component_remediation. "
        + "Returns: end-of-life (EOL) status and risk score, whether the version is outdated or unmaintained, "
        + "latest available version, license info, and vulnerability count. "
        + "ALWAYS use this when the user asks: 'Is this library safe?', 'Is component X end-of-life?', "
        + "'Is my version of Y outdated?', 'What is the latest version of Z?', 'What is the risk?', 'Check OSS risk status'. "
        + "Input: purl (Package URL, e.g. pkg:npm/express@4.18.0). "
        + "Two modes: (1) Account-scoped — pass purl only. Works for any known component. "
        + "(2) Project-scoped — pass artifact_id + purl. Returns richer data: dependency type (direct/transitive), parent components, STO vulnerability source. "
        + "For individual CVE/vulnerability DETAILS (CVE IDs, CVSS scores, fix versions), use scs_component_vulnerability instead — this resource covers OSS risk only.",
      diagnosticHint: "If you get empty results: the component may not have been enriched yet (only components seen in scanned SBOMs are enriched). "
        + "Get purl values from harness_list(resource_type='scs_artifact_component', artifact_id='...'). "
        + "PURL format: pkg:<type>/<namespace>/<name>@<version> (e.g. pkg:npm/express@4.18.0, pkg:golang/stdlib@1.20.0). "
        + "For richer data (dependency type, parents), always pass artifact_id when available.",
      searchAliases: [
        "oss risk", "end of life", "eol", "outdated", "unmaintained",
        "component risk", "library risk", "package risk", "version risk",
        "is it safe", "latest version", "component enrichment",
        "still maintained", "actively maintained", "is it maintained",
        "risk level", "risk score", "maintenance status",
        "deprecated", "abandoned", "stale dependency",
      ],
      relatedResources: [
        { resourceType: "scs_artifact_component", relationship: "parent", description: "List components in an artifact to get purl values and artifact_id" },
        { resourceType: "scs_component_remediation", relationship: "sibling", description: "Get upgrade suggestions if the component is outdated/at-risk" },
        { resourceType: "scs_oss_risk_summary", relationship: "parent", description: "Project-level OSS risk overview — start here for broad risk assessment" },
        { resourceType: "scs_component_vulnerability", relationship: "sibling", description: "Individual CVE details (severity, CVSS, fix versions) — use for specific CVE/vulnerability queries" },
      ],
      toolset: "scs",
      scope: "project",
      scopeOptional: true,
      identifierFields: ["artifact_id"],
      listFilterFields: [
        { name: "purl", description: "Package URL of the component (e.g. pkg:npm/express@4.18.0) — required", required: true },
        { name: "artifact_id", description: "Artifact ID for project-scoped lookup (preferred — returns richer data including dependency type and parents)" },
      ],
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
          queryParams: {
            purl: "purl",
          },
          responseExtractor: scsCleanExtract,
          description: "Get OSS risk and enrichment data for a component by PURL. Pass artifact_id for project-scoped results.",
        },
      },
    },

    // ── Component Vulnerability Details (PRD §3.4 — CVE/CVSS lookup) ──
    {
      resourceType: "scs_component_vulnerability",
      displayName: "Component Vulnerability Details",
      description: "CVE and vulnerability details for a specific OSS component by Package URL (PURL). "
        + "Returns INDIVIDUAL CVE records with severity, CVSS score, and fix/upgrade versions — "
        + "this is the ONLY resource that provides per-CVE details for a component. "
        + "Use this when the user asks: 'What CVEs affect X?', 'Show vulnerabilities for library Y', "
        + "'CVSS scores for Z', 'Security advisories for component W', 'Is this version vulnerable?'. "
        + "DO NOT use scs_component_enrichment for CVE queries — it only returns aggregate counts (issue_count), "
        + "not individual CVE IDs or CVSS scores. "
        + "Input: purl (Package URL, e.g. pkg:npm/express@4.18.0). Optionally pass artifact_id for artifact-scoped results. "
        + "Two modes: (1) Account-scoped — pass purl only. Returns all known CVEs for the component globally. "
        + "(2) Artifact-scoped — pass artifact_id + purl. Returns CVEs in the context of a specific artifact.",
      diagnosticHint: "If you get empty results: the vulnerability enrichment pipeline may not have processed this component yet. "
        + "IMPORTANT: Even when artifact_security shows aggregate vulnerability counts (e.g. 677 total), "
        + "this endpoint may return empty — that means per-CVE details are not available, NOT that there are zero vulnerabilities. "
        + "In that case, report the AGGREGATE counts from artifact_security and state: 'Specific CVE details are not yet available in the system.' "
        + "NEVER fill the gap with CVEs from your training knowledge — that is fabrication. "
        + "Get purl values from harness_list(resource_type='scs_artifact_component', artifact_id='...'). "
        + "PURL format: pkg:<type>/<namespace>/<name>@<version> (e.g. pkg:npm/express@4.18.0).",
      searchAliases: [
        "cve", "vulnerability", "cvss", "security advisory", "security issue",
        "component vulnerability", "library vulnerability", "package vulnerability",
        "known vulnerabilities", "cve lookup", "vulnerability scan",
        "is it vulnerable", "security flaws", "critical vulnerability",
      ],
      relatedResources: [
        { resourceType: "scs_artifact_component", relationship: "parent", description: "List components in an artifact to get purl values" },
        { resourceType: "scs_component_enrichment", relationship: "sibling", description: "OSS risk (EOL, unmaintained, outdated) — aggregate data, not individual CVEs" },
        { resourceType: "scs_component_remediation", relationship: "sibling", description: "Safe upgrade suggestions to fix vulnerabilities" },
      ],
      toolset: "scs",
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
      resourceType: "scs_oss_risk_summary",
      displayName: "Project OSS Risk Summary",
      description: "Project-level OSS risk overview — aggregated counts of end-of-life, unmaintained, and outdated components across ALL artifacts in a project. "
        + "Returns: total_artifacts_scanned, total_artifacts_with_risks, aggregate risk counts (EOL, derived EOL, close-to-EOL, unmaintained, outdated), "
        + "and a per-artifact breakdown sorted by total risk count descending. "
        + "Use this for: 'What is the OSS risk in my project?', 'Which artifacts have the most risk?', 'How many EOL components do we have?', "
        + "'Show me a project security overview', 'OSS health summary'. "
        + "This is a READ-ONLY summary — for individual component risk details, follow up with scs_component_enrichment (pass purl). "
        + "For remediation advice on specific components, use scs_component_remediation.",
      diagnosticHint: "If you get a 404: the SCS_COMPONENT_ENRICHMENT feature flag may not be enabled for this account. "
        + "If total_artifacts_scanned is 0: no artifacts in this project have SBOM data — ensure SBOM generation steps are configured in pipelines.",
      searchAliases: [
        "oss risk summary", "project risk", "eol summary", "outdated summary",
        "unmaintained summary", "project security overview", "oss health",
        "risk overview", "component risk summary", "project oss risk",
      ],
      relatedResources: [
        { resourceType: "scs_component_enrichment", relationship: "child", description: "Drill into individual component risk by purl" },
        { resourceType: "scs_artifact_component", relationship: "child", description: "List components for a specific artifact" },
        { resourceType: "scs_component_remediation", relationship: "sibling", description: "Get upgrade suggestions for at-risk components" },
        { resourceType: "artifact_security", relationship: "parent", description: "List artifacts in the project" },
      ],
      toolset: "scs",
      scope: "project",
      identifierFields: [],
      operations: {
        get: {
          method: "GET",
          path: `${SCS}/v1/orgs/{org}/projects/{project}/oss-risks/summary`,
          pathParams: { org_id: "org", project_id: "project" },
          responseExtractor: scsCleanExtract,
          description: "Get project-level OSS risk summary with aggregate counts and per-artifact breakdown",
        },
      },
    },

    // ── Project Security Overview (P3-5) ────────────────────────────────
    {
      resourceType: "scs_project_security_overview",
      displayName: "Project Security Overview",
      description: "Comprehensive project-level security posture overview — aggregates SBOM coverage, vulnerability counts, "
        + "compliance check results, enforcement violations, and deployment summary across ALL artifacts (container images and code repositories). "
        + "Use this for: 'Give me a security overview of my project', 'What is the security posture?', 'How many vulnerabilities in my project?', "
        + "'Show compliance status', 'SBOM coverage', 'How many artifacts are deployed to production?'. "
        + "Returns six sections: artifact_count (total/images/repositories), vulnerability_summary (critical/high/medium/low), "
        + "compliance_summary (passed/failed checks with severity breakdown), enforcement_summary (deny-list/allow-list violations), "
        + "sbom_coverage (artifacts with/without SBOM, total components), deployment_summary (prod/non-prod artifact counts). "
        + "This is a READ-ONLY summary endpoint — for drill-down, use the specific SCS resources (artifact_security, scs_compliance_result, scs_bom_violation, etc.).",
      diagnosticHint: "If you get a 404: ensure the project has SCS enabled and artifacts have been scanned. "
        + "If all counts are zero: no artifacts have been onboarded — ensure SBOM generation steps are configured in pipelines. "
        + "For individual artifact details, use harness_list(resource_type='artifact_security', source_id='...'). "
        + "ANTI-FABRICATION: Report ONLY the numbers returned by this endpoint. Do NOT calculate percentages, infer trends across time, "
        + "or invent metrics (e.g. 'risk score', 'health grade') that are not present in the response.",
      searchAliases: [
        "security overview", "project security", "security posture", "security summary",
        "vulnerability summary", "compliance summary", "enforcement summary",
        "sbom coverage", "deployment summary", "project health",
        "how secure is my project", "security status",
      ],
      relatedResources: [
        { resourceType: "scs_artifact_source", relationship: "child", description: "List artifact sources for drill-down into specific registries" },
        { resourceType: "artifact_security", relationship: "child", description: "List individual artifacts with vulnerability and compliance details" },
        { resourceType: "scs_compliance_result", relationship: "child", description: "Drill into compliance check results for a specific artifact" },
        { resourceType: "scs_bom_violation", relationship: "child", description: "Drill into BOM enforcement violations for a specific artifact" },
        { resourceType: "scs_oss_risk_summary", relationship: "sibling", description: "OSS risk summary — EOL, outdated, unmaintained component counts" },
      ],
      toolset: "scs",
      scope: "project",
      identifierFields: [],
      operations: {
        get: {
          method: "GET",
          path: `${SCS}/v1/orgs/{org}/projects/{project}/security-overview`,
          pathParams: { org_id: "org", project_id: "project" },
          responseExtractor: projectSecurityOverviewExtract,
          description: "Get comprehensive project-level security posture overview",
        },
      },
    },

    // ── SBOM Drift (server-side diff between two SBOM versions) ───────
    {
      resourceType: "scs_sbom_drift",
      displayName: "SBOM Drift",
      description: "Server-side SBOM drift calculation — compares two SBOM versions and returns a summary of component and license changes. "
        + "FAR more efficient than fetching all components for both artifacts and diffing in-context. "
        + "Use this for ANY query about: new dependencies between versions, removed packages, SBOM diff, dependency changes, what changed between builds. "
        + "Two-step flow: (1) get orchestration_id from artifact_security list response (orchestration.id field), "
        + "(2) harness_execute(resource_type='scs_sbom_drift', action='calculate', orchestration_id=<id>, base='last_generated_sbom'). "
        + "The 'base' parameter controls what to compare against: 'last_generated_sbom' (previous SBOM for same artifact source), "
        + "'baseline' (the pinned baseline version), or 'repository' (a specific tag/version). "
        + "Returns: drift_id (for detailed drill-down), total_drifts, component_drift_summary (added/deleted/modified counts), license_drift_summary. "
        + "For detailed component-level diffs, use scs_component_drift with the returned drift_id.",
      diagnosticHint: "If you get 'Could not find activity': the orchestration_id may be expired or invalid. "
        + "Get fresh orchestration IDs from harness_list(resource_type='artifact_security', source_id='...') — look for orchestration.id in each artifact. "
        + "The 'base' field is required. Use 'last_generated_sbom' to compare against the previous version of the same artifact source.",
      searchAliases: [
        "sbom diff", "sbom drift", "dependency diff", "dependency changes",
        "new dependencies", "removed dependencies", "what changed",
        "component changes", "version diff", "sbom comparison",
        "compare versions", "compare artifacts", "changes between versions",
        "what was added", "what was removed", "new packages",
        "introduced dependencies", "diff between builds",
      ],
      relatedResources: [
        { resourceType: "artifact_security", relationship: "parent", description: "Get orchestration_id from artifact list (orchestration.id field)" },
        { resourceType: "scs_component_drift", relationship: "child", description: "Drill into component-level diffs using drift_id from calculate response" },
      ],
      toolset: "scs",
      scope: "project",
      identifierFields: ["orchestration_id"],
      executeHint: "To calculate SBOM drift: "
        + "(1) List artifacts: harness_list(resource_type='artifact_security', source_id='...'). "
        + "(2) Pick the most recent artifact's orchestration.id. "
        + "(3) harness_execute(resource_type='scs_sbom_drift', action='calculate', orchestration_id=<id>, base='last_generated_sbom'). "
        + "The server compares against the previous SBOM automatically. No need to fetch component lists manually.",
      operations: {},
      executeActions: {
        calculate: {
          method: "POST",
          path: `${SCS}/v1/orgs/{org}/projects/{project}/orchestration/{orchestration}/sbom-drift`,
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
      resourceType: "scs_component_drift",
      displayName: "SBOM Component Drift",
      description: "Component-level drift details from a server-side SBOM comparison. Shows exactly which packages were added, deleted, or modified between two SBOM versions. "
        + "Requires drift_id from harness_execute(resource_type='scs_sbom_drift', action='calculate'). "
        + "Each result includes: status (added/modified/deleted), old_component, new_component — with package name, version, license, purl, supplier. "
        + "Filter by status to see only additions, deletions, or modifications. "
        + "This replaces the need to fetch full component lists and diff them manually — saving tokens and improving accuracy.",
      diagnosticHint: "If you get a 404: verify drift_id is correct. "
        + "Get drift_id from harness_execute(resource_type='scs_sbom_drift', action='calculate', orchestration_id='...', base='last_generated_sbom'). "
        + "If total_drifts was 0 in the calculate response, there are no component drifts to list.",
      searchAliases: [
        "component diff", "package diff", "added components", "removed components",
        "modified components", "dependency additions", "dependency removals",
      ],
      relatedResources: [
        { resourceType: "scs_sbom_drift", relationship: "parent", description: "Calculate drift first to get drift_id" },
        { resourceType: "artifact_security", relationship: "parent", description: "Get orchestration_id needed to trigger drift calculation" },
      ],
      toolset: "scs",
      scope: "project",
      identifierFields: ["drift_id"],
      listFilterFields: [
        { name: "drift_id", description: "Drift ID from scs_sbom_drift calculate response", required: true },
        { name: "status", description: "Filter by drift status: 'added', 'modified', or 'deleted'" },
        { name: "search_term", description: "Search components by name" },
      ],
      operations: {
        list: {
          method: "GET",
          path: `${SCS}/v1/orgs/{org}/projects/{project}/sbom-drift/{drift}/components`,
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
      resourceType: "scs_sbom",
      displayName: "SBOM",
      description: "Software Bill of Materials download. Requires an orchestration ID (from artifact chain of custody). "
        + "Use this to download the full SBOM for an artifact build.",
      diagnosticHint: "If you get a 404: verify orchestration_id is correct. Get orchestration IDs from harness_get(resource_type='scs_chain_of_custody', artifact_id='...').",
      searchAliases: ["sbom", "software bill of materials", "bom", "sbom download"],
      relatedResources: [
        { resourceType: "scs_chain_of_custody", relationship: "parent", description: "Get orchestration_id needed for SBOM download" },
      ],
      toolset: "scs",
      scope: "project",
      identifierFields: ["orchestration_id"],
      operations: {
        get: {
          method: "GET",
          // Note: this endpoint uses singular org/project (no 's') — API inconsistency
          path: `${SCS}/v1/org/{org}/project/{project}/orchestration/{orchestrationId}/sbom-download`,
          pathParams: { org_id: "org", project_id: "project", orchestration_id: "orchestrationId" },
          responseExtractor: scsCleanExtract,
          description: "Get SBOM download URL for an orchestration run",
        },
      },
    },
  ],
};
