import YAML from "yaml";
import type { BodySchema, PathBuilderConfig, ToolsetDefinition } from "../types.js";
import { ngExtract, pageExtract, passthrough, v1ListExtract } from "../extractors.js";
import { SCOPE_BEHAVIOR_DOC, templateV1BasePathFromScope } from "../scope-utils.js";

function getTemplateYamlFromInput(input: Record<string, unknown>): string {
  const b = (input.body as Record<string, unknown>) ?? {};
  const templateYaml =
    typeof b.template_yaml === "string"
      ? b.template_yaml
      : typeof b.yaml === "string"
        ? b.yaml
        : typeof input.body === "string"
          ? input.body
          : null;
  if (!templateYaml) {
    throw new Error(
      "template_yaml (or yaml) is required: full template YAML string passed as body.template_yaml, body.yaml, or a raw YAML body string",
    );
  }
  return templateYaml;
}

function buildTemplateYamlBody(input: Record<string, unknown>): string {
  return getTemplateYamlFromInput(input);
}

/**
 * NG delete path: /template/api/templates/{id}/{version} when version_label set,
 * else /template/api/templates/{id} (all versions).
 */
function templateNgDeletePath(input: Record<string, unknown>): string {
  const templateId = input.template_id as string;
  if (!templateId) throw new Error("template_id is required");
  const version = input.version_label as string | undefined;
  if (version) {
    return `/template/api/templates/${encodeURIComponent(templateId)}/${encodeURIComponent(version)}`;
  }
  return `/template/api/templates/${encodeURIComponent(templateId)}`;
}

function templateV1GetPath(input: Record<string, unknown>, config: PathBuilderConfig): string {
  const templateId = input.template_id as string;
  if (!templateId) throw new Error("template_id is required");
  const base = templateV1BasePathFromScope(input, config);
  const version = input.version_label as string | undefined;
  if (version) {
    return `${base}/${encodeURIComponent(templateId)}/versions/${encodeURIComponent(version)}`;
  }
  return `${base}/${encodeURIComponent(templateId)}`;
}

function templateV1VersionedPath(input: Record<string, unknown>, config: PathBuilderConfig): string {
  const templateId = input.template_id as string;
  const version = input.version_label as string;
  if (!templateId) throw new Error("template_id is required");
  if (!version) throw new Error("version_label is required");
  const base = templateV1BasePathFromScope(input, config);
  return `${base}/${encodeURIComponent(templateId)}/versions/${encodeURIComponent(version)}`;
}

function extractV1TemplateMeta(parsed: Record<string, unknown>): {
  identifier?: string;
  name?: string;
  label?: string;
} {
  const tmpl = parsed?.template as Record<string, unknown> | undefined;
  if (!tmpl || typeof tmpl !== "object") return {};
  return {
    identifier: typeof tmpl.identifier === "string" ? tmpl.identifier : undefined,
    name: typeof tmpl.name === "string" ? tmpl.name : undefined,
    label: typeof tmpl.versionLabel === "string" ? tmpl.versionLabel : undefined,
  };
}

/**
 * Build JSON body for v1 template create/update (template-service OpenAPI).
 * Accepts unified v1 YAML in body.template_yaml; identifier, label, and name can be
 * supplied explicitly or parsed from the YAML.
 */
function buildV1TemplateBody(input: Record<string, unknown>): Record<string, unknown> {
  const b = (input.body as Record<string, unknown>) ?? {};
  const templateYaml = getTemplateYamlFromInput(input);

  const inputTemplateId = typeof input.template_id === "string" && input.template_id !== "" ? input.template_id : undefined;
  const inputVersionLabel = typeof input.version_label === "string" && input.version_label !== "" ? input.version_label : undefined;
  const bodyIdentifier = typeof b.identifier === "string" && b.identifier !== "" ? b.identifier : undefined;
  const bodyLabel = typeof b.label === "string" && b.label !== "" ? b.label : undefined;
  const bodyVersionLabel = typeof b.version_label === "string" && b.version_label !== "" ? b.version_label : undefined;

  if (inputTemplateId && bodyIdentifier && bodyIdentifier !== inputTemplateId) {
    throw new Error("body.identifier must match template_id for template_v1 operations");
  }
  if (inputVersionLabel && bodyLabel && bodyLabel !== inputVersionLabel) {
    throw new Error("body.label must match version_label for template_v1 operations");
  }
  if (inputVersionLabel && bodyVersionLabel && bodyVersionLabel !== inputVersionLabel) {
    throw new Error("body.version_label must match version_label for template_v1 operations");
  }

  let identifier = inputTemplateId ?? bodyIdentifier;
  let name = b.name as string | undefined;
  let label = inputVersionLabel ?? bodyLabel ?? bodyVersionLabel;

  try {
    const parsed = YAML.parse(templateYaml) as Record<string, unknown>;
    const meta = extractV1TemplateMeta(parsed);
    if (!identifier && meta.identifier) identifier = meta.identifier;
    if (!name && meta.name) name = meta.name;
    if (!label && meta.label) label = meta.label;
  } catch {
    /* non-critical — caller can provide identifier/name/label explicitly */
  }

  if (!identifier) {
    throw new Error(
      "identifier is required for v1 template create/update: set body.identifier, template_id, or template.identifier in template_yaml",
    );
  }
  if (!name) {
    name = identifier;
  }
  if (!label) {
    label = "1.0.0";
  }

  const result: Record<string, unknown> = {
    template_yaml: templateYaml,
    yaml_version: "1",
    identifier,
    name,
    label,
    git_details: { store_type: "INLINE" },
  };

  if (b.description) result.description = b.description;
  if (b.tags) result.tags = b.tags;
  if (b.is_stable !== undefined) result.is_stable = b.is_stable;
  else if (input.is_stable !== undefined) result.is_stable = input.is_stable;
  if (b.comments) result.comments = b.comments;
  else if (input.comments) result.comments = input.comments;

  return result;
}

const templateListFilterFields = [
  { name: "search_term", description: "Filter templates by name or keyword" },
  {
    name: "template_type",
    description: "Template entity type",
    enum: ["Pipeline", "Stage", "Step", "CustomDeployment", "MonitoredService", "SecretManager", "ArtifactSource"],
  },
  { name: "template_list_type", description: "Template list type", enum: ["Stable", "LastUpdated", "All"] },
  {
    name: "global",
    description:
      "When true, accesses global templates (list: passes isGlobal=true; get: forces accountIdentifier to __GLOBAL_TEMPLATES_ACCOUNT_ID__)",
    type: "boolean" as const,
  },
  {
    name: "metadata_only",
    description:
      "When true, fetches only template metadata via list-metadata — faster than full list",
    type: "boolean" as const,
  },
];

const templateV1ListFilterFields = [
  { name: "search_term", description: "Filter templates by name or keyword" },
  {
    name: "template_type",
    description: "Template entity type (v1 query: entity_types)",
    enum: ["Pipeline", "Stage", "Step", "StepGroup"],
  },
  {
    name: "type",
    description: "Template list type (v1 API)",
    enum: ["STABLE_TEMPLATE", "LAST_UPDATES_TEMPLATE", "ALL"],
  },
  { name: "sort", description: "Field to sort by" },
  { name: "order", description: "Sort order", enum: ["asc", "desc"] },
];

const templateV0CreateSchema: BodySchema = {
  description:
    "Classic (v0) template YAML for NG API create. Root key `template` with identifier, name, versionLabel, type, and spec.",
  fields: [
    {
      name: "template_yaml",
      type: "yaml",
      required: true,
      description:
        "v0 template YAML: template.identifier, template.name, template.versionLabel, template.type, template.spec",
    },
    { name: "is_stable", type: "boolean", required: false, description: "Mark as stable/default version (setDefaultTemplate query param)" },
    { name: "comments", type: "string", required: false, description: "Version comments" },
    { name: "is_new_template", type: "boolean", required: false, description: "When true, cannot add a version to an existing identifier" },
    { name: "enable_dag", type: "boolean", required: false, description: "Enable DAG for Pipeline templates" },
  ],
};

const templateV0UpdateSchema: BodySchema = {
  description: "Classic (v0) template YAML for NG API update (full version replacement).",
  fields: [
    {
      name: "template_yaml",
      type: "yaml",
      required: true,
      description: "Full v0 template YAML including template.versionLabel and template.type",
    },
    { name: "is_stable", type: "boolean", required: false, description: "Mark as stable/default version" },
    { name: "comments", type: "string", required: false, description: "Version update comments" },
  ],
};

const templateV1CreateSchema: BodySchema = {
  description:
    "Unified v1 template for template-service v1 REST API (JSON body). Use harness_schema(resource_type='template_v1') for the full YAML schema.",
  fields: [
    {
      name: "template_yaml",
      type: "yaml",
      required: true,
      description:
        "Unified v1 YAML: top-level version: 1 and template.identifier, template.name, template.step|stage|pipeline",
    },
    { name: "identifier", type: "string", required: false, description: "Template identifier (defaults from template_yaml or template_id)" },
    { name: "name", type: "string", required: false, description: "Display name (defaults from template_yaml or identifier)" },
    { name: "label", type: "string", required: false, description: "Version label (defaults to 1.0.0)" },
    { name: "is_stable", type: "boolean", required: false, description: "Mark as stable/default version" },
    { name: "comments", type: "string", required: false, description: "Version comments" },
  ],
};

const templateV1UpdateSchema: BodySchema = {
  description: "Unified v1 template for v1 REST API update. Requires template_id and version_label in params.",
  fields: [
    {
      name: "template_yaml",
      type: "yaml",
      required: true,
      description: "Full unified v1 template YAML (version: 1, template.step|stage|pipeline)",
    },
    { name: "identifier", type: "string", required: false, description: "Template identifier (defaults from template_id)" },
    { name: "name", type: "string", required: false, description: "Display name" },
    { name: "label", type: "string", required: false, description: "Version label (defaults from version_label param)" },
    { name: "is_stable", type: "boolean", required: false, description: "Mark as stable/default version" },
    { name: "comments", type: "string", required: false, description: "Version update comments" },
  ],
};

const templateDeepLink =
  "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/setup/resources/templates/{templateIdentifier}";

export const templatesToolset: ToolsetDefinition = {
  name: "templates",
  displayName: "Templates",
  description: "Harness templates (pipeline, stage, step, etc.) — classic v0 and unified v1 resource types",
  resources: [
    {
      resourceType: "template",
      displayName: "Template (v0)",
      description:
        "Classic Harness template (v0 YAML). Use template.identifier, versionLabel, type, and spec. Supports list, get, create, update, and delete at account, org, or project scope.",
      toolset: "templates",
      scope: "project",
      scopeOptional: true,
      supportedScopes: ["account", "org", "project"],
      identifierFields: ["template_id"],
      searchAliases: ["v0 template", "classic template", "step template", "stage template"],
      listFilterFields: templateListFilterFields,
      deepLinkTemplate: templateDeepLink,
      operations: {
        list: {
          method: "POST",
          path: "/template/api/templates/list",
          pathBuilder: (input) =>
            input.metadata_only || input.global
              ? "/template/api/templates/list-metadata"
              : "/template/api/templates/list",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            search_term: "searchTerm",
            page: "page",
            size: "size",
            template_list_type: "templateListType",
            global: "isGlobal",
          },
          bodyBuilder: (input) => ({
            filterType: "Template",
            templateEntityTypes: input.template_type ? [input.template_type] : undefined,
          }),
          responseExtractor: pageExtract,
          description:
            "List templates. Use global=true for global templates. Use metadata_only=true for lightweight metadata list.",
        },
        get: {
          method: "GET",
          path: "/template/api/templates/{templateIdentifier}",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { template_id: "templateIdentifier" },
          queryParams: {
            version_label: "versionLabel",
            account_id: "accountIdentifier",
          },
          responseExtractor: ngExtract,
          description: "Get template details and YAML. Use global=true for global templates account.",
        },
        create: {
          method: "POST",
          path: "/template/api/templates",
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          headers: { "Content-Type": "application/yaml" },
          queryParams: {
            comments: "comments",
            is_stable: "setDefaultTemplate",
            is_new_template: "isNewTemplate",
            enable_dag: "enableDAG",
          },
          bodyBuilder: (input) => buildTemplateYamlBody(input),
          bodySchema: templateV0CreateSchema,
          responseExtractor: ngExtract,
          description:
            "Create a v0 template via NG API. Body is raw YAML (application/yaml). Scope via org_id/project_id query params; omit both for account scope.",
        },
        update: {
          method: "PUT",
          path: "/template/api/templates/update/{templateIdentifier}/{versionLabel}",
          operationPolicy: { risk: "low_write", retryPolicy: "safe" },
          pathParams: { template_id: "templateIdentifier", version_label: "versionLabel" },
          headers: { "Content-Type": "application/yaml" },
          queryParams: {
            comments: "comments",
            is_stable: "setDefaultTemplate",
          },
          bodyBuilder: (input) => buildTemplateYamlBody(input),
          bodySchema: templateV0UpdateSchema,
          responseExtractor: ngExtract,
          description:
            "Update a v0 template version via NG API. Requires template_id and version_label. Body is full v0 template YAML.",
        },
        delete: {
          method: "DELETE",
          path: "/template/api/templates/{templateIdentifier}/{versionLabel}",
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          pathBuilder: (input) => templateNgDeletePath(input),
          queryParams: {
            comments: "comments",
            force_delete: "forceDelete",
          },
          responseExtractor: ngExtract,
          description:
            "Delete a template. Provide version_label to delete one version; omit to delete all versions (may require force_delete).",
        },
      },
    },
    {
      resourceType: "template_v1",
      displayName: "Template (v1)",
      description:
        "Unified v1 template (simplified YAML with version: 1 and template.step, template.stage, or template.pipeline). Uses template-service v1 REST API (/v1/templates...), not the NG YAML API.\n" +
        SCOPE_BEHAVIOR_DOC,
      toolset: "templates",
      scope: "project",
      scopeOptional: true,
      supportedScopes: ["account", "org", "project"],
      headerBasedScoping: true,
      identifierFields: ["template_id"],
      searchAliases: ["v1 template", "unified template", "agent template", "template v1"],
      listFilterFields: templateV1ListFilterFields,
      deepLinkTemplate: templateDeepLink,
      operations: {
        list: {
          method: "GET",
          path: "/v1/orgs/{org}/projects/{project}/templates",
          pathBuilder: templateV1BasePathFromScope,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            search_term: "search_term",
            page: "page",
            size: "limit",
            type: "type",
            sort: "sort",
            order: "order",
          },
          responseExtractor: v1ListExtract(),
          description:
            "List v1 templates. Scope follows org_id/project_id presence (see resource description). Filter with type=STABLE_TEMPLATE|LAST_UPDATES_TEMPLATE|ALL.",
        },
        get: {
          method: "GET",
          path: "/v1/orgs/{org}/projects/{project}/templates/{template}",
          pathBuilder: (input, config) => templateV1GetPath(input, config),
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          responseExtractor: passthrough,
          description:
            "Get unified v1 template YAML. Omit version_label for stable; pass version_label for a specific version.",
        },
        create: {
          method: "POST",
          path: "/v1/orgs/{org}/projects/{project}/templates",
          pathBuilder: templateV1BasePathFromScope,
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          bodyBuilder: buildV1TemplateBody,
          bodySchema: templateV1CreateSchema,
          responseExtractor: passthrough,
          description:
            "Create a unified v1 template via v1 REST API (JSON body with template_yaml, yaml_version=1).",
        },
        update: {
          method: "PUT",
          path: "/v1/orgs/{org}/projects/{project}/templates/{template}/versions/{version}",
          pathBuilder: (input, config) => templateV1VersionedPath(input, config),
          operationPolicy: { risk: "low_write", retryPolicy: "safe" },
          bodyBuilder: buildV1TemplateBody,
          bodySchema: templateV1UpdateSchema,
          responseExtractor: passthrough,
          description:
            "Update a unified v1 template version via v1 REST API. Requires template_id and version_label. Body is JSON with template_yaml.",
        },
        delete: {
          method: "DELETE",
          path: "/v1/orgs/{org}/projects/{project}/templates/{template}/versions/{version}",
          pathBuilder: (input, config) => templateV1VersionedPath(input, config),
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          queryParams: {
            comments: "comments",
            force_delete: "force_delete",
          },
          responseExtractor: passthrough,
          description: "Delete a v1 template version. Requires template_id and version_label.",
        },
      },
    },
  ],
};
