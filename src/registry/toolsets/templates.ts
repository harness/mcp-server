import type { ToolsetDefinition } from "../types.js";

const ngExtract = (raw: unknown) => {
  const r = raw as { data?: unknown };
  return r.data ?? raw;
};

const pageExtract = (raw: unknown) => {
  const r = raw as { data?: { content?: unknown[]; totalElements?: number } };
  return {
    items: r.data?.content ?? [],
    total: r.data?.totalElements ?? 0,
  };
};

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
      listFilterFields: ["search_term", "template_type", "template_list_type"],
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
          responseExtractor: (raw) => {
            const r = raw as { data?: unknown };
            return r.data ?? raw;
          },
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
          responseExtractor: (raw) => {
            const r = raw as { data?: unknown; identifier?: string; name?: string; yaml?: string };
            return r.data ?? raw;
          },
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
