import type { ToolsetDefinition, BodySchema } from "../types.js";
import { v1ListExtract, passthrough } from "../extractors.js";

// ---------------------------------------------------------------------------
// Body schemas (for harness_describe output)
// ---------------------------------------------------------------------------

const policyCreateSchema: BodySchema = {
  description: "OPA policy definition",
  fields: [
    { name: "identifier", type: "string", required: true, description: "Unique identifier for the policy" },
    { name: "name", type: "string", required: true, description: "Display name" },
    { name: "rego", type: "string", required: true, description: "Rego policy source code" },
    { name: "git_connector_ref", type: "string", required: false, description: "Git connector reference for remote policy storage" },
    { name: "git_path", type: "string", required: false, description: "Path within the git repo" },
    { name: "git_repo", type: "string", required: false, description: "Git repository name" },
  ],
};

const policyUpdateSchema: BodySchema = {
  description: "OPA policy update",
  fields: [
    { name: "name", type: "string", required: false, description: "Updated display name" },
    { name: "rego", type: "string", required: false, description: "Updated Rego policy source code" },
  ],
};

const policySetCreateSchema: BodySchema = {
  description: "OPA policy set definition",
  fields: [
    { name: "identifier", type: "string", required: true, description: "Unique identifier for the policy set" },
    { name: "name", type: "string", required: true, description: "Display name" },
    { name: "action", type: "string", required: true, description: "Enforcement action: onrun, onsave, onpush, etc." },
    { name: "type", type: "string", required: true, description: "Entity type: pipeline, connector, service, environment, etc." },
    { name: "enabled", type: "boolean", required: true, description: "Whether the policy set is enabled" },
    { name: "description", type: "string", required: false, description: "Description of the policy set" },
    { name: "policies", type: "array", required: false, description: "Policies to include: [{ identifier, severity }]", itemType: "{ identifier: string, severity: 'warning' | 'error' }" },
    { name: "yaml_version", type: "string", required: false, description: "YAML version for the policy set" },
  ],
};

const policySetUpdateSchema: BodySchema = {
  description: "OPA policy set update",
  fields: [
    { name: "name", type: "string", required: false, description: "Updated display name" },
    { name: "action", type: "string", required: false, description: "Updated enforcement action" },
    { name: "type", type: "string", required: false, description: "Updated entity type" },
    { name: "enabled", type: "boolean", required: false, description: "Enable or disable the policy set" },
    { name: "description", type: "string", required: false, description: "Updated description" },
    { name: "policies", type: "array", required: false, description: "Updated policies: [{ identifier, severity }]", itemType: "{ identifier: string, severity: 'warning' | 'error' }" },
    { name: "resource_groups", type: "array", required: false, description: "Resource group selectors", itemType: "object" },
    { name: "entity_selector", type: "array", required: false, description: "Entity selectors for scoping", itemType: "object" },
  ],
};

// ---------------------------------------------------------------------------
// Toolset definition
// ---------------------------------------------------------------------------

export const governanceToolset: ToolsetDefinition = {
  name: "governance",
  displayName: "Governance",
  description: "OPA policy management — policies, policy sets, and policy evaluation results",
  resources: [
    // ----- Policy -----
    {
      resourceType: "policy",
      displayName: "OPA Policy",
      description: "OPA Rego policy for Harness governance. Supports full CRUD. "
        + "Use this for SCS/SBOM enforcement — create deny-list or allow-list policies that control which components are permitted in your supply chain. "
        + "Policies are written in Rego and evaluated against SBOM components during enforcement. "
        + "To list SBOM/SSCA-enforcement policies specifically, pass filter type='sbom_enforcement' "
        + "(note: individual policies use 'sbom_enforcement' while the policy sets that contain them use type='sbom' — "
        + "see the policy_set resource for details on this asymmetry).",
      searchAliases: ["opa policy", "rego policy", "deny list", "allow list", "sbom policy", "governance policy", "supply chain policy"],
      relatedResources: [
        { resourceType: "policy_set", relationship: "parent", description: "Group policies into policy sets with enforcement actions" },
        { resourceType: "policy_evaluation", relationship: "child", description: "View evaluation results for this policy" },
        { resourceType: "scs_compliance_result", relationship: "sibling", description: "SCS compliance results showing policy enforcement outcomes on artifacts" },
      ],
      toolset: "governance",
      scope: "project",
      identifierFields: ["policy_id"],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/settings/governance/policies/edit/{identifier}",
      listFilterFields: [
        { name: "search_term", description: "Filter policies by name or keyword" },
        { name: "type", description: "Filter by policy entity type. For SBOM/SSCA enforcement use 'sbom_enforcement'. Other known values: pipeline, connector, service, environment, secret, template, infrastructure. Unknown values return an empty list rather than an error." },
        { name: "sort", description: "Sort field" },
        { name: "identifier_filter", description: "Filter by policy identifier" },
        { name: "exclude_rego", description: "Exclude rego source from list response", type: "boolean" },
        { name: "include_policy_set_count", description: "Include count of policy sets referencing each policy", type: "boolean" },
      ],
      operations: {
        list: {
          method: "GET",
          path: "/pm/api/v1/policies",
          queryParams: {
            search_term: "searchTerm",
            page: "page",
            size: "per_page",
            sort: "sort",
            type: "type",
            identifier_filter: "identifierFilter",
            exclude_rego: "excludeRegoFromResponse",
            include_policy_set_count: "includePolicySetCount",
          },
          responseExtractor: v1ListExtract(),
          description: "List OPA policies",
        },
        get: {
          method: "GET",
          path: "/pm/api/v1/policies/{identifier}",
          pathParams: { policy_id: "identifier" },
          responseExtractor: passthrough,
          description: "Get an OPA policy by identifier, including its Rego source",
        },
        create: {
          method: "POST",
          path: "/pm/api/v1/policies",
          bodyBuilder: (input) => input.body,
          responseExtractor: passthrough,
          description: "Create a new OPA policy",
          bodySchema: policyCreateSchema,
        },
        update: {
          method: "PATCH",
          path: "/pm/api/v1/policies/{identifier}",
          pathParams: { policy_id: "identifier" },
          bodyBuilder: (input) => input.body,
          responseExtractor: passthrough,
          description: "Update an existing OPA policy",
          bodySchema: policyUpdateSchema,
        },
        delete: {
          method: "DELETE",
          path: "/pm/api/v1/policies/{identifier}",
          pathParams: { policy_id: "identifier" },
          responseExtractor: passthrough,
          description: "Delete an OPA policy",
        },
      },
    },

    // ----- Policy Set -----
    {
      resourceType: "policy_set",
      displayName: "OPA Policy Set",
      description: "Policy set grouping OPA policies with an enforcement action and an entity type. Supports full CRUD. "
        + "For SCS/SBOM enforcement, use filter type='sbom' to list the policy sets that apply deny-list or allow-list rules during artifact scans — "
        + "the SBOM enforcement step (e.g. action='onstep') binds these sets to the artifact pipeline. "
        + "IMPORTANT TYPE ASYMMETRY: policy sets use type='sbom', while the individual policies they contain use type='sbom_enforcement'. "
        + "Do NOT pass type='sbom_enforcement' or type='ssca_enforcement' when listing policy sets — both return an empty result even when "
        + "SBOM policy sets exist in the project. Other supported types: pipeline, connector, service, environment, secret, template, infrastructure. "
        + "Policy sets control when and how policies are evaluated (on pipeline run, on save, on step, etc.).",
      searchAliases: ["policy set", "enforcement rules", "sbom enforcement", "supply chain enforcement", "governance rules"],
      relatedResources: [
        { resourceType: "policy", relationship: "child", description: "Individual policies contained in this set (use type='sbom_enforcement' to list SBOM policies)" },
        { resourceType: "policy_evaluation", relationship: "child", description: "Evaluation results for this policy set" },
        { resourceType: "scs_compliance_result", relationship: "sibling", description: "SCS compliance results showing enforcement outcomes" },
        { resourceType: "scs_bom_violation", relationship: "sibling", description: "BOM enforcement violations — each violation references the policy set identifier that fired it" },
      ],
      toolset: "governance",
      scope: "project",
      identifierFields: ["policy_set_id"],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/settings/governance/policy-sets/{identifier}",
      listFilterFields: [
        { name: "search_term", description: "Filter policy sets by name or keyword" },
        { name: "type", description: "Filter by policy-set entity type. For SBOM/SSCA enforcement use 'sbom' (NOT 'sbom_enforcement' or 'ssca_enforcement' — those are valid only for the policy resource and return empty on policy sets). Other known values: pipeline, connector, service, environment, secret, template, infrastructure." },
        { name: "action", description: "Filter by enforcement action. SBOM enforcement uses 'onstep'. Other values: onrun (pipeline), onsave, onpush, onstepstart." },
        { name: "sort", description: "Sort field" },
        { name: "identifier_filter", description: "Filter by policy set identifier" },
      ],
      operations: {
        list: {
          method: "GET",
          path: "/pm/api/v1/policysets",
          queryParams: {
            search_term: "searchTerm",
            page: "page",
            size: "per_page",
            sort: "sort",
            type: "type",
            action: "action",
            identifier_filter: "identifierFilter",
          },
          responseExtractor: v1ListExtract(),
          description: "List OPA policy sets",
        },
        get: {
          method: "GET",
          path: "/pm/api/v1/policysets/{identifier}",
          pathParams: { policy_set_id: "identifier" },
          responseExtractor: passthrough,
          description: "Get an OPA policy set by identifier",
        },
        create: {
          method: "POST",
          path: "/pm/api/v1/policysets",
          bodyBuilder: (input) => input.body,
          responseExtractor: passthrough,
          description: "Create a new OPA policy set",
          bodySchema: policySetCreateSchema,
        },
        update: {
          method: "PATCH",
          path: "/pm/api/v1/policysets/{identifier}",
          pathParams: { policy_set_id: "identifier" },
          bodyBuilder: (input) => input.body,
          responseExtractor: passthrough,
          description: "Update an existing OPA policy set",
          bodySchema: policySetUpdateSchema,
        },
        delete: {
          method: "DELETE",
          path: "/pm/api/v1/policysets/{identifier}",
          pathParams: { policy_set_id: "identifier" },
          responseExtractor: passthrough,
          description: "Delete an OPA policy set",
        },
      },
    },

    // ----- Policy Evaluation -----
    {
      resourceType: "policy_evaluation",
      displayName: "Policy Evaluation",
      description: "OPA policy evaluation result. Read-only — list and get evaluation outcomes.",
      toolset: "governance",
      scope: "project",
      identifierFields: ["evaluation_id"],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/settings/governance/evaluation/{id}",
      listFilterFields: [
        { name: "entity", description: "Filter by entity identifier" },
        { name: "type", description: "Filter by entity type (pipeline, connector, service, etc.)" },
        { name: "action", description: "Filter by action (onrun, onsave, etc.)" },
        { name: "status", description: "Filter by evaluation status" },
        { name: "execution_id", description: "Filter by pipeline execution ID" },
        { name: "created_date_from", description: "Filter evaluations created after this date (ISO 8601)" },
        { name: "created_date_to", description: "Filter evaluations created before this date (ISO 8601)" },
        { name: "include_child_scopes", description: "Include evaluations from child scopes", type: "boolean" },
      ],
      operations: {
        list: {
          method: "GET",
          path: "/pm/api/v1/evaluations",
          queryParams: {
            page: "page",
            size: "per_page",
            entity: "entity",
            type: "type",
            action: "action",
            status: "status",
            execution_id: "execution_id",
            created_date_from: "created_date_from",
            created_date_to: "created_date_to",
            include_child_scopes: "includeChildScopes",
          },
          responseExtractor: v1ListExtract(),
          description: "List OPA policy evaluation results",
        },
        get: {
          method: "GET",
          path: "/pm/api/v1/evaluations/{id}",
          pathParams: { evaluation_id: "id" },
          responseExtractor: passthrough,
          description: "Get a specific policy evaluation result by ID",
        },
      },
    },
  ],
};
