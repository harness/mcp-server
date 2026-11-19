import { encodePathSegment } from "../../utils/path.js";
import type { BodySchema, PathBuilderConfig, PreflightContext, ResourceScope, ToolsetDefinition } from "../types.js";
import { passthrough, v1ListExtract } from "../extractors.js";

/** API gateway prefix for the connector-control-plane service. */
const CCP = "/connector-control-plane";

/**
 * Resolve the scope path segment for connector-control-plane routes.
 *
 * Mirrors the connector/secret contract: project scope by default (org/project
 * from input, falling back to HARNESS_ORG/HARNESS_PROJECT); org or account only
 * when resource_scope asks for it. The account travels as the Harness-Account
 * header, so the account-level path carries no account segment.
 */
export function integrationScopeBase(
  input: Record<string, unknown>,
  config: PathBuilderConfig,
): string {
  const scope = (input.resource_scope as ResourceScope | undefined) ?? "project";
  if (scope === "account") return `${CCP}/v1`;

  const org = (input.org_id as string | undefined) || config.HARNESS_ORG;
  if (!org) {
    throw new Error(
      `${scope} scope requires org_id (or HARNESS_ORG). Pass resource_scope="account" for account-level integrations.`,
    );
  }
  const orgBase = `${CCP}/v1/orgs/${encodePathSegment(org)}`;
  if (scope === "org") return orgBase;

  const project = (input.project_id as string | undefined) || config.HARNESS_PROJECT;
  if (!project) {
    throw new Error(
      'project scope requires project_id (or HARNESS_PROJECT). Pass resource_scope="org" or "account" for org- or account-level integrations.',
    );
  }
  return `${orgBase}/projects/${encodePathSegment(project)}`;
}

function requireField(input: Record<string, unknown>, field: string, resourceType: string): string {
  const value = input[field];
  if (typeof value !== "string" || value === "") {
    throw new Error(`Missing required field "${field}" for ${resourceType}. Pass it via params or as resource_id.`);
  }
  return value;
}

export function integrationCollectionPath(input: Record<string, unknown>, config: PathBuilderConfig): string {
  return `${integrationScopeBase(input, config)}/integrations`;
}

export function integrationPath(input: Record<string, unknown>, config: PathBuilderConfig): string {
  const id = requireField(input, "integration_id", "integration");
  return `${integrationCollectionPath(input, config)}/${encodePathSegment(id)}`;
}

export function jobCollectionPath(input: Record<string, unknown>, config: PathBuilderConfig): string {
  const id = requireField(input, "integration_id", "integration_job");
  return `${integrationCollectionPath(input, config)}/${encodePathSegment(id)}/jobs`;
}

export function jobPath(input: Record<string, unknown>, config: PathBuilderConfig): string {
  const jobId = requireField(input, "job_id", "integration_job");
  return `${jobCollectionPath(input, config)}/${encodePathSegment(jobId)}`;
}

type Item = Record<string, unknown>;
const isRecord = (v: unknown): v is Item => typeof v === "object" && v !== null && !Array.isArray(v);
const usesOf = (v: unknown): unknown => (isRecord(v) ? v.uses : undefined);
const stateOf = (v: unknown): unknown => (isRecord(v) ? v.state : undefined);

function dropUndefined(obj: Item): Item {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

/** List item: identity, which connector/auth it uses, runner, health. Drops `with` config blobs. */
export function compactIntegration(raw: Item): Item {
  return dropUndefined({
    identifier: raw.identifier,
    name: raw.name,
    description: raw.description,
    connector: usesOf(raw.connector),
    auth: usesOf(raw.auth),
    runner: isRecord(raw.runner) ? raw.runner.type : undefined,
    health: stateOf(raw.health),
    version: raw.version,
    updated: raw.updated,
  });
}

/** List item: identity, action, trigger, state. Drops action config, checkpoints, webhook, backfill. */
export function compactJob(raw: Item): Item {
  return dropUndefined({
    identifier: raw.identifier,
    name: raw.name,
    enabled: raw.enabled,
    default: raw.default,
    action: usesOf(raw.action),
    trigger: raw.trigger,
    streams: raw.streams,
    health: stateOf(raw.health),
    lastRun: stateOf(raw.lastRun),
    nextRunAt: raw.nextRunAt,
  });
}

export function definitionPath(input: Record<string, unknown>): string {
  const id = requireField(input, "definition_id", "integration_definition");
  return `${CCP}/v1/definitions/${encodePathSegment(id)}`;
}

/** List item: what the definition is and, for connectors, which auth/action ids it offers. */
export function compactDefinition(raw: Item): Item {
  return dropUndefined({
    id: raw.id,
    name: raw.name,
    category: raw.category,
    vendor: raw.vendor,
    version: raw.version,
    description: raw.description,
    auth: raw.auth,
    actions: raw.actions,
  });
}

/** Pass the agent's body through as-is; reject a missing or non-object body before any request. */
export function integrationBody(input: Record<string, unknown>): Record<string, unknown> {
  const body = input.body;
  if (!isRecord(body)) {
    throw new Error('integration needs a JSON object body. Use harness_describe(resource_type="integration") for the fields.');
  }
  return body;
}

const compositionFields = (kind: "connector" | "auth") => [
  { name: "uses", type: "string" as const, required: true, description: `${kind} definition id (integration_definition, category=${kind}).` },
  { name: "with", type: "object" as const, required: false, description: `Values for the ${kind} definition's template inputs. Secrets are Harness secret refs (id, org.id, account.id), never raw values.` },
];

const integrationCreateBody: BodySchema = {
  description: "Integration to create. Fill connector.with and auth.with from the definitions' templates (harness_get integration_definition).",
  fields: [
    { name: "identifier", type: "string", required: true, description: "Unique within the scope. Letter or underscore first, then letters, digits, _ or $ (max 128). Cannot change later." },
    { name: "name", type: "string", required: true, description: "Display name." },
    { name: "description", type: "string", required: false, description: "Free text." },
    { name: "tags", type: "object", required: false, description: "String key/value map." },
    { name: "connector", type: "object", required: true, description: "Which connector and its settings.", fields: compositionFields("connector") },
    { name: "auth", type: "object", required: true, description: "Which auth method (one of the connector's auth ids) and its settings.", fields: compositionFields("auth") },
    {
      name: "runner", type: "object", required: true, description: "Where the plugin runs. No default.",
      fields: [
        { name: "type", type: "string", required: true, description: "harness_cloud or self_hosted (one the connector offers)." },
        { name: "selectors", type: "array", itemType: "string", required: false, description: "Delegate selectors. Required for self_hosted; not allowed for harness_cloud." },
      ],
    },
  ],
};

/** Fields the integration PUT reads. Everything else in a GET response is server-owned. */
export const INTEGRATION_WRITE_FIELDS = [
  "identifier", "name", "description", "tags", "connector", "auth", "runner", "version",
] as const;

/** Server-owned fields of IntegrationResponse; dropped silently so an agent can send back what it read. */
const INTEGRATION_READ_ONLY_FIELDS = new Set([
  "id", "uniqueId", "parentUniqueId", "accountId", "created", "updated", "createdBy", "updatedBy", "health",
]);

const pickComposition = (v: unknown): unknown => (isRecord(v) ? dropUndefined({ uses: v.uses, with: v.with }) : v);
const pickRunner = (v: unknown): unknown => (isRecord(v) ? dropUndefined({ type: v.type, selectors: v.selectors }) : v);

/**
 * Build a full-replace PUT body from the current integration and a partial patch.
 * Top-level fields in the patch replace the current ones whole (no deep merge);
 * `null` clears a field; `version` comes from the patch when given, else from current.
 */
function assertKnownIntegrationFields(patch: Item): void {
  const unknown = Object.keys(patch).filter(
    (k) => !(INTEGRATION_WRITE_FIELDS as readonly string[]).includes(k) && !INTEGRATION_READ_ONLY_FIELDS.has(k),
  );
  if (unknown.length > 0) {
    throw new Error(
      `Unknown integration field(s): ${unknown.join(", ")}. Updatable fields: ${INTEGRATION_WRITE_FIELDS.join(", ")}.`,
    );
  }
}

export function mergeIntegrationUpdate(current: Item, patch: Item): Item {
  assertKnownIntegrationFields(patch);
  const merged: Item = {};
  for (const field of INTEGRATION_WRITE_FIELDS) {
    const value = patch[field] !== undefined ? patch[field] : current[field];
    if (value === undefined || value === null) continue;
    merged[field] =
      field === "connector" || field === "auth" ? pickComposition(value)
      : field === "runner" ? pickRunner(value)
      : value;
  }
  return merged;
}

/** Read the integration at the same scope, then replace input.body with the merged full record. */
async function mergeIntegrationBeforeUpdate(ctx: PreflightContext): Promise<void> {
  const patch = ctx.input.body;
  if (!isRecord(patch) || Object.keys(patch).length === 0) {
    throw new Error("integration update needs a body with at least one field to change (e.g. {\"name\": \"New name\"}).");
  }
  assertKnownIntegrationFields(patch);
  const current = await ctx.registry.dispatch(ctx.client, "integration", "get", { ...ctx.input, body: undefined }, ctx.signal);
  if (!isRecord(current)) {
    throw new Error("integration update: could not read the current integration to merge the change into.");
  }
  ctx.input.body = mergeIntegrationUpdate(current, patch);
}

const SCOPE_NOTE =
  "Default scope is project — pass org_id and project_id (or rely on HARNESS_ORG/HARNESS_PROJECT). " +
  "Use resource_scope='org' or 'account' only when the user asked for org- or account-level integrations.";

export const integrationsToolset: ToolsetDefinition = {
  name: "integrations",
  displayName: "Integrations",
  description:
    "Connector control plane integrations — configured connections to external vendors (connector + auth + runner) " +
    "and the ingest jobs that pull data from them.",
  optIn: true,
  resources: [
    {
      resourceType: "integration",
      displayName: "Integration",
      description:
        "A configured connection to an external vendor: a connector definition (connector.uses), an auth method " +
        "(auth.uses) and a runner. Ingest jobs live under it (integration_job). " + SCOPE_NOTE,
      toolset: "integrations",
      scope: "project",
      supportedScopes: ["account", "org", "project"],
      headerBasedScoping: true,
      identifierFields: ["integration_id"],
      compactItem: compactIntegration,
      relatedResources: [
        { resourceType: "integration_job", relationship: "child", description: "Ingest jobs of this integration (pass integration_id)." },
      ],
      listFilterFields: [
        { name: "search_term", description: "Match on name or identifier (max 128 chars)." },
        { name: "connector", description: "Comma-separated connector definition ids (e.g. github), max 20." },
        { name: "auth", description: "Comma-separated auth definition ids, max 20." },
        { name: "sort", description: "Sort key and direction: name|identifier|created|updated with ,asc|,desc. Default updated,desc." },
      ],
      operations: {
        list: {
          method: "GET",
          path: "/connector-control-plane/v1/orgs/{org}/projects/{project}/integrations",
          pathBuilder: integrationCollectionPath,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            page: "page",
            size: "limit",
            search_term: "search_term",
            connector: "connector",
            auth: "auth",
            sort: "sort",
          },
          defaultQueryParams: { page: "0", limit: "30" },
          responseExtractor: v1ListExtract(),
          headerPagination: true,
          description:
            "List integrations. Defaults: page=0 (0-based), size=30 (max 100). `total` is the number matching the " +
            "filters across all pages (from X-Total-Elements), not items.length.",
        },
        get: {
          method: "GET",
          path: "/connector-control-plane/v1/orgs/{org}/projects/{project}/integrations/{integration}",
          pathBuilder: integrationPath,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          responseExtractor: passthrough,
          description:
            "Get one integration by integration_id, including connector/auth config (connector.with, auth.with), " +
            "runner, health and version.",
        },
        create: {
          method: "POST",
          path: "/connector-control-plane/v1/orgs/{org}/projects/{project}/integrations",
          pathBuilder: integrationCollectionPath,
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          bodyBuilder: integrationBody,
          bodySchema: integrationCreateBody,
          responseExtractor: passthrough,
          description:
            "Create an integration at the requested scope (project by default). Returns the stored integration. " +
            "409 if the identifier exists in that scope.",
        },
        update: {
          method: "PUT",
          path: "/connector-control-plane/v1/orgs/{org}/projects/{project}/integrations/{integration}",
          pathBuilder: integrationPath,
          operationPolicy: { risk: "medium_write", retryPolicy: "do_not_retry" },
          preflight: mergeIntegrationBeforeUpdate,
          bodyBuilder: integrationBody,
          bodySchema: {
            description:
              "Partial update: send only the fields to change; the rest keep their current values. connector, auth, " +
              "tags and runner are replaced whole, so send the complete object. null clears description or tags.",
            fields: integrationCreateBody.fields
              .filter((f) => f.name !== "identifier")
              .map((f) => ({ ...f, required: false }))
              .concat({ name: "version", type: "number", required: false, description: "Optional. Defaults to the version just read; pass the version you read to fail with 409 if someone changed it since." }),
          },
          responseExtractor: passthrough,
          description:
            "Update an integration by integration_id with a partial body. Reads the current record and writes the " +
            "merged result. 409 means it changed concurrently — get it again and retry.",
        },
        delete: {
          method: "DELETE",
          path: "/connector-control-plane/v1/orgs/{org}/projects/{project}/integrations/{integration}",
          pathBuilder: integrationPath,
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          responseExtractor: passthrough,
          description: "Delete an integration by integration_id. Also deletes all of its jobs. Cannot be undone.",
        },
      },
    },
    {
      resourceType: "integration_job",
      displayName: "Integration Job",
      description:
        "An ingest job of an integration: an action (action.uses), the streams it pulls, and a trigger (schedule or " +
        "webhook). Always addressed by integration_id + job_id. Uses the same scope as its integration. " + SCOPE_NOTE,
      toolset: "integrations",
      scope: "project",
      supportedScopes: ["account", "org", "project"],
      headerBasedScoping: true,
      identifierFields: ["integration_id", "job_id"],
      compactItem: compactJob,
      relatedResources: [
        { resourceType: "integration", relationship: "parent", description: "The integration that owns the job." },
      ],
      operations: {
        list: {
          method: "GET",
          path: "/connector-control-plane/v1/orgs/{org}/projects/{project}/integrations/{integration}/jobs",
          pathBuilder: jobCollectionPath,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          responseExtractor: v1ListExtract(),
          description: "List all jobs of an integration (pass integration_id). Not paged — returns every job.",
        },
        get: {
          method: "GET",
          path: "/connector-control-plane/v1/orgs/{org}/projects/{project}/integrations/{integration}/jobs/{job}",
          pathBuilder: jobPath,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          responseExtractor: passthrough,
          description:
            "Get one job by integration_id + job_id (resource_id fills job_id), including action config, " +
            "checkpoints, last run, next run and health.",
        },
      },
    },
    {
      resourceType: "integration_definition",
      displayName: "Integration Definition",
      description:
        "Global connector library catalog (not account/org/project scoped). Categories: connector, auth, action, " +
        "trigger, stream. A connector's list item names the auth and action ids it supports; get returns the " +
        "full template (input form) and, for ingest actions, the JSON Schema of each stream. Use these ids for " +
        "integration connector.uses / auth.uses and job action.uses / trigger.uses.",
      toolset: "integrations",
      scope: "account",
      headerBasedScoping: true,
      identifierFields: ["definition_id"],
      compactItem: compactDefinition,
      relatedResources: [
        { resourceType: "integration", relationship: "schema", description: "connector.uses and auth.uses are definition ids." },
        { resourceType: "integration_job", relationship: "schema", description: "action.uses and trigger.uses are definition ids." },
      ],
      listFilterFields: [
        {
          name: "category",
          description: "Only definitions of this category.",
          enum: ["connector", "auth", "action", "trigger", "stream"],
        },
      ],
      operations: {
        list: {
          method: "GET",
          path: "/connector-control-plane/v1/definitions",
          pathBuilder: () => `${CCP}/v1/definitions`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: { category: "category" },
          responseExtractor: v1ListExtract(),
          description:
            "List library definitions, optionally by category. Not paged — returns every match. Summaries only; " +
            "get a definition by id for its template and stream schemas.",
        },
        get: {
          method: "GET",
          path: "/connector-control-plane/v1/definitions/{id}",
          pathBuilder: definitionPath,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          responseExtractor: passthrough,
          description:
            "Get one definition by definition_id: category, version, vendor, template (the authored input form, " +
            "including option sources for dynamic fields) and, for ingest actions, streams[].schema.",
        },
      },
    },
  ],
};
