import type { ToolsetDefinition, BodySchema } from "../types.js";
import { ngExtract, pageExtract } from "../extractors.js";

// ---------------------------------------------------------------------------
// Body schemas (for harness_describe output)
// ---------------------------------------------------------------------------

const freezeCreateSchema: BodySchema = {
  description: "Freeze window YAML definition. Pass the full freeze YAML string with a 'freeze:' root.",
  fields: [
    { name: "yaml", type: "yaml", required: true, description: "Freeze window YAML string with 'freeze:' root (e.g. 'freeze:\\n  name: ...\\n  identifier: ...\\n  windows: ...')" },
  ],
};

const freezeUpdateSchema: BodySchema = {
  description: "Updated freeze window YAML definition. Pass the full freeze YAML string with a 'freeze:' root.",
  fields: [
    { name: "yaml", type: "yaml", required: true, description: "Complete freeze window YAML string (replaces existing)" },
  ],
};

const globalFreezeManageSchema: BodySchema = {
  description: "Manage (enable/disable) the global freeze. Pass the freeze YAML definition.",
  fields: [
    { name: "yaml", type: "yaml", required: true, description: "Global freeze YAML string with 'freeze:' root" },
  ],
};

// ---------------------------------------------------------------------------
// Toolset definition
// ---------------------------------------------------------------------------

export const freezeToolset: ToolsetDefinition = {
  name: "freeze",
  displayName: "Deployment Freeze",
  description: "Deployment freeze windows — create, manage, and toggle freeze windows to block pipeline executions during maintenance or release periods",
  resources: [
    // ----- Freeze Window -----
    {
      resourceType: "freeze_window",
      displayName: "Freeze Window",
      description: "Deployment freeze window. Block pipeline executions during specified time windows. Supports full CRUD plus toggle status.",
      toolset: "freeze",
      scope: "project",
      identifierFields: ["freeze_id"],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/settings/freeze-windows/studio/window/{freezeIdentifier}/?sectionId=OVERVIEW",
      listFilterFields: [
        { name: "freeze_status", description: "Filter by freeze status", enum: ["Enabled", "Disabled"] },
        { name: "search_term", description: "Filter freeze windows by name or keyword" },
        { name: "start_time", description: "Filter by start time (epoch ms)" },
        { name: "end_time", description: "Filter by end time (epoch ms)" },
      ],
      operations: {
        list: {
          method: "POST",
          path: "/ng/api/freeze/list",
          queryParams: {
            page: "page",
            size: "size",
          },
          bodyBuilder: (input) => {
            const filterProperties: Record<string, unknown> = {
              filterType: "FreezeSetup",
            };
            if (input.freeze_status) filterProperties.freezeStatus = input.freeze_status;
            if (input.search_term) filterProperties.searchTerm = input.search_term;
            if (input.start_time) filterProperties.startTime = input.start_time;
            if (input.end_time) filterProperties.endTime = input.end_time;
            return filterProperties;
          },
          responseExtractor: pageExtract,
          description: "List deployment freeze windows with optional filters",
        },
        get: {
          method: "GET",
          path: "/ng/api/freeze/{freezeIdentifier}",
          pathParams: { freeze_id: "freezeIdentifier" },
          responseExtractor: ngExtract,
          description: "Get freeze window details by identifier",
        },
        create: {
          method: "POST",
          path: "/ng/api/freeze",
          headers: { "Content-Type": "application/yaml" },
          bodyBuilder: (input) => {
            const b = input.body as Record<string, unknown> | undefined;
            if (b && typeof b === "object" && typeof b.yaml === "string") {
              return b.yaml;
            }
            throw new Error("body must include yaml (freeze YAML string with 'freeze:' root)");
          },
          responseExtractor: ngExtract,
          description: "Create a new deployment freeze window from YAML",
          bodySchema: freezeCreateSchema,
        },
        update: {
          method: "PUT",
          path: "/ng/api/freeze/{freezeIdentifier}",
          pathParams: { freeze_id: "freezeIdentifier" },
          headers: { "Content-Type": "application/yaml" },
          bodyBuilder: (input) => {
            const b = input.body as Record<string, unknown> | undefined;
            if (b && typeof b === "object" && typeof b.yaml === "string") {
              return b.yaml;
            }
            throw new Error("body must include yaml (freeze YAML string with 'freeze:' root)");
          },
          responseExtractor: ngExtract,
          description: "Update an existing deployment freeze window from YAML",
          bodySchema: freezeUpdateSchema,
        },
        delete: {
          method: "DELETE",
          path: "/ng/api/freeze/{freezeIdentifier}",
          pathParams: { freeze_id: "freezeIdentifier" },
          responseExtractor: ngExtract,
          description: "Delete a deployment freeze window",
        },
      },
      executeActions: {
        toggle_status: {
          method: "POST",
          path: "/ng/api/freeze/updateFreezeStatus",
          queryParams: { status: "status" },
          bodyBuilder: (input) => {
            const b = input.body as Record<string, unknown> | undefined;
            const ids = b?.freeze_ids ?? input.freeze_ids;
            if (!Array.isArray(ids) || ids.length === 0) {
              throw new Error("body must include freeze_ids (array of freeze window identifiers)");
            }
            return ids;
          },
          responseExtractor: ngExtract,
          actionDescription: "Toggle freeze window status (Enabled/Disabled). Pass status='Enabled' or status='Disabled' and freeze_ids (array of identifiers) in body.",
          bodySchema: {
            description: "Request body is a JSON array of freeze window identifiers (e.g. [\"freeze1\", \"freeze2\"]). Pass freeze_ids in the body object — bodyBuilder extracts the array for the API.",
            fields: [
              { name: "freeze_ids", type: "array", required: false, description: "Array of freeze window identifiers to toggle", itemType: "string" },
            ],
          },
        },
      },
    },

    // ----- Global Freeze -----
    {
      resourceType: "global_freeze",
      displayName: "Global Freeze",
      description: "Global deployment freeze — a singleton freeze that applies across the entire project scope. Supports get and manage (enable/disable).",
      toolset: "freeze",
      scope: "project",
      identifierFields: [],
      operations: {
        get: {
          method: "GET",
          path: "/ng/api/freeze/getGlobalFreeze",
          responseExtractor: ngExtract,
          description: "Get the current global freeze status and configuration",
        },
      },
      executeActions: {
        manage: {
          method: "POST",
          path: "/ng/api/freeze/manageGlobalFreeze",
          headers: { "Content-Type": "application/yaml" },
          bodyBuilder: (input) => {
            const b = input.body as Record<string, unknown> | undefined;
            if (b && typeof b === "object" && typeof b.yaml === "string") {
              return b.yaml;
            }
            throw new Error("body must include yaml (global freeze YAML string with 'freeze:' root)");
          },
          responseExtractor: ngExtract,
          actionDescription: "Enable or disable the global deployment freeze. Pass freeze YAML definition in body.yaml.",
          bodySchema: globalFreezeManageSchema,
        },
      },
    },
  ],
};
