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
        { name: "secret_identifier", description: "Filter by secret identifier" },
        { name: "secret_name", description: "Filter by secret name" },
        { name: "secret_manager_identifiers", description: "Filter by secret manager identifiers (comma-separated)" },
        { name: "description", description: "Filter by description" },
        { name: "tags", description: "Filter by tags as key:value pairs (JSON object)" },
        { name: "include_all_secrets_accessible_at_scope", type: "boolean", description: "When true, include secrets inherited from parent scopes (e.g. at project scope also return org- and account-scope secrets). Default: false." },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/setup/resources/secrets/{secretIdentifier}",
      operations: {
        list: {
          method: "POST",
          path: "/ng/api/v2/secrets/list/secrets",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            search_term: "searchTerm",
            page: "pageIndex",
            size: "pageSize",
          },
          bodyBuilder: (input) => {
            const csv = (v: unknown): string[] | undefined => {
              if (!v) return undefined;
              return String(v).split(",").map((s) => s.trim()).filter(Boolean);
            };
            const asBool = (v: unknown): boolean | undefined => {
              if (v === true || v === "true") return true;
              if (v === false || v === "false") return false;
              return undefined;
            };
            return {
              filterType: "Secret",
              secretTypes: input.type ? [input.type] : undefined,
              secretIdentifier: input.secret_identifier || undefined,
              secretName: input.secret_name || undefined,
              secretManagerIdentifiers: csv(input.secret_manager_identifiers),
              description: input.description || undefined,
              searchTerm: input.search_term || undefined,
              tags: input.tags,
              includeAllSecretsAccessibleAtScope: asBool(input.include_all_secrets_accessible_at_scope),
            };
          },
          responseExtractor: pageExtract,
          description: "List secret metadata (values never exposed)",
        },
        get: {
          method: "GET",
          path: "/ng/api/v2/secrets/{secretIdentifier}",
          pathParams: { secret_id: "secretIdentifier" },
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          responseExtractor: ngExtract,
          description: "Get secret metadata (value never exposed)",
        },
      },
    },
  ],
};
