import { type Config, resolveProductBaseUrl } from "../config.js";
import type { HarnessClient } from "../client/harness-client.js";
import type { ResourceDefinition, ToolsetDefinition, ToolsetName, OperationName, EndpointSpec, FilterFieldSpec } from "./types.js";
import { createLogger } from "../utils/logger.js";
import { buildDeepLink, appendStoreType } from "../utils/deep-links.js";

// Import all toolsets
import { pipelinesToolset } from "./toolsets/pipelines.js";
import { servicesToolset } from "./toolsets/services.js";
import { environmentsToolset } from "./toolsets/environments.js";
import { connectorsToolset } from "./toolsets/connectors.js";
import { infrastructureToolset } from "./toolsets/infrastructure.js";
import { secretsToolset } from "./toolsets/secrets.js";
import { logsToolset } from "./toolsets/logs.js";
import { auditToolset } from "./toolsets/audit.js";
import { delegatesToolset } from "./toolsets/delegates.js";
import { repositoriesToolset } from "./toolsets/repositories.js";
import { registriesToolset } from "./toolsets/registries.js";
import { templatesToolset } from "./toolsets/templates.js";
import { dashboardsToolset } from "./toolsets/dashboards.js";
import { idpToolset } from "./toolsets/idp.js";
import { pullRequestsToolset } from "./toolsets/pull-requests.js";
import { featureFlagsToolset } from "./toolsets/feature-flags.js";
import { gitopsToolset } from "./toolsets/gitops.js";
import { chaosToolset } from "./toolsets/chaos.js";
import { ccmToolset } from "./toolsets/ccm.js";
import { seiToolset } from "./toolsets/sei.js";
import { scsToolset } from "./toolsets/scs.js";
import { stoToolset } from "./toolsets/sto.js";
import { accessControlToolset } from "./toolsets/access-control.js";
import { settingsToolset } from "./toolsets/settings.js";
import { platformToolset } from "./toolsets/platform.js";

import { visualizationsToolset } from "./toolsets/visualizations.js";
import { governanceToolset } from "./toolsets/governance.js";
import { freezeToolset } from "./toolsets/freeze.js";
import { overridesToolset } from "./toolsets/overrides.js";

const log = createLogger("registry");

/** All available toolsets */
const ALL_TOOLSETS: ToolsetDefinition[] = [
  pipelinesToolset,
  servicesToolset,
  environmentsToolset,
  connectorsToolset,
  infrastructureToolset,
  secretsToolset,
  logsToolset,
  auditToolset,
  delegatesToolset,
  repositoriesToolset,
  registriesToolset,
  templatesToolset,
  dashboardsToolset,
  idpToolset,
  pullRequestsToolset,
  featureFlagsToolset,
  gitopsToolset,
  chaosToolset,
  ccmToolset,
  seiToolset,
  scsToolset,
  stoToolset,
  accessControlToolset,
  settingsToolset,
  platformToolset,

  visualizationsToolset,
  governanceToolset,
  freezeToolset,
  overridesToolset,
];

/**
 * The enabled registry — filtered by HARNESS_TOOLSETS config.
 */
export class Registry {
  private resourceMap: Map<string, ResourceDefinition> = new Map();
  private toolsets: ToolsetDefinition[] = [];

  constructor(private config: Config) {
    const enabledNames = this.parseToolsetFilter();
    this.toolsets = enabledNames
      ? ALL_TOOLSETS.filter((t) => enabledNames.has(t.name))
      : ALL_TOOLSETS;

    for (const toolset of this.toolsets) {
      for (const resource of toolset.resources) {
        this.resourceMap.set(resource.resourceType, resource);
      }
    }

    log.info(`Registry loaded: ${this.resourceMap.size} resource types from ${this.toolsets.length} toolsets`);
  }

  private parseToolsetFilter(): Set<ToolsetName> | null {
    const raw = this.config.HARNESS_TOOLSETS;
    if (!raw || raw.trim() === "") return null;

    const validNames = new Set<string>(ALL_TOOLSETS.map((t) => t.name));
    const parsed = raw.split(",").map((s) => s.trim()).filter(Boolean);
    const valid: ToolsetName[] = [];
    const invalid: string[] = [];

    for (const name of parsed) {
      if (validNames.has(name)) {
        valid.push(name as ToolsetName);
      } else {
        invalid.push(name);
      }
    }

    if (invalid.length > 0) {
      const available = Array.from(validNames).sort().join(", ");
      throw new Error(
        `Invalid HARNESS_TOOLSETS: ${invalid.map((n) => `"${n}"`).join(", ")}. ` +
        `Valid toolset names: ${available}`,
      );
    }

    if (valid.length === 0) return null;
    return new Set(valid);
  }

  get defaultOrgId(): string { return this.config.HARNESS_DEFAULT_ORG_ID; }
  get defaultProjectId(): string | undefined { return this.config.HARNESS_DEFAULT_PROJECT_ID; }

  /** Get a resource definition by type, or throw. */
  getResource(resourceType: string): ResourceDefinition {
    const def = this.resourceMap.get(resourceType);
    if (!def) {
      const available = Array.from(this.resourceMap.keys()).sort().join(", ");
      throw new Error(`Unknown resource_type "${resourceType}". Available: ${available}`);
    }
    return def;
  }

  /** Get all enabled resource types. */
  getAllResourceTypes(): string[] {
    return Array.from(this.resourceMap.keys()).sort();
  }

  /** Get all unique filter fields across all enabled resource definitions. */
  getAllFilterFields(): FilterFieldSpec[] {
    const seen = new Set<string>();
    const fields: FilterFieldSpec[] = [];
    for (const [, def] of this.resourceMap) {
      for (const f of def.listFilterFields ?? []) {
        if (!seen.has(f.name)) {
          seen.add(f.name);
          fields.push(f);
        }
      }
    }
    return fields;
  }

  /** Get all enabled toolsets with their resources. */
  getAllToolsets(): ToolsetDefinition[] {
    return this.toolsets;
  }

  /** Check if a resource type supports an operation. */
  supportsOperation(resourceType: string, operation: OperationName): boolean {
    const def = this.resourceMap.get(resourceType);
    return def?.operations[operation] !== undefined;
  }

  /** Check if a resource type has execute actions. */
  getExecuteActions(resourceType: string): Record<string, EndpointSpec & { actionDescription: string }> | undefined {
    const def = this.resourceMap.get(resourceType);
    return def?.executeActions;
  }

  private static readonly READ_OPERATIONS: Set<OperationName> = new Set(["list", "get"]);

  /** Dispatch a CRUD operation to the Harness API. */
  async dispatch(
    client: HarnessClient,
    resourceType: string,
    operation: OperationName,
    input: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<unknown> {
    if (this.config.HARNESS_READ_ONLY && !Registry.READ_OPERATIONS.has(operation)) {
      throw new Error(`Read-only mode is enabled (HARNESS_READ_ONLY=true). "${operation}" operations are not allowed.`);
    }

    const def = this.getResource(resourceType);
    const spec = def.operations[operation];
    if (!spec) {
      const supported = Object.keys(def.operations).join(", ");
      throw new Error(`Resource "${resourceType}" does not support "${operation}". Supported: ${supported}`);
    }

    return this.executeSpec(client, def, spec, input, signal);
  }

  /** Dispatch an execute action to the Harness API. */
  async dispatchExecute(
    client: HarnessClient,
    resourceType: string,
    action: string,
    input: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<unknown> {
    if (this.config.HARNESS_READ_ONLY) {
      throw new Error(`Read-only mode is enabled (HARNESS_READ_ONLY=true). Execute actions are not allowed.`);
    }

    const def = this.getResource(resourceType);
    const actionSpec = def.executeActions?.[action];
    if (!actionSpec) {
      const available = def.executeActions ? Object.keys(def.executeActions).join(", ") : "none";
      throw new Error(`Resource "${resourceType}" has no execute action "${action}". Available: ${available}`);
    }

    return this.executeSpec(client, def, actionSpec, input, signal);
  }

  private async executeSpec(
    client: HarnessClient,
    def: ResourceDefinition,
    spec: EndpointSpec,
    input: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<unknown> {
    // Build path with substitutions (or pathBuilder when present)
    let path: string;
    if (spec.pathBuilder) {
      path = spec.pathBuilder(input, this.config);
    } else {
      path = spec.path;
      if (spec.pathParams) {
        for (const [inputKey, pathPlaceholder] of Object.entries(spec.pathParams)) {
          let value = input[inputKey];
          if (value === undefined || value === "") {
            // Default scope placeholders from config for project/org-scoped resources
            if (pathPlaceholder === "org" && (def.scope === "project" || def.scope === "org")) {
              value = this.config.HARNESS_DEFAULT_ORG_ID;
            } else if (pathPlaceholder === "project" && def.scope === "project") {
              value = this.config.HARNESS_DEFAULT_PROJECT_ID;
            }
          }
          if (value === undefined || value === "") {
            throw new Error(`Missing required field "${inputKey}" for path parameter "${pathPlaceholder}"`);
          }
          path = path.replace(`{${pathPlaceholder}}`, encodeURIComponent(String(value)));
        }
      }
    }

    // Build query params
    const params: Record<string, string | number | boolean | undefined> = {};

    // Add scope params (allow per-resource override of query param names)
    const orgParam = def.scopeParams?.org ?? "orgIdentifier";
    const projectParam = def.scopeParams?.project ?? "projectIdentifier";
    if (def.scope === "project" || def.scope === "org") {
      params[orgParam] = (input.org_id as string) ?? this.config.HARNESS_DEFAULT_ORG_ID;
    }
    if (def.scope === "project") {
      params[projectParam] = (input.project_id as string) ?? this.config.HARNESS_DEFAULT_PROJECT_ID;
    }
    // Inject custom account param when scopeParams.account is set
    // (in addition to the client's default accountIdentifier)
    if (def.scopeParams?.account) {
      params[def.scopeParams.account] = this.config.HARNESS_ACCOUNT_ID;
    }

    // Add static query params (not derived from input)
    if (spec.staticQueryParams) {
      for (const [key, value] of Object.entries(spec.staticQueryParams)) {
        params[key] = value;
      }
    }

    // Map input fields to query params
    if (spec.queryParams) {
      for (const [inputKey, queryKey] of Object.entries(spec.queryParams)) {
        const value = input[inputKey];
        if (value !== undefined && value !== "") {
          params[queryKey] = value as string | number | boolean;
        }
      }
    }

    // Build body
    const body = spec.bodyBuilder ? spec.bodyBuilder(input) : undefined;

    // Validate required fields if bodySchema is defined.
    // When bodyWrapperKey is set, the bodyBuilder wraps user fields inside that
    // key (e.g. { project: { identifier, name } }), so we validate the inner object.
    if (spec.bodySchema && body && typeof body === "object") {
      const bodyRecord = body as Record<string, unknown>;
      const payload =
        spec.bodyWrapperKey &&
        bodyRecord[spec.bodyWrapperKey] != null &&
        typeof bodyRecord[spec.bodyWrapperKey] === "object"
          ? (bodyRecord[spec.bodyWrapperKey] as Record<string, unknown>)
          : bodyRecord;
      const missing = spec.bodySchema.fields
        .filter(f => f.required && payload[f.name] === undefined)
        .map(f => f.name);
      if (missing.length > 0) {
        throw new Error(
          `Missing required fields for ${def.resourceType}: ${missing.join(", ")}. ` +
          `Use harness_describe(resource_type="${def.resourceType}") to see the schema.`
        );
      }
    }

    // Make request — resolve base URL from product backend
    const product = def.product ?? "harness";
    const baseUrl = resolveProductBaseUrl(this.config, product);
    const raw = await client.request({
      method: spec.method,
      path,
      params,
      body,
      ...(baseUrl ? { baseUrl } : {}),
      ...(spec.headers ? { headers: spec.headers } : {}),
      signal,
    });

    // Extract response
    const result = spec.responseExtractor ? spec.responseExtractor(raw) : raw;

    // Propagate storeType from the request query params into the result when
    // the API response didn't include one.  Create/update endpoints like
    // `/pipeline/api/pipelines/v2` return a slim `PipelineSaveResponse` that
    // omits `storeType`, so the caller's intent (REMOTE vs INLINE) would be
    // lost without this propagation.  This also ensures the `openInHarness`
    // deep link gets the correct `?storeType=` suffix.
    if (result && typeof result === "object" && params.storeType) {
      const r = result as Record<string, unknown>;
      if (!r.storeType) {
        r.storeType = params.storeType;
      }
    }

    // Attach deep link if available
    if (def.deepLinkTemplate && typeof result === "object" && result !== null) {
      const resultRecord = result as Record<string, unknown>;
      const baseLinkParams: Record<string, string> = {
        orgIdentifier: (params.orgIdentifier as string) ?? "",
        projectIdentifier: (params.projectIdentifier as string) ?? "",
      };

      // Populate resolved path param values so deep link templates using
      // path-style placeholders (e.g. {org}, {project}) get substituted.
      // Merge from both the current spec and the get spec to cover cases where
      // the list spec lacks path params that the deep link template references.
      const allPathParams: Record<string, string> = {
        ...def.operations.get?.pathParams,
        ...spec.pathParams,
      };
      for (const [inputKey, pathPlaceholder] of Object.entries(allPathParams)) {
        if (baseLinkParams[pathPlaceholder]) continue; // already set
        let value = input[inputKey] as string | undefined;
        if (!value && pathPlaceholder === "org") {
          value = this.config.HARNESS_DEFAULT_ORG_ID;
        } else if (!value && pathPlaceholder === "project") {
          value = this.config.HARNESS_DEFAULT_PROJECT_ID;
        }
        if (value) {
          baseLinkParams[pathPlaceholder] = value;
        }
      }

      const getPathParam = def.operations.get?.pathParams;
      for (const field of def.identifierFields) {
        const pathParamName = spec.pathParams?.[field] ?? getPathParam?.[field] ?? field;
        let value = input[field];
        if (!value && resultRecord) {
          value = resultRecord[pathParamName] ?? resultRecord.identifier;
        }
        if (value) {
          baseLinkParams[pathParamName] = String(value);
        }
      }
      // Only attach top-level openInHarness for single-item results (get/create/update),
      // not for list results where there's no single entity to link to.
      const r = result as { items?: unknown[] };
      const isList = r.items && Array.isArray(r.items);
      if (!isList) {
        try {
          let link = buildDeepLink(
            this.config.HARNESS_BASE_URL,
            this.config.HARNESS_ACCOUNT_ID,
            def.deepLinkTemplate,
            baseLinkParams,
          );
          link = appendStoreType(link, resultRecord);
          resultRecord.openInHarness = link;
        } catch {
          // Deep link construction failed — non-critical
        }
      }
      if (r.items && Array.isArray(r.items)) {
        for (const item of r.items) {
          if (typeof item !== "object" || item === null) continue;
          try {
            const itemRecord = item as Record<string, unknown>;
            const itemLinkParams: Record<string, string> = { ...baseLinkParams };

            // Resolve identifier fields from each item
            for (const field of def.identifierFields) {
              // Use get spec's path param name when present so deep link template placeholder matches (e.g. templateIdentifier)
              const getPathParam = def.operations.get?.pathParams?.[field];
              const pathParamName = spec.pathParams?.[field] ?? getPathParam ?? field;
              // Look for the API param name directly in the item (e.g., pipelineIdentifier, identifier)
              if (itemRecord[pathParamName] !== undefined) {
                itemLinkParams[pathParamName] = String(itemRecord[pathParamName]);
              } else if (itemRecord.identifier !== undefined) {
                // Fall back to the generic "identifier" field for the primary identifier
                itemLinkParams[pathParamName] = String(itemRecord.identifier);
              }
            }

            // Resolve any remaining {placeholder} tokens directly from item fields.
            // This covers cases like execution items that carry pipelineIdentifier
            // but it's not in identifierFields (since the resource's identifier is execution_id).
            const remaining: RegExpMatchArray | null = def.deepLinkTemplate.match(/\{(\w+)\}/g);
            if (remaining) {
              for (const token of remaining) {
                const key = token.slice(1, -1); // strip { }
                if (key === "accountId" || itemLinkParams[key]) continue;
                if (itemRecord[key] !== undefined) {
                  itemLinkParams[key] = String(itemRecord[key]);
                }
              }
            }

            let itemLink = buildDeepLink(
              this.config.HARNESS_BASE_URL,
              this.config.HARNESS_ACCOUNT_ID,
              def.deepLinkTemplate,
              itemLinkParams,
            );
            itemLink = appendStoreType(itemLink, itemRecord);
            itemRecord.openInHarness = itemLink;
          } catch {
            // Per-item deep link failed — non-critical, skip
          }
        }
      }
    }

    return result;
  }

  /** Get describe metadata for all enabled resource types (full detail). */
  describe(): Record<string, unknown> {
    const toolsets: Record<string, unknown> = {};
    for (const ts of this.toolsets) {
      toolsets[ts.name] = {
        displayName: ts.displayName,
        description: ts.description,
        resources: ts.resources.map((r) => ({
          resource_type: r.resourceType,
          displayName: r.displayName,
          description: r.description,
          scope: r.scope,
          operations: Object.keys(r.operations),
          executeActions: r.executeActions ? Object.keys(r.executeActions) : undefined,
          identifierFields: r.identifierFields,
          listFilterFields: r.listFilterFields,
          diagnosticHint: r.diagnosticHint ?? undefined,
        })),
      };
    }
    return {
      total_resource_types: this.resourceMap.size,
      total_toolsets: this.toolsets.length,
      toolsets,
    };
  }

  /** Search resource types by keyword — matches type, display name, toolset, description. */
  searchResources(query: string): Array<{ type: string; name: string; toolset: string; ops: string[]; description: string }> {
    const q = query.toLowerCase();
    const results: Array<{ type: string; name: string; toolset: string; ops: string[]; description: string; score: number }> = [];

    for (const def of this.resourceMap.values()) {
      let score = 0;
      const toolsetName = this.toolsets.find((t) => t.resources.includes(def))?.name ?? "";

      if (def.resourceType.toLowerCase() === q) score = 100;
      else if (def.resourceType.toLowerCase().includes(q)) score = 80;
      else if (def.displayName.toLowerCase().includes(q)) score = 60;
      else if (toolsetName.toLowerCase().includes(q)) score = 40;
      else if (def.description.toLowerCase().includes(q)) score = 20;

      if (score > 0) {
        const ops = [
          ...Object.keys(def.operations),
          ...Object.keys(def.executeActions ?? {}),
        ];
        results.push({
          type: def.resourceType,
          name: def.displayName,
          toolset: toolsetName,
          ops,
          description: def.description,
          score,
        });
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .map(({ score, ...rest }) => rest);
  }

  /** Get compact summary — one line per resource type, ~15 tokens each. */
  describeSummary(): Record<string, unknown> {
    const resource_types = [];
    for (const ts of this.toolsets) {
      for (const r of ts.resources) {
        const ops = Object.keys(r.operations);
        if (r.executeActions) {
          ops.push(...Object.keys(r.executeActions));
        }
        resource_types.push({
          type: r.resourceType,
          name: r.displayName,
          toolset: ts.name,
          ops,
        });
      }
    }
    return {
      total_resource_types: this.resourceMap.size,
      total_toolsets: this.toolsets.length,
      resource_types,
      hint: "Call harness_describe(resource_type='<type>') for full details including diagnosticHint and executeHint.",
    };
  }
}
