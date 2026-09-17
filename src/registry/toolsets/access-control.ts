import type { ToolsetDefinition } from "../types.js";
import { ngExtract, pageExtract, userAggregateExtract, userAggregatePageExtract } from "../extractors.js";

function csvStrings(value: unknown): string[] | undefined {
  if (value == null || value === "") return undefined;
  const parts = Array.isArray(value)
    ? value.map((item) => String(item).trim())
    : String(value).split(",").map((item) => item.trim());
  const out = parts.filter(Boolean);
  return out.length > 0 ? out : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return undefined;
}

/** Keep email/uuid through harness_list compact mode (email is not in the global whitelist). */
function compactUserListItem(item: Record<string, unknown>): Record<string, unknown> {
  const slim: Record<string, unknown> = {};
  for (const key of [
    "identifier",
    "uuid",
    "name",
    "email",
    "locked",
    "disabled",
    "externallyManaged",
    "openInHarness",
  ] as const) {
    if (item[key] !== undefined) slim[key] = item[key];
  }
  return slim;
}

function mapRoleBinding(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const r = raw as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  const roleIdentifier = r.roleIdentifier ?? r.role_identifier;
  const resourceGroupIdentifier = r.resourceGroupIdentifier ?? r.resource_group_identifier;
  const roleScopeLevel = r.roleScopeLevel ?? r.role_scope_level;
  const roleName = r.roleName ?? r.role_name;
  const resourceGroupName = r.resourceGroupName ?? r.resource_group_name;
  if (typeof roleIdentifier === "string") out.roleIdentifier = roleIdentifier;
  if (typeof resourceGroupIdentifier === "string") out.resourceGroupIdentifier = resourceGroupIdentifier;
  if (typeof roleScopeLevel === "string") out.roleScopeLevel = roleScopeLevel;
  if (typeof roleName === "string") out.roleName = roleName;
  if (typeof resourceGroupName === "string") out.resourceGroupName = resourceGroupName;
  const managed = asBoolean(r.managedRole ?? r.managed_role);
  if (managed !== undefined) out.managedRole = managed;
  return out;
}

function assertMemberUuids(value: unknown): string[] {
  if (Array.isArray(value) && value.length === 0) return [];
  const users = csvStrings(value);
  if (!users) {
    throw new Error("users must be an array or comma-separated list of user UUIDs");
  }
  const emailed = users.find((id) => id.includes("@"));
  if (emailed) {
    throw new Error(
      `users must be Harness user UUIDs, not emails (${emailed}). Call harness_list resource_type=user and use identifier/uuid.`,
    );
  }
  return users;
}

function userGroupWriteBody(input: Record<string, unknown>): Record<string, unknown> {
  const raw = input.body;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("body is required and must be an object with identifier and name");
  }
  const b = { ...(raw as Record<string, unknown>) };
  if (typeof b.identifier !== "string" || b.identifier === "") {
    const fromField = input.user_group_id;
    if (typeof fromField === "string" && fromField !== "") b.identifier = fromField;
  }
  if (b.users !== undefined) {
    b.users = assertMemberUuids(b.users);
  }
  return b;
}

const USER_GROUP_WRITE_SCHEMA = {
  description: "User group definition",
  fields: [
    { name: "identifier", type: "string" as const, required: true, description: "Unique identifier" },
    { name: "name", type: "string" as const, required: true, description: "Display name" },
    { name: "description", type: "string" as const, required: false, description: "Group description" },
    { name: "users", type: "array" as const, required: false, description: "User IDs to add to the group", itemType: "string" },
  ],
};

export const accessControlToolset: ToolsetDefinition = {
  name: "access_control",
  displayName: "Access Control",
  description: "RBAC — users, user groups, service accounts, roles, role assignments, resource groups, and permissions",
  resources: [
    {
      resourceType: "user",
      displayName: "User",
      description:
        "Harness users. Supports list, get, and invite. Default list/get/invite scope is project — pass org_id and project_id (or a project URL) on the first call. Use resource_scope='account' only when the user asked for account-level users.",
      toolset: "access_control",
      scope: "project",
      supportedScopes: ["account", "org", "project"],
      identifierFields: ["user_id"],
      compactItem: compactUserListItem,
      listFilterFields: [
        { name: "search_term", description: "Filter users by email or name" },
        { name: "role_identifiers", description: "Filter by role identifiers (comma-separated)" },
        { name: "resource_group_identifiers", description: "Filter by resource group identifiers (comma-separated)" },
      ],
      diagnosticHint:
        "If get returns 404, user_id must be the UUID from harness_list (identifier/uuid), not an email. Search with search_term=<email> and use the returned uuid. If list is empty, retry with resource_scope matching where the user lives (account, org, or project).",
      deepLinkTemplate: "/ng/account/{accountId}/settings/access-control/users",
      operations: {
        list: {
          method: "POST",
          path: "/ng/api/user/aggregate",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          skipScopeBodyInjection: true,
          queryParams: {
            search_term: "searchTerm",
            page: "pageIndex",
            size: "pageSize",
          },
          bodyBuilder: (input) => {
            const roleIdentifiers = csvStrings(input.role_identifiers);
            const resourceGroupIdentifiers = csvStrings(input.resource_group_identifiers);
            if ((roleIdentifiers || resourceGroupIdentifiers) && input.search_term) {
              throw new Error("Search and Filter are not supported together");
            }
            const body: Record<string, unknown> = {};
            if (roleIdentifiers) body.roleIdentifiers = roleIdentifiers;
            if (resourceGroupIdentifiers) body.resourceGroupIdentifiers = resourceGroupIdentifiers;
            return body;
          },
          responseExtractor: userAggregatePageExtract,
          description: "List users",
        },
        get: {
          method: "GET",
          path: "/ng/api/user/aggregate/{userId}",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { user_id: "userId" },
          responseExtractor: userAggregateExtract,
          description: "Get user details by ID",
        },
      },
      executeActions: {
        invite: {
          method: "POST",
          path: "/ng/api/user/users",
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          skipScopeBodyInjection: true,
          bodyBuilder: (input) => {
            const b = input.body as Record<string, unknown> | undefined;
            const emails = csvStrings(b?.emails ?? b?.email_ids);
            if (!emails) {
              throw new Error(
                'emails is required for user invite — pass body.emails as an array or comma-separated string.',
              );
            }
            const userGroups = csvStrings(b?.user_groups ?? b?.user_group_ids);
            const roleBindingsRaw = b?.role_bindings ?? b?.roleBindings;
            const roleBindings = Array.isArray(roleBindingsRaw)
              ? roleBindingsRaw.map(mapRoleBinding)
              : [];
            return {
              emails,
              ...(userGroups ? { userGroups } : {}),
              ...(roleBindings.length > 0 ? { roleBindings } : {}),
            };
          },
          responseExtractor: ngExtract,
          actionDescription: "Invite users to Harness with specified role bindings and user groups.",
          bodySchema: {
            description: "User invitation request",
            fields: [
              { name: "emails", type: "array", required: true, description: "Email addresses of users to invite (array or comma-separated string)", itemType: "string" },
              { name: "user_groups", type: "array", required: false, description: "User group identifiers to add invited users to", itemType: "string" },
              { name: "role_bindings", type: "array", required: false, description: "Role bindings for invited users", itemType: "object", fields: [
                { name: "roleIdentifier", type: "string", required: true, description: "Role identifier" },
                { name: "resourceGroupIdentifier", type: "string", required: false, description: "Resource group identifier" },
                { name: "roleScopeLevel", type: "string", required: false, description: "Role scope level (account, organization, project)" },
                { name: "roleName", type: "string", required: false, description: "Role display name" },
                { name: "resourceGroupName", type: "string", required: false, description: "Resource group display name" },
                { name: "managedRole", type: "boolean", required: false, description: "Whether this is a managed role" },
              ]},
            ],
          },
        },
      },
    },
    {
      resourceType: "user_group",
      displayName: "User Group",
      description:
        "User group for RBAC. Supports list, get, create, update, and delete. Default list/get/create/update/delete scope is project — pass org_id and project_id (or a project URL) on the first call. Use resource_scope='account' only when the user asked for account-level groups.",
      toolset: "access_control",
      scope: "project",
      supportedScopes: ["account", "org", "project"],
      identifierFields: ["user_group_id"],
      listFilterFields: [
        { name: "search_term", description: "Filter user groups by name or keyword" },
        {
          name: "filter_type",
          description: "Which groups to include at this scope",
          enum: [
            "EXCLUDE_INHERITED_GROUPS",
            "INCLUDE_INHERITED_GROUPS",
            "INCLUDE_CHILD_SCOPE_GROUPS",
            "INCLUDE_PARENT_SCOPE_GROUPS",
          ],
        },
      ],
      diagnosticHint:
        "If get/update/delete returns 404, the group may live at another scope — use the item's org/project (or resource_scope=account). users must be user UUIDs from harness_list resource_type=user (identifier), not emails. Update replaces the whole group including membership.",
      deepLinkTemplate: "/ng/account/{accountId}/settings/access-control/user-groups/{groupIdentifier}",
      operations: {
        list: {
          method: "GET",
          path: "/ng/api/user-groups",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            search_term: "searchTerm",
            filter_type: "filterType",
            page: "pageIndex",
            size: "pageSize",
          },
          responseExtractor: pageExtract,
          description: "List user groups",
        },
        get: {
          method: "GET",
          path: "/ng/api/user-groups/{groupIdentifier}",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { user_group_id: "groupIdentifier" },
          responseExtractor: ngExtract,
          description: "Get user group details",
        },
        create: {
          method: "POST",
          path: "/ng/api/user-groups",
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          injectAccountInBody: true,
          bodyBuilder: userGroupWriteBody,
          responseExtractor: ngExtract,
          description: "Create a user group",
          bodySchema: USER_GROUP_WRITE_SCHEMA,
        },
        update: {
          method: "PUT",
          path: "/ng/api/user-groups",
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          injectAccountInBody: true,
          bodyBuilder: userGroupWriteBody,
          responseExtractor: ngExtract,
          description: "Update a user group",
          bodySchema: USER_GROUP_WRITE_SCHEMA,
        },
        delete: {
          method: "DELETE",
          path: "/ng/api/user-groups/{groupIdentifier}",
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          pathParams: { user_group_id: "groupIdentifier" },
          responseExtractor: ngExtract,
          description: "Delete a user group",
        },
      },
    },
    {
      resourceType: "service_account",
      displayName: "Service Account",
      description: "Service account for API access. Supports list, get, create, and delete.",
      toolset: "access_control",
      scope: "project",
      identifierFields: ["service_account_id"],
      listFilterFields: [
        { name: "search_term", description: "Filter service accounts by name or keyword" },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/settings/access-control/service-accounts/{serviceAccountIdentifier}",
      operations: {
        list: {
          method: "GET",
          path: "/ng/api/serviceaccount",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            search_term: "searchTerm",
            page: "pageIndex",
            size: "pageSize",
          },
          responseExtractor: pageExtract,
          description: "List service accounts",
        },
        get: {
          method: "GET",
          path: "/ng/api/serviceaccount/{serviceAccountIdentifier}",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { service_account_id: "serviceAccountIdentifier" },
          responseExtractor: ngExtract,
          description: "Get service account details",
        },
        create: {
          method: "POST",
          path: "/ng/api/serviceaccount",
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          bodyBuilder: (input) => input.body,
          injectAccountInBody: true,
          responseExtractor: ngExtract,
          description: "Create a service account",
          bodySchema: {
            description: "Service account definition",
            fields: [
              { name: "identifier", type: "string", required: true, description: "Unique identifier" },
              { name: "name", type: "string", required: true, description: "Display name" },
              { name: "email", type: "string", required: true, description: "Service account email" },
              { name: "description", type: "string", required: false, description: "Description" },
              { name: "tags", type: "object", required: false, description: "Key-value tag map" },
            ],
          },
        },
        delete: {
          method: "DELETE",
          path: "/ng/api/serviceaccount/{serviceAccountIdentifier}",
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          pathParams: { service_account_id: "serviceAccountIdentifier" },
          responseExtractor: ngExtract,
          description: "Delete a service account",
        },
      },
    },
    {
      resourceType: "role",
      displayName: "Role",
      description: "RBAC role. Supports list, get, create, and delete.",
      toolset: "access_control",
      scope: "project",
      identifierFields: ["role_id"],
      listFilterFields: [
        { name: "search_term", description: "Filter roles by name or keyword" },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/settings/access-control/roles/{roleIdentifier}",
      operations: {
        list: {
          method: "GET",
          path: "/authz/api/roles",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            search_term: "searchTerm",
            page: "pageIndex",
            size: "pageSize",
          },
          responseExtractor: pageExtract,
          description: "List available roles",
        },
        get: {
          method: "GET",
          path: "/authz/api/roles/{roleIdentifier}",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { role_id: "roleIdentifier" },
          responseExtractor: ngExtract,
          description: "Get role details",
        },
        create: {
          method: "POST",
          path: "/authz/api/roles",
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          bodyBuilder: (input) => input.body,
          responseExtractor: ngExtract,
          description: "Create a role",
          bodySchema: {
            description: "Role definition",
            fields: [
              { name: "identifier", type: "string", required: true, description: "Unique identifier" },
              { name: "name", type: "string", required: true, description: "Display name" },
              { name: "permissions", type: "array", required: true, description: "Permission identifiers to include", itemType: "string" },
              { name: "description", type: "string", required: false, description: "Role description" },
              { name: "allowed_scope_levels", type: "array", required: false, description: "Allowed scope levels", itemType: "string" },
            ],
          },
        },
        delete: {
          method: "DELETE",
          path: "/authz/api/roles/{roleIdentifier}",
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          pathParams: { role_id: "roleIdentifier" },
          responseExtractor: ngExtract,
          description: "Delete a role",
        },
      },
    },
    {
      resourceType: "role_assignment",
      displayName: "Role Assignment",
      description: "Role assignment binding a principal to a role. Supports list, create, and delete.",
      toolset: "access_control",
      scope: "project",
      identifierFields: ["role_assignment_id"],
      listFilterFields: [
        { name: "principal_type", description: "Principal type filter", enum: ["USER", "USER_GROUP", "SERVICE_ACCOUNT"] },
        { name: "role_identifier", description: "Role identifier filter" },
        { name: "resource_group_identifier", description: "Resource group identifier filter" },
      ],
      operations: {
        list: {
          method: "POST",
          path: "/authz/api/roleassignments/filter",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: { page: "pageIndex", size: "pageSize" },
          bodyBuilder: (input) => ({
            principalTypeFilter: input.principal_type ? [input.principal_type] : undefined,
            roleFilter: input.role_identifier ? [input.role_identifier] : undefined,
            resourceGroupFilter: input.resource_group_identifier ? [input.resource_group_identifier] : undefined,
          }),
          responseExtractor: pageExtract,
          description: "List role assignments with filters",
        },
        create: {
          method: "POST",
          path: "/authz/api/roleassignments",
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          bodyBuilder: (input) => input.body,
          responseExtractor: ngExtract,
          description: "Create a role assignment",
          bodySchema: {
            description: "Role assignment binding",
            fields: [
              { name: "resourceGroupIdentifier", type: "string", required: true, description: "Resource group identifier" },
              { name: "roleIdentifier", type: "string", required: true, description: "Role identifier" },
              { name: "principal", type: "object", required: true, description: "Principal (user/group/service account)", fields: [
                { name: "identifier", type: "string", required: true, description: "Principal identifier" },
                { name: "type", type: "string", required: true, description: "Principal type: USER, USER_GROUP, or SERVICE_ACCOUNT" },
              ]},
              { name: "disabled", type: "boolean", required: false, description: "Whether the assignment is disabled" },
            ],
          },
        },
        delete: {
          method: "DELETE",
          path: "/authz/api/roleassignments/{roleAssignmentIdentifier}",
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          pathParams: { role_assignment_id: "roleAssignmentIdentifier" },
          responseExtractor: ngExtract,
          description: "Delete a role assignment",
        },
      },
    },
    {
      resourceType: "resource_group",
      displayName: "Resource Group",
      description: "Resource group defining a set of resources for RBAC. Supports list, get, create, and delete.",
      toolset: "access_control",
      scope: "project",
      identifierFields: ["resource_group_id"],
      listFilterFields: [
        { name: "search_term", description: "Filter resource groups by name or keyword" },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/settings/access-control/resource-groups/{resourceGroupIdentifier}",
      operations: {
        list: {
          method: "GET",
          path: "/authz/api/v2/resourcegroup",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            search_term: "searchTerm",
            page: "pageIndex",
            size: "pageSize",
          },
          responseExtractor: pageExtract,
          description: "List resource groups",
        },
        get: {
          method: "GET",
          path: "/authz/api/v2/resourcegroup/{resourceGroupIdentifier}",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { resource_group_id: "resourceGroupIdentifier" },
          responseExtractor: ngExtract,
          description: "Get resource group details",
        },
        create: {
          method: "POST",
          path: "/authz/api/v2/resourcegroup",
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          /** POST body must be `{ resourceGroup: { ... } }` per Harness authz API. */
          bodyBuilder: (input) => {
            const b = input.body;
            if (b === undefined || b === null) return b;
            if (typeof b !== "object" || Array.isArray(b)) return b;
            const rec = b as Record<string, unknown>;
            if (
              "resourceGroup" in rec &&
              typeof rec.resourceGroup === "object" &&
              rec.resourceGroup !== null &&
              !Array.isArray(rec.resourceGroup)
            ) {
              return { resourceGroup: rec.resourceGroup };
            }
            return { resourceGroup: rec };
          },
          bodyWrapperKey: "resourceGroup",
          injectAccountInBody: true,
          responseExtractor: ngExtract,
          description: "Create a resource group",
          bodySchema: {
            description: "Resource group definition",
            fields: [
              { name: "identifier", type: "string", required: true, description: "Unique identifier" },
              { name: "name", type: "string", required: true, description: "Display name" },
              { name: "description", type: "string", required: false, description: "Description" },
              { name: "includedScopes", type: "array", required: false, description: "Scopes to include", itemType: "scope object" },
              { name: "resourceFilter", type: "array", required: false, description: "Resource filters", itemType: "filter object" },
            ],
          },
        },
        delete: {
          method: "DELETE",
          path: "/authz/api/v2/resourcegroup/{resourceGroupIdentifier}",
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          pathParams: { resource_group_id: "resourceGroupIdentifier" },
          responseExtractor: ngExtract,
          description: "Delete a resource group",
        },
      },
    },
    {
      resourceType: "permission",
      displayName: "Permission",
      description: "Platform permission. List-only.",
      toolset: "access_control",
      scope: "account",
      identifierFields: [],
      operations: {
        list: {
          method: "GET",
          path: "/authz/api/permissions",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          responseExtractor: ngExtract,
          description: "List all available permissions",
        },
      },
    },
  ],
};
