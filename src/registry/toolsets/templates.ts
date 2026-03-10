import type { ToolsetDefinition } from "../types.js";
import { ngExtract, pageExtract } from "../extractors.js";

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
      ],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/setup/resources/templates/{templateIdentifier}",
      operations: {
        list: {
          method: "POST",
          path: "/template/api/templates/list",
          queryParams: {
            search_term: "searchTerm",
            page: "page",
            size: "size",
            template_list_type: "templateListType",
          },
          bodyBuilder: (input) => ({
            filterType: "Template",
            templateEntityTypes: input.template_type
              ? [input.template_type]
              : undefined,
          }),
          responseExtractor: pageExtract,
          description: "List templates",
        },
        get: {
          method: "GET",
          path: "/template/api/templates/{templateIdentifier}",
          pathParams: { template_id: "templateIdentifier" },
          queryParams: { version_label: "versionLabel" },
          responseExtractor: ngExtract,
          description: "Get template details",
        },
        update: {
          method: "PUT",
          path: "/v1/orgs/{org}/projects/{project}/templates/{template}/versions/{version}",
          pathParams: { org_id: "org", project_id: "project", template_id: "template", version_label: "version" },
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
            if (b.is_stable !== undefined) out.is_stable = b.is_stable;
            if (b.comments !== undefined) out.comments = b.comments;
            return out;
          },
          bodySchema: {
            description: "Template version update",
            fields: [
              { name: "template_yaml", type: "yaml", required: true, description: "Full template YAML string with changes" },
              { name: "is_stable", type: "boolean", required: false, description: "Mark as stable version" },
              { name: "comments", type: "string", required: false, description: "Version update comments" },
            ],
          },
          responseExtractor: ngExtract,
          description: "Update a template version. Provide full template_yaml (required). Optional: is_stable, comments.",
        },
        create: {
          method: "POST",
          path: "/v1/orgs/{org}/projects/{project}/templates",
          pathParams: { org_id: "org", project_id: "project" },
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
          path: "/template/api/templates/{templateIdentifier}",
          pathParams: { template_id: "templateIdentifier" },
          queryParams: { version_label: "versionLabel" },
          responseExtractor: ngExtract,
          description:
            "Delete a template. If version_label is provided, only that version is deleted. If omitted, all versions of the template are deleted.",
        },
      },
    },
  ],
};
