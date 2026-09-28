import type { ToolsetDefinition } from "../types.js";
import { ngExtract } from "../extractors.js";

/** Category values accepted by GET /ng/api/settings. */
export const SETTING_CATEGORIES = [
  "CD",
  "CI",
  "CE",
  "CV",
  "CF",
  "STO",
  "CORE",
  "PMS",
  "TEMPLATESERVICE",
  "GOVERNANCE",
  "CHAOS",
  "SCIM",
  "GIT_EXPERIENCE",
  "CONNECTORS",
  "EULA",
  "NOTIFICATIONS",
  "SUPPLY_CHAIN_ASSURANCE",
  "USER",
  "MODULES_VISIBILITY",
  "DBOPS",
  "IR",
  "AR",
  "RELEASE",
] as const;

export const settingsToolset: ToolsetDefinition = {
  name: "settings",
  displayName: "Settings",
  description: "Harness platform settings — account, org, and project configuration",
  resources: [
    {
      resourceType: "setting",
      displayName: "Setting",
      description:
        "Platform setting. Supports list with a 'category' filter. Optionally filter by 'group' and 'include_parent_scopes'. " +
        "Use resource_scope='account'|'org'|'project' to target account-, org-, or project-level settings. Default is project.",
      toolset: "settings",
      scope: "project",
      supportedScopes: ["account", "org", "project"],
      identifierFields: [],
      listFilterFields: [
        {
          name: "category",
          required: true,
          description: "Filter settings by category",
          enum: [...SETTING_CATEGORIES],
        },
        { name: "group", description: "Filter settings by group" },
        {
          name: "include_parent_scopes",
          description: "Include settings that exist only at parent scopes",
          type: "boolean",
        },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/settings",
      operations: {
        list: {
          method: "GET",
          path: "/ng/api/settings",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            category: "category",
            group: "group",
            include_parent_scopes: "includeParentScopes",
          },
          responseExtractor: ngExtract,
          description: "List platform settings.",
        },
      },
    },
  ],
};
