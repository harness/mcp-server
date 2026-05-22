import YAML from "yaml";
import type { BodySchema, PathBuilderConfig, ResourceScope, ToolsetDefinition } from "../types.js";
import { ngExtract, pageExtract, passthrough, v1ListExtract } from "../extractors.js";

function getString(input: Record<string, unknown>, key: string): string | undefined {
  const value = input[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function getTemplateYamlFromInput(input: Record<string, unknown>): string {
  const body = input.body;
  const bodyRecord = isRecord(body) ? body : {};
  const templateYaml =
    getString(bodyRecord, "template_yaml") ??
    getString(bodyRecord, "yaml") ??
    (typeof body === "string" ? body : undefined);

  if (!templateYaml) {
    throw new Error(
      "template_yaml (or yaml) is required: pass a full template YAML string as body.template_yaml, body.yaml, or a raw YAML body string",
    );
  }

  return templateYaml;
}

function resolveTemplateV1Scope(
  input: Record<string, unknown>,
  config: PathBuilderConfig,
): { scope: ResourceScope; org?: string; project?: string } {
  const requestedScope = getString(input, "resource_scope") as ResourceScope | undefined;
  const explicitOrg = getString(input, "org_id");
  const explicitProject = getString(input, "project_id");
  const defaultOrg = config.HARNESS_ORG;
  const defaultProject = config.HARNESS_PROJECT;

  if (requestedScope === "account") {
    return { scope: "account" };
  }

  if (requestedScope === "org") {
    const org = explicitOrg ?? defaultOrg;
    if (!org) {
      throw new Error("org_id is required for template_v1 org scope when HARNESS_ORG is not configured");
    }
    return { scope: "org", org };
  }

  if (requestedScope === "project") {
    const org = explicitOrg ?? defaultOrg;
    const project = explicitProject ?? defaultProject;
    if (!org) {
      throw new Error("org_id is required for template_v1 project scope when HARNESS_ORG is not configured");
    }
    if (!project) {
      throw new Error("project_id is required for template_v1 project scope when HARNESS_PROJECT is not configured");
    }
    return { scope: "project", org, project };
  }

  if (explicitProject) {
    const org = explicitOrg ?? defaultOrg;
    if (!org) {
      throw new Error("org_id is required when project_id is provided for template_v1");
    }
    return { scope: "project", org, project: explicitProject };
  }

  if (explicitOrg) {
    return { scope: "org", org: explicitOrg };
  }

  if (defaultOrg && defaultProject) {
    return { scope: "project", org: defaultOrg, project: defaultProject };
  }

  if (defaultOrg) {
    return { scope: "org", org: defaultOrg };
  }

  return { scope: "account" };
}

function templateV1BasePath(input: Record<string, unknown>, config: PathBuilderConfig): string {
  const scope = resolveTemplateV1Scope(input, config);
  if (scope.scope === "project") {
    return `/v1/orgs/${encodeURIComponent(scope.org!)}/projects/${encodeURIComponent(scope.project!)}/templates`;
  }
  if (scope.scope === "org") {
    return `/v1/orgs/${encodeURIComponent(scope.org!)}/templates`;
  }
  return "/v1/templates";
}

function templateV1GetPath(input: Record<string, unknown>, config: PathBuilderConfig): string {
  const templateId = getString(input, "template_id");
  if (!templateId) throw new Error("template_id is required");
  const base = templateV1BasePath(input, config);
  const version = getString(input, "version_label");
  if (version) {
    return `${base}/${encodeURIComponent(templateId)}/versions/${encodeURIComponent(version)}`;
  }
  return `${base}/${encodeURIComponent(templateId)}`;
}

function templateV1VersionPath(input: Record<string, unknown>, config: PathBuilderConfig): string {
  const templateId = getString(input, "template_id");
  const version = getString(input, "version_label");
  if (!templateId) throw new Error("template_id is required");
  if (!version) throw new Error("version_label is required");
  return `${templateV1BasePath(input, config)}/${encodeURIComponent(templateId)}/versions/${encodeURIComponent(version)}`;
}

function extractTemplateV1Metadata(templateYaml: string): {
  identifier?: string;
  name?: string;
  label?: string;
} {
  const parsed = YAML.parse(templateYaml);
  const template = isRecord(parsed) && isRecord(parsed.template) ? parsed.template : undefined;
  if (!template) return {};

  return {
    identifier: getString(template, "identifier"),
    name: getString(template, "name"),
    label: getString(template, "versionLabel") ?? getString(template, "label") ?? getString(template, "version"),
  };
}

function buildTemplateV1Body(input: Record<string, unknown>): Record<string, unknown> {
  const body = isRecord(input.body) ? input.body : {};
  const templateYaml = getTemplateYamlFromInput(input);
  const metadata = extractTemplateV1Metadata(templateYaml);
  const identifier = getString(body, "identifier") ?? getString(input, "template_id") ?? metadata.identifier;
  if (!identifier) {
    throw new Error("identifier is required for template_v1 create/update: set body.identifier, template_id, or template.identifier in template_yaml");
  }

  const result: Record<string, unknown> = {
    template_yaml: templateYaml,
    yaml_version: getString(body, "yaml_version") ?? "1",
    identifier,
    name: getString(body, "name") ?? metadata.name ?? identifier,
    label: getString(body, "label") ?? getString(body, "version_label") ?? getString(input, "version_label") ?? metadata.label ?? "1.0.0",
    git_details: isRecord(body.git_details) ? body.git_details : { store_type: "INLINE" },
  };

  const description = getString(body, "description");
  if (description) result.description = description;
  if (body.tags !== undefined) result.tags = body.tags;
  if (body.is_stable !== undefined) result.is_stable = body.is_stable;
  if (body.comments !== undefined) result.comments = body.comments;

  return result;
}

const templateV1BodySchema: BodySchema = {
  description: "Unified v1 template-service request body. Pass template_yaml containing top-level version: 1 and template.step, template.stage, or template.pipeline.",
  fields: [
    { name: "template_yaml", type: "yaml", required: true, description: "Unified v1 template YAML" },
    { name: "identifier", type: "string", required: true, description: "Template identifier. Defaults from template_yaml or template_id when omitted." },
    { name: "name", type: "string", required: true, description: "Template display name. Defaults from template_yaml or identifier when omitted." },
    { name: "label", type: "string", required: false, description: "Version label. Defaults from version_label or 1.0.0." },
    { name: "yaml_version", type: "string", required: false, description: "Template YAML schema version. Defaults to 1." },
    { name: "git_details", type: "object", required: false, description: "Git storage details. Defaults to { store_type: 'INLINE' }." },
    { name: "is_stable", type: "boolean", required: false, description: "Mark this version stable/default." },
    { name: "comments", type: "string", required: false, description: "Version comments." },
  ],
};

/**
 * Builds the NG delete path for templates.
 * When version_label is provided: /template/api/templates/{id}/{version}
 * When omitted: /template/api/templates/{id} (deletes all versions)
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

export const templatesToolset: ToolsetDefinition = {
  name: "templates",
  displayName: "Templates",
  description: "Harness templates (pipeline, stage, step, etc.)",
  resources: [
    {
      resourceType: "template",
      displayName: "Template",
      description: "Reusable template definition. Supports list, get, create, update, and delete. Use resource_scope='account' to list or get account-level templates.",
      toolset: "templates",
      scope: "project",
      supportedScopes: ["account", "org", "project"],
      scopeOptional: true,
      identifierFields: ["template_id"],
      listFilterFields: [
        { name: "search_term", description: "Filter templates by name or keyword" },
        { name: "template_type", description: "Template entity type", enum: ["Pipeline", "Stage", "Step", "CustomDeployment", "MonitoredService", "SecretManager", "ArtifactSource"] },
        { name: "template_list_type", description: "Template list type", enum: ["Stable", "LastUpdated", "All"] },
        { name: "global", description: "When true, accesses global templates (list: passes isGlobal=true; get: forces accountIdentifier to __GLOBAL_TEMPLATES_ACCOUNT_ID__)", type: "boolean" },
        { name: "metadata_only", description: "When true, fetches only template metadata (name, identifier, type, tags) via the list-metadata endpoint — faster and lighter than the full list", type: "boolean" },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/setup/resources/templates/{templateIdentifier}",
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
            templateEntityTypes: input.template_type
              ? [input.template_type]
              : undefined,
          }),
          responseExtractor: pageExtract,
          description: "List templates. Use global=true to include global templates (passes isGlobal=true to the API). Use metadata_only=true to fetch only template metadata via the list-metadata endpoint (faster, lighter).",
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
          description: "Get template details. Use global=true to fetch from global templates account.",
        },
        update: {
          method: "PUT",
          path: "/template/api/templates/update/{templateIdentifier}/{versionLabel}",
          operationPolicy: { risk: "low_write", retryPolicy: "safe" },
          pathParams: { template_id: "templateIdentifier", version_label: "versionLabel" },
          bodyBuilder: (input) => {
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
              throw new Error("body.template_yaml (or body.yaml) is required: full template YAML string with your changes");
            }
            return templateYaml;
          },
          bodySchema: {
            description: "Template version update",
            fields: [
              { name: "template_yaml", type: "yaml", required: true, description: "Full template YAML string with changes (name, identifier, etc. are derived from the YAML)" },
              { name: "identifier", type: "string", required: false, description: "Template identifier (derived from YAML if omitted)" },
              { name: "name", type: "string", required: false, description: "Display name (derived from YAML if omitted)" },
              { name: "label", type: "string", required: false, description: "Version label (derived from YAML if omitted)" },
              { name: "yaml_version", type: "string", required: false, description: "YAML version (e.g. '1')" },
              { name: "git_details", type: "object", required: false, description: "Git storage details (e.g. { store_type: 'INLINE' })" },
              { name: "is_stable", type: "boolean", required: false, description: "Mark as stable version" },
              { name: "comments", type: "string", required: false, description: "Version update comments" },
            ],
          },
          responseExtractor: ngExtract,
          description: "Update a template version. Pass org_id (and optionally project_id) to set scope explicitly. Provide full template_yaml (required). Optional: identifier, name, label, yaml_version, git_details, is_stable, comments.",
        },
        create: {
          method: "POST",
          path: "/template/api/templates",
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          bodyBuilder: (input) => {
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
              throw new Error("body.template_yaml (or body.yaml) is required: full template YAML string");
            }
            return templateYaml;
          },
          bodySchema: {
            description: "Template definition",
            fields: [
              { name: "template_yaml", type: "yaml", required: true, description: "Full template YAML string" },
              { name: "identifier", type: "string", required: true, description: "Unique template identifier" },
              { name: "name", type: "string", required: true, description: "Display name" },
              { name: "label", type: "string", required: false, description: "Version label (default: v1)" },
              { name: "is_stable", type: "boolean", required: false, description: "Mark as stable version (default: true)" },
              { name: "description", type: "string", required: false, description: "Template description" },
              { name: "tags", type: "object", required: false, description: "Key-value tag map" },
              { name: "comments", type: "string", required: false, description: "Version comments" },
            ],
          },
          responseExtractor: ngExtract,
          description: "Create a template (step, stage, or pipeline). Pass org_id (and optionally project_id) to set scope explicitly. Body: template_yaml (string, required), identifier, name, label (version), is_stable.",
        },
        delete: {
          method: "DELETE",
          path: "/template/api/templates/{templateIdentifier}/{versionLabel}",
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          pathBuilder: (input) => templateNgDeletePath(input),
          responseExtractor: ngExtract,
          description:
            "Delete a template. When version_label is provided, deletes that specific version. When omitted, deletes all versions of the template.",
        },
      },
    },
    {
      resourceType: "template_v1",
      displayName: "Template (v1)",
      description:
        "Unified v1 template-service template. Use when the user explicitly asks for template_v1 or provides unified YAML with top-level version: 1 and template.step, template.stage, or template.pipeline. Supports account, org, and project scope.",
      toolset: "templates",
      scope: "project",
      supportedScopes: ["account", "org", "project"],
      scopeOptional: true,
      headerBasedScoping: true,
      identifierFields: ["template_id"],
      searchAliases: ["v1 template", "template v1", "unified template"],
      listFilterFields: [
        { name: "search_term", description: "Filter templates by name or keyword" },
        { name: "template_type", description: "Template entity type", enum: ["Pipeline", "Stage", "Step", "StepGroup"] },
        { name: "type", description: "Template list type", enum: ["STABLE_TEMPLATE", "LAST_UPDATES_TEMPLATE", "ALL"] },
        { name: "sort", description: "Field to sort by" },
        { name: "order", description: "Sort order", enum: ["asc", "desc"] },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/setup/resources/templates/{templateIdentifier}",
      operations: {
        list: {
          method: "GET",
          path: "/v1/templates",
          pathBuilder: templateV1BasePath,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            search_term: "search_term",
            template_type: "entity_types",
            page: "page",
            size: "limit",
            type: "type",
            sort: "sort",
            order: "order",
          },
          responseExtractor: v1ListExtract(),
          description:
            "List unified v1 templates. Without explicit scope, configured HARNESS_ORG/HARNESS_PROJECT default to project scope; pass resource_scope='account' or 'org' to override.",
        },
        get: {
          method: "GET",
          path: "/v1/templates/{template}",
          pathBuilder: templateV1GetPath,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          responseExtractor: passthrough,
          description: "Get a unified v1 template. Omit version_label for the stable/default version; pass version_label for a specific version.",
        },
        create: {
          method: "POST",
          path: "/v1/templates",
          pathBuilder: templateV1BasePath,
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          bodyBuilder: buildTemplateV1Body,
          bodySchema: templateV1BodySchema,
          skipScopeBodyInjection: true,
          responseExtractor: passthrough,
          description: "Create a unified v1 template with a JSON template-service body containing template_yaml, yaml_version, identifier, name, label, and git_details.",
        },
        update: {
          method: "PUT",
          path: "/v1/templates/{template}/versions/{version}",
          pathBuilder: templateV1VersionPath,
          operationPolicy: { risk: "low_write", retryPolicy: "safe" },
          bodyBuilder: buildTemplateV1Body,
          bodySchema: templateV1BodySchema,
          skipScopeBodyInjection: true,
          responseExtractor: passthrough,
          description: "Update a unified v1 template version. Requires template_id and version_label.",
        },
        delete: {
          method: "DELETE",
          path: "/v1/templates/{template}/versions/{version}",
          pathBuilder: templateV1VersionPath,
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          queryParams: {
            comments: "comments",
            force_delete: "force_delete",
          },
          responseExtractor: passthrough,
          description: "Delete a unified v1 template version. Requires template_id and version_label.",
        },
      },
    },
  ],
};
