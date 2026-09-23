import type { ToolsetDefinition, ParamsSchema } from "../types.js";
import { passthrough, ngExtract, pageExtract } from "../extractors.js";

function gitopsListBody(
  input: Record<string, unknown>,
  extras?: Record<string, unknown>,
) {
  return {
    pageIndex: typeof input.page === "number" ? input.page : 0,
    pageSize: typeof input.size === "number" ? input.size : 20,
    searchTerm: (input.search_term as string) ?? "",
    ...extras,
  };
}

/**
 * v1 GetAppProjectMappingListByAgent returns `{ appProjMap: { <argoName>: Project } }`.
 * harness_list expects `{ items, total }`. Flatten map keys into row objects.
 */
function appProjMapExtract(raw: unknown): { items: unknown[]; total: number } {
  if (!isRecord(raw)) return { items: [], total: 0 };
  const map = raw.appProjMap;
  if (!isRecord(map)) return { items: [], total: 0 };

  const items: unknown[] = [];
  for (const [argoproject, value] of Object.entries(map)) {
    const proj = isRecord(value) ? value : {};
    items.push({
      argoproject,
      orgIdentifier: proj.orgIdentifier ?? "",
      projectIdentifier: proj.projectIdentifier ?? "",
      autoCreateServiceEnv: proj.autoCreateServiceEnv ?? false,
    });
  }
  return { items, total: items.length };
}

/**
 * AgentProjectService.List returns `{ items, metadata }` without `total`.
 * Guarantee `items` + `total` so skipCompact survives harness_list normalization
 * (normalizeHarnessListPayload clones when total is missing and drops __skipCompact).
 */
function argoProjectListExtract(raw: unknown): { items: unknown[]; total: number; metadata?: unknown } {
  if (Array.isArray(raw)) return { items: raw, total: raw.length };
  if (!isRecord(raw)) return { items: [], total: 0 };
  const items = Array.isArray(raw.items) ? raw.items : [];
  const total = typeof raw.total === "number" ? raw.total : items.length;
  return raw.metadata !== undefined
    ? { items, total, metadata: raw.metadata }
    : { items, total };
}

/**
 * Normalize create/update body into `{ appProjMap }` for AppProjectMappingService.
 * Accepts native `appProjMap` or ergonomic `mappings: [{ argoproject, orgIdentifier, projectIdentifier, autoCreateServiceEnv }]`.
 */
function buildAppProjMapBody(input: Record<string, unknown>): { appProjMap: Record<string, unknown> } {
  const body = isRecord(input.body) ? input.body : {};

  if (isRecord(body.appProjMap) && Object.keys(body.appProjMap).length > 0) {
    const appProjMap: Record<string, unknown> = {};
    for (const [argoproject, value] of Object.entries(body.appProjMap)) {
      const name = argoproject.trim();
      if (!name) {
        throw new Error("appProjMap keys must be non-empty Argo AppProject names.");
      }
      if (!isRecord(value)) {
        throw new Error(`appProjMap['${name}'] must be an object with orgIdentifier and projectIdentifier.`);
      }
      const orgIdentifier = String(value.orgIdentifier ?? "").trim();
      const projectIdentifier = String(value.projectIdentifier ?? "").trim();
      if (!orgIdentifier || !projectIdentifier) {
        throw new Error(
          `appProjMap['${name}'] requires orgIdentifier and projectIdentifier.`,
        );
      }
      appProjMap[name] = {
        orgIdentifier,
        projectIdentifier,
        autoCreateServiceEnv: value.autoCreateServiceEnv ?? false,
      };
    }
    return { appProjMap };
  }

  if (Array.isArray(body.mappings) && body.mappings.length > 0) {
    const appProjMap: Record<string, unknown> = {};
    for (const row of body.mappings) {
      if (!isRecord(row)) {
        throw new Error("Each mappings[] entry must be an object with argoproject, orgIdentifier, projectIdentifier.");
      }
      const argoproject = String(row.argoproject ?? "").trim();
      const orgIdentifier = String(row.orgIdentifier ?? row.org ?? "").trim();
      const projectIdentifier = String(row.projectIdentifier ?? row.project ?? "").trim();
      if (!argoproject || !orgIdentifier || !projectIdentifier) {
        throw new Error(
          "Each mappings[] entry requires argoproject, orgIdentifier (or org), and projectIdentifier (or project).",
        );
      }
      if (appProjMap[argoproject]) {
        throw new Error(`Duplicate argoproject in mappings: ${argoproject}`);
      }
      appProjMap[argoproject] = {
        orgIdentifier,
        projectIdentifier,
        autoCreateServiceEnv: row.autoCreateServiceEnv ?? false,
      };
    }
    return { appProjMap };
  }

  throw new Error(
    "body must include non-empty appProjMap OR mappings[]. " +
      "Native: { appProjMap: { '<argo>': { orgIdentifier, projectIdentifier, autoCreateServiceEnv? } } }. " +
      "Ergonomic: { mappings: [{ argoproject, orgIdentifier, projectIdentifier, autoCreateServiceEnv? }] }.",
  );
}

/**
 * Strict boolean for update — create may default missing autoCreateServiceEnv to false;
 * update must not (would silently disable autocreate).
 */
function requireAutoCreateServiceEnv(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(
      `${label} requires autoCreateServiceEnv as boolean true|false (not omitted). ` +
        "Update must not silently default to false. " +
        "Org/project in the body are lookup keys matching the existing mapping — v1 Update cannot retarget.",
    );
  }
  return value;
}

/**
 * Validates autoCreateServiceEnv and lookup keys on a raw Update input,
 * before any transform. Used by the `update` op's preflight hook (so the
 * registry's generic required-field check, which can't see into the
 * dynamically-keyed appProjMap body, never runs) and by
 * buildAppProjMapUpdateBody itself for direct/test callers.
 */
function validateAppProjMapUpdateBody(input: Record<string, unknown>): void {
  const body = isRecord(input.body) ? input.body : {};
  const hasMap = isRecord(body.appProjMap) && Object.keys(body.appProjMap).length > 0;
  const hasMappings = Array.isArray(body.mappings) && body.mappings.length > 0;

  if (!hasMap && !hasMappings) {
    const argoproject = String(input.argoproject ?? input.resource_id ?? "").trim();
    const orgIdentifier = String(body.orgIdentifier ?? body.org ?? "").trim();
    const projectIdentifier = String(body.projectIdentifier ?? body.project ?? "").trim();
    if (!argoproject || !orgIdentifier || !projectIdentifier) {
      throw new Error(
        "Update requires appProjMap/mappings[], OR resource_id (Argo AppProject name) plus " +
          "body.orgIdentifier and body.projectIdentifier (must match the existing mapping). " +
          "Also set body.autoCreateServiceEnv to true or false. " +
          "resource_scope/org_id/project_id are for the agent registration scope only.",
      );
    }
    requireAutoCreateServiceEnv(body.autoCreateServiceEnv, "body");
    return;
  }

  if (hasMap) {
    for (const [name, value] of Object.entries(body.appProjMap as Record<string, unknown>)) {
      if (!isRecord(value)) {
        throw new Error(`Update appProjMap['${name}'] must be an object.`);
      }
      requireAutoCreateServiceEnv(value.autoCreateServiceEnv, `appProjMap['${name}']`);
    }
  }
  if (hasMappings) {
    for (const [i, row] of (body.mappings as unknown[]).entries()) {
      if (!isRecord(row)) {
        throw new Error(`Update mappings[${i}] must be an object.`);
      }
      requireAutoCreateServiceEnv(row.autoCreateServiceEnv, `mappings[${i}]`);
    }
  }
}

/**
 * Body for AppProjectMappingService.Update (PUT …/appprojectsmapping).
 *
 * Server semantics (handler/server/appprojectmapping.go Update):
 * - Looks up each row by agent + Argo name + body orgIdentifier/projectIdentifier.
 * - Wrong org/project → "mapping not found" (not a retarget).
 * - Persists autoCreateServiceEnv on the existing Mongo identifier.
 * - Agent scope query params must match how the agent was registered (account./org./project),
 *   not the mapped Harness project (those belong in the body only).
 *
 * Shapes: flat single-row (resource_id/argoproject + body fields), or appProjMap / mappings[].
 */
function buildAppProjMapUpdateBody(input: Record<string, unknown>): { appProjMap: Record<string, unknown> } {
  validateAppProjMapUpdateBody(input);
  const body = isRecord(input.body) ? input.body : {};
  const hasMap = isRecord(body.appProjMap) && Object.keys(body.appProjMap).length > 0;
  const hasMappings = Array.isArray(body.mappings) && body.mappings.length > 0;

  if (!hasMap && !hasMappings) {
    const argoproject = String(input.argoproject ?? input.resource_id ?? "").trim();
    const orgIdentifier = String(body.orgIdentifier ?? body.org ?? "").trim();
    const projectIdentifier = String(body.projectIdentifier ?? body.project ?? "").trim();
    return {
      appProjMap: {
        [argoproject]: {
          orgIdentifier,
          projectIdentifier,
          autoCreateServiceEnv: body.autoCreateServiceEnv as boolean,
        },
      },
    };
  }

  // After strict autocreate checks, reuse create fold for org/project/map validation.
  return buildAppProjMapBody(input);
}

/**
 * Body for ReconcilerService.ImportData.
 * Gateway `body: "filter"` decodes the HTTP JSON into ReconcilerFilter, so the
 * request body is `{ projectNames: string[] }` (not wrapped in a `filter` key).
 * Names are Argo AppProject names; Harness org/project come from existing mappings.
 */
function buildImportFilterBody(input: Record<string, unknown>): { projectNames: string[] } {
  const body = isRecord(input.body) ? input.body : {};
  const raw = body.projectNames ?? body.project_names;
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error(
      "body.projectNames is required — non-empty array of Argo AppProject names already mapped. " +
        "Example: body={ projectNames: ['team-a', 'team-b'] }. " +
        "Import does not create mappings; run harness_create on gitops_app_project_mapping first. " +
        "Empty/omitted projectNames (import-all) is not allowed in MCP v1 (UI always sends explicit names).",
    );
  }
  const projectNames: string[] = [];
  for (const n of raw) {
    const name = String(n ?? "").trim();
    if (!name) {
      throw new Error("body.projectNames entries must be non-empty Argo AppProject names.");
    }
    projectNames.push(name);
  }
  return { projectNames };
}

/**
 * ListAutoCreateLogsResponse → harness_list shape.
 * Preserves page aggregates (counted from returned logs, not DB-wide).
 */
function autoCreateLogExtract(raw: unknown): Record<string, unknown> {
  if (!isRecord(raw)) {
    return { items: [], total: 0 };
  }
  const logs = Array.isArray(raw.logs) ? raw.logs : [];
  const total = typeof raw.total === "number" ? raw.total : logs.length;
  return {
    items: logs,
    total,
    successServices: raw.successServices ?? 0,
    failedServices: raw.failedServices ?? 0,
    successEnvironments: raw.successEnvironments ?? 0,
    failedEnvironments: raw.failedEnvironments ?? 0,
    successClusterLinks: raw.successClusterLinks ?? 0,
    failedClusterLinks: raw.failedClusterLinks ?? 0,
  };
}

/**
 * Build bulk operation targets from input.
 * Single app: resource_id (agent_id) + params.app_name
 * Multiple apps: body.targets [{agent_id, app_name}, ...]
 */
function buildBulkTargets(
  input: Record<string, unknown>,
  actionName: string,
): Array<{ applicationName: string; agentIdentifier: string }> {
  const body = (input.body ?? {}) as Record<string, unknown>;
  const targets: Array<{ applicationName: string; agentIdentifier: string }> = [];

  if (Array.isArray(body.targets)) {
    for (const t of body.targets as Array<Record<string, unknown>>) {
      if (!t.agent_id || !t.app_name) {
        throw new Error(`Each target must have agent_id and app_name. Got: ${JSON.stringify(t)}`);
      }
      targets.push({
        applicationName: String(t.app_name),
        agentIdentifier: String(t.agent_id),
      });
    }
  } else if (input.agent_id && input.app_name) {
    targets.push({
      applicationName: String(input.app_name),
      agentIdentifier: String(input.agent_id),
    });
  }

  if (targets.length === 0) {
    throw new Error(
      `${actionName} requires at least one target. ` +
      `Single app: resource_id='<agent_id>' + params.app_name='<name>'. ` +
      `Multiple apps: body.targets=[{agent_id:'...', app_name:'...'}, ...].`,
    );
  }

  return targets;
}

/**
 * gRPC-gateway encoding for `apiextensionsv1.JSON` fields.
 *
 * The proto type is `message JSON { optional bytes raw = 1; }`.
 * gRPC-gateway maps `bytes` to base64, so each JSON value must be sent as
 * `{ raw: "<base64 of UTF-8 JSON>" }`.  Pre-encoded values (already have `raw`)
 * are passed through unchanged.
 */
function encodeJsonField(val: unknown): unknown {
  if (val === null || val === undefined) return val;
  if (isRecord(val) && "raw" in val) return val;
  return { raw: Buffer.from(JSON.stringify(val), "utf-8").toString("base64") };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Encode `apiextensionsv1.JSON` fields inside a generator's `list.elements`
 * and `plugin.input.parameters`.  Shared by top-level and nested encoders.
 */
function encodeGeneratorJsonFields(gen: Record<string, unknown>): Record<string, unknown> {
  const result = { ...gen };

  if (isRecord(result.list)) {
    const list = { ...result.list };
    if (Array.isArray(list.elements)) {
      list.elements = list.elements.map(encodeJsonField);
    }
    result.list = list;
  }

  if (isRecord(result.plugin)) {
    const plugin = { ...result.plugin };
    if (isRecord(plugin.input)) {
      const input = { ...plugin.input };
      if (isRecord(input.parameters)) {
        const encoded: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(input.parameters)) {
          encoded[k] = encodeJsonField(v);
        }
        input.parameters = encoded;
      }
      plugin.input = input;
    }
    result.plugin = plugin;
  }

  return result;
}

/**
 * Encode a top-level generator (ApplicationSetGenerator).
 * Handles list/plugin JSON fields, then recurses into matrix/merge nested generators.
 */
function encodeGenerator(gen: Record<string, unknown>): Record<string, unknown> {
  const result = encodeGeneratorJsonFields(gen);

  if (isRecord(result.matrix)) {
    const matrix = { ...result.matrix };
    if (Array.isArray(matrix.generators)) {
      matrix.generators = matrix.generators.filter(isRecord).map(encodeNestedGenerator);
    }
    result.matrix = matrix;
  }

  if (isRecord(result.merge)) {
    const merge = { ...result.merge };
    if (Array.isArray(merge.generators)) {
      merge.generators = merge.generators.filter(isRecord).map(encodeNestedGenerator);
    }
    result.merge = merge;
  }

  return result;
}

/**
 * Encode a nested generator (ApplicationSetNestedGenerator).
 * Same list/plugin encoding as top-level, but at this depth `matrix` and `merge`
 * are `apiextensionsv1.JSON` blobs — the entire sub-object gets base64-encoded.
 */
function encodeNestedGenerator(gen: Record<string, unknown>): Record<string, unknown> {
  const result = encodeGeneratorJsonFields(gen);

  if (isRecord(result.matrix)) {
    result.matrix = encodeJsonField(result.matrix);
  }

  if (isRecord(result.merge)) {
    result.merge = encodeJsonField(result.merge);
  }

  return result;
}

/**
 * Walk an ApplicationSet object and encode all `apiextensionsv1.JSON` fields
 * for gRPC-gateway compatibility. Handles:
 *   - ListGenerator.elements (repeated JSON)
 *   - PluginInput.parameters (map<string, JSON>)
 *   - ApplicationSetNestedGenerator.matrix/merge (JSON blobs in nested generators)
 */
function encodeAppSetJsonFields(
  appset: Record<string, unknown>,
): Record<string, unknown> {
  if (!isRecord(appset.spec)) return appset;
  const spec = appset.spec;
  if (!Array.isArray(spec.generators)) return appset;

  const encodedGenerators = spec.generators.filter(isRecord).map(encodeGenerator);

  return {
    ...appset,
    spec: { ...spec, generators: encodedGenerators },
  };
}

export const gitopsToolset: ToolsetDefinition = {
  name: "gitops",
  displayName: "GitOps",
  description:
    "Harness GitOps — agents, applications, clusters, and repositories",
  resources: [
    {
      resourceType: "gitops_agent",
      displayName: "GitOps Agent",
      description:
        "GitOps agent (Argo CD instance). Agents can be scoped at account, org, or project level.\n" +
        "SCOPE BEHAVIOR:\n" +
        "- Account-level: Do NOT pass org_id or project_id\n" +
        "- Org-level: Pass org_id only (no project_id)\n" +
        "- Project-level: Pass both org_id AND project_id\n" +
        "IDENTIFIERS: agent_id is the raw identifier (e.g. 'myagent', NOT 'account.myagent').",
      toolset: "gitops",
      scope: "project",
      scopeOptional: true,
      supportedScopes: ["account", "org", "project"],
      identifierFields: ["agent_id"],
      listFilterFields: [
        { name: "search_term", description: "Filter GitOps agents by name or keyword" },
        { name: "type", description: "Agent type filter", enum: ["MANAGED_ARGO_PROVIDER", "HOSTED_ARGO_PROVIDER"] },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/gitops/agents/{agentIdentifier}",
      operations: {
        list: {
          method: "GET",
          path: "/gitops/api/v1/agents",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            search_term: "searchTerm",
            type: "type",
            page: "pageIndex",
            size: "pageSize",
          },
          responseExtractor: passthrough,
          description: "List GitOps agents",
        },
        get: {
          method: "GET",
          path: "/gitops/api/v1/agents/{agentIdentifier}",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { agent_id: "agentIdentifier" },
          responseExtractor: passthrough,
          description: "Get GitOps agent details",
        },
        delete: {
          method: "DELETE",
          path: "/gitops/api/v1/agents/{agentIdentifier}",
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          pathParams: { agent_id: "agentIdentifier" },
          responseExtractor: passthrough,
          description:
            "Delete a GitOps agent. The agent identifier in the path is the raw identifier — NOT scope-prefixed.\n\n" +
            "SCOPE DETERMINES WHICH ORG/PROJECT PARAMS ARE INJECTED:\n" +
            "  Account-level agent: resource_scope='account' — omit org_id and project_id\n" +
            "    harness_delete(resource_type='gitops_agent', resource_id='myagent', resource_scope='account')\n" +
            "  Org-level agent:     resource_scope='org'     — org_id is injected, no project_id\n" +
            "    harness_delete(resource_type='gitops_agent', resource_id='myagent', resource_scope='org')\n" +
            "  Project-level agent: resource_scope='project' — both org_id and project_id are injected\n" +
            "    harness_delete(resource_type='gitops_agent', resource_id='myagent')\n\n" +
            "NOTE: The path identifier is always the raw agent ID (e.g. 'myagent'), never scope-prefixed\n" +
            "(unlike other GitOps APIs where agentIdentifier is prefixed with 'account.', 'org.', etc.).\n" +
            "The backend derives the scope from the presence of orgIdentifier and projectIdentifier in the request.",
          paramsSchema: {
            fields: [
              {
                name: "agent_id",
                required: true,
                description:
                  "Raw agent identifier — no scope prefix. E.g. 'myagent', not 'account.myagent'. " +
                  "Passed as resource_id to harness_delete. " +
                  "Use harness_list(resource_type='gitops_agent') to discover the identifier.",
              },
              {
                name: "resource_scope",
                required: false,
                description:
                  "Controls which scope params are injected. " +
                  "'account' — account-level agent (no org/project). " +
                  "'org' — org-level agent (orgIdentifier injected). " +
                  "'project' — project-level agent (orgIdentifier + projectIdentifier injected, default when omitted).",
              },
            ],
          } satisfies ParamsSchema,
        },
      },
    },
    {
      resourceType: "gitops_argo_project",
      displayName: "GitOps Argo AppProject",
      description:
        "Argo CD AppProjects visible to a GitOps agent — includes unmapped projects.\n" +
        "Use for migration discovery before creating Harness app-project mappings.\n" +
        "Do NOT confuse with mapped-only APIs: this hits GET /agents/{agent}/projects (AgentProjectService.List),\n" +
        "which asks the agent for AppProjects from the cluster, not only rows already mapped in Mongo.\n\n" +
        "SCOPE BEHAVIOR (caller Harness scope must match how the agent was registered):\n" +
        "- Account-level agent: resource_scope='account' — omit org_id and project_id\n" +
        "- Org-level agent: resource_scope='org' — pass org_id only\n" +
        "- Project-level agent: resource_scope='project' (default) — pass org_id and project_id\n\n" +
        "IDENTIFIERS: agent_id is scope-prefixed (unlike harness_list/get on gitops_agent itself):\n" +
        "- Account-scoped agent: 'account.myagent'\n" +
        "- Org-scoped agent: 'org.myagent'\n" +
        "- Project-scoped agent: 'myagent' (no prefix)\n\n" +
        "EXAMPLE:\n" +
        "harness_list(resource_type='gitops_argo_project', resource_scope='account', filters={agent_id:'account.myagent'})",
      toolset: "gitops",
      scope: "project",
      scopeOptional: true,
      supportedScopes: ["account", "org", "project"],
      identifierFields: ["agent_id"],
      listFilterFields: [
        {
          name: "agent_id",
          description:
            "Scope-prefixed GitOps agent identifier (required). " +
            "E.g. 'account.myagent', 'org.myagent', or 'myagent' for project-level.",
          required: true,
        },
      ],
      operations: {
        list: {
          method: "GET",
          path: "/gitops/api/v1/agents/{agentIdentifier}/projects",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: {
            agent_id: "agentIdentifier",
          },
          skipCompact: true,
          responseExtractor: argoProjectListExtract,
          emptyOnErrorPatterns: [/agent is not registered/, /never connected/, /Not Implemented/],
          description:
            "List Argo CD AppProjects for an agent (mapped and unmapped). " +
            "Requires filters.agent_id (scope-prefixed). Response items use metadata.name as the Argo AppProject name.",
        },
      },
    },
    {
      resourceType: "gitops_app_project_mapping",
      displayName: "GitOps App Project Mapping",
      description:
        "Argo CD AppProject → Harness org/project mapping for a GitOps agent.\n" +
        "Supports list, create, and update (v1 appProjMap). Update toggles autoCreateServiceEnv only — " +
        "body org/project are lookup keys (must match the existing row); v1 cannot retarget (delete+create for that).\n" +
        "Discover with gitops_argo_project, create mappings, update autocreate as needed, then import.\n\n" +
        "SCOPE BEHAVIOR (resource_scope / org_id / project_id = agent registration scope, NOT the mapped Harness project):\n" +
        "- Account-level agent: resource_scope='account' — omit org_id and project_id\n" +
        "- Org-level agent: resource_scope='org' — pass org_id only (agent's org)\n" +
        "- Project-level agent: resource_scope='project' (default) — pass org_id and project_id (agent's project)\n" +
        "Mapped Harness org/project go in the body only.\n\n" +
        "IDENTIFIERS:\n" +
        "- agent_id is scope-prefixed: 'account.myagent' | 'org.myagent' | 'myagent'\n" +
        "- For update/delete: resource_id is the Argo AppProject name (argoproject); pass agent_id in params\n\n" +
        "EXAMPLES:\n" +
        "harness_list(resource_type='gitops_app_project_mapping', resource_scope='account', filters={agent_id:'account.myagent'})\n" +
        "harness_create(resource_type='gitops_app_project_mapping', resource_scope='account',\n" +
        "  params={agent_id:'account.myagent'},\n" +
        "  body={appProjMap:{'team-a':{orgIdentifier:'default', projectIdentifier:'team-a-proj', autoCreateServiceEnv:true}}})\n" +
        "harness_update(resource_type='gitops_app_project_mapping', resource_id='team-a', resource_scope='account',\n" +
        "  params={agent_id:'account.myagent'},\n" +
        "  body={orgIdentifier:'default', projectIdentifier:'team-a-proj', autoCreateServiceEnv:true})",
      toolset: "gitops",
      scope: "project",
      scopeOptional: true,
      supportedScopes: ["account", "org", "project"],
      identifierFields: ["agent_id", "argoproject"],
      listFilterFields: [
        {
          name: "agent_id",
          description:
            "Scope-prefixed GitOps agent identifier (required). " +
            "E.g. 'account.myagent', 'org.myagent', or 'myagent' for project-level.",
          required: true,
        },
      ],
      operations: {
        list: {
          method: "GET",
          path: "/gitops/api/v1/agents/{agentIdentifier}/appprojectsmapping",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: {
            agent_id: "agentIdentifier",
          },
          skipCompact: true,
          responseExtractor: appProjMapExtract,
          description:
            "List Argo↔Harness project mappings for an agent. " +
            "Requires filters.agent_id (scope-prefixed). " +
            "Each item: argoproject, orgIdentifier, projectIdentifier, autoCreateServiceEnv.",
        },
        create: {
          method: "POST",
          path: "/gitops/api/v1/agents/{agentIdentifier}/appprojectsmapping",
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          pathParams: {
            agent_id: "agentIdentifier",
          },
          bodyBuilder: (input) => buildAppProjMapBody(input),
          responseExtractor: passthrough,
          description:
            "Create one or more Argo↔Harness project mappings (bulk, one HTTP call).\n" +
            "REQUIRED: params.agent_id (scope-prefixed). No resource_id for create.\n" +
            "Body: appProjMap (native) OR mappings[] (ergonomic). Harness org/project must already exist.\n" +
            "All entries succeed or fail atomically. Hosted agents are rejected by the server.",
          bodySchema: {
            description:
              "Provide exactly one of appProjMap or mappings[]. Empty body is rejected.",
            fields: [
              {
                name: "appProjMap",
                type: "object",
                required: false,
                description:
                  "Map of Argo AppProject name → { orgIdentifier, projectIdentifier, autoCreateServiceEnv? }. " +
                  "Example: { 'team-a': { orgIdentifier: 'default', projectIdentifier: 'team-a-proj', autoCreateServiceEnv: true } }",
              },
              {
                name: "mappings",
                type: "array",
                required: false,
                description:
                  "Alternative to appProjMap: [{ argoproject, orgIdentifier|org, projectIdentifier|project, autoCreateServiceEnv? }, ...]",
              },
            ],
          },
          paramsSchema: {
            fields: [
              {
                name: "agent_id",
                required: true,
                description:
                  "Scope-prefixed GitOps agent identifier. E.g. 'account.myagent', 'org.myagent', or 'myagent' for project-level.",
              },
            ],
          } satisfies ParamsSchema,
        },
        update: {
          method: "PUT",
          path: "/gitops/api/v1/agents/{agentIdentifier}/appprojectsmapping",
          operationPolicy: { risk: "low_write", retryPolicy: "safe" },
          pathParams: {
            agent_id: "agentIdentifier",
          },
          bodyBuilder: (input) => buildAppProjMapUpdateBody(input),
          preflight: async ({ input }) => validateAppProjMapUpdateBody(input),
          responseExtractor: passthrough,
          description:
            "Update mapping(s) — primarily toggle autoCreateServiceEnv (UI parity).\n" +
            "REQUIRED: resource_id = Argo AppProject name; params.agent_id (scope-prefixed).\n" +
            "Body orgIdentifier/projectIdentifier must match the existing mapping (server lookup keys).\n" +
            "v1 Update cannot retarget Harness org/project — use delete + create for remapping.\n" +
            "resource_scope/org_id/project_id = agent registration scope only (same as list/create).\n" +
            "Example: harness_update(resource_type='gitops_app_project_mapping', resource_id='team-a', " +
            "resource_scope='account', params={agent_id:'account.myagent'}, " +
            "body={orgIdentifier:'default', projectIdentifier:'team-a-proj', autoCreateServiceEnv:true})",
          bodySchema: {
            description:
              "Single-row: orgIdentifier, projectIdentifier, autoCreateServiceEnv (required boolean). " +
              "Bulk: appProjMap or mappings[] with autoCreateServiceEnv required on every entry. " +
              "Org/project must match existing rows. autoCreateServiceEnv is enforced by preflight " +
              "(not the field-level `required` flag below — this body is folded into a dynamically " +
              "keyed map before the generic required-field check runs).",
            fields: [
              {
                name: "orgIdentifier",
                type: "string",
                required: false,
                description:
                  "Existing mapping's Harness org (lookup key). Required for flat single-row body. Alias: org.",
              },
              {
                name: "projectIdentifier",
                type: "string",
                required: false,
                description:
                  "Existing mapping's Harness project (lookup key). Required for flat single-row body. Alias: project.",
              },
              {
                name: "autoCreateServiceEnv",
                type: "boolean",
                required: false,
                description:
                  "Required boolean, enforced by preflight (see bodySchema.description). " +
                  "Omitting is rejected — update must not default to false.",
              },
              {
                name: "appProjMap",
                type: "object",
                required: false,
                description:
                  "Bulk native map. Each value needs orgIdentifier, projectIdentifier, autoCreateServiceEnv (boolean).",
              },
              {
                name: "mappings",
                type: "array",
                required: false,
                description:
                  "Bulk ergonomic array. Each row needs argoproject, org/project, autoCreateServiceEnv (boolean).",
              },
            ],
          },
          paramsSchema: {
            fields: [
              {
                name: "agent_id",
                required: true,
                description:
                  "Scope-prefixed GitOps agent identifier. E.g. 'account.myagent', 'org.myagent', or 'myagent' for project-level.",
              },
            ],
          } satisfies ParamsSchema,
        },
        delete: {
          method: "DELETE",
          path: "/gitops/api/v1/agents/{agentIdentifier}/appprojectsmapping/{name}",
          pathBuilder: (input) => {
            const agentId = String(input.agent_id ?? "").trim();
            const argoproject = String(input.argoproject ?? input.resource_id ?? "").trim();
            const orgId = String(input.org_id ?? "").trim();
            const projectId = String(input.project_id ?? "").trim();
            if (!agentId) {
              throw new Error(
                "params.agent_id is required (scope-prefixed: 'account.myagent' | 'org.myagent' | 'myagent').",
              );
            }
            if (!argoproject) {
              throw new Error(
                "resource_id is required — Argo AppProject name (argoproject). " +
                  "Use harness_list(resource_type='gitops_app_project_mapping') to discover it.",
              );
            }
            if (!orgId || !projectId) {
              throw new Error(
                "org_id and project_id are required for delete — pass the mapping's Harness org/project " +
                  "from harness_list (orgIdentifier / projectIdentifier). " +
                  "Required even when resource_scope='account': v1 Delete looks up by agent + Argo name + org + project " +
                  "(not agent registration scope alone). resource_scope still controls agent Load.",
              );
            }
            return (
              `/gitops/api/v1/agents/${encodeURIComponent(agentId)}` +
              `/appprojectsmapping/${encodeURIComponent(argoproject)}`
            );
          },
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          // Always send mapping org/project — resource_scope=account would otherwise omit them.
          queryParams: {
            org_id: "orgIdentifier",
            project_id: "projectIdentifier",
          },
          responseExtractor: passthrough,
          description:
            "Delete an Argo↔Harness project mapping (v1). CASCADE: server also deletes apps, appsets, " +
            "repos, and clusters under that Argo project for this mapping — irreversible.\n\n" +
            "REQUIRED:\n" +
            "  resource_id — Argo AppProject name (list field argoproject)\n" +
            "  params.agent_id — scope-prefixed agent id\n" +
            "  org_id + project_id — mapping's Harness org/project from list (always required)\n" +
            "  resource_scope — agent registration scope (account|org|project)\n\n" +
            "EXAMPLE:\n" +
            "harness_delete(resource_type='gitops_app_project_mapping', resource_id='team-a',\n" +
            "  resource_scope='account', params={agent_id:'account.myagent'},\n" +
            "  org_id='default', project_id='team-a-proj')\n\n" +
            "Hosted agents are rejected by the server.",
          paramsSchema: {
            fields: [
              {
                name: "agent_id",
                required: true,
                description:
                  "Scope-prefixed GitOps agent identifier. E.g. 'account.myagent', 'org.myagent', or 'myagent' for project-level.",
              },
              {
                name: "org_id",
                required: true,
                description:
                  "Mapped Harness orgIdentifier from harness_list (not omitted for account-scoped agents).",
              },
              {
                name: "project_id",
                required: true,
                description:
                  "Mapped Harness projectIdentifier from harness_list (not omitted for account-scoped agents).",
              },
            ],
          } satisfies ParamsSchema,
        },
      },
      executeHint:
        "IMPORT: action='import' — resource_id is the scope-prefixed agent_id (not argoproject). " +
        "Body: { projectNames: ['argo-a', ...] } (required, non-empty). " +
        "Mappings must already exist. " +
        "IMPORTANT: save importRequestId and reconcileAppResponse.autoCreateCounts — " +
        "see gitops_autocreate_log for how to poll them.",
      executeActions: {
        import: {
          method: "POST",
          path: "/gitops/api/v1/agents/{agentIdentifier}/reconcile/import",
          operationPolicy: { risk: "high_write", retryPolicy: "do_not_retry" },
          pathParams: {
            agent_id: "agentIdentifier",
          },
          bodyBuilder: (input) => buildImportFilterBody(input),
          responseExtractor: passthrough,
          actionDescription:
            "Import Argo CD objects into Harness for mapped AppProjects (sync HTTP — can take minutes).",
          description:
            "POST reconcile/import. Prerequisites: mappings exist for each name in body.projectNames.\n" +
            "REQUIRED: resource_id = scope-prefixed agent_id; body.projectNames = non-empty Argo names.\n" +
            "resource_scope = agent registration scope (same as list/create — not mapping org/project).\n" +
            "Response: applicationCount, clusterCount, repositoryCount, …, importRequestId, " +
            "reconcileAppResponse.autoCreateCounts (planned). Hosted agents rejected.\n\n" +
            "AFTER IMPORT — auto-create outcomes: if reconcileAppResponse.autoCreateCounts sums > 0, " +
            "poll harness_list(resource_type='gitops_autocreate_log', filters={agent_id, import_request_id}) " +
            "yourself — see that resource's description for the exact stop condition.\n\n" +
            "Example: harness_execute(resource_type='gitops_app_project_mapping', action='import',\n" +
            "  resource_id='account.myagent', resource_scope='account',\n" +
            "  body={projectNames:['team-a']})",
          bodySchema: {
            description: "ReconcilerFilter JSON (gateway body:\"filter\").",
            fields: [
              {
                name: "projectNames",
                type: "array",
                required: true,
                description: "Argo AppProject names to import (must already be mapped).",
              },
            ],
          },
        },
      },
      relatedResources: [
        {
          resourceType: "gitops_autocreate_log",
          relationship: "import produces importRequestId for",
          description:
            "After import, poll harness_list on gitops_autocreate_log with the returned " +
            "importRequestId to observe auto-create outcomes.",
        },
        {
          resourceType: "gitops_argo_project",
          relationship: "discover unmapped projects before",
          description: "List Argo AppProjects on the agent before creating mappings.",
        },
      ],
    },
    {
      resourceType: "gitops_autocreate_log",
      displayName: "GitOps Auto-Create Log",
      description:
        "Logs for services / environments / cluster-links auto-created during GitOps import " +
        "(when mappings had autoCreateServiceEnv=true). This is a snapshot endpoint, not a completion " +
        "signal — there is no terminal status field.\n\n" +
        "PREREQUISITE: Run harness_execute(resource_type='gitops_app_project_mapping', action='import', …) first. " +
        "Use the response fields importRequestId and reconcileAppResponse.autoCreateCounts.\n\n" +
        "HOW TO POLL FOR COMPLETION:\n" +
        "  1. If autoCreateCounts.serviceCount + environmentCount + clusterLinkCount == 0, skip " +
        "— nothing was scheduled.\n" +
        "  2. Otherwise call this list every ~10s with the same import_request_id, " +
        "passing size=100 so a single page covers most imports.\n" +
        "  3. Stop when the response's total >= that summed count, or after ~2 minutes " +
        "(treat as done-enough).\n" +
        "  4. items[] holds one page. When total exceeds items.length, page through with " +
        "skip=items already read.\n\n" +
        "SCOPE BEHAVIOR (agent registration scope — same as import):\n" +
        "- Account-level agent: resource_scope='account' — omit org_id and project_id\n" +
        "- Org-level agent: resource_scope='org' — pass org_id only\n" +
        "- Project-level agent: resource_scope='project' (default) — pass org_id and project_id\n\n" +
        "IDENTIFIERS: agent_id is scope-prefixed: 'account.myagent' | 'org.myagent' | 'myagent'\n\n" +
        "EXAMPLE:\n" +
        "harness_list(resource_type='gitops_autocreate_log', resource_scope='account', size=100,\n" +
        "  filters={agent_id:'account.myagent', import_request_id:'507f1f77bcf86cd799439011'})",
      toolset: "gitops",
      scope: "project",
      scopeOptional: true,
      supportedScopes: ["account", "org", "project"],
      identifierFields: ["agent_id"],
      listFilterFields: [
        {
          name: "agent_id",
          description:
            "Scope-prefixed GitOps agent identifier (required). Same agent used for import.",
          required: true,
        },
        {
          name: "import_request_id",
          description:
            "Required. importRequestId from the import execute response. " +
            "Server filter mode (1): importRequestId alone — org/project query not used for this mode.",
          required: true,
        },
        {
          name: "since_time",
          description:
            "Optional Unix epoch milliseconds — only logs created after this time (delta polling).",
          required: false,
        },
        {
          name: "skip",
          description:
            "Optional pagination offset (default 0). Pair with harness_list's size, which maps to the " +
            "API limit (default 20, max 100).",
          required: false,
        },
      ],
      relatedResources: [
        {
          resourceType: "gitops_app_project_mapping",
          relationship: "importRequestId produced by",
          description:
            "harness_execute action='import' on gitops_app_project_mapping returns importRequestId.",
        },
      ],
      operations: {
        list: {
          method: "GET",
          path: "/gitops/api/v1/agents/{agentIdentifier}/autocreate-logs",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: {
            agent_id: "agentIdentifier",
          },
          queryParams: {
            import_request_id: "importRequestId",
            since_time: "sinceTime",
            size: "limit",
            skip: "skip",
          },
          skipCompact: true,
          responseExtractor: autoCreateLogExtract,
          description:
            "List auto-create logs for one import run.\n" +
            "REQUIRED filters: agent_id (scope-prefixed), import_request_id (from import response).\n" +
            "Optional: since_time (ms), skip, size (→ API limit; harness_list default 20, max 100).\n" +
            "Returns items[] (one page of logs) plus total and per-page success/failed aggregates " +
            "(successServices, failedServices, … — aggregates are for the returned page, not DB-wide).\n" +
            "Status values: SUCCESS, FAILED, WARNING. resourceType: service | environment | clusterLink.\n" +
            "Logs TTL ~7 days. Poll every ~10s using the same import_request_id with size=100; stop when " +
            "total covers the planned autoCreateCounts sum, or after ~2 min. Page with skip when total " +
            "exceeds items.length.\n\n" +
            "Example: harness_list(resource_type='gitops_autocreate_log', resource_scope='account', size=100,\n" +
            "  filters={agent_id:'account.myagent', import_request_id:'507f1f77bcf86cd799439011'})",
        },
      },
    },
    {
      resourceType: "gitops_application",
      displayName: "GitOps Application",
      description:
        "GitOps application managed by an agent. List returns all apps (no agent required). Get/sync require agent_id.\n" +
        "IDENTIFIERS: agent_id is scope-prefixed:\n" +
        "- Account-scoped agent: 'account.myagent'\n" +
        "- Org-scoped agent: 'org.myagent'\n" +
        "- Project-scoped agent: 'myagent' (no prefix)",
      toolset: "gitops",
      scope: "project",
      diagnosticHint: "Use harness_diagnose with resource_type='gitops_application', agent_id, and resource_id (app name) to analyze sync failures, health issues, and unhealthy K8s resources. Combines app status, resource tree, and recent events.",
      executeHint:
        "SYNC: action='sync' for single app, action='bulk_sync' for multiple. " +
        "REFRESH: action='refresh' (body.refresh='normal' or 'hard'). " +
        "CANCEL: action='cancel_operation' to stop a running sync/rollback. " +
        "RESOURCE ACTIONS (restart, pause, etc.): 1) harness_get resource_type='gitops_app_resource_tree' to discover K8s resources, " +
        "2) harness_list resource_type='gitops_resource_action' to discover available actions, " +
        "3) harness_execute action='run_resource_action'. " +
        "NOTE: resource_id maps to agent_id in harness_execute, but to app_name in harness_get and harness_update.",
      identifierFields: ["agent_id", "app_name"],
      listFilterFields: [
        { name: "search_term", description: "Filter GitOps applications by name or keyword" },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/gitops/applications/{appName}",
      operations: {
        list: {
          method: "POST",
          path: "/gitops/api/v1/applications",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          injectAccountInBody: true,
          bodyBuilder: (input) => gitopsListBody(input, { metadataOnly: true }),
          responseExtractor: passthrough,
          description: "List GitOps applications in the project",
        },
        get: {
          method: "GET",
          path: "/gitops/api/v1/agents/{agentIdentifier}/applications/{appName}",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: {
            agent_id: "agentIdentifier",
            app_name: "appName",
          },
          responseExtractor: passthrough,
          description: "Get GitOps application details (requires agent_id)",
        },
        create: {
          method: "POST",
          path: "/gitops/api/v1/agents/{agentIdentifier}/applications",
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          pathParams: {
            agent_id: "agentIdentifier",
          },
          queryParams: {
            cluster_identifier: "clusterIdentifier",
            repo_identifier: "repoIdentifier",
            repo_identifiers: "repoIdentifiers",
            skip_repo_validation: "skipRepoValidation",
          },
          bodyBuilder: (input) => {
            const body = (input.body ?? {}) as Record<string, unknown>;
            if (!body.application) {
              throw new Error(
                "body.application is required. Provide the full ArgoCD Application object: " +
                "{ metadata: { name, labels?, annotations? }, spec: { source|sources, destination, syncPolicy? } }. " +
                "Use harness_describe(resource_type='gitops_application') for the full schema.",
              );
            }
            return {
              application: body.application,
              upsert: body.upsert ?? false,
              validate: body.validate ?? true,
            };
          },
          responseExtractor: passthrough,
          description:
            "Create a GitOps application. Body must contain the ArgoCD Application object in native format.\n\n" +
            "EXAMPLE (single-source):\n" +
            "harness_create(resource_type='gitops_application',\n" +
            "  params={agent_id:'account.myagent', cluster_identifier:'account.incluster', skip_repo_validation:'true'},\n" +
            "  body={application:{metadata:{name:'my-app'}, spec:{source:{repoURL:'https://github.com/org/repo', path:'manifests', targetRevision:'HEAD'}, destination:{server:'https://kubernetes.default.svc', namespace:'default'}}}})\n\n" +
            "EXAMPLE (multi-source):\n" +
            "Use spec.sources (array) instead of spec.source. Each source object has: { repoURL, path, targetRevision, chart, helm, ref, name }.\n\n" +
            "REQUIRED params:\n" +
            "  agent_id — scope-prefixed agent identifier (e.g. 'account.myagent'). NOTE: harness_create has no resource_id — pass agent_id inside params.\n" +
            "  cluster_identifier — scope-prefixed cluster ID (e.g. 'account.incluster')\n" +
            "  repo_identifier or repo_identifiers — scope-prefixed repo IDs, OR skip_repo_validation=true\n\n" +
            "SCOPE PREFIXES: 'account.' for account-level, 'org.' for org-level, no prefix for project-level.\n\n" +
            "DO NOT set spec.project — Harness auto-maps it.\n\n" +
            "LINKING SERVICE/ENVIRONMENT: Set labels 'harness.io/serviceRef' and 'harness.io/envRef' in metadata.labels. Values are scope-prefixed: 'account.myservice' for account-level, 'org.myservice' for org-level, 'myservice' for project-level.",
          bodySchema: {
            description:
              "Body must contain 'application' with the full ArgoCD Application object. Uses native ArgoCD camelCase field names.",
            fields: [
              {
                name: "application", type: "object", required: true,
                description:
                  "ArgoCD Application object. Structure:\n" +
                  "{ metadata: { name (required), labels?, annotations? },\n" +
                  "  spec: {\n" +
                  "    source: { repoURL, path, targetRevision ('HEAD' default), chart?, helm?, kustomize?, directory?, plugin? },\n" +
                  "    OR sources: [{ repoURL, path, targetRevision, chart, helm, ref, name }, ...] for multi-source,\n" +
                  "    destination: { server OR name, namespace },\n" +
                  "    syncPolicy?: { automated?: { prune, selfHeal }, syncOptions?: string[] }\n" +
                  "  }\n" +
                  "}.\n" +
                  "Do NOT set spec.project (Harness auto-maps it).",
              },
              { name: "upsert", type: "boolean", required: false, description: "If true, update existing app instead of failing on duplicate (default: false)." },
              { name: "validate", type: "boolean", required: false, description: "Validate spec before creating (default: true)." },
            ],
          },
        },
        update: {
          method: "PUT",
          path: "/gitops/api/v1/agents/{agentIdentifier}/applications/{appName}",
          operationPolicy: { risk: "low_write", retryPolicy: "safe" },
          pathParams: {
            agent_id: "agentIdentifier",
            app_name: "appName",
          },
          queryParams: {
            cluster_identifier: "clusterIdentifier",
            repo_identifier: "repoIdentifier",
            repo_identifiers: "repoIdentifiers",
            skip_repo_validation: "skipRepoValidation",
          },
          bodyBuilder: (input) => {
            const body = (input.body ?? {}) as Record<string, unknown>;
            if (!body.application) {
              throw new Error(
                "body.application is required. Provide the full ArgoCD Application object. " +
                "RECOMMENDED: harness_get the current app first, modify fields, then pass the full object.",
              );
            }
            return {
              application: body.application,
              validate: body.validate ?? true,
            };
          },
          responseExtractor: passthrough,
          description:
            "Update a GitOps application. This is a full PUT replace — provide the complete desired state.\n" +
            "RECOMMENDED FLOW: First harness_get the current app, modify the fields you need, then pass the full application object.\n" +
            "IMPORTANT: resource_id must be the app_name (plain name, not scope-prefixed), and agent_id goes in params.\n" +
            "Example: harness_update(resource_type='gitops_application', resource_id='my-app', params={agent_id:'account.myagent', cluster_identifier:'account.incluster', skip_repo_validation:'true'}, body={application:{...}})\n" +
            "SCOPE PREFIXES for agent_id: 'account.' for account-level, 'org.' for org-level, no prefix for project-level.\n" +
            "REPO VALIDATION: Set repo_identifier or skip_repo_validation=true in params.\n" +
            "LINKING SERVICE/ENVIRONMENT: Set labels 'harness.io/serviceRef' and 'harness.io/envRef' in metadata.labels. Values are scope-prefixed.",
          bodySchema: {
            description:
              "Body must contain 'application' with the full ArgoCD Application object. Uses native ArgoCD camelCase field names.\n" +
              "Query params via 'params': app_name (path), cluster_identifier, repo_identifier/repo_identifiers, skip_repo_validation.",
            fields: [
              {
                name: "application", type: "object", required: true,
                description:
                  "Full ArgoCD Application object: { metadata: { name, labels?, annotations? }, spec: { source|sources, destination, syncPolicy? } }.\n" +
                  "Get the current app first with harness_get, modify what you need, pass the whole object back. Do NOT set spec.project (Harness auto-maps it).",
              },
              { name: "validate", type: "boolean", required: false, description: "Validate spec before applying (default: true)." },
            ],
          },
        },
        delete: {
          method: "DELETE",
          path: "/gitops/api/v1/agents/{agentIdentifier}/applications/{appName}",
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          pathParams: {
            agent_id: "agentIdentifier",
            app_name: "appName",
          },
          queryParams: {
            cascade: "request.cascade",
            propagation_policy: "request.propagationPolicy",
            remove_existing_finalizers: "options.removeExistingFinalizers",
            app_namespace: "request.appNamespace",
          },
          bodyBuilder: (input) => {
            const cascade = input.cascade;
            const propagationPolicy = input.propagation_policy;

            if (cascade === undefined || cascade === "") {
              throw new Error(
                "Deletion mode is required — ask the user which mode they want before proceeding:\n\n" +
                "DELETION MODES:\n" +
                "  1. Foreground: cascade='true', propagation_policy='foreground'\n" +
                "     Waits for all K8s child resources to be fully deleted before removing the Application.\n" +
                "  2. Background: cascade='true', propagation_policy='background'\n" +
                "     Removes the Application immediately; Kubernetes cleans up child resources asynchronously.\n" +
                "  3. Non-cascading: cascade='false' (no propagation_policy needed)\n" +
                "     Deletes only the ArgoCD Application record. K8s resources remain running in the cluster.\n\n" +
                "Also ask: remove_existing_finalizers='true' or 'false'\n" +
                "  Set 'true' only if the app is stuck and cannot be deleted due to stuck finalizers. Default: 'false'.",
              );
            }

            if ((cascade === "true" || cascade === true) && !propagationPolicy) {
              throw new Error(
                "propagation_policy is required when cascade=true — ask the user:\n" +
                "  'foreground' — waits for all K8s child resources to be deleted first (recommended)\n" +
                "  'background' — deletes the Application immediately; Kubernetes cleans up resources asynchronously",
              );
            }

            return undefined;
          },
          responseExtractor: passthrough,
          description:
            "Delete a GitOps application. ALWAYS ask the user for the deletion mode and finalizer preference before calling — do not assume defaults.\n\n" +
            "EXAMPLE:\n" +
            "harness_delete(resource_type='gitops_application', resource_id='my-app',\n" +
            "  params={agent_id:'account.myagent', cascade:'true', propagation_policy:'foreground', remove_existing_finalizers:'false'})\n\n" +
            "DELETION MODES (required — ask the user):\n" +
            "  Foreground: cascade='true', propagation_policy='foreground'\n" +
            "    Waits for all K8s child resources to be deleted before removing the Application.\n" +
            "  Background: cascade='true', propagation_policy='background'\n" +
            "    Deletes the Application immediately; K8s cleans up child resources asynchronously.\n" +
            "  Non-cascading: cascade='false'\n" +
            "    Removes only the ArgoCD Application record; K8s resources remain running in the cluster.\n\n" +
            "FINALIZER REMOVAL (ask the user): remove_existing_finalizers='true'/'false'\n" +
            "  Use 'true' only when the app is stuck and cannot be deleted due to stuck finalizers.\n\n" +
            "IDENTIFIERS:\n" +
            "  resource_id — app name, plain (not scope-prefixed), e.g. 'my-app'\n" +
            "  agent_id in params — scope-prefixed: 'account.myagent' | 'org.myagent' | 'myagent'",
          paramsSchema: {
            fields: [
              {
                name: "agent_id",
                required: true,
                description: "Scope-prefixed agent identifier (e.g. 'account.myagent', 'org.myagent', or 'myagent' for project-level).",
              },
              {
                // Not marked required here: the bodyBuilder owns deletion-mode
                // validation and emits the detailed "ask the user" guidance
                // (mode + finalizer choice). A generic required-param error
                // would pre-empt that richer message.
                name: "cascade",
                required: false,
                description: "Whether to cascade deletion to K8s resources. 'true' = cascade (foreground or background), 'false' = non-cascading (leaves K8s resources running). Ask the user before setting.",
              },
              {
                name: "propagation_policy",
                required: false,
                description: "Required when cascade='true'. 'foreground' — waits for all K8s child resources to be deleted first. 'background' — deletes immediately, async cleanup. Omit when cascade='false'.",
              },
              {
                // Optional with a safe default ('false'); do not force callers
                // to supply it just to reach the deletion-mode validation.
                name: "remove_existing_finalizers",
                required: false,
                description: "Whether to strip existing finalizers before deletion. 'true' unblocks stuck apps; 'false' is the safe default. Ask the user before setting.",
              },
              {
                name: "app_namespace",
                required: false,
                description: "Application namespace override. Only needed when the app was deployed to a non-default namespace.",
              },
            ],
          } satisfies ParamsSchema,
        },
      },
      executeActions: {
        sync: {
          method: "POST",
          path: "/gitops/api/v1/agents/{agentIdentifier}/applications/{appName}/sync",
          operationPolicy: { risk: "high_write", retryPolicy: "do_not_retry" },
          pathParams: {
            agent_id: "agentIdentifier",
            app_name: "appName",
          },
          bodyBuilder: (input) => input.body ?? {},
          responseExtractor: passthrough,
          actionDescription: "Sync a GitOps application",
          bodySchema: {
            description: "Sync options",
            fields: [
              { name: "prune", type: "boolean", required: false, description: "Prune resources not in git" },
              { name: "dryRun", type: "boolean", required: false, description: "Simulate sync without executing" },
              { name: "revision", type: "string", required: false, description: "Target revision to sync to" },
            ],
          },
        },
        refresh: {
          method: "POST",
          path: "/gitops/api/v1/applications/bulk/refresh",
          operationPolicy: { risk: "low_write", retryPolicy: "safe" },
          bodyBuilder: (input) => {
            const body = (input.body ?? {}) as Record<string, unknown>;
            return {
              applicationTargets: buildBulkTargets(input, "Refresh"),
              refresh: body.refresh ?? "normal",
            };
          },
          responseExtractor: passthrough,
          actionDescription:
            "Refresh one or more GitOps applications. Normal refresh checks if source changed; hard refresh forces full manifest regeneration.\n\n" +
            "SINGLE APP: harness_execute(resource_type='gitops_application', action='refresh', resource_id='account.myagent', params={app_name:'my-app'}, body={refresh:'hard'})\n\n" +
            "MULTIPLE APPS: harness_execute(resource_type='gitops_application', action='refresh', body={targets:[{agent_id:'account.myagent', app_name:'app1'}, {agent_id:'account.myagent', app_name:'app2'}], refresh:'hard'})\n\n" +
            "NOTE: resource_id maps to agent_id (scope-prefixed). For apps across different agents, use body.targets.",
          bodySchema: {
            description:
              "Refresh body. Single app: use resource_id + params.app_name. Multiple apps: use body.targets.",
            fields: [
              { name: "refresh", type: "string", required: false, description: "Refresh mode: 'normal' (only if source changed) or 'hard' (force full manifest regeneration). Default: 'normal'." },
              { name: "targets", type: "array", required: false, description: "Array of targets for multi-app refresh: [{agent_id: 'account.myagent', app_name: 'my-app'}, ...]. Agent IDs are scope-prefixed." },
            ],
          },
        },
        bulk_sync: {
          method: "POST",
          path: "/gitops/api/v1/applications/bulk/sync",
          operationPolicy: { risk: "high_write", retryPolicy: "do_not_retry" },
          bodyBuilder: (input) => {
            const body = (input.body ?? {}) as Record<string, unknown>;
            const targets = buildBulkTargets(input, "Bulk sync");

            const result: Record<string, unknown> = { applicationTargets: targets };

            if (body.dryRun !== undefined) result.dryRun = body.dryRun;
            if (body.prune !== undefined) result.prune = body.prune;
            if (body.strategy) result.strategy = body.strategy;
            if (body.retryStrategy) result.retryStrategy = body.retryStrategy;

            if (body.syncOptions) {
              const opts = body.syncOptions;
              result.syncOptions = Array.isArray(opts) ? { items: opts } : opts;
            }

            return result;
          },
          responseExtractor: passthrough,
          actionDescription:
            "Sync one or more GitOps applications to their target state. Applies the same sync settings to all targeted apps.\n\n" +
            "SINGLE APP: harness_execute(resource_type='gitops_application', action='bulk_sync', resource_id='account.myagent', params={app_name:'my-app'}, body={prune:true})\n" +
            "For single-app sync you can also use action='sync' which takes agent_id and app_name directly.\n\n" +
            "MULTIPLE APPS: harness_execute(resource_type='gitops_application', action='bulk_sync', body={targets:[{agent_id:'account.myagent', app_name:'app1'}, {agent_id:'account.myagent', app_name:'app2'}], prune:true})\n\n" +
            "NOTE: resource_id maps to agent_id (scope-prefixed). For apps across different agents, use body.targets.",
          bodySchema: {
            description:
              "Bulk sync body. Single app: use resource_id + params.app_name. Multiple apps: use body.targets. Sync settings apply to all targets.",
            fields: [
              { name: "targets", type: "array", required: false, description: "Array of targets: [{agent_id: 'account.myagent', app_name: 'my-app'}, ...]. Agent IDs are scope-prefixed." },
              { name: "dryRun", type: "boolean", required: false, description: "Simulate sync without applying changes (default: false)." },
              { name: "prune", type: "boolean", required: false, description: "Delete resources from cluster that are not in git (default: false)." },
              { name: "strategy", type: "object", required: false, description: "Sync strategy: {apply?: {force: bool}} for kubectl apply, or {hook?: {force: bool}} for hook-based sync (default)." },
              { name: "retryStrategy", type: "object", required: false, description: "Retry on failure: {limit: number, backoff?: {duration: string, factor: number, maxDuration: string}}." },
              { name: "syncOptions", type: "array", required: false, description: "Sync option strings, e.g. ['CreateNamespace=true', 'PruneLast=true', 'ApplyOutOfSyncOnly=true']." },
            ],
          },
        },
        cancel_operation: {
          method: "DELETE",
          path: "/gitops/api/v1/agents/{agentIdentifier}/applications/{appName}/operation",
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          pathParams: {
            agent_id: "agentIdentifier",
            app_name: "appName",
          },
          bodyBuilder: () => undefined,
          responseExtractor: passthrough,
          actionDescription:
            "Cancel the currently running sync or rollback operation on a GitOps application.\n\n" +
            "Example: harness_execute(resource_type='gitops_application', action='cancel_operation', resource_id='account.myagent', params={app_name:'my-app'})\n\n" +
            "NOTE: resource_id is the agent_id, scope-prefixed: 'account.myagent' for account-level, 'org.myagent' for org-level, 'myagent' for project-level.\n" +
            "This only cancels sync/rollback operations — resource actions (restart, pause, etc.) execute instantly and cannot be cancelled.",
          bodySchema: {
            description: "No body required. The app is identified by resource_id (agent_id) and params.app_name.",
            fields: [],
          },
        },
        run_resource_action: {
          method: "POST",
          path: "/gitops/api/v1/agents/{agentIdentifier}/applications/{appName}/resource/actions",
          operationPolicy: { risk: "high_write", retryPolicy: "do_not_retry" },
          pathParams: {
            agent_id: "agentIdentifier",
            app_name: "appName",
          },
          bodyBuilder: (input) => {
            const body = (input.body ?? {}) as Record<string, unknown>;
            const action = body.action;
            const kind = body.kind;
            const resourceName = body.resourceName;
            const namespace = body.namespace;
            if (!action || !kind || !resourceName || !namespace) {
              throw new Error(
                "run_resource_action requires body.namespace, body.resourceName, body.kind, and body.action. " +
                "Use harness_list(resource_type='gitops_resource_action', ...) to discover available actions first.",
              );
            }
            const result: Record<string, unknown> = {
              namespace,
              resourceName,
              kind,
              action,
            };
            if (body.group) result.group = body.group;
            if (body.version) result.version = body.version;
            return result;
          },
          responseExtractor: passthrough,
          actionDescription:
            "Run an action on a specific Kubernetes resource within a GitOps application (e.g. restart a Deployment, pause/resume a Rollout).\n\n" +
            "WORKFLOW:\n" +
            "1. Get the app's resource tree: harness_get(resource_type='gitops_app_resource_tree', resource_id='my-app', params={agent_id:'account.myagent'})\n" +
            "2. Discover available actions: harness_list(resource_type='gitops_resource_action', filters={agent_id:'account.myagent', app_name:'my-app', namespace:'default', kind:'Deployment', resource_name:'my-deploy', group:'apps'})\n" +
            "3. Run the action: harness_execute(resource_type='gitops_application', action='run_resource_action', resource_id='account.myagent', params={app_name:'my-app'}, body={namespace:'default', resourceName:'my-deploy', kind:'Deployment', group:'apps', action:'restart'})\n\n" +
            "SCOPING:\n" +
            "  agent_id — scope-prefixed: 'account.myagent', 'org.myagent', or 'myagent' (project)\n" +
            "  app_name — plain name, NOT scope-prefixed\n" +
            "  body fields (namespace, resourceName, kind, group, action) — plain K8s values, NOT scope-prefixed\n\n" +
            "NOTE: In step 3, resource_id is the agent_id. In step 1, resource_id is the app_name (harness_get maps resource_id to the last identifier field).",
          bodySchema: {
            description:
              "Resource action body. Identifies the K8s resource and the action to perform on it.",
            fields: [
              { name: "namespace", type: "string", required: true, description: "Kubernetes namespace of the target resource." },
              { name: "resourceName", type: "string", required: true, description: "Name of the Kubernetes resource (e.g. 'my-deployment')." },
              { name: "kind", type: "string", required: true, description: "Kubernetes resource kind (e.g. 'Deployment', 'Rollout', 'StatefulSet', 'DaemonSet', 'CronJob')." },
              { name: "group", type: "string", required: false, description: "Kubernetes API group (e.g. 'apps' for Deployments, 'argoproj.io' for Rollouts). Required for most resource kinds." },
              { name: "version", type: "string", required: false, description: "Kubernetes API version (e.g. 'v1', 'v1alpha1'). Usually optional." },
              { name: "action", type: "string", required: true, description: "Action to run (e.g. 'restart', 'pause', 'resume', 'retry', 'abort', 'promote-full'). Use harness_list(resource_type='gitops_resource_action') to discover available actions." },
            ],
          },
        },
      },
    },
    {
      resourceType: "gitops_cluster",
      displayName: "GitOps Cluster",
      description:
        "Kubernetes cluster registered with GitOps. List returns all clusters (no agent required). Get requires agent_id.\n" +
        "SCOPE BEHAVIOR:\n" +
        "- Account-level: Do NOT pass org_id or project_id\n" +
        "- Org-level: Pass org_id only (no project_id)\n" +
        "- Project-level: Pass both org_id AND project_id\n" +
        "IDENTIFIERS: agent_id is scope-prefixed:\n" +
        "- Account-scoped agent: 'account.myagent'\n" +
        "- Org-scoped agent: 'org.myagent'\n" +
        "- Project-scoped agent: 'myagent' (no prefix)\n" +
        "cluster_id is the raw identifier (e.g. 'incluster'), not prefixed.",
      toolset: "gitops",
      scope: "project",
      scopeOptional: true,
      supportedScopes: ["account", "org", "project"],
      identifierFields: ["agent_id", "cluster_id"],
      listFilterFields: [
        { name: "search_term", description: "Filter clusters by name or keyword" },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/gitops/clusters",
      operations: {
        list: {
          method: "POST",
          path: "/gitops/api/v1/clusters",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          injectAccountInBody: true,
          bodyBuilder: (input) => gitopsListBody(input),
          responseExtractor: passthrough,
          description: "List GitOps clusters (scope depends on org_id/project_id presence)",
        },
        get: {
          method: "GET",
          path: "/gitops/api/v1/agents/{agentIdentifier}/clusters/{clusterIdentifier}",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: {
            agent_id: "agentIdentifier",
            cluster_id: "clusterIdentifier",
          },
          responseExtractor: passthrough,
          description: "Get GitOps cluster details (requires agent_id)",
        },
        delete: {
          method: "DELETE",
          path: "/gitops/api/v1/agents/{agentIdentifier}/clusters/{clusterIdentifier}",
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          pathParams: {
            agent_id: "agentIdentifier",
            cluster_id: "clusterIdentifier",
          },
          queryParams: {
            force_delete: "forceDelete",
            query_name: "query.name",
          },
          responseExtractor: passthrough,
          description:
            "Delete a GitOps cluster registration.\n\n" +
            "EXAMPLE:\n" +
            "harness_delete(resource_type='gitops_cluster', resource_id='c11', params={agent_id:'account.myagent'})\n\n" +
            "FORCE DELETE: Deletion fails if GitOps applications are still deployed to this cluster. " +
            "Set force_delete='true' in params to bypass this check and delete anyway.\n\n" +
            "IDENTIFIERS:\n" +
            "  resource_id — the immutable internal cluster identifier (e.g. 'cluster11'). This never changes even when the cluster is renamed in the UI.\n" +
            "  agent_id — scope-prefixed agent identifier (e.g. 'account.myagent').\n" +
            "  query_name — the ArgoCD display name (the name visible in the UI). Harness stores the cluster by resource_id internally, " +
            "but ArgoCD tracks it by display name. If the cluster was renamed after registration, resource_id stays the same while the display name changes. " +
            "In that case, pass the current display name as query_name so ArgoCD can locate the cluster for deletion. " +
            "Use harness_get(resource_type='gitops_cluster') to find the current display name.",
          paramsSchema: {
            fields: [
              {
                name: "agent_id",
                required: true,
                description: "Scope-prefixed agent identifier (e.g. 'account.myagent', 'org.myagent', or 'myagent' for project-level).",
              },
              {
                name: "force_delete",
                required: false,
                description: "Set to 'true' to skip the safety check that blocks deletion when GitOps applications are still deployed to this cluster. Default: false.",
              },
              {
                name: "query_name",
                required: false,
                description: "ArgoCD display name of the cluster. Only required if the cluster was renamed in the UI after registration — the display name changes but resource_id (the path identifier) does not. Omit if the cluster has never been renamed.",
              },
            ],
          } satisfies ParamsSchema,
        },
      },
    },
    {
      resourceType: "gitops_repository",
      displayName: "GitOps Repository",
      description:
        "Git repository registered with GitOps. List returns all repositories (no agent required). Get requires agent_id.\n" +
        "SCOPE BEHAVIOR:\n" +
        "- Account-level: Do NOT pass org_id or project_id\n" +
        "- Org-level: Pass org_id only (no project_id)\n" +
        "- Project-level: Pass both org_id AND project_id\n" +
        "IDENTIFIERS: agent_id is scope-prefixed:\n" +
        "- Account-scoped agent: 'account.myagent'\n" +
        "- Org-scoped agent: 'org.myagent'\n" +
        "- Project-scoped agent: 'myagent' (no prefix)\n" +
        "repo_id is the raw identifier, not prefixed.",
      toolset: "gitops",
      scope: "project",
      scopeOptional: true,
      supportedScopes: ["account", "org", "project"],
      identifierFields: ["agent_id", "repo_id"],
      listFilterFields: [
        { name: "search_term", description: "Filter repositories by name or URL" },
        { name: "repo_creds_id", description: "Filter by repository credentials ID" },
      ],
      operations: {
        list: {
          method: "POST",
          path: "/gitops/api/v1/repositories",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          injectAccountInBody: true,
          bodyBuilder: (input) => gitopsListBody(input, { repoCredsId: input.repo_creds_id ?? "" }),
          responseExtractor: passthrough,
          description: "List GitOps repositories (scope depends on org_id/project_id presence)",
        },
        get: {
          method: "GET",
          path: "/gitops/api/v1/agents/{agentIdentifier}/repositories/{repoIdentifier}",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: {
            agent_id: "agentIdentifier",
            repo_id: "repoIdentifier",
          },
          responseExtractor: passthrough,
          description: "Get GitOps repository details (requires agent_id)",
        },
        delete: {
          method: "DELETE",
          path: "/gitops/api/v1/agents/{agentIdentifier}/repositories/{repoIdentifier}",
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          pathParams: {
            agent_id: "agentIdentifier",
            repo_id: "repoIdentifier",
          },
          queryParams: {
            force_delete: "forceDelete",
          },
          responseExtractor: passthrough,
          description:
            "Delete a GitOps repository.\n\n" +
            "EXAMPLE:\n" +
            "harness_delete(resource_type='gitops_repository', resource_id='rolloutsDemoRepo',\n" +
            "  params={agent_id:'account.myagent'})\n\n" +
            "IDENTIFIERS:\n" +
            "  resource_id — repository identifier (e.g. 'rolloutsDemoRepo'). " +
            "Use harness_list(resource_type='gitops_repository') to discover it.\n" +
            "  agent_id   — scope-prefixed agent identifier: 'account.myagent' | 'org.myagent' | 'myagent'\n\n" +
            "SCOPE: set resource_scope to control which org/project params are injected:\n" +
            "  'account' — account-level (no org/project)\n" +
            "  'org'     — org-level (orgIdentifier injected)\n" +
            "  'project' — project-level (orgIdentifier + projectIdentifier injected, default)\n\n" +
            "FORCE DELETE: set force_delete='true' to bypass the safety check that blocks deletion\n" +
            "when the repository is still referenced by one or more GitOps applications.\n" +
            "Use only when you intend to delete the repo regardless of active app references.",
          paramsSchema: {
            fields: [
              {
                name: "agent_id",
                required: true,
                description: "Scope-prefixed agent identifier. E.g. 'account.myagent', 'org.myagent', or 'myagent' for project-level.",
              },
              {
                name: "force_delete",
                required: false,
                description:
                  "Set to 'true' to force-delete even if the repository is still in use by GitOps applications. " +
                  "Defaults to 'false' (deletion is blocked when active apps reference the repo).",
              },
            ],
          } satisfies ParamsSchema,
        },
      },
    },
    {
      resourceType: "gitops_applicationset",
      displayName: "GitOps ApplicationSet",
      description:
        "GitOps ApplicationSet — a template that auto-generates multiple Applications from generators.\n" +
        "An ApplicationSet has: generators (list/git/clusters/matrix/merge/pullRequest/scmProvider/plugin) that produce parameter sets, " +
        "and a template (ApplicationSpec) that gets rendered once per parameter set to create an Application.\n\n" +
        "IDENTIFIERS:\n" +
        "  agent_id — scope-prefixed agent identifier: 'account.myagent' | 'org.myagent' | 'myagent'\n" +
        "  appset_id — the ApplicationSet UUID (NOT the name). You CANNOT use the appset name for get/update.\n" +
        "    To find the UUID: harness_list(resource_type='gitops_applicationset', params={agent_id:'...'}) → each item has 'identifier' = the UUID.\n" +
        "    Then use: harness_get(resource_type='gitops_applicationset', resource_id='<uuid>', params={agent_id:'...'})",
      toolset: "gitops",
      scope: "project",
      identifierFields: ["agent_id", "appset_id"],
      executeHint:
        "GET/UPDATE/DELETE requires the ApplicationSet UUID, NOT its name. The API uses UUID as the identifier.\n" +
        "REQUIRED WORKFLOW:\n" +
        "  1. harness_list(resource_type='gitops_applicationset', params={agent_id:'account.myagent'}) — find appset by name, note 'identifier' (= UUID)\n" +
        "  2. For GET: harness_get(resource_type='gitops_applicationset', resource_id='<uuid>', params={agent_id:'account.myagent'})\n" +
        "  3. For UPDATE: include metadata.uid=<uuid> and preserve spec.template.spec.project from the list response\n" +
        "  4. For DELETE: harness_delete(resource_type='gitops_applicationset', resource_id='<uuid>', params={agent_id:'account.myagent'})\n" +
        "CREATE does NOT need a UUID — just pass agent_id in params.",
      listFilterFields: [
        { name: "search_term", description: "Filter ApplicationSets by name or keyword" },
        { name: "agent_id", description: "Optional: Filter by GitOps agent identifier" },
      ],
      operations: {
        list: {
          method: "POST",
          path: "/gitops/api/v1/applicationsets",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          injectAccountInBody: true,
          bodyBuilder: (input) => gitopsListBody(input, input.agent_id ? { agentIdentifier: input.agent_id } : {}),
          responseExtractor: passthrough,
          emptyOnErrorPatterns: [/agent is not registered/, /never connected/, /Not Implemented/],
          description: "List GitOps ApplicationSets",
        },
        get: {
          method: "GET",
          path: "/gitops/api/v1/applicationset/{identifier}",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: {
            appset_id: "identifier",
          },
          queryParams: {
            agent_id: "agentIdentifier",
          },
          responseExtractor: passthrough,
          description:
            "Get GitOps ApplicationSet details by UUID.\n" +
            "IMPORTANT: resource_id must be the ApplicationSet UUID (e.g. 'cce8a056-8059-...'), NOT the name.\n" +
            "To find the UUID: harness_list(resource_type='gitops_applicationset', params={agent_id:'account.myagent'}) — the response 'identifier' field is the UUID.\n" +
            "Example: harness_get(resource_type='gitops_applicationset', resource_id='<uuid>', params={agent_id:'account.myagent'})",
        },
        create: {
          method: "POST",
          path: "/gitops/api/v1/applicationset",
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          queryParams: {
            agent_id: "agentIdentifier",
          },
          bodyBuilder: (input) => {
            const body = isRecord(input.body) ? input.body : {};
            if (!isRecord(body.applicationset)) {
              throw new Error(
                "body.applicationset is required. Provide the full ArgoCD ApplicationSet object: " +
                "{ metadata: { name }, spec: { generators: [...], template: { metadata: { name }, spec: { source, destination } } } }. " +
                "Use harness_describe(resource_type='gitops_applicationset') for examples.",
              );
            }
            return {
              applicationset: encodeAppSetJsonFields(body.applicationset),
              upsert: body.upsert ?? false,
              dryRun: body.dryRun ?? false,
            };
          },
          responseExtractor: passthrough,
          description:
            "Create a GitOps ApplicationSet. Generators define WHERE to generate apps; template defines WHAT each app looks like.\n\n" +
            "EXAMPLE (list generator):\n" +
            "harness_create(resource_type='gitops_applicationset', params={agent_id:'account.myagent'},\n" +
            "  body={applicationset:{metadata:{name:'my-appset'}, spec:{\n" +
            "    goTemplate:true, generators:[{list:{elements:[{ns:'dev'},{ns:'staging'}]}}],\n" +
            "    template:{metadata:{name:'app-{{.ns}}'}, spec:{source:{repoURL:'...', path:'manifests', targetRevision:'HEAD'}, destination:{server:'https://kubernetes.default.svc', namespace:'{{.ns}}'}}}\n" +
            "  }}})\n\n" +
            "REQUIRED: agent_id in params (scope-prefixed). No resource_id for create.\n" +
            "DO NOT set spec.template.spec.project — Harness auto-assigns it.\n" +
            "Set spec.goTemplate=true for Go template syntax (e.g. '{{.path.basename}}').",
          bodySchema: {
            description:
              "Body must contain 'applicationset' with the full ArgoCD ApplicationSet object.",
            fields: [
              {
                name: "applicationset", type: "object", required: true,
                description:
                  "ArgoCD ApplicationSet object:\n" +
                  "{ metadata: { name (required) },\n" +
                  "  spec: {\n" +
                  "    goTemplate: boolean (recommended: true),\n" +
                  "    generators: [{ <type>: { ... } }, ...] — REQUIRED\n" +
                  "    template: { metadata: { name }, spec: { source: { repoURL, path, targetRevision }, destination: { server, namespace }, syncPolicy? } },\n" +
                  "    syncPolicy?: { applicationsSync?: 'create-only'|'create-update'|'create-delete'|'sync' }\n" +
                  "  } }\n\n" +
                  "GENERATOR TYPES AND FIELDS:\n\n" +
                  "1. LIST — static list of key-value parameter sets:\n" +
                  "   {list:{elements:[{cluster:'staging', url:'https://1.2.3.4'}, {cluster:'prod', url:'https://2.3.4.5'}]}}\n" +
                  "   Template vars: any keys from elements (e.g. {{.cluster}}, {{.url}})\n\n" +
                  "2. GIT — generates from directories or files in a Git repo:\n" +
                  "   Directories: {git:{repoURL:'https://...', revision:'HEAD', directories:[{path:'apps/*'}]}}\n" +
                  "   Files: {git:{repoURL:'https://...', revision:'HEAD', files:[{path:'config/*.json'}]}}\n" +
                  "   Optional: values:{key:'val'} for extra template vars\n" +
                  "   Template vars: {{.path.path}}, {{.path.basename}}, {{.path.basenameNormalized}}, {{index .path.segments N}}\n\n" +
                  "3. CLUSTERS — generates from ArgoCD-registered clusters:\n" +
                  "   Match all clusters: {clusters:{}} or {clusters:{selector:{}}}\n" +
                  "   Filter by labels: {clusters:{selector:{matchLabels:{env:'production'}}}}\n" +
                  "   Filter by expressions: {clusters:{selector:{matchExpressions:[{key:'region', operator:'In', values:['us-east','us-west']}]}}}\n" +
                  "   NOTE: Empty selector {} or omitted selector both match ALL clusters (standard K8s LabelSelector semantics).\n" +
                  "   Optional: values:{key:'val'} for extra template vars\n" +
                  "   Template vars: {{.name}}, {{.nameNormalized}}, {{.server}}, {{.metadata.labels.<key>}}, {{.metadata.annotations.<key>}}\n\n" +
                  "4. MATRIX — cartesian product of exactly 2 generators:\n" +
                  "   {matrix:{generators:[{list:{elements:[{cluster:'staging', url:'https://1.2.3.4'}]}}, {git:{repoURL:'...', revision:'HEAD', directories:[{path:'apps/*'}]}}]}}\n" +
                  "   Template vars: combined from both generators (e.g. {{.cluster}}, {{.path.basename}})\n\n" +
                  "5. MERGE — merges output of 2+ generators by shared keys:\n" +
                  "   {merge:{mergeKeys:['env'], generators:[{list:{elements:[{env:'dev', region:'us-east'}]}}, {list:{elements:[{env:'dev', replicas:'2'}]}}]}}\n" +
                  "   Template vars: union of fields from all generators, merged by mergeKeys\n\n" +
                  "6. PULL REQUEST — generates from open PRs in a repo (requires SCM token):\n" +
                  "   GitHub: {pullRequest:{github:{owner:'org', repo:'repo', tokenRef:{secretName:'gh-token', key:'token'}, labels:['deploy']}}}\n" +
                  "   Also supports: gitlab, gitea, bitbucket, bitbucketcloud, azuredevops\n" +
                  "   Template vars: {{.number}}, {{.branch}}, {{.branch_slug}}, {{.head_sha}}, {{.head_short_sha}}, {{.labels}}\n\n" +
                  "7. SCM PROVIDER — generates from repos matching filters in an SCM org:\n" +
                  "   GitHub: {scmProvider:{github:{organization:'my-org', tokenRef:{secretName:'gh-token', key:'token'}}}}\n" +
                  "   Also supports: gitlab, gitea, bitbucket, bitbucketcloud, azuredevops, awscodecommit\n" +
                  "   Template vars: {{.organization}}, {{.repository}}, {{.url}}, {{.branch}}, {{.sha}}, {{.labels}}\n\n" +
                  "8. PLUGIN — generates from an external plugin (ConfigMap-based):\n" +
                  "   {plugin:{configMapRef:{name:'my-plugin'}, input:{parameters:{key1:'value1'}}, requeueAfterSeconds:30}}\n" +
                  "   Optional: values:{key:'val'}\n" +
                  "   Template vars: defined by the plugin output",
              },
              { name: "upsert", type: "boolean", required: false, description: "If true, update existing ApplicationSet instead of failing on duplicate (default: false)." },
              { name: "dryRun", type: "boolean", required: false, description: "Simulate creation without applying (default: false)." },
            ],
          },
        },
        update: {
          method: "PUT",
          path: "/gitops/api/v1/applicationset",
          operationPolicy: { risk: "low_write", retryPolicy: "safe" },
          queryParams: {
            agent_id: "agentIdentifier",
          },
          bodyBuilder: (input) => {
            const body = isRecord(input.body) ? input.body : {};
            if (!isRecord(body.applicationset)) {
              throw new Error(
                "body.applicationset is required. Provide the full ArgoCD ApplicationSet object. " +
                "CRITICAL: metadata.uid is REQUIRED — first harness_list to find the appset and obtain its 'identifier' (= uid).",
              );
            }
            const appset = body.applicationset;
            const metadata = isRecord(appset.metadata) ? appset.metadata : undefined;
            if (!metadata?.uid) {
              throw new Error(
                "metadata.uid is REQUIRED for update. " +
                "Run harness_list(resource_type='gitops_applicationset', params={agent_id:'...'}) first — " +
                "the response 'identifier' field is the uid. " +
                "Include it as body.applicationset.metadata.uid.",
              );
            }
            return {
              applicationset: encodeAppSetJsonFields(appset),
              upsert: body.upsert ?? false,
              dryRun: body.dryRun ?? false,
            };
          },
          responseExtractor: passthrough,
          description:
            "Update a GitOps ApplicationSet. Full PUT replace — provide the complete desired state.\n\n" +
            "REQUIRED FLOW:\n" +
            "  1. harness_list(resource_type='gitops_applicationset', params={agent_id:'account.myagent'}, search_term='my-appset')\n" +
            "     → note 'identifier' (= metadata.uid) and spec.template.spec.project\n" +
            "  2. Modify the fields you need\n" +
            "  3. harness_update(resource_type='gitops_applicationset', resource_id='<appset_id>',\n" +
            "     params={agent_id:'account.myagent'}, body={applicationset:{metadata:{name:'my-appset', uid:'<identifier>'}, spec:{...project:'<project>'...}}})\n\n" +
            "MUST PRESERVE from list response:\n" +
            "  - metadata.uid — server uses it to identify the appset\n" +
            "  - metadata.name — server validates it matches\n" +
            "  - spec.template.spec.project — omitting it causes 'resource name may not be empty' error",
          bodySchema: {
            description:
              "Full PUT replace. MUST include metadata.uid (= 'identifier' from harness_list) and spec.template.spec.project.",
            fields: [
              {
                name: "applicationset", type: "object", required: true,
                description:
                  "Full ArgoCD ApplicationSet object.\n" +
                  "{ metadata: { name (required), uid (REQUIRED — from harness_list 'identifier') },\n" +
                  "  spec: { generators: [...], template: { metadata, spec: { ..., project: '<from harness_list>' } } } }",
              },
              { name: "upsert", type: "boolean", required: false, description: "If true, create if not exists (default: false)." },
              { name: "dryRun", type: "boolean", required: false, description: "Simulate update without applying (default: false)." },
            ],
          },
        },
        delete: {
          method: "DELETE",
          path: "/gitops/api/v1/applicationset/{identifier}",
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          pathParams: {
            appset_id: "identifier",
          },
          queryParams: {
            agent_id: "agentIdentifier",
          },
          responseExtractor: passthrough,
          description:
            "Delete a GitOps ApplicationSet by UUID.\n\n" +
            "IMPORTANT: resource_id must be the ApplicationSet UUID, NOT its name.\n\n" +
            "REQUIRED WORKFLOW:\n" +
            "  1. harness_list(resource_type='gitops_applicationset', params={agent_id:'account.myagent'}, search_term='my-appset')\n" +
            "     → note the 'identifier' field (= UUID)\n" +
            "  2. harness_delete(resource_type='gitops_applicationset', resource_id='<uuid>', params={agent_id:'account.myagent'})\n\n" +
            "NOTE: Deleting an ApplicationSet also deletes all Applications it generated, unless the ApplicationSet's syncPolicy preserves them.",
        },
      },
    },
    {
      resourceType: "gitops_repo_credential",
      displayName: "GitOps Repository Credential",
      description:
        "Repository credentials for GitOps agent. Supports list and get.\n" +
        "SCOPE BEHAVIOR:\n" +
        "- Account-level: Do NOT pass org_id or project_id\n" +
        "- Org-level: Pass org_id only (no project_id)\n" +
        "- Project-level: Pass both org_id AND project_id\n" +
        "IDENTIFIERS: agent_id is scope-prefixed:\n" +
        "- Account-scoped agent: 'account.myagent'\n" +
        "- Org-scoped agent: 'org.myagent'\n" +
        "- Project-scoped agent: 'myagent' (no prefix)",
      toolset: "gitops",
      scope: "project",
      scopeOptional: true,
      supportedScopes: ["account", "org", "project"],
      identifierFields: ["agent_id", "credential_id"],
      listFilterFields: [
        { name: "search_term", description: "Filter repository credentials by name or keyword" },
        { name: "agent_id", description: "Optional: Filter by GitOps agent identifier" },
      ],
      operations: {
        list: {
          method: "POST",
          path: "/gitops/api/v1/repocreds",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          injectAccountInBody: true,
          bodyBuilder: (input) => gitopsListBody(input, input.agent_id ? { agentIdentifier: input.agent_id } : {}),
          responseExtractor: passthrough,
          emptyOnErrorPatterns: [/agent is not registered/, /never connected/, /Not Implemented/],
          description: "List GitOps repository credentials",
        },
        get: {
          method: "GET",
          path: "/gitops/api/v1/agents/{agentIdentifier}/repocreds/{credentialId}",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: {
            agent_id: "agentIdentifier",
            credential_id: "credentialId",
          },
          responseExtractor: passthrough,
          description: "Get GitOps repository credential details",
        },
        delete: {
          method: "DELETE",
          path: "/gitops/api/v1/agents/{agentIdentifier}/repocreds/{credentialId}",
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          pathParams: {
            agent_id: "agentIdentifier",
            credential_id: "credentialId",
          },
          responseExtractor: passthrough,
          description:
            "Delete a GitOps repository credential template.\n\n" +
            "EXAMPLE:\n" +
            "harness_delete(resource_type='gitops_repo_credential', resource_id='ashinsabu3_donlxgyi',\n" +
            "  params={agent_id:'account.tomylocal'})\n\n" +
            "IDENTIFIERS:\n" +
            "  resource_id — credential identifier (e.g. 'ashinsabu3_donlxgyi'). " +
            "Use harness_list(resource_type='gitops_repo_credential') to discover it.\n" +
            "  agent_id   — scope-prefixed agent identifier: 'account.myagent' | 'org.myagent' | 'myagent'\n\n" +
            "SCOPE: set resource_scope to control which org/project params are injected:\n" +
            "  'account' — account-level (no org/project)\n" +
            "  'org'     — org-level (orgIdentifier injected)\n" +
            "  'project' — project-level (orgIdentifier + projectIdentifier injected, default)",
          paramsSchema: {
            fields: [
              {
                name: "agent_id",
                required: true,
                description: "Scope-prefixed agent identifier. E.g. 'account.myagent', 'org.myagent', or 'myagent' for project-level.",
              },
            ],
          } satisfies ParamsSchema,
        },
      },
    },
    {
      resourceType: "gitops_app_event",
      displayName: "GitOps App Event",
      description:
        "Events for a GitOps application. Supports list.\n" +
        "IDENTIFIERS: agent_id is scope-prefixed:\n" +
        "- Account-scoped agent: 'account.myagent'\n" +
        "- Org-scoped agent: 'org.myagent'\n" +
        "- Project-scoped agent: 'myagent' (no prefix)",
      toolset: "gitops",
      scope: "project",
      identifierFields: ["agent_id", "app_name"],
      listFilterFields: [
        { name: "agent_id", description: "GitOps agent identifier", required: true },
        { name: "app_name", description: "GitOps application name", required: true },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/gitops/applications/{appName}",
      operations: {
        list: {
          method: "GET",
          path: "/gitops/api/v1/agents/{agentIdentifier}/applications/{appName}/events",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: {
            agent_id: "agentIdentifier",
            app_name: "appName",
          },
          responseExtractor: passthrough,
          description: "List events for a GitOps application",
        },
      },
    },
    {
      resourceType: "gitops_pod_log",
      displayName: "GitOps Pod Log",
      description:
        "Pod logs for a GitOps application. Supports get with pod_name, namespace, container, tail_lines.\n" +
        "IDENTIFIERS: agent_id is scope-prefixed:\n" +
        "- Account-scoped agent: 'account.myagent'\n" +
        "- Org-scoped agent: 'org.myagent'\n" +
        "- Project-scoped agent: 'myagent' (no prefix)",
      toolset: "gitops",
      scope: "project",
      identifierFields: ["agent_id", "app_name"],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/gitops/applications/{appName}",
      operations: {
        get: {
          method: "GET",
          path: "/gitops/api/v1/agents/{agentIdentifier}/applications/{appName}/logs",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: {
            agent_id: "agentIdentifier",
            app_name: "appName",
          },
          queryParams: {
            pod_name: "podName",
            namespace: "namespace",
            container: "container",
            tail_lines: "tailLines",
          },
          responseExtractor: passthrough,
          description: "Get pod logs for a GitOps application",
          paramsSchema: {
            fields: [
              { name: "pod_name", required: false, description: "Pod name filter" },
              { name: "namespace", required: false, description: "Kubernetes namespace filter" },
              { name: "container", required: false, description: "Container name filter" },
              { name: "tail_lines", required: false, description: "Number of log lines to tail" },
            ],
          } satisfies ParamsSchema,
        },
      },
    },
    {
      resourceType: "gitops_managed_resource",
      displayName: "GitOps Managed Resource",
      description:
        "Managed Kubernetes resources for a GitOps application. Supports list.\n" +
        "IDENTIFIERS: agent_id is scope-prefixed:\n" +
        "- Account-scoped agent: 'account.myagent'\n" +
        "- Org-scoped agent: 'org.myagent'\n" +
        "- Project-scoped agent: 'myagent' (no prefix)",
      toolset: "gitops",
      scope: "project",
      identifierFields: ["agent_id", "app_name"],
      listFilterFields: [
        { name: "agent_id", description: "GitOps agent identifier", required: true },
        { name: "app_name", description: "GitOps application name", required: true },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/gitops/applications/{appName}",
      operations: {
        list: {
          method: "GET",
          path: "/gitops/api/v1/agents/{agentIdentifier}/applications/{appName}/managed-resources",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: {
            agent_id: "agentIdentifier",
            app_name: "appName",
          },
          responseExtractor: passthrough,
          description: "List managed resources for a GitOps application",
        },
      },
    },
    {
      resourceType: "gitops_resource_action",
      displayName: "GitOps Resource Action",
      description:
        "Available actions for a specific resource in a GitOps application. Supports list with namespace, resource_name, kind.\n" +
        "IDENTIFIERS: agent_id is scope-prefixed:\n" +
        "- Account-scoped agent: 'account.myagent'\n" +
        "- Org-scoped agent: 'org.myagent'\n" +
        "- Project-scoped agent: 'myagent' (no prefix)",
      toolset: "gitops",
      scope: "project",
      identifierFields: ["agent_id", "app_name"],
      listFilterFields: [
        { name: "namespace", description: "Kubernetes namespace filter" },
        { name: "resource_name", description: "Resource name filter" },
        { name: "kind", description: "Kubernetes resource kind filter" },
        { name: "group", description: "Kubernetes API group filter (e.g. 'apps')" },
        { name: "version", description: "Kubernetes API version filter (e.g. 'v1')" },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/gitops/applications/{appName}",
      operations: {
        list: {
          method: "GET",
          path: "/gitops/api/v1/agents/{agentIdentifier}/applications/{appName}/resource/actions",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: {
            agent_id: "agentIdentifier",
            app_name: "appName",
          },
          queryParams: {
            namespace: "request.namespace",
            resource_name: "request.resourceName",
            kind: "request.kind",
            group: "request.group",
            version: "request.version",
          },
          responseExtractor: passthrough,
          description: "List available actions for a resource in a GitOps application",
        },
      },
    },
    {
      resourceType: "gitops_dashboard",
      displayName: "GitOps Dashboard",
      description: "GitOps dashboard overview with summary metrics. Supports get.",
      toolset: "gitops",
      scope: "project",
      identifierFields: [],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/gitops",
      operations: {
        get: {
          method: "GET",
          path: "/gitops/api/v1/dashboard/overview",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          responseExtractor: passthrough,
          description: "Get GitOps dashboard overview with summary metrics",
        },
      },
    },
    {
      resourceType: "gitops_app_resource_tree",
      displayName: "GitOps App Resource Tree",
      description:
        "Kubernetes resource tree for a GitOps application. Supports get.\n" +
        "IDENTIFIERS: agent_id is scope-prefixed:\n" +
        "- Account-scoped agent: 'account.myagent'\n" +
        "- Org-scoped agent: 'org.myagent'\n" +
        "- Project-scoped agent: 'myagent' (no prefix)",
      toolset: "gitops",
      scope: "project",
      identifierFields: ["agent_id", "app_name"],
      operations: {
        get: {
          method: "GET",
          path: "/gitops/api/v1/agents/{agentIdentifier}/applications/{appName}/resource-tree",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: {
            agent_id: "agentIdentifier",
            app_name: "appName",
          },
          responseExtractor: passthrough,
          description: "Get the Kubernetes resource tree for a GitOps application",
        },
      },
    },
    {
      resourceType: "gitops_cluster_link",
      displayName: "GitOps Cluster-Environment Link",
      description:
        "Link between a GitOps cluster and a Harness Environment. This is a Harness NG API, not a GitOps agent API.\n" +
        "IMPORTANT: Unlike GitOps agent APIs, all identifiers here are RAW (not scope-prefixed). Use 'myagent' not 'account.myagent', 'incluster' not 'account.incluster'.\n" +
        "OPERATIONS: list (requires environment_id), create (link cluster to env), delete (unlink cluster from env).\n" +
        "SCOPE OF THE CLUSTER (the 'scope' field):\n" +
        "- ACCOUNT: cluster registered at account level\n" +
        "- ORGANIZATION: cluster registered at org level\n" +
        "- PROJECT: cluster registered at project level\n" +
        "SCOPE HIERARCHY RULE: Cluster scope must be equal to or wider than environment scope.\n" +
        "  - A PROJECT environment can link ACCOUNT, ORGANIZATION, or PROJECT clusters\n" +
        "  - An ORGANIZATION environment can link ACCOUNT or ORGANIZATION clusters\n" +
        "  - An ACCOUNT environment can only link ACCOUNT clusters",
      toolset: "gitops",
      scope: "project",
      identifierFields: ["cluster_id"],
      diagnosticHint: "If create fails with a scope error, verify the cluster scope is equal to or wider than the environment scope (ACCOUNT > ORGANIZATION > PROJECT). Use harness_list(resource_type='gitops_cluster') to check available clusters and their scopes. All identifiers must be raw (not scope-prefixed).",
      relatedResources: [
        { resourceType: "gitops_cluster", relationship: "linked_cluster", description: "The GitOps cluster being linked to an environment" },
        { resourceType: "environment", relationship: "target_environment", description: "The Harness environment the cluster is linked to" },
      ],
      listFilterFields: [
        { name: "environment_id", description: "Environment identifier (required)", required: true },
        { name: "search_term", description: "Filter clusters by name or keyword" },
        { name: "scope", description: "Filter by cluster scope: ACCOUNT, ORGANIZATION, or PROJECT" },
      ],
      operations: {
        list: {
          method: "GET",
          path: "/ng/api/gitops/clusters",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            environment_id: "environmentIdentifier",
            search_term: "searchTerm",
            scope: "scope",
            page: "page",
            size: "size",
          },
          responseExtractor: pageExtract,
          description:
            "List GitOps clusters linked to a Harness environment. Requires environment_id filter.\n\n" +
            "Example: harness_list(resource_type='gitops_cluster_link', filters={environment_id:'my-env'})\n\n" +
            "SCOPING: All filter values are raw, NOT scope-prefixed (e.g. environment_id:'my-env', not 'account.my-env').\n" +
            "NOTE: The response 'name' field is scope-prefixed (e.g. 'account.incluster'). To use it with harness_delete, strip the prefix.",
        },
        create: {
          method: "POST",
          path: "/ng/api/gitops/clusters",
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          bodyBuilder: (input) => {
            const body = (input.body ?? {}) as Record<string, unknown>;
            const { identifier, envRef, agentIdentifier, scope } = body;
            if (!identifier || !envRef || !agentIdentifier || !scope) {
              throw new Error(
                "gitops_cluster_link create requires body.identifier, body.envRef, body.agentIdentifier, and body.scope (ACCOUNT/ORGANIZATION/PROJECT). " +
                "All identifiers are raw, NOT scope-prefixed. Use harness_list(resource_type='gitops_cluster') to find available clusters and their agent IDs.",
              );
            }
            return { identifier, envRef, agentIdentifier, scope };
          },
          responseExtractor: ngExtract,
          description:
            "Link a GitOps cluster to a Harness environment.\n\n" +
            "Example: harness_create(resource_type='gitops_cluster_link', body={identifier:'incluster', envRef:'my-env', agentIdentifier:'myagent', scope:'ACCOUNT'})\n\n" +
            "SCOPE VALUES: 'ACCOUNT', 'ORGANIZATION', or 'PROJECT' — must match the scope where the cluster is registered in GitOps.\n" +
            "SCOPE RULE: Cluster scope must be equal to or wider than the environment scope.",
          bodySchema: {
            description:
              "Cluster link body. All fields describe the cluster being linked and the target environment.",
            fields: [
              { name: "identifier", type: "string", required: true, description: "Cluster identifier — raw, NOT scope-prefixed (e.g. 'incluster', not 'account.incluster')." },
              { name: "envRef", type: "string", required: true, description: "Environment identifier — raw, NOT scope-prefixed (e.g. 'my-env')." },
              { name: "agentIdentifier", type: "string", required: true, description: "GitOps agent identifier — raw, NOT scope-prefixed (e.g. 'myagent', not 'account.myagent'). Unlike GitOps agent APIs, this NG API takes raw agent IDs." },
              { name: "scope", type: "string", required: true, description: "Scope of the cluster in Harness GitOps: 'ACCOUNT', 'ORGANIZATION', or 'PROJECT'." },
            ],
          },
        },
        delete: {
          method: "DELETE",
          path: "/ng/api/gitops/clusters/{clusterIdentifier}",
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          pathParams: {
            cluster_id: "clusterIdentifier",
          },
          queryParams: {
            environment_id: "environmentIdentifier",
            agent_id: "agentIdentifier",
            scope: "scope",
          },
          responseExtractor: ngExtract,
          description:
            "Unlink a GitOps cluster from a Harness environment.\n\n" +
            "Example: harness_delete(resource_type='gitops_cluster_link', resource_id='incluster', params={environment_id:'my-env', agent_id:'myagent', scope:'ACCOUNT'})\n\n" +
            "IMPORTANT: All identifiers are RAW, NOT scope-prefixed:\n" +
            "- resource_id: raw cluster identifier (e.g. 'incluster', not 'account.incluster'). The list response returns 'name' as scope-prefixed — strip the prefix for delete.\n" +
            "- agent_id: raw agent identifier (e.g. 'myagent', not 'account.myagent').\n" +
            "- environment_id: raw environment identifier.\n" +
            "All three plus scope are required in params.",
        },
      },
    },
  ],
};
