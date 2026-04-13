import { type Config, resolveProductBaseUrl } from "../config.js";
import type { HarnessClient } from "../client/harness-client.js";
import { HarnessApiError } from "../utils/errors.js";
import type { ResourceDefinition, ToolsetDefinition, ToolsetName, OperationName, EndpointSpec, FilterFieldSpec } from "./types.js";
import { createLogger } from "../utils/logger.js";
import { buildDeepLink, appendStoreType } from "../utils/deep-links.js";

// Import all toolsets
import { pipelinesToolset } from "./toolsets/pipelines.js";
import { agentPipelinesToolset } from "./toolsets/agent-pipelines.js";
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

/** Keys under which different Harness APIs return list arrays. */
const LIST_ARRAY_KEYS = ["items", "features", "content", "data", "objects"];

/** All available toolsets */
const ALL_TOOLSETS: ToolsetDefinition[] = [
  pipelinesToolset,
  agentPipelinesToolset,
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
 * Options for extending the Registry with additional toolsets.
 */
export interface RegistryOptions {
  additionalToolsets?: ToolsetDefinition[];
}

/**
 * The enabled registry — filtered by HARNESS_TOOLSETS config.
 */
export class Registry {
  private resourceMap: Map<string, ResourceDefinition> = new Map();
  private toolsets: ToolsetDefinition[] = [];

  constructor(private config: Config, options: RegistryOptions = {}) {
    const allToolsets = [...ALL_TOOLSETS, ...(options.additionalToolsets ?? [])];
    const enabledNames = this.parseToolsetFilter(allToolsets);
    this.toolsets = enabledNames
      ? allToolsets.filter((t) => enabledNames.has(t.name))
      : allToolsets;

    for (const toolset of this.toolsets) {
      for (const resource of toolset.resources) {
        this.resourceMap.set(resource.resourceType, resource);
      }
    }

    log.info(`Registry loaded: ${this.resourceMap.size} resource types from ${this.toolsets.length} toolsets`);
  }

  private parseToolsetFilter(allToolsets: ToolsetDefinition[]): Set<string> | null {
    const raw = this.config.HARNESS_TOOLSETS;
    if (!raw || raw.trim() === "") return null;

    const validNames = new Set<string>(allToolsets.map((t) => t.name));
    const parsed = raw.split(",").map((s) => s.trim()).filter(Boolean);
    const valid: string[] = [];
    const invalid: string[] = [];

    for (const name of parsed) {
      if (validNames.has(name)) {
        valid.push(name);
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

  get orgId(): string { return this.config.HARNESS_ORG; }
  get projectId(): string | undefined { return this.config.HARNESS_PROJECT; }

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

  /** Get resource types that support a specific CRUD operation. */
  getTypesForOperation(operation: OperationName): string[] {
    return this.getAllResourceTypes().filter(rt => this.supportsOperation(rt, operation));
  }

  /** Get resource types that have at least one execute action. */
  getTypesWithExecuteActions(): string[] {
    return this.getAllResourceTypes().filter(rt => {
      const actions = this.getExecuteActions(rt);
      return actions !== undefined && Object.keys(actions).length > 0;
    });
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

    // Validate required listFilterFields for list operations before hitting the API
    if (operation === "list" && def.listFilterFields) {
      const missing = def.listFilterFields
        .filter(f => f.required && input[f.name] === undefined)
        .map(f => f.name);
      if (missing.length > 0) {
        throw new Error(
          `Missing required filter(s) for listing ${resourceType}: ${missing.join(", ")}. ` +
          `Pass them via filters (e.g. filters: { ${missing.map(n => `${n}: "..."`).join(", ")} }).`
        );
      }
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
              value = this.config.HARNESS_ORG;
            } else if (pathPlaceholder === "project" && def.scope === "project") {
              value = this.config.HARNESS_PROJECT;
            }
          }
          if (value === undefined || value === "") {
            throw new Error(`Missing required field "${inputKey}" for path parameter "${pathPlaceholder}"`);
          }
          path = path.replace(`{${pathPlaceholder}}`, encodeURIComponent(String(value)));
        }
      }
    }

    // Build query params (values may be string[] for repeated query keys — see HarnessClient.buildUrl)
    const params: Record<string, string | number | boolean | string[] | undefined> = {};

    // Add scope params (allow per-resource override of query param names)
    // When scopeOptional is true, only add org/project if explicitly provided in input.
    // Otherwise, fall back to config defaults based on the resource's scope level.
    const orgParam = def.scopeParams?.org ?? "orgIdentifier";
    const projectParam = def.scopeParams?.project ?? "projectIdentifier";
    if (def.scopeOptional) {
      // Dynamic scoping: only inject when caller explicitly provides them
      if (input.org_id) {
        params[orgParam] = input.org_id as string;
      }
      if (input.project_id) {
        params[projectParam] = input.project_id as string;
      }
    } else {
      // Standard scoping: always inject based on scope level, falling back to config defaults
      if (def.scope === "project" || def.scope === "org") {
        params[orgParam] = (input.org_id as string) ?? this.config.HARNESS_ORG;
      }
      if (def.scope === "project") {
        params[projectParam] = (input.project_id as string) ?? this.config.HARNESS_PROJECT;
      }
    }
    // Inject custom account param when scopeParams.account is set
    // (in addition to the client's default accountIdentifier)
    if (def.scopeParams?.account) {
      params[def.scopeParams.account] = this.config.HARNESS_ACCOUNT_ID;
    }

    // Account-scoped resources sometimes still need orgIdentifier in query params (NG /ng/api/projects).
    if (spec.injectOrgQueryFallback) {
      const orgKey = def.scopeParams?.org ?? "orgIdentifier";
      const cur = params[orgKey];
      if (cur === undefined || cur === "") {
        const fallback = (input.org_id as string) ?? this.config.HARNESS_ORG;
        if (fallback) {
          params[orgKey] = fallback;
        }
      }
    }

    // Add static query params (not derived from input)
    if (spec.staticQueryParams) {
      for (const [key, value] of Object.entries(spec.staticQueryParams)) {
        params[key] = value;
      }
    }

    // Apply default query params first (can be overridden by input)
    if (spec.defaultQueryParams) {
      for (const [queryKey, defaultValue] of Object.entries(spec.defaultQueryParams)) {
        params[queryKey] = defaultValue;
      }
    }

    // Build body BEFORE mapping input→queryParams so that bodyBuilders that
    // hoist fields onto input (e.g. trigger's pipelineIdentifier → pipeline_id)
    // take effect before query params are resolved.
    const body = spec.bodyBuilder ? spec.bodyBuilder(input) : undefined;

    // Map input fields to query params (overrides defaults)
    if (spec.queryParams) {
      for (const [inputKey, queryKey] of Object.entries(spec.queryParams)) {
        let value = input[inputKey];
        // Convert 0-indexed page to 1-indexed when the API requires it
        if (spec.pageOneIndexed && inputKey === "page" && typeof value === "number") {
          value = value + 1;
        }
        if (Array.isArray(value)) {
          const parts = value.filter(
            (v): v is string | number | boolean => v !== undefined && v !== "" && v !== null,
          );
          if (parts.length > 0) {
            params[queryKey] = parts.map(String);
          }
        } else if (value !== undefined && value !== "") {
          params[queryKey] = value as string | number | boolean;
        }
      }
    }

    // Inject orgIdentifier/projectIdentifier into the body for mutating operations (POST/PUT).
    // Harness NG APIs require these in the body (not just query params) to scope the resource correctly.
    // If bodyWrapperKey is set (e.g., "connector"), inject inside the wrapper object.
    if (body && typeof body === "object" && (spec.method === "POST" || spec.method === "PUT")) {
      const bodyRecord = body as Record<string, unknown>;
      // Determine where to inject: inside wrapper if present, otherwise at top level
      const targetRecord = spec.bodyWrapperKey && 
        bodyRecord[spec.bodyWrapperKey] && 
        typeof bodyRecord[spec.bodyWrapperKey] === "object"
          ? (bodyRecord[spec.bodyWrapperKey] as Record<string, unknown>)
          : bodyRecord;
      // Only inject accountIdentifier when the endpoint explicitly requires it
      // (gRPC-gateway APIs with body:"*" need it in the body, not just query params)
      if (spec.injectAccountInBody && this.config.HARNESS_ACCOUNT_ID && !targetRecord.accountIdentifier) {
        targetRecord.accountIdentifier = this.config.HARNESS_ACCOUNT_ID;
      }
      if (params.orgIdentifier && !targetRecord.orgIdentifier) {
        targetRecord.orgIdentifier = params.orgIdentifier;
      }
      if (params.projectIdentifier && !targetRecord.projectIdentifier) {
        targetRecord.projectIdentifier = params.projectIdentifier;
      }
    }

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

    // Make request — resolve base URL and auth from product backend
    const product = def.product ?? (def.toolset === "scs" ? "scs" : "harness");
    const baseUrl = resolveProductBaseUrl(this.config, product);
    const productHeaders: Record<string, string> = { ...spec.headers };
    if (product === "fme") {
      productHeaders["Authorization"] = `Bearer ${this.config.HARNESS_API_KEY}`;
    }

    const requestOpts = {
      method: spec.method,
      path,
      params,
      body,
      ...(baseUrl ? { baseUrl } : {}),
      ...(Object.keys(productHeaders).length > 0 ? { headers: productHeaders } : {}),
      ...(spec.responseType ? { responseType: spec.responseType } : {}),
      ...(product !== "harness" ? { product } : {}),
      ...(spec.headerBasedScoping || def.headerBasedScoping ? { headerBasedScoping: true } : {}),
      signal,
    };

    // ELK→Mongo fallback: when elkFallback is enabled, try Elasticsearch first.
    // On server-side failure (5xx / timeout), retry against MongoDB.
    let raw: unknown;
    let dataSource: "elasticsearch" | "mongodb" | undefined;
    if (spec.elkFallback) {
      try {
        raw = await client.request({ ...requestOpts, params: { ...params, enforce_elasticsearch: "true" } });
        dataSource = "elasticsearch";
      } catch (elkErr: unknown) {
        const isApiError = elkErr instanceof HarnessApiError;
        // Fall back to MongoDB on any server error (5xx), timeout (408),
        // or client error (4xx) — a 404 often means the ES index doesn't
        // exist yet for this account, and a 400 may be ES-specific.
        // Only auth failures (401/403) are re-thrown immediately.
        const status = isApiError ? elkErr.statusCode : 0;
        const isRetryable = status >= 400 && status !== 401 && status !== 403;
        if (isRetryable) {
          log.warn(`ELK query failed for ${def.resourceType} (${status}); falling back to MongoDB`);
          raw = await client.request({ ...requestOpts, params: { ...params, enforce_elasticsearch: "false" } });
          dataSource = "mongodb";
        } else {
          throw elkErr;
        }
      }
    } else {
      raw = await client.request(requestOpts);
    }

    // Extract response
    let result = spec.responseExtractor ? spec.responseExtractor(raw) : raw;

    // Tag ELK/Mongo data source on the response when fallback is active
    if (dataSource && result && typeof result === "object" && !Array.isArray(result)) {
      (result as Record<string, unknown>)._data_source = dataSource;
    }

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
          value = this.config.HARNESS_ORG;
        } else if (!value && pathPlaceholder === "project") {
          value = this.config.HARNESS_PROJECT;
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
          // Check top-level first
          value = resultRecord[pathParamName] ?? resultRecord.identifier;
          if (!value) {
            // Look for identifier in any nested object that has an 'identifier' field
            // This handles wrapped responses like {service: {identifier: "..."}}, {environment: {...}}, etc.
            for (const key of Object.keys(resultRecord)) {
              const nested = resultRecord[key];
              if (nested && typeof nested === "object" && !Array.isArray(nested)) {
                const nestedObj = nested as Record<string, unknown>;
                if ("identifier" in nestedObj) {
                  value = nestedObj[pathParamName] ?? nestedObj.identifier;
                  if (value) break;
                }
              }
            }
          }
        }
        if (value) {
          baseLinkParams[pathParamName] = String(value);
        }
      }
      // Resolve remaining {placeholder} tokens directly from response fields.
      // This covers cases where the API response field name differs from the
      // pathParams mapping (e.g. PR responses return "number" not "prNumber").
      const remaining = def.deepLinkTemplate.match(/\{(\w+)\}/g);
      if (remaining) {
        for (const token of remaining) {
          const key = token.slice(1, -1);
          if (key === "accountId" || baseLinkParams[key]) continue;
          if (resultRecord[key] !== undefined) {
            baseLinkParams[key] = String(resultRecord[key]);
          }
        }
      }

      // Only attach top-level openInHarness for single-item results (get/create/update),
      // not for list results where there's no single entity to link to.
      const r = result as Record<string, unknown>;
      const isList = LIST_ARRAY_KEYS.some(
        (key) => Array.isArray(r[key])
      );
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
      // Handle various list array keys used by different APIs
      let listArray: unknown[] | undefined;
      for (const key of LIST_ARRAY_KEYS) {
        const arr = (result as Record<string, unknown>)[key];
        if (Array.isArray(arr)) {
          listArray = arr;
          break;
        }
      }
      if (listArray) {
        for (const item of listArray) {
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
              } else if (itemRecord.name !== undefined) {
                // Some APIs use "name" as the identifier (e.g., registry)
                itemLinkParams[pathParamName] = String(itemRecord.name);
              } else {
                // Check for nested wrapper objects (e.g., connector.identifier, service.identifier)
                // Common wrapper keys used by Harness NG APIs
                const wrapperKeys = ["connector", "service", "environment", "secret", "role", "resourceGroup", "pipeline", "template", "artifact", "organization", "project"];
                for (const wrapperKey of wrapperKeys) {
                  const nested = itemRecord[wrapperKey];
                  if (nested && typeof nested === "object") {
                    const nestedRecord = nested as Record<string, unknown>;
                    if (nestedRecord[pathParamName] !== undefined) {
                      itemLinkParams[pathParamName] = String(nestedRecord[pathParamName]);
                      break;
                    } else if (nestedRecord.identifier !== undefined) {
                      itemLinkParams[pathParamName] = String(nestedRecord.identifier);
                      break;
                    }
                  }
                }
              }
            }

            // Also resolve any remaining placeholders directly from item fields
            // (e.g., pipelineIdentifier, registryIdentifier that aren't in identifierFields)
            const placeholderRegex = /\{(\w+)\}/g;
            let match;
            while ((match = placeholderRegex.exec(def.deepLinkTemplate)) !== null) {
              const placeholder = match[1];
              if (placeholder && !itemLinkParams[placeholder] && itemRecord[placeholder] !== undefined) {
                itemLinkParams[placeholder] = String(itemRecord[placeholder]);
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
          relatedResources: r.relatedResources ?? undefined,
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
      else if (def.searchAliases?.some(a => a.toLowerCase() === q)) score = 95;
      else if (def.searchAliases?.some(a => a.toLowerCase().includes(q) || q.includes(a.toLowerCase()))) score = 90;
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
          ...(r.searchAliases?.length ? { aliases: r.searchAliases } : {}),
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
