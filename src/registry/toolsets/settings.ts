import type { ToolsetDefinition } from "../types.js";
import { ngExtract } from "../extractors.js";

export const settingsToolset: ToolsetDefinition = {
  name: "settings",
  displayName: "Settings",
  description: "Harness platform settings — account, org, and project configuration",
  resources: [
    {
      resourceType: "setting",
      displayName: "Setting",
      description: "Platform setting. Supports list with required 'category' filter. Optionally filter by 'group' and 'include_parent_scopes'.",
      toolset: "settings",
      scope: "project",
      identifierFields: [],
      listFilterFields: [
        { name: "category", description: "Filter settings by category" },
        { name: "group", description: "Filter settings by group" },
        { name: "include_parent_scopes", description: "Include parent scopes in settings", type: "boolean" },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/settings",
      operations: {
        list: {
          method: "GET",
          path: "/ng/api/settings",
          queryParams: {
            category: "category",
            group: "group",
            include_parent_scopes: "includeParentScopes",
          },
          responseExtractor: ngExtract,
          description: "List platform settings. 'category' is required (e.g. CE, CI, CD, CORE, PMS, NOTIFICATION).",
        },
      },
    },
  ],
};
