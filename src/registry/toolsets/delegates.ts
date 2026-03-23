import type { ToolsetDefinition } from "../types.js";
import { ngExtract, v1Unwrap } from "../extractors.js";

export const delegatesToolset: ToolsetDefinition = {
  name: "delegates",
  displayName: "Delegates",
  description: "Delegate management, health status, and delegate tokens",
  resources: [
    {
      resourceType: "delegate",
      displayName: "Delegate",
      description: "Harness delegate agent for executing tasks. List-only.",
      toolset: "delegates",
      scope: "account",
      scopeOptional: true,
      identifierFields: ["delegate_id"],
      diagnosticHint: "Use harness_diagnose with resource_type='delegate' to check health across all delegates — reports connectivity, heartbeat staleness, expiring replicas, and legacy mode. Optionally pass resource_id to filter to a specific delegate.",
      deepLinkTemplate: "/ng/account/{accountId}/settings/resources/delegates",
      listFilterFields: [
        { name: "all", description: "Include all delegates", type: "boolean" },
        { name: "status", description: "Delegate status filter", enum: ["CONNECTED", "DISCONNECTED", "ENABLED", "WAITING_FOR_APPROVAL", "DISABLED", "DELETED"] },
        { name: "delegate_name", description: "Filter delegates by name" },
        { name: "delegate_type", description: "Delegate type filter" },
        { name: "description", description: "Filter by delegate description" },
        { name: "host_name", description: "Filter by host name" },
        { name: "delegate_group_identifier", description: "Filter by delegate group identifier" },
        { name: "delegate_instance_filter", description: "Filter by delegate instance" },
        { name: "auto_upgrade", description: "Filter by auto upgrade status" },
        { name: "version_status", description: "Filter by version status" },
      ],
      operations: {
        list: {
          method: "POST",
          path: "/ng/api/delegate-setup/listDelegates",
          queryParams: { all: "all" },
          bodyBuilder: (input) => ({
            filterType: "Delegate",
            ...(input.status ? { status: input.status } : {}),
            ...(input.delegate_name ? { delegateName: input.delegate_name } : {}),
            ...(input.delegate_type ? { delegateType: input.delegate_type } : {}),
            ...(input.description ? { description: input.description } : {}),
            ...(input.host_name ? { hostName: input.host_name } : {}),
            ...(input.delegate_group_identifier ? { delegateGroupIdentifier: input.delegate_group_identifier } : {}),
            ...(input.delegate_instance_filter ? { delegateInstanceFilter: input.delegate_instance_filter } : {}),
            ...(input.auto_upgrade ? { autoUpgrade: input.auto_upgrade } : {}),
            ...(input.version_status ? { versionStatus: input.version_status } : {}),
          }),
          responseExtractor: v1Unwrap("resource"),
          description: "List all delegates in the account",
        },
      },
    },
    {
      resourceType: "delegate_token",
      displayName: "Delegate Token",
      description: "Delegate registration token. Supports list, get, create, delete, and revoke action.",
      toolset: "delegates",
      scope: "project",
      identifierFields: ["token_name"],
      listFilterFields: [
        { name: "name", description: "Filter delegate tokens by name" },
        { name: "status", description: "Delegate token status filter", enum: ["ACTIVE", "REVOKED"] },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/settings/resources/delegates/tokens",
      operations: {
        list: {
          method: "GET",
          path: "/ng/api/delegate-token-ng",
          queryParams: {
            name: "name",
            status: "status",
          },
          responseExtractor: ngExtract,
          description: "List delegate tokens",
        },
        get: {
          method: "GET",
          path: "/ng/api/delegate-token-ng/{tokenName}",
          pathParams: { token_name: "tokenName" },
          responseExtractor: ngExtract,
          description: "Get delegate token details",
        },
        create: {
          method: "POST",
          path: "/ng/api/delegate-token-ng",
          bodyBuilder: (input) => ({
            name: input.token_name ?? input.name,
          }),
          bodySchema: {
            description: "Delegate token",
            fields: [
              { name: "name", type: "string", required: true, description: "Token name" },
            ],
          },
          responseExtractor: ngExtract,
          description: "Create a delegate token",
        },
        delete: {
          method: "DELETE",
          path: "/ng/api/delegate-token-ng/{tokenName}",
          pathParams: { token_name: "tokenName" },
          responseExtractor: ngExtract,
          description: "Delete a delegate token",
        },
      },
      executeActions: {
        revoke: {
          method: "PUT",
          path: "/ng/api/delegate-token-ng/{tokenName}",
          pathParams: { token_name: "tokenName" },
          queryParams: { status: "status" },
          bodyBuilder: () => undefined,
          bodySchema: { description: "No body required. Token is revoked via path parameter.", fields: [] },
          responseExtractor: ngExtract,
          actionDescription: "Revoke a delegate token. Sets status to REVOKED.",
        },
        get_delegates: {
          method: "GET",
          path: "/ng/api/delegate-token-ng/{tokenName}/delegates",
          pathParams: { token_name: "tokenName" },
          bodySchema: { description: "No body required. Returns delegates for the token.", fields: [] },
          responseExtractor: ngExtract,
          actionDescription: "Get delegates associated with a specific token.",
        },
      },
    },
  ],
};
