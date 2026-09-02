import type { ToolsetDefinition, BodySchema } from "../types.js";
import { buildBodyNormalized } from "../../utils/body-normalizer.js";
import { ngExtract, pageExtract } from "../extractors.js";
import { isRecord } from "../../utils/type-guards.js";

const environmentCreateSchema: BodySchema = {
  description: "Environment definition",
  fields: [
    { name: "identifier", type: "string", required: true, description: "Unique identifier (lowercase, hyphens, underscores)" },
    { name: "name", type: "string", required: true, description: "Display name" },
    { name: "type", type: "string", required: true, description: "Environment type: Production or PreProduction" },
    { name: "description", type: "string", required: false, description: "Optional description" },
    { name: "tags", type: "object", required: false, description: "Key-value tag map" },
    { name: "yaml", type: "yaml", required: false, description: "Full environment YAML definition (for advanced config)" },
  ],
};

const environmentUpdateSchema: BodySchema = {
  description: "Environment update definition",
  fields: [
    { name: "identifier", type: "string", required: false, description: "Identifier (auto-injected from resource_id if missing)" },
    { name: "name", type: "string", required: true, description: "Display name" },
    { name: "type", type: "string", required: true, description: "Environment type: Production or PreProduction" },
    { name: "description", type: "string", required: false, description: "Updated description" },
    { name: "tags", type: "object", required: false, description: "Key-value tag map" },
  ],
};

/** Copy environmentRef onto environmentIdentifier so the deep-link template can resolve {environmentIdentifier}. */
function aliasEnvironmentIdentifier(record: Record<string, unknown>): void {
  if (typeof record.environmentIdentifier === "string" && record.environmentIdentifier) return;
  const nested = isRecord(record.infrastructure) ? record.infrastructure : undefined;
  const ref = record.environmentRef ?? nested?.environmentRef;
  if (typeof ref === "string" && ref) {
    record.environmentIdentifier = ref;
  }
}

const infrastructureExtract = (raw: unknown): unknown => {
  const data = ngExtract(raw);
  if (isRecord(data)) aliasEnvironmentIdentifier(data);
  return data;
};

const infrastructurePageExtract = (raw: unknown): { items: unknown[]; total: number } => {
  const page = pageExtract(raw);
  for (const item of page.items) {
    if (isRecord(item)) aliasEnvironmentIdentifier(item);
  }
  return page;
};

/**
 * Infra create/update body shaping (same unwrap/strip pattern as service/env), plus
 * ``ensureYamlWrapper`` — NG requires non-empty ``yaml`` and will not synthesize it
 * (QA: flat JSON → ``yaml: must not be empty``; service/env succeed without yaml).
 *
 * Inject org/project from tool-level ``org_id``/``project_id`` *before* yaml synthesis
 * so the generated ``body.yaml`` includes scope fields. Registry also injects those
 * into the JSON body later; without this, yaml would lag behind the outer body.
 */
const infrastructureScopeFields = [
  { from: "org_id", to: "orgIdentifier", onlyIfMissing: true },
  { from: "project_id", to: "projectIdentifier", onlyIfMissing: true },
] as const;

const infrastructureBodyBuilder = buildBodyNormalized({
  unwrapKey: "infrastructureDefinition",
  ensureYamlWrapper: "infrastructureDefinition",
  injectFields: [...infrastructureScopeFields],
});

const infrastructureUpdateBodyBuilder = buildBodyNormalized({
  unwrapKey: "infrastructureDefinition",
  ensureYamlWrapper: "infrastructureDefinition",
  injectIdentifier: { inputField: "infrastructure_id", bodyField: "identifier" },
  injectFields: [...infrastructureScopeFields],
});

export const environmentsToolset: ToolsetDefinition = {
  name: "environments",
  displayName: "Environments",
  description: "Deployment target environments (dev, staging, prod, etc.)",
  resources: [
    {
      resourceType: "environment",
      displayName: "Environment",
      description: "Deployment target environment. Supports full CRUD. Default list/get scope is project — pass org_id and project_id (or a project URL) on the first call. Use resource_scope='account' only when the user asked for account-level environments.",
      toolset: "environments",
      scope: "project",
      supportedScopes: ["account", "org", "project"],
      identifierFields: ["environment_id"],
      listFilterFields: [
        { name: "search_term", description: "Filter environments by name or keyword" },
        { name: "env_type", description: "Environment type filter", enum: ["Production", "PreProduction"] },
        { name: "sort", description: "Field to sort by (e.g. name, identifier)" },
        { name: "order", description: "Sort order", enum: ["asc", "desc"] },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/settings/environments/{environmentIdentifier}/details",
      operations: {
        list: {
          method: "GET",
          path: "/ng/api/environmentsV2",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            search_term: "searchTerm",
            env_type: "envType",
            sort: "sort",
            order: "order",
            page: "page",
            size: "size",
          },
          responseExtractor: pageExtract,
          description: "List environments in a project",
        },
        get: {
          method: "GET",
          path: "/ng/api/environmentsV2/{environmentIdentifier}",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { environment_id: "environmentIdentifier" },
          responseExtractor: ngExtract,
          description: "Get environment details",
        },
        create: {
          method: "POST",
          path: "/ng/api/environmentsV2",
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          bodyBuilder: buildBodyNormalized({ unwrapKey: "environment" }),
          responseExtractor: ngExtract,
          description: "Create a new environment",
          bodySchema: environmentCreateSchema,
        },
        update: {
          method: "PUT",
          path: "/ng/api/environmentsV2",
          operationPolicy: { risk: "low_write", retryPolicy: "safe" },
          bodyBuilder: buildBodyNormalized({
            unwrapKey: "environment",
            injectIdentifier: { inputField: "environment_id", bodyField: "identifier" },
          }),
          responseExtractor: ngExtract,
          description: "Update an existing environment",
          bodySchema: environmentUpdateSchema,
        },
        delete: {
          method: "DELETE",
          path: "/ng/api/environmentsV2/{environmentIdentifier}",
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          pathParams: { environment_id: "environmentIdentifier" },
          responseExtractor: ngExtract,
          description: "Delete an environment",
        },
      },
      executeActions: {
        move_configs: {
          method: "POST",
          path: "/ng/api/environmentsV2/move-config/{environmentIdentifier}",
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          pathParams: { environment_id: "environmentIdentifier" },
          queryParams: {
            connector_ref: "connectorRef",
            repo_name: "repoName",
            branch: "branch",
            file_path: "filePath",
            commit_msg: "commitMsg",
            is_new_branch: "isNewBranch",
            base_branch: "baseBranch",
            is_harness_code_repo: "isHarnessCodeRepo",
            move_config_type: "moveConfigType",
          },
          bodyBuilder: () => ({}),
          responseExtractor: ngExtract,
          actionDescription: "Move environment configuration (e.g., move inline config to remote or vice versa)",
          bodySchema: {
            description: "Move configuration request. All parameters are passed as query params.",
            fields: [
              { name: "connector_ref", type: "string", required: false, description: "Connector reference for remote storage" },
              { name: "repo_name", type: "string", required: false, description: "Repository name" },
              { name: "branch", type: "string", required: false, description: "Branch name" },
              { name: "file_path", type: "string", required: false, description: "File path in the repository" },
              { name: "commit_msg", type: "string", required: false, description: "Commit message" },
              { name: "is_new_branch", type: "boolean", required: false, description: "Whether to create a new branch" },
              { name: "base_branch", type: "string", required: false, description: "Base branch if creating a new branch" },
              { name: "is_harness_code_repo", type: "boolean", required: false, description: "Whether the repo is a Harness Code repo" },
              { name: "move_config_type", type: "string", required: true, description: "INLINE_TO_REMOTE (REMOTE_TO_INLINE not supported for environments)" },
            ],
          },
        },
      },
    },
    {
      resourceType: "infrastructure_definition",
      aliases: ["infrastructure"],
      displayName: "Infrastructure Definition",
      description: "Infrastructure definition within an environment. Supports full CRUD. Default list/get scope is project — pass org_id and project_id (or a project URL) on the first call. Use resource_scope='account' only when the user asked for account-level infrastructure definitions.",
      toolset: "environments",
      scope: "project",
      supportedScopes: ["account", "org", "project"],
      identifierFields: ["infrastructure_id"],
      searchAliases: ["infrastructure"],
      listFilterFields: [
        { name: "environment_id", description: "**Required.** Environment identifier — infrastructure is always scoped to an environment" },
        { name: "search_term", description: "Search term to filter infrastructure definitions" },
        { name: "deployment_type", description: "Filter by deployment type (e.g. Kubernetes, ECS)" },
        { name: "sort", description: "Field to sort by (e.g. name, identifier)" },
        { name: "order", description: "Sort order", enum: ["asc", "desc"] },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/settings/environments/{environmentIdentifier}/details?sectionId=INFRASTRUCTURE",
      operations: {
        list: {
          method: "GET",
          path: "/ng/api/infrastructures",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            environment_id: "environmentIdentifier",
            search_term: "searchTerm",
            deployment_type: "deploymentType",
            sort: "sort",
            order: "order",
            page: "page",
            size: "size",
          },
          responseExtractor: infrastructurePageExtract,
          description: "List infrastructure definitions",
        },
        get: {
          method: "GET",
          path: "/ng/api/infrastructures/{infraIdentifier}",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { infrastructure_id: "infraIdentifier" },
          queryParams: { environment_id: "environmentIdentifier" },
          responseExtractor: infrastructureExtract,
          description: "Get infrastructure definition details",
        },
        create: {
          method: "POST",
          path: "/ng/api/infrastructures",
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          bodyBuilder: infrastructureBodyBuilder,
          bodySchema: {
            description:
              "Infrastructure definition. NG requires body.yaml (infrastructureDefinition: ...). " +
              "Prefer body: { identifier, name, type, environmentRef, deploymentType?, yaml }. " +
              "If yaml is omitted, the server synthesizes it from the flat fields.",
            fields: [
              { name: "identifier", type: "string", required: true, description: "Unique identifier" },
              { name: "name", type: "string", required: true, description: "Display name" },
              { name: "type", type: "string", required: true, description: "Infrastructure type (e.g. KubernetesDirect, KubernetesGcp)" },
              { name: "environmentRef", type: "string", required: true, description: "Environment reference identifier" },
              { name: "deploymentType", type: "string", required: false, description: "Deployment type (e.g. Kubernetes)" },
              {
                name: "yaml",
                type: "yaml",
                required: true,
                description:
                  "Full infrastructure YAML under infrastructureDefinition:. Auto-synthesized from flat fields when omitted.",
              },
            ],
          },
          responseExtractor: infrastructureExtract,
          description: "Create infrastructure definition",
        },
        update: {
          method: "PUT",
          path: "/ng/api/infrastructures",
          operationPolicy: { risk: "low_write", retryPolicy: "safe" },
          bodyBuilder: infrastructureUpdateBodyBuilder,
          bodySchema: {
            description:
              "Infrastructure definition update. NG requires body.yaml; auto-synthesized from flat fields when omitted.",
            fields: [
              { name: "identifier", type: "string", required: true, description: "Infrastructure identifier" },
              { name: "name", type: "string", required: true, description: "Display name" },
              { name: "type", type: "string", required: true, description: "Infrastructure type" },
              { name: "environmentRef", type: "string", required: true, description: "Environment reference identifier" },
              {
                name: "yaml",
                type: "yaml",
                required: true,
                description:
                  "Full infrastructure YAML under infrastructureDefinition:. Auto-synthesized from flat fields when omitted.",
              },
            ],
          },
          responseExtractor: infrastructureExtract,
          description: "Update infrastructure definition",
        },
        delete: {
          method: "DELETE",
          path: "/ng/api/infrastructures/{infraIdentifier}",
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          pathParams: { infrastructure_id: "infraIdentifier" },
          queryParams: { environment_id: "environmentIdentifier" },
          responseExtractor: ngExtract,
          description: "Delete infrastructure definition",
        },
      },
      executeActions: {
        move_configs: {
          method: "POST",
          path: "/ng/api/infrastructures/move-config/{infraIdentifier}",
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          pathParams: { infrastructure_id: "infraIdentifier" },
          queryParams: {
            environment_id: "environmentIdentifier",
            connector_ref: "connectorRef",
            repo_name: "repoName",
            branch: "branch",
            file_path: "filePath",
            commit_msg: "commitMsg",
            is_new_branch: "isNewBranch",
            base_branch: "baseBranch",
            is_harness_code_repo: "isHarnessCodeRepo",
            move_config_type: "moveConfigType",
          },
          bodyBuilder: () => ({}),
          bodySchema: {
            description: "Move configuration request. All parameters are passed as query params.",
            fields: [
              { name: "environment_id", type: "string", required: true, description: "Environment identifier" },
              { name: "connector_ref", type: "string", required: false, description: "Connector reference for remote storage" },
              { name: "repo_name", type: "string", required: false, description: "Repository name" },
              { name: "branch", type: "string", required: false, description: "Branch name" },
              { name: "file_path", type: "string", required: false, description: "File path in the repository" },
              { name: "commit_msg", type: "string", required: false, description: "Commit message" },
              { name: "is_new_branch", type: "boolean", required: false, description: "Whether to create a new branch" },
              { name: "base_branch", type: "string", required: false, description: "Base branch if creating a new branch" },
              { name: "is_harness_code_repo", type: "boolean", required: false, description: "Whether the repo is a Harness Code repo" },
              { name: "move_config_type", type: "string", required: true, description: "INLINE_TO_REMOTE or REMOTE_TO_INLINE" },
            ],
          },
          responseExtractor: ngExtract,
          actionDescription: "Move infrastructure configuration (e.g., move inline config to remote or vice versa)",
        },
      },
    },
  ],
};
