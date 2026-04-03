import type { ToolsetDefinition, PathBuilderConfig } from "../types.js";
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
  "violationType", "violationDetails",
  "supplier", "supplierType", "packageManager",
  "isExempted", "exemptionId",
];

const COMPONENT_DRIFT_LIST_FIELDS = [
  "status", "old_component", "new_component",
];

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
        + "Two-step flow: first list sources to get source_id, then list artifacts within that source.",
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
          responseExtractor: scsListExtract(ARTIFACT_SOURCE_LIST_FIELDS),
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
        + "IMPORTANT: source_id is required to list artifacts. Get it from harness_list(resource_type='scs_artifact_source') first.",
      diagnosticHint: "If you get a 404: verify source_id is correct. Use harness_list(resource_type='scs_artifact_source') to find valid source IDs. "
        + "For artifact details, use harness_get with both source_id and artifact_id.",
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
          responseExtractor: scsListExtract(ARTIFACT_SECURITY_LIST_FIELDS),
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
      description: "Software components (dependencies) within an artifact — SBOM component list. Supports list. "
        + "Use this for dependency queries (e.g., 'show dependencies', 'find lodash', 'list direct dependencies'). "
        + "Also use this to find which components have known vulnerabilities (check vulnerability_count field in response). "
        + "Retain purl from responses — it is required for remediation lookups and dependency tree queries.",
      diagnosticHint: "If you get a 404: verify artifact_id is correct. Get artifact IDs from harness_list(resource_type='artifact_security', source_id='...'). "
        + "Use dependency_type='DIRECT' to filter for direct dependencies only. "
        + "For dependency TREE (what a specific component depends on, transitive deps), use scs_component_dependencies instead — this resource only returns a flat list.",
      searchAliases: ["dependency", "sbom component", "package", "library", "component list", "direct dependency", "transitive dependency"],
      relatedResources: [
        { resourceType: "artifact_security", relationship: "parent", description: "Get artifact_id needed to list components" },
        { resourceType: "scs_component_dependencies", relationship: "child", description: "Get dependency tree for a specific component (pass purl)" },
        { resourceType: "scs_component_remediation", relationship: "sibling", description: "Safe upgrade suggestions with dependency impact analysis (pass purl) — preferred over scs_artifact_remediation" },
        { resourceType: "scs_component_enrichment", relationship: "sibling", description: "OSS risk / EOL / outdated status for a component (pass purl)" },
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
          responseExtractor: scsListExtract(ARTIFACT_COMPONENT_LIST_FIELDS),
          description: "List components (dependencies) in an artifact",
        },
      },
    },

    // ── Component Dependencies / Dependency Tree (P3-8) ──────────────
    {
      resourceType: "scs_component_dependencies",
      displayName: "Component Dependency Tree",
      description: "Dependency tree for a specific component within an artifact — shows what a component DEPENDS ON. "
        + "Returns direct and indirect (transitive) dependencies with their relationship paths and vulnerability counts. "
        + "Input: artifact_id (as resource_id) + component purl (required). "
        + "Use this when the user asks about: dependency tree, dependency chain, transitive dependencies, what X depends on, full dependency graph, or dependency impact. "
        + "This is DIFFERENT from scs_artifact_component which lists all components IN an artifact (flat list). "
        + "This resource shows what a SINGLE component depends on (tree structure).",
      diagnosticHint: "If you get a 404: verify artifact_id and purl are correct. "
        + "Get purl values from harness_list(resource_type='scs_artifact_component', artifact_id='...'). "
        + "This endpoint works for both code repo and container image artifacts.",
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
          responseExtractor: scsListExtract(COMPONENT_DEPENDENCY_LIST_FIELDS),
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
        + "Use get operation to retrieve enforcement summary (overall counts by violation type — deny-list vs allow-list).",
      diagnosticHint: "If you get a 404: verify enforcement_id is correct. "
        + "Get enforcement_id from harness_list(resource_type='artifact_security', filters={source_id:'...', artifact_id:'...'}) — "
        + "look for violations.enforcementId in the response. "
        + "If the artifact has no enforcement results, enforcement_id will be absent. "
        + "IMPORTANT: Do NOT use scs_compliance_result for BOM/OPA enforcement violations — that resource is only for CIS/OWASP checks.",
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
          responseExtractor: scsListExtract(BOM_VIOLATION_LIST_FIELDS),
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
          responseExtractor: scsListExtract(CODE_REPO_LIST_FIELDS),
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
        + "Optionally pass target_version to get upgrade suggestions for a specific version.",
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
          responseExtractor: scsCleanExtract,
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
        + "Requires artifact_id. For create, also requires component purl and target_version. "
        + "Use scs_component_remediation first to review the upgrade suggestion before creating a PR. "
        + "Closing or merging PRs is done in the source repository (or generic pull-request tools), not via this SCS resource.",
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
          responseExtractor: scsCleanExtract,
          description: "List remediation pull requests for an artifact",
        },
        create: {
          method: "POST",
          path: `${SCS}/v1/orgs/{org}/projects/{project}/artifacts/{artifact}/component/remediation/create-pull-request`,
          pathParams: { org_id: "org", project_id: "project", artifact_id: "artifact" },
          bodyBuilder: (input) => ({
            ...(input.purl ? { purl: input.purl } : {}),
            ...(input.target_version ? { target_version: input.target_version } : {}),
          }),
          responseExtractor: scsCleanExtract,
          description: "Create a remediation PR to upgrade a vulnerable component",
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
      identifierFields: [],
      operations: {
        get: {
          method: "GET",
          path: `${SCS}/v1/orgs/{org}/projects/{project}/ssca-config/auto-pr-config`,
          pathParams: { org_id: "org", project_id: "project" },
          responseExtractor: scsCleanExtract,
          description: "Get current auto-PR configuration",
        },
        update: {
          method: "PUT",
          path: `${SCS}/v1/orgs/{org}/projects/{project}/ssca-config/auto-pr-config`,
          pathParams: { org_id: "org", project_id: "project" },
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
        + "For CVE/vulnerability DETAILS, use security_issue (STO) instead — this resource covers OSS risk only.",
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
        { resourceType: "security_issue", relationship: "sibling", description: "CVE/vulnerability details (STO domain) — use for specific CVE queries" },
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
          pathBuilder: (input: Record<string, unknown>, config: PathBuilderConfig) => {
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
              { name: "orchestration_id", type: "string", required: true, description: "Orchestration step execution ID (from artifact_security orchestration.id field)" },
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
