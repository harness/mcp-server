import type { ToolsetDefinition, BodySchema } from "../types.js";
import { pageExtract, unwrapOrgResponse, unwrapProjectResponse, v1Unwrap } from "../extractors.js";
import { stripNulls } from "../../utils/body-normalizer.js";

// ---------------------------------------------------------------------------
// Body schemas (for harness_describe output)
// ---------------------------------------------------------------------------

const orgCreateSchema: BodySchema = {
  description: "Organization definition",
  fields: [
    { name: "identifier", type: "string", required: true, description: "Unique identifier (lowercase, hyphens, underscores)" },
    { name: "name", type: "string", required: true, description: "Display name" },
    { name: "description", type: "string", required: false, description: "Optional description" },
    { name: "tags", type: "object", required: false, description: "Key-value tag map" },
  ],
};

const orgUpdateSchema: BodySchema = {
  description: "Organization update definition",
  fields: [
    { name: "identifier", type: "string", required: false, description: "Identifier (auto-injected from org_id if missing)" },
    { name: "name", type: "string", required: true, description: "Display name" },
    { name: "description", type: "string", required: false, description: "Updated description" },
    { name: "tags", type: "object", required: false, description: "Key-value tag map" },
  ],
};

const projectCreateSchema: BodySchema = {
  description: "Project definition",
  fields: [
    { name: "identifier", type: "string", required: true, description: "Unique identifier (lowercase, hyphens, underscores)" },
    { name: "name", type: "string", required: true, description: "Display name" },
    { name: "description", type: "string", required: false, description: "Optional description" },
    { name: "color", type: "string", required: false, description: "Project color (hex code)" },
    { name: "modules", type: "array", required: false, description: "Enabled modules (CD, CI, CF, CE, CV, STO, CHAOS, SRM, IACM, CET, CODE, IDP, SSCA, SEI)" },
    { name: "tags", type: "object", required: false, description: "Key-value tag map" },
  ],
};

const projectUpdateSchema: BodySchema = {
  description: "Project update definition",
  fields: [
    { name: "identifier", type: "string", required: false, description: "Identifier (auto-injected from project_id if missing)" },
    { name: "name", type: "string", required: true, description: "Display name" },
    { name: "description", type: "string", required: false, description: "Updated description" },
    { name: "color", type: "string", required: false, description: "Project color (hex code)" },
    { name: "modules", type: "array", required: false, description: "Enabled modules" },
    { name: "tags", type: "object", required: false, description: "Key-value tag map" },
  ],
};

// ---------------------------------------------------------------------------
// Body builders for v1 API wrapper format
// ---------------------------------------------------------------------------

/**
 * Build org body: NG `/ng/api/organizations` expects `{ organization: { identifier, name, ... } }`.
 * Accepts `{ organization: {...} }`, legacy `{ org: {...} }`, or flat `{ identifier, name, ... }`.
 */
function buildOrgBody(input: Record<string, unknown>): unknown {
  const body = input.body;
  if (!body || typeof body !== "object") return undefined;
  const rec = body as Record<string, unknown>;

  if ("organization" in rec && typeof rec.organization === "object" && rec.organization !== null) {
    return stripNulls({ organization: rec.organization });
  }
  if ("org" in rec && typeof rec.org === "object" && rec.org !== null) {
    return stripNulls({ organization: rec.org });
  }
  return stripNulls({ organization: rec });
}

/**
 * Build org update body: same as create, but injects identifier from org_id if missing.
 */
function buildOrgUpdateBody(input: Record<string, unknown>): unknown {
  const body = input.body;
  if (!body || typeof body !== "object") return undefined;
  const rec = body as Record<string, unknown>;

  let inner: Record<string, unknown>;
  if ("organization" in rec && typeof rec.organization === "object" && rec.organization !== null) {
    inner = { ...(rec.organization as Record<string, unknown>) };
  } else if ("org" in rec && typeof rec.org === "object" && rec.org !== null) {
    inner = { ...(rec.org as Record<string, unknown>) };
  } else {
    inner = { ...rec };
  }

  // Inject identifier from path param if missing
  if (!inner.identifier && input.org_id) {
    inner.identifier = input.org_id;
  }

  return stripNulls({ organization: inner });
}

/**
 * Build project body: v1 API expects `{ project: { identifier, name, ... } }`.
 * Accepts either `{ project: {...} }` (pass-through) or `{ identifier, name, ... }` (auto-wrap).
 */
function buildProjectBody(input: Record<string, unknown>): unknown {
  const body = input.body;
  if (!body || typeof body !== "object") return undefined;
  const rec = body as Record<string, unknown>;

  // Already wrapped — use as-is
  if ("project" in rec && typeof rec.project === "object") {
    return stripNulls(rec);
  }
  // Wrap flat fields
  return stripNulls({ project: rec });
}

/**
 * Build project update body: same as create, but injects identifier from project_id if missing.
 */
function buildProjectUpdateBody(input: Record<string, unknown>): unknown {
  const body = input.body;
  if (!body || typeof body !== "object") return undefined;
  const rec = body as Record<string, unknown>;

  let inner: Record<string, unknown>;
  if ("project" in rec && typeof rec.project === "object" && rec.project !== null) {
    inner = { ...(rec.project as Record<string, unknown>) };
  } else {
    inner = { ...rec };
  }

  // Inject identifier from path param if missing
  if (!inner.identifier && input.project_id) {
    inner.identifier = input.project_id;
  }

  return stripNulls({ project: inner });
}

// ---------------------------------------------------------------------------
// Toolset definition
// ---------------------------------------------------------------------------

export const platformToolset: ToolsetDefinition = {
  name: "platform",
  displayName: "Platform",
  description: "Harness platform entities — organizations and projects",
  resources: [
    // ----- Organization -----
    {
      resourceType: "organization",
      displayName: "Organization",
      description: "Harness organization. Top-level grouping under an account. Supports full CRUD via v1 API.",
      toolset: "platform",
      scope: "account",
      identifierFields: ["org_id"],
      listFilterFields: [
        { name: "search_term", description: "Filter organizations by name, ID, or tags (maps to searchTerm)" },
        { name: "identifiers", description: "Comma-separated org identifiers to fetch specific orgs" },
        { name: "sort_orders", description: "Sort criteria (maps to sortOrders), e.g. fieldName=name&orderType=ASC" },
        { name: "page_token", description: "Pagination token from a previous list response" },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/settings/organizations/{org}",
      operations: {
        list: {
          method: "GET",
          // NG: GET /ng/api/organizations?pageIndex=&pageSize=&searchTerm=&sortOrders=&pageToken=&identifiers=
          path: "/ng/api/organizations",
          queryParams: {
            search_term: "searchTerm",
            page: "pageIndex",
            size: "pageSize",
            sort_orders: "sortOrders",
            page_token: "pageToken",
            identifiers: "identifiers",
          },
          responseExtractor: pageExtract,
          description: "List organizations in the account",
        },
        get: {
          method: "GET",
          path: "/ng/api/organizations/{org}",
          pathParams: { org_id: "org" },
          responseExtractor: unwrapOrgResponse,
          description: "Get organization details",
        },
        create: {
          method: "POST",
          path: "/ng/api/organizations",
          bodyBuilder: buildOrgBody,
          responseExtractor: unwrapOrgResponse,
          description: "Create a new organization",
          bodySchema: orgCreateSchema,
          bodyWrapperKey: "organization",
        },
        update: {
          method: "PUT",
          path: "/ng/api/organizations/{org}",
          pathParams: { org_id: "org" },
          bodyBuilder: buildOrgUpdateBody,
          responseExtractor: unwrapOrgResponse,
          description: "Update an existing organization",
          bodySchema: orgUpdateSchema,
          bodyWrapperKey: "organization",
        },
        delete: {
          method: "DELETE",
          path: "/ng/api/organizations/{org}",
          pathParams: { org_id: "org" },
          responseExtractor: unwrapOrgResponse,
          description: "Delete an organization",
        },
      },
    },

    // ----- Project -----
    {
      resourceType: "project",
      displayName: "Project",
      description: "Harness project within an organization. Scopes pipelines, services, environments, etc. Supports full CRUD via v1 API.",
      toolset: "platform",
      scope: "account",
      identifierFields: ["project_id"],
      listFilterFields: [
        { name: "identifiers", description: "Comma-separated project identifiers to filter" },
        { name: "search_term", description: "Search term (maps to searchTerm)" },
        { name: "has_module", description: "Filter by module presence (hasModule)" },
        { name: "module_type", description: "Module type (e.g. CD, CI)" },
        { name: "only_favorites", description: "Only favorited projects", type: "boolean" },
        { name: "sort_orders", description: "Sort descriptor, e.g. fieldName=name&orderType=ASC (maps to sortOrders)" },
        { name: "page_token", description: "Pagination token from a previous response" },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{org}/projects/{project}",
      operations: {
        list: {
          method: "GET",
          // NG: GET /ng/api/projects?accountIdentifier=&orgIdentifier=&… (accountIdentifier injected by client)
          path: "/ng/api/projects",
          queryParams: {
            org_id: "orgIdentifier",
            has_module: "hasModule",
            identifiers: "identifiers",
            module_type: "moduleType",
            search_term: "searchTerm",
            only_favorites: "onlyFavorites",
            page: "pageIndex",
            size: "pageSize",
            sort_orders: "sortOrders",
            page_token: "pageToken",
          },
          responseExtractor: pageExtract,
          description: "List projects (NG /ng/api/projects)",
        },
        get: {
          method: "GET",
          // NG: GET /ng/api/projects/{projectIdentifier}?orgIdentifier=&accountIdentifier= (client injects account)
          path: "/ng/api/projects/{project}",
          pathParams: { project_id: "project" },
          queryParams: { org_id: "orgIdentifier" },
          injectOrgQueryFallback: true,
          responseExtractor: unwrapProjectResponse,
          description: "Get project details",
        },
        create: {
          method: "POST",
          // NG: POST /ng/api/projects?orgIdentifier= — body { project: { orgIdentifier, identifier, name, ... } }
          path: "/ng/api/projects",
          queryParams: { org_id: "orgIdentifier" },
          injectOrgQueryFallback: true,
          bodyBuilder: buildProjectBody,
          responseExtractor: unwrapProjectResponse,
          description: "Create a new project in an organization",
          bodySchema: projectCreateSchema,
          bodyWrapperKey: "project",
        },
        update: {
          method: "PUT",
          path: "/ng/api/projects/{project}",
          pathParams: { project_id: "project" },
          queryParams: { org_id: "orgIdentifier" },
          injectOrgQueryFallback: true,
          bodyBuilder: buildProjectUpdateBody,
          responseExtractor: unwrapProjectResponse,
          description: "Update an existing project",
          bodySchema: projectUpdateSchema,
          bodyWrapperKey: "project",
        },
        delete: {
          method: "DELETE",
          path: "/ng/api/projects/{project}",
          pathParams: { project_id: "project" },
          queryParams: { org_id: "orgIdentifier" },
          injectOrgQueryFallback: true,
          responseExtractor: unwrapProjectResponse,
          description: "Delete a project",
        },
      },
    },
  ],
};
