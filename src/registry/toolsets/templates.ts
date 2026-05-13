import type { ToolsetDefinition, PathBuilderConfig } from "../types.js";
import { ngExtract, pageExtract } from "../extractors.js";

/**
 * Builds a scope-aware v1 API base path for templates.
 * Uses ONLY explicit input fields (org_id, project_id) — never falls back to
 * config defaults. This lets callers target org/account scope even when
 * HARNESS_PROJECT is configured. The dispatcher still handles default scope
 * injection for NG endpoints (list/get/delete) via query params.
 */
function templateV1BasePath(input: Record<string, unknown>, _config: PathBuilderConfig): string {
  const org = input.org_id as string | undefined;
  const project = input.project_id as string | undefined;
  const templateId = input.template_id as string;
  if (!templateId) throw new Error("template_id is required");

  if (org && project) {
    return `/v1/orgs/${encodeURIComponent(org)}/projects/${encodeURIComponent(project)}/templates/${encodeURIComponent(templateId)}`;
  }
  if (org) {
    return `/v1/orgs/${encodeURIComponent(org)}/templates/${encodeURIComponent(templateId)}`;
  }
  return `/v1/templates/${encodeURIComponent(templateId)}`;
}

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
          path: "/v1/orgs/{org}/projects/{project}/templates/{template}/versions/{version}",
          operationPolicy: { risk: "low_write", retryPolicy: "safe" },
          pathBuilder: (input, config) => {
            const version = input.version_label as string;
            if (!version) throw new Error("version_label is required for template update");
            return `${templateV1BasePath(input, config)}/versions/${encodeURIComponent(version)}`;
          },
          bodyBuilder: (input) => {
            const b = (input.body as Record<string, unknown>) ?? {};
            const templateYaml =
              typeof b.template_yaml === "string"
                ? b.template_yaml
                : typeof b.yaml === "string"
                  ? b.yaml
                  : null;
            if (!templateYaml) {
              throw new Error("body.template_yaml (or body.yaml) is required: full template YAML string with your changes");
            }
            const out: Record<string, unknown> = { template_yaml: templateYaml };
            if (b.identifier !== undefined) out.identifier = b.identifier;
            if (b.name !== undefined) out.name = b.name;
            if (b.label !== undefined) out.label = b.label;
            if (b.yaml_version !== undefined) out.yaml_version = b.yaml_version;
            if (b.git_details !== undefined) out.git_details = b.git_details;
            if (b.is_stable !== undefined) out.is_stable = b.is_stable;
            if (b.comments !== undefined) out.comments = b.comments;
            return out;
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
          path: "/v1/orgs/{org}/projects/{project}/templates",
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          pathBuilder: (input, _config) => {
            const org = input.org_id as string | undefined;
            const project = input.project_id as string | undefined;
            if (org && project) {
              return `/v1/orgs/${encodeURIComponent(org)}/projects/${encodeURIComponent(project)}/templates`;
            }
            if (org) {
              return `/v1/orgs/${encodeURIComponent(org)}/templates`;
            }
            return "/v1/templates";
          },
          bodyBuilder: (input) => {
            const b = (input.body as Record<string, unknown>) ?? {};
            const templateYaml =
              typeof b.template_yaml === "string"
                ? b.template_yaml
                : typeof b.yaml === "string"
                  ? b.yaml
                  : null;
            if (!templateYaml) {
              throw new Error("body.template_yaml (or body.yaml) is required: full template YAML string");
            }
            const identifier = (b.identifier as string) ?? "";
            const name = (b.name as string) ?? "";
            if (!identifier || !name) {
              throw new Error("body.identifier and body.name are required when creating a template");
            }
            const out: Record<string, unknown> = {
              template_yaml: templateYaml,
              identifier,
              name,
              label: (b.label ?? b.versionLabel ?? "v1") as string,
              is_stable: b.is_stable !== false,
            };
            if (b.description !== undefined) out.description = b.description;
            if (b.tags !== undefined) out.tags = b.tags;
            if (b.comments !== undefined) out.comments = b.comments;
            return out;
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
  ],
};
