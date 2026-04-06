import type { ToolsetDefinition, BodySchema } from "../types.js";
import { v1ListExtract, v1Unwrap } from "../extractors.js";
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
 * Build org body: v1 API expects `{ org: { identifier, name, ... } }`.
 * Accepts either `{ org: {...} }` (pass-through) or `{ identifier, name, ... }` (auto-wrap).
 */
function buildOrgBody(input: Record<string, unknown>): unknown {
  const body = input.body;
  if (!body || typeof body !== "object") return undefined;
  const rec = body as Record<string, unknown>;

  // Already wrapped — use as-is
  if ("org" in rec && typeof rec.org === "object") {
    return stripNulls(rec);
  }
  // Wrap flat fields
  return stripNulls({ org: rec });
}

/**
 * Build org update body: same as create, but injects identifier from org_id if missing.
 */
function buildOrgUpdateBody(input: Record<string, unknown>): unknown {
  const body = input.body;
  if (!body || typeof body !== "object") return undefined;
  const rec = body as Record<string, unknown>;

  let inner: Record<string, unknown>;
  if ("org" in rec && typeof rec.org === "object" && rec.org !== null) {
    inner = { ...(rec.org as Record<string, unknown>) };
  } else {
    inner = { ...rec };
  }

  // Inject identifier from path param if missing
  if (!inner.identifier && input.org_id) {
    inner.identifier = input.org_id;
  }

  return stripNulls({ org: inner });
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
        { name: "search_term", description: "Filter organizations by name or keyword" },
        { name: "sort", description: "Sort field" },
        { name: "order", description: "Sort order (asc/desc)" },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/settings/organizations/{org}",
      operations: {
        list: {
          method: "GET",
          path: "/ng/api/organizations",
          queryParams: {
            search_term: "search_term",
            page: "page",
            limit: "limit",
            sort: "sort",
            order: "order",
          },
          responseExtractor: v1ListExtract("org"),
          description: "List organizations in the account",
        },
        get: {
          method: "GET",
          path: "/ng/api/organizations/{org}",
          pathParams: { org_id: "org" },
          responseExtractor: v1Unwrap("org"),
          description: "Get organization details",
        },
        create: {
          method: "POST",
          path: "/ng/api/organizations",
          bodyBuilder: buildOrgBody,
          responseExtractor: v1Unwrap("org"),
          description: "Create a new organization",
          bodySchema: orgCreateSchema,
          bodyWrapperKey: "org",
        },
        update: {
          method: "PUT",
          path: "/ng/api/organizations/{org}",
          pathParams: { org_id: "org" },
          bodyBuilder: buildOrgUpdateBody,
          responseExtractor: v1Unwrap("org"),
          description: "Update an existing organization",
          bodySchema: orgUpdateSchema,
          bodyWrapperKey: "org",
        },
        delete: {
          method: "DELETE",
          path: "/ng/api/organizations/{org}",
          pathParams: { org_id: "org" },
          responseExtractor: v1Unwrap("org"),
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
        { name: "search_term", description: "Filter projects by name or keyword" },
        { name: "sort", description: "Sort field" },
        { name: "order", description: "Sort order (asc/desc)" },
        { name: "has_module", description: "Filter by module presence" },
        { name: "module_type", description: "Module type filter" },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{org}/projects/{project}",
      operations: {
        list: {
          method: "GET",
          path: "/ng/api/organizations/{org}/projects",
          pathParams: { org_id: "org" },
          queryParams: {
            search_term: "search_term",
            page: "page",
            limit: "limit",
            sort: "sort",
            order: "order",
            has_module: "has_module",
            module_type: "module_type",
          },
          responseExtractor: v1ListExtract("project"),
          description: "List projects in an organization",
        },
        get: {
          method: "GET",
          path: "/ng/api/organizations/{org}/projects/{project}",
          pathParams: { org_id: "org", project_id: "project" },
          responseExtractor: v1Unwrap("project"),
          description: "Get project details",
        },
        create: {
          method: "POST",
          path: "/ng/api/organizations/{org}/projects",
          pathParams: { org_id: "org" },
          bodyBuilder: buildProjectBody,
          responseExtractor: v1Unwrap("project"),
          description: "Create a new project in an organization",
          bodySchema: projectCreateSchema,
          bodyWrapperKey: "project",
        },
        update: {
          method: "PUT",
          path: "/ng/api/organizations/{org}/projects/{project}",
          pathParams: { org_id: "org", project_id: "project" },
          bodyBuilder: buildProjectUpdateBody,
          responseExtractor: v1Unwrap("project"),
          description: "Update an existing project",
          bodySchema: projectUpdateSchema,
          bodyWrapperKey: "project",
        },
        delete: {
          method: "DELETE",
          path: "/ng/api/organizations/{org}/projects/{project}",
          pathParams: { org_id: "org", project_id: "project" },
          responseExtractor: v1Unwrap("project"),
          description: "Delete a project",
        },
      },
    },
  ],
};
