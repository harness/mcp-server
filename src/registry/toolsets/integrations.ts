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
    { name: "identifier", type: "string", required: true, description: "Unique within the scope, e.g. my_github. Cannot change later; the backend error states the allowed format." },
    { name: "name", type: "string", required: true, description: "Display name." },
    { name: "description", type: "string", required: false, description: "Free text." },
    { name: "tags", type: "object", required: false, description: "String key/value map." },
    { name: "connector", type: "object", required: true, description: "Which connector and its settings.", fields: compositionFields("connector") },
    { name: "auth", type: "object", required: true, description: "Which auth method (one of the connector's auth ids) and its settings.", fields: compositionFields("auth") },
    {
      name: "runner", type: "object", required: true, description: "Where the plugin runs. No default.",
      fields: [
        { name: "type", type: "string", required: true, description: "One of the runner types the connector definition offers (e.g. harness_cloud, self_hosted)." },
        { name: "selectors", type: "array", itemType: "string", required: false, description: "Delegate selectors, for self-hosted runners." },
      ],
    },
  ],
};

/**
 * Server-owned fields of IntegrationResponse. Removed before a PUT; everything else is carried over,
 * so a field the backend adds later survives a partial update instead of being reset. The backend
 * ignores unknown fields, so a read-only field added later is harmless too.
 */
export const INTEGRATION_READ_ONLY_FIELDS = [
  "id", "uniqueId", "parentUniqueId", "accountId", "created", "updated", "createdBy", "updatedBy", "health",
] as const;

/**
 * Build a full-replace PUT body from the current integration and a partial patch.
 * Top-level patch fields replace current ones whole (no deep merge); `null` clears a field;
 * `version` comes from the patch when given, else from current. The backend validates fields.
 */
export function mergeIntegrationUpdate(current: Item, patch: Item): Item {
  const merged: Item = { ...current };
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) merged[k] = v;
  }
  for (const k of INTEGRATION_READ_ONLY_FIELDS) delete merged[k];
  for (const [k, v] of Object.entries(merged)) {
    if (v === null) delete merged[k];
  }
  return merged;
}

/** Read the integration at the same scope, then replace input.body with the merged full record. */
async function mergeIntegrationBeforeUpdate(ctx: PreflightContext): Promise<void> {
  const patch = ctx.input.body;
  if (!isRecord(patch) || Object.keys(patch).length === 0) {
    throw new Error("integration update needs a body with at least one field to change (e.g. {\"name\": \"New name\"}).");
  }
  const current = await ctx.registry.dispatch(ctx.client, "integration", "get", { ...ctx.input, body: undefined }, ctx.signal);
  if (!isRecord(current)) {
    throw new Error("integration update: could not read the current integration to merge the change into.");
  }
  ctx.input.body = mergeIntegrationUpdate(current, patch);
}

/** Job body: must be a JSON object. Fields are validated by the backend, which rejects unknown ones by name. */
export function jobBody(input: Record<string, unknown>): Record<string, unknown> {
  const body = input.body;
  if (!isRecord(body)) {
    throw new Error('integration_job needs a JSON object body. Use harness_describe(resource_type="integration_job") for the fields.');
  }
  return body;
}

const useFields = (kind: "action" | "trigger", example: string) => [
  { name: "uses", type: "string" as const, required: true, description: `${kind} definition id (integration_definition, category=${kind}), e.g. ${example}.` },
  { name: "with", type: "object" as const, required: false, description: `Values for the ${kind} definition's template inputs.` },
];

const jobCreateBody: BodySchema = {
  description:
    "Ingest job to create. Fill action.with and trigger.with from the definitions' templates (harness_get integration_definition). " +
    "The backend rejects fields not listed here (400 naming the field).",
  fields: [
    { name: "identifier", type: "string", required: true, description: "Unique within the integration, e.g. nightly-sync (lowercase, digits, '-'). Cannot change later; the backend error states the allowed format." },
    { name: "name", type: "string", required: false, description: "Display name." },
    { name: "action", type: "object", required: true, description: "The ingest action (one of the connector's actions ids) and its inputs.", fields: useFields("action", "an ingest action of the connector") },
    { name: "trigger", type: "object", required: true, description: "When the job runs (a trigger definition, e.g. schedule or webhook) and its inputs.", fields: useFields("trigger", "schedule or webhook") },
    { name: "streams", type: "array", itemType: "string", required: false, description: "Streams to ingest (names from the action definition's streams). Omit for all streams." },
    { name: "enabled", type: "boolean", required: false, description: "An enabled job starts ingesting on its trigger right away; pass false to create it paused." },
    { name: "syncModes", type: "object", required: false, description: "Per-stream sync mode: {\"<stream>\": \"<mode>\"}, e.g. incremental or full_refresh." },
    { name: "reconcile", type: "boolean", required: false, description: "Reconcile deletions on full refresh." },
    { name: "resources", type: "object", required: false, description: "Runner resource override, e.g. {cpu: \"500m\", memory: \"1Gi\", ephemeralStorage: \"1Gi\"}." },
  ],
};

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
        { name: "search_term", description: "Match on name or identifier." },
        { name: "connector", description: "Comma-separated connector definition ids (e.g. github)." },
        { name: "auth", description: "Comma-separated auth definition ids." },
        { name: "sort", description: "Sort key and direction, e.g. name,asc or updated,desc." },
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
        create: {
          method: "POST",
          path: "/connector-control-plane/v1/orgs/{org}/projects/{project}/integrations/{integration}/jobs",
          pathBuilder: jobCollectionPath,
          operationPolicy: { risk: "medium_write", retryPolicy: "do_not_retry" },
          bodyBuilder: jobBody,
          bodySchema: jobCreateBody,
          responseExtractor: passthrough,
          description:
            "Create a job under integration_id. Enabled by default, so it starts ingesting on its trigger — pass " +
            "enabled:false to create it paused. 409 if the identifier exists. For a webhook trigger the response " +
            "carries webhook.token once; it is never returned again.",
        },
        delete: {
          method: "DELETE",
          path: "/connector-control-plane/v1/orgs/{org}/projects/{project}/integrations/{integration}/jobs/{job}",
          pathBuilder: jobPath,
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          responseExtractor: passthrough,
          description: "Delete a job by integration_id + job_id. Stops its ingestion. Cannot be undone.",
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
          description: "Only definitions of this category, e.g. connector, auth, action, trigger or stream.",
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
