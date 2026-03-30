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

const ARTIFACT_COMPONENT_LIST_FIELDS = [
  "purl", "packageUrl", "package_name", "name", "package_version", "version",
  "package_license", "license", "dependency_type",
  "vulnerability_count", "supplier",
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
    "Harness SCS — artifact sources, artifact security, code repositories, SBOMs, compliance, remediation, dependency graph, PR creation, and auto-PR configuration",
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
        { resourceType: "scs_artifact_component", relationship: "child", description: "List dependencies/components within this artifact" },
        { resourceType: "scs_compliance_result", relationship: "child", description: "Compliance scan results for this artifact" },
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
        { resourceType: "scs_artifact_remediation", relationship: "sibling", description: "Remediation advice for a component (pass purl)" },
      ],
      toolset: "scs",
      scope: "project",
      identifierFields: ["artifact_id"],
      listFilterFields: [
        { name: "artifact_id", description: "Artifact ID to list components for", required: true },
        { name: "search_term", description: "Search components by name or package identifier" },
        { name: "dependency_type", description: "Filter by dependency type (DIRECT or TRANSITIVE)" }
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
        { resourceType: "scs_component_remediation", relationship: "sibling", description: "Get upgrade suggestions for a component" },
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
      displayName: "SCS Artifact Remediation",
      description: "Remediation advice for a component identified by its package URL (purl). "
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
      description: "Compliance scan results for an artifact — policy violations, CIS/OWASP checks. Supports list. "
        + "Use this for compliance and policy violation queries.",
      diagnosticHint: "If you get a 404: verify artifact_id is correct. Get artifact IDs from harness_list(resource_type='artifact_security', source_id='...'). "
        + "Filter by standards (e.g. 'CIS', 'OWASP') and status ('PASSED', 'FAILED', 'WARNING').",
      searchAliases: ["compliance", "policy violation", "cis", "owasp", "compliance check", "enforcement", "bom enforcement", "sbom enforcement"],
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
      description: "Safe upgrade suggestions for a vulnerable or outdated OSS component. "
        + "Returns recommended version, warnings, dependency impact analysis, and code preview. "
        + "Input: artifact_id (as resource_id) + component purl (required). "
        + "The response includes dependency_changes (added/removed/modified) — this IS the dependency impact analysis. "
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
