import type { PathBuilderConfig, ToolsetDefinition } from "../types.js";
import { ngExtract, pageExtract } from "../extractors.js";

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function requiredString(input: Record<string, unknown>, key: string, context: string): string {
  const value = nonEmptyString(input[key]);
  if (!value) {
    throw new Error(`${key} is required for ${context}`);
  }
  return value;
}

function templateV1ScopePath(input: Record<string, unknown>, config: PathBuilderConfig): string {
  const org = nonEmptyString(input.org_id) ?? config.HARNESS_ORG;
  const project = nonEmptyString(input.project_id) ?? config.HARNESS_PROJECT;

  if (project && !org) {
    throw new Error("org_id is required when project_id is provided for template scope");
  }

  if (org && project) {
    return `/v1/orgs/${encodeURIComponent(org)}/projects/${encodeURIComponent(project)}`;
  }
  if (org) {
    return `/v1/orgs/${encodeURIComponent(org)}`;
  }
  return "/v1";
}

export const templatesToolset: ToolsetDefinition = {
  name: "templates",
  displayName: "Templates",
  description: "Harness templates (pipeline, stage, step, etc.)",
  resources: [
    {
      resourceType: "template",
      displayName: "Template",
      description: "Reusable template definition. Supports list, get, create, update, and delete.",
      toolset: "templates",
      scope: "project",
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
            const template = requiredString(input, "template_id", "template update");
            const version = requiredString(input, "version_label", "template update");
            return `${templateV1ScopePath(input, config)}/templates/${encodeURIComponent(template)}/versions/${encodeURIComponent(version)}`;
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
              { name: "yaml_version", type: "string", required: false, description: "YAML version (for example, '1')" },
              { name: "git_details", type: "object", required: false, description: "Git storage details (for example, { store_type: 'INLINE' })" },
              { name: "is_stable", type: "boolean", required: false, description: "Mark as stable version" },
              { name: "comments", type: "string", required: false, description: "Version update comments" },
            ],
          },
          responseExtractor: ngExtract,
          description: "Update a template version. Provide full template_yaml (required). Name, identifier, and other metadata are derived from the YAML content. Optional: is_stable, comments.",
        },
        create: {
          method: "POST",
          path: "/v1/orgs/{org}/projects/{project}/templates",
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          pathBuilder: (input, config) => `${templateV1ScopePath(input, config)}/templates`,
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
          description: "Create a template (step, stage, or pipeline). Body: template_yaml (string, required), identifier, name, label (version), is_stable.",
        },
        delete: {
          method: "DELETE",
          path: "/template/api/templates/{templateIdentifier}/{versionLabel}",
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          pathParams: { template_id: "templateIdentifier", version_label: "versionLabel" },
          responseExtractor: ngExtract,
          description:
            "Delete a specific version of a template. Both template_id and version_label are required.",
        },
      },
    },
  ],
};
