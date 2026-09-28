import type { ToolsetDefinition } from "../types.js";
import { asRecord, asString } from "../../utils/type-guards.js";
import {
  restResourceFirstExtract,
  restResourceListExtract,
  restResourceUnwrap,
} from "../extractors.js";

function delegateListBody(input: Record<string, unknown>): Record<string, unknown> | undefined {
  const body: Record<string, unknown> = { filterType: "Delegate" };
  if (input.status) body.status = input.status;
  if (input.delegate_name) body.delegateName = input.delegate_name;
  if (input.delegate_id && !body.delegateName) body.delegateName = input.delegate_id;
  if (input.delegate_type) body.delegateType = input.delegate_type;
  if (input.description) body.description = input.description;
  if (input.host_name) body.hostName = input.host_name;
  if (input.delegate_group_identifier) body.delegateGroupIdentifier = input.delegate_group_identifier;
  if (input.delegate_instance_filter) body.delegateInstanceFilter = input.delegate_instance_filter;
  if (input.auto_upgrade) body.autoUpgrade = input.auto_upgrade;
  if (input.version_status) body.versionStatus = input.version_status;
  // No filters → omit the body (same as an unfiltered UI list).
  return Object.keys(body).length > 1 ? body : undefined;
}

/** Token name is a query parameter. Accept token_name, name, resource_id, or body.name. */
function hoistDelegateTokenName(input: Record<string, unknown>): undefined {
  if (asString(input.token_name)) return undefined;
  const body = asRecord(input.body);
  const name = asString(input.name) ?? asString(body?.name) ?? asString(body?.token_name);
  if (name) {
    input.token_name = name;
    return undefined;
  }
  throw new Error(
    'delegate_token: "token_name" is required. Pass token_name, name, resource_id, or body.name.',
  );
}

export const delegatesToolset: ToolsetDefinition = {
  name: "delegates",
  displayName: "Delegates",
  description: "Delegate management, health status, and delegate tokens",
  resources: [
    {
      resourceType: "delegate",
      displayName: "Delegate",
      description:
        "Harness delegate agent for executing tasks. List and get by name. Lives at account, org, or project scope — pass resource_scope (and org_id/project_id) to match the delegate's location. Pass filters.all=true without org/project to list every delegate in the account.",
      toolset: "delegates",
      scope: "account",
      supportedScopes: ["account", "org", "project"],
      scopeOptional: true,
      identifierFields: ["delegate_id"],
      diagnosticHint: "Use harness_diagnose with resource_type='delegate' to check health across all delegates — reports connectivity, heartbeat staleness, expiring replicas, and legacy mode. Optionally pass resource_id to filter to a specific delegate.",
      deepLinkTemplate: "/ng/account/{accountId}/settings/resources/delegates",
      listFilterFields: [
        { name: "all", description: "When true, include delegates in child org/project scopes under the requested scope. Omit for the current scope only.", type: "boolean" },
        { name: "status", description: "Delegate status filter", enum: ["CONNECTED", "DISCONNECTED", "ENABLED", "WAITING_FOR_APPROVAL", "DISABLED", "DELETED"] },
        { name: "delegate_name", description: "Filter delegates by name" },
        { name: "delegate_type", description: "Delegate type filter" },
        { name: "description", description: "Filter by delegate description" },
        { name: "host_name", description: "Filter by host name" },
        { name: "delegate_group_identifier", description: "Filter by delegate group identifier" },
        { name: "delegate_instance_filter", description: "Filter by delegate instance", enum: ["EXPIRED", "AVAILABLE"] },
        { name: "auto_upgrade", description: "Filter by auto upgrade status", enum: ["ON", "OFF", "DETECTING"] },
        { name: "version_status", description: "Filter by version status", enum: ["EXPIRED", "EXPIRING", "UNSUPPORTED", "ACTIVE"] },
      ],
      operations: {
        list: {
          method: "POST",
          path: "/ng/api/delegate-setup/listDelegates",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: { all: "all" },
          skipScopeBodyInjection: true,
          bodyBuilder: delegateListBody,
          responseExtractor: restResourceListExtract,
          description: "List delegates at the requested scope. Pass all=true to include child org/project scopes.",
        },
        get: {
          method: "POST",
          path: "/ng/api/delegate-setup/listDelegates",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: { all: "all" },
          defaultQueryParams: { all: "true" },
          skipScopeBodyInjection: true,
          paramsSchema: {
            fields: [
              { name: "delegate_id", required: true, description: "Delegate group name" },
            ],
          },
          bodyBuilder: (input) => ({
            filterType: "Delegate",
            delegateName: input.delegate_id ?? input.delegate_name,
          }),
          responseExtractor: restResourceFirstExtract,
          description: "Get a delegate group by name.",
        },
      },
    },
    {
      resourceType: "delegate_token",
      displayName: "Delegate Token",
      description:
        "Delegate registration token. Tokens are scoped like delegates (account, org, or project). Pass the name as token_name (or body.name on create).",
      toolset: "delegates",
      scope: "project",
      supportedScopes: ["account", "org", "project"],
      scopeOptional: true,
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
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            name: "name",
            status: "status",
          },
          responseExtractor: restResourceListExtract,
          description: "List delegate tokens at the requested scope",
        },
        get: {
          method: "GET",
          path: "/ng/api/delegate-token-ng",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            token_name: "name",
            name: "name",
          },
          bodyBuilder: hoistDelegateTokenName,
          responseExtractor: restResourceFirstExtract,
          description: "Get a delegate token by name",
        },
        create: {
          method: "POST",
          path: "/ng/api/delegate-token-ng",
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          queryParams: {
            token_name: "tokenName",
            name: "tokenName",
            revoke_after: "revokeAfter",
          },
          skipScopeBodyInjection: true,
          bodyBuilder: hoistDelegateTokenName,
          bodySchema: {
            description: "Token name. Pass body.name or token_name.",
            fields: [
              { name: "name", type: "string", required: true, description: "Token name" },
            ],
          },
          responseExtractor: restResourceUnwrap,
          description: "Create a delegate token",
        },
        delete: {
          method: "DELETE",
          path: "/ng/api/delegate-token-ng",
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          queryParams: {
            token_name: "tokenName",
            name: "tokenName",
          },
          skipScopeBodyInjection: true,
          bodyBuilder: hoistDelegateTokenName,
          responseExtractor: restResourceUnwrap,
          description: "Delete a revoked delegate token",
        },
      },
      executeActions: {
        revoke: {
          method: "PUT",
          path: "/ng/api/delegate-token-ng",
          operationPolicy: { risk: "high_write", retryPolicy: "do_not_retry" },
          queryParams: {
            token_name: "tokenName",
            name: "tokenName",
          },
          skipScopeBodyInjection: true,
          bodyBuilder: hoistDelegateTokenName,
          bodySchema: { description: "No body required. Pass token_name to identify the token.", fields: [] },
          responseExtractor: restResourceUnwrap,
          actionDescription: "Revoke a delegate token. Sets status to REVOKED.",
        },
        get_delegates: {
          method: "GET",
          path: "/ng/api/delegate-token-ng/delegate-groups",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            token_name: "delegateTokenName",
            name: "delegateTokenName",
          },
          bodyBuilder: hoistDelegateTokenName,
          bodySchema: { description: "No body required. Pass token_name to identify the token.", fields: [] },
          responseExtractor: restResourceUnwrap,
          actionDescription: "List delegate groups associated with a specific token.",
        },
      },
    },
  ],
};
