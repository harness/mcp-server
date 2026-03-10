import type { ToolsetDefinition } from "../types.js";
import { ngExtract, pageExtract } from "../extractors.js";

export const secretsToolset: ToolsetDefinition = {
  name: "secrets",
  displayName: "Secrets",
  description: "Secret management (read-only metadata — values never exposed)",
  resources: [
    {
      resourceType: "secret",
      displayName: "Secret",
      description: "Secret metadata (name, type, scope). Values are NEVER returned. Read-only.",
      toolset: "secrets",
      scope: "project",
      identifierFields: ["secret_id"],
      listFilterFields: [
        { name: "search_term", description: "Filter secrets by name or keyword" },
        { name: "type", description: "Secret type filter", enum: ["SecretFile", "SecretText", "SSHKey", "WinRmCredentials"] },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/setup/resources/secrets/{secretIdentifier}",
      operations: {
        list: {
          method: "POST",
          path: "/ng/api/v2/secrets/list",
          queryParams: {
            search_term: "searchTerm",
            page: "page",
            size: "size",
          },
          bodyBuilder: (input) => ({
            filterType: "Secret",
            secretTypes: input.type ? [input.type] : undefined,
          }),
          responseExtractor: pageExtract,
          description: "List secret metadata (values never exposed)",
        },
        get: {
          method: "GET",
          path: "/ng/api/v2/secrets/{secretIdentifier}",
          pathParams: { secret_id: "secretIdentifier" },
          responseExtractor: ngExtract,
          description: "Get secret metadata (value never exposed)",
        },
      },
    },
  ],
};
