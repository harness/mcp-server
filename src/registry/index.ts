import { randomUUID } from "node:crypto";
import { type Config, resolveFmeApiKey, resolveProductBaseUrl } from "../config.js";
import type { HarnessClient } from "../client/harness-client.js";
import { HarnessApiError } from "../utils/errors.js";
import type { ResourceDefinition, ToolsetDefinition, ToolsetName, OperationName, EndpointSpec, FilterFieldSpec, ResourceScope } from "./types.js";
import type { AuditManager } from "../audit/manager.js";
import type { AuditContext, AuditEvent } from "../audit/types.js";
import { createLogger } from "../utils/logger.js";
import { buildDeepLink, appendStoreType } from "../utils/deep-links.js";
import { isFormDataBody } from "../utils/type-guards.js";

// Import all toolsets
import { pipelinesToolset } from "./toolsets/pipelines.js";
import { agentsToolset } from "./toolsets/agents.js";
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
import { dbopsToolset } from "./toolsets/dbops.js";
import { accessControlToolset } from "./toolsets/access-control.js";
import { settingsToolset } from "./toolsets/settings.js";
import { platformToolset } from "./toolsets/platform.js";
import { fileStoreToolset } from "./toolsets/file-store.js";

import { visualizationsToolset } from "./toolsets/visualizations.js";
import { governanceToolset } from "./toolsets/governance.js";
import { freezeToolset } from "./toolsets/freeze.js";
import { overridesToolset } from "./toolsets/overrides.js";
import { aiEvalsToolset } from "./toolsets/ai-evals.js";
import { iacmToolset } from "./toolsets/iacm.js";
import { ansibleToolset } from "./toolsets/ansible.js";

const log = createLogger("registry");

/** Keys under which different Harness APIs return list arrays. */
const LIST_ARRAY_KEYS = ["items", "features", "content", "data", "objects"];
const RESOURCE_SCOPES: readonly ResourceScope[] = ["account", "org", "project"];

/** Backward-compatible aliases for renamed public toolset names. */
const TOOLSET_ALIASES: Record<string, string> = {
  "agent-pipelines": "agents",
};

function isResourceScope(value: unknown): value is ResourceScope {
  return typeof value === "string" && RESOURCE_SCOPES.includes(value as ResourceScope);
}

function getSupportedScopes(def: ResourceDefinition): readonly ResourceScope[] {
  if (def.supportedScopes?.length) {
    return def.supportedScopes;
  }
  return [def.scope];
}

function getRequestedScope(def: ResourceDefinition, input: Record<string, unknown>): ResourceScope | undefined {
  const value = input.resource_scope;
  if (value === undefined || value === "") {
    return undefined;
  }
  if (!isResourceScope(value)) {
    throw new Error(`Invalid resource_scope "${String(value)}". Expected one of: ${RESOURCE_SCOPES.join(", ")}`);
  }
  const supported = getSupportedScopes(def);
  if (!supported.includes(value)) {
    throw new Error(
      `${def.resourceType} does not support ${value} scope. Supported scopes: ${supported.join(", ")}`,
    );
  }
  return value;
}

function shouldUseOrg(scope: ResourceScope): boolean {
  return scope === "org" || scope === "project";
}

function shouldUseProject(scope: ResourceScope): boolean {
  return scope === "project";
}

interface ExplicitScopeValues {
  orgId?: string;
  projectId?: string;
}

function resolveScopeString(value: unknown, fallback: string | undefined): string | undefined {
  if (typeof value === "string" && value !== "") {
    return value;
  }
  return fallback && fallback !== "" ? fallback : undefined;
}

function getExplicitScopeValues(scope: ResourceScope, input: Record<string, unknown>, config: Config): ExplicitScopeValues {
  const orgId = resolveScopeString(input.org_id, config.HARNESS_ORG);
  const projectId = resolveScopeString(input.project_id, config.HARNESS_PROJECT);

  if (shouldUseOrg(scope) && !orgId) {
    throw new Error(`resource_scope "${scope}" requires org_id or HARNESS_ORG.`);
  }
  if (shouldUseProject(scope) && !projectId) {
    throw new Error(`resource_scope "${scope}" requires project_id or HARNESS_PROJECT.`);
  }

  return { orgId, projectId };
}

const ALL_TOOLSETS: ToolsetDefinition[] = [
  pipelinesToolset,
  agentsToolset,
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
  dbopsToolset,
  accessControlToolset,
  settingsToolset,
  platformToolset,
  fileStoreToolset,

  visualizationsToolset,
  governanceToolset,
  freezeToolset,
  overridesToolset,
  aiEvalsToolset,
  iacmToolset,
  ansibleToolset,
];

/** All available toolset names — used by docs generation to discover opt-in toolsets. */
export const ALL_TOOLSET_NAMES: string[] = ALL_TOOLSETS.map((t) => t.name);

/**
 * Options for extending the Registry with additional toolsets.
 */
export interface RegistryOptions {
  additionalToolsets?: ToolsetDefinition[];
  /**
   * Optional callback that resolves the effective account ID for the current
   * request.  Used by multi-tenant deployments (internal HTTP mode) where the
   * account ID varies per request and is not known at startup.
   * When provided, `registry.getAccountId()` calls this first and falls back
   * to `config.HARNESS_ACCOUNT_ID` if it returns `undefined`.
   */
  accountIdResolver?: () => string | undefined;
  /** When provided, every dispatch emits an AuditEvent to all registered sinks. */
  auditManager?: AuditManager;
}

/**
 * The enabled registry — filtered by HARNESS_TOOLSETS config.
 */
export class Registry {
  private resourceMap: Map<string, ResourceDefinition> = new Map();
  private toolsets: ToolsetDefinition[] = [];
  private accountIdResolver?: () => string | undefined;
  private auditManager?: AuditManager;

  constructor(private config: Config, options: RegistryOptions = {}) {
    this.accountIdResolver = options.accountIdResolver;
    this.auditManager = options.auditManager;
    const allToolsets = [...ALL_TOOLSETS, ...(options.additionalToolsets ?? [])];
    const enabledNames = this.parseToolsetFilter(allToolsets);
    this.toolsets = enabledNames
      ? allToolsets.filter((t) => enabledNames.has(t.name))
      : allToolsets.filter((t) => !t.optIn);

    for (const toolset of this.toolsets) {
      for (const resource of toolset.resources) {
        this.resourceMap.set(resource.resourceType, resource);
      }
    }

    log.info(`Registry loaded: ${this.resourceMap.size} resource types from ${this.toolsets.length} toolsets`, {
      defaultPipelineVersion: this.config.HARNESS_PIPELINE_VERSION ?? "0",
    });
  }

  getAccountId(): string {
    return this.accountIdResolver?.() ?? this.config.HARNESS_ACCOUNT_ID;
  }

  /**
   * Parse HARNESS_TOOLSETS env var. Supports three modes:
   *
   *  - Explicit list:    "pipelines,services"         → only those toolsets
   *  - Additive (+):     "+ai-evals"                  → defaults + ai-evals
   *  - Subtractive (-):  "-chaos,-ccm"                → defaults minus chaos & ccm
   *  - Mixed +/-:        "+ai-evals,-chaos"            → defaults + ai-evals - chaos
   *
   * Returns `null` when the value is empty (meaning "all defaults").
   * Returns `"defaults"` when +/- modifiers are used (caller applies them).
   */
  private parseToolsetFilter(allToolsets: ToolsetDefinition[]): Set<string> | null {
    const raw = this.config.HARNESS_TOOLSETS;
    if (!raw || raw.trim() === "") return null;

    const validNames = new Set<string>(allToolsets.map((t) => t.name));
    const parsed = raw.split(",").map((s) => s.trim()).filter(Boolean);

    const hasModifiers = parsed.some((s) => s.startsWith("+") || s.startsWith("-"));

    if (hasModifiers) {
      const defaults = new Set(allToolsets.filter((t) => !t.optIn).map((t) => t.name));
      const invalid: string[] = [];

      for (const token of parsed) {
        const op = token[0];
        const rawName = (op === "+" || op === "-") ? token.slice(1) : token;
        const name = TOOLSET_ALIASES[rawName] ?? rawName;
        if (!validNames.has(name)) {
          invalid.push(rawName);
          continue;
        }
        if (op === "+") {
          defaults.add(name);
        } else if (op === "-") {
          defaults.delete(name);
        } else {
          defaults.add(name);
        }
      }

      if (invalid.length > 0) {
        const available = Array.from(validNames).sort().join(", ");
        throw new Error(
          `Invalid HARNESS_TOOLSETS: ${invalid.map((n) => `"${n}"`).join(", ")}. ` +
          `Valid toolset names: ${available}`,
        );
      }

      return defaults;
    }

    const valid: string[] = [];
    const invalid: string[] = [];

    for (const rawName of parsed) {
      const name = TOOLSET_ALIASES[rawName] ?? rawName;
      if (validNames.has(name)) {
        valid.push(name);
      } else {
        invalid.push(rawName);
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

  get orgId(): string | undefined { return this.config.HARNESS_ORG; }
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

  /** Get scopes supported by a resource for explicit resource_scope selection. */
  getSupportedScopes(resourceType: string): readonly ResourceScope[] {
    return getSupportedScopes(this.getResource(resourceType));
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
    signalOrAudit?: AbortSignal | AuditContext,
    signal?: AbortSignal,
  ): Promise<unknown> {
    const auditCtx = signalOrAudit instanceof AbortSignal ? undefined : signalOrAudit;
    const abortSignal = signalOrAudit instanceof AbortSignal ? signalOrAudit : signal;

    if (this.config.HARNESS_READ_ONLY && !Registry.READ_OPERATIONS.has(operation)) {
      throw new Error(`Read-only mode is enabled (HARNESS_READ_ONLY=true). "${operation}" operations are not allowed.`);
    }

    const def = this.getResource(resourceType);
    const spec = def.operations[operation];
    if (!spec) {
      const supported = Object.keys(def.operations).join(", ");
      throw new Error(`Resource "${resourceType}" does not support "${operation}". Supported: ${supported}`);
    }

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

    return this.executeSpecWithAudit(client, def, spec, operation, resourceType, input, auditCtx, abortSignal);
  }

  /** Dispatch an execute action to the Harness API. */
  async dispatchExecute(
    client: HarnessClient,
    resourceType: string,
    action: string,
    input: Record<string, unknown>,
    signalOrAudit?: AbortSignal | AuditContext,
    signal?: AbortSignal,
  ): Promise<unknown> {
    const auditCtx = signalOrAudit instanceof AbortSignal ? undefined : signalOrAudit;
    const abortSignal = signalOrAudit instanceof AbortSignal ? signalOrAudit : signal;

    const def = this.getResource(resourceType);
    const actionSpec = def.executeActions?.[action];
    if (!actionSpec) {
      const available = def.executeActions ? Object.keys(def.executeActions).join(", ") : "none";
      throw new Error(`Resource "${resourceType}" has no execute action "${action}". Available: ${available}`);
    }

    if (this.config.HARNESS_READ_ONLY && actionSpec.operationPolicy.risk !== "read") {
      throw new Error(`Read-only mode is enabled (HARNESS_READ_ONLY=true). Execute action "${action}" is not allowed.`);
    }

    return this.executeSpecWithAudit(client, def, actionSpec, "execute", resourceType, input, { ...auditCtx, tool: auditCtx?.tool ?? "harness_execute", action }, abortSignal);
  }

  /**
   * Wraps executeSpec with timing and audit event emission.
   */
  private async executeSpecWithAudit(
    client: HarnessClient,
    def: ResourceDefinition,
    spec: EndpointSpec,
    operation: string,
    resourceType: string,
    input: Record<string, unknown>,
    auditCtx?: AuditContext,
    signal?: AbortSignal,
  ): Promise<unknown> {
    if (!this.auditManager) {
      return this.executeSpec(client, def, spec, input, signal);
    }

    const startTime = Date.now();
    try {
      const result = await this.executeSpec(client, def, spec, input, signal);
      this.emitAuditEvent(def, spec, operation, resourceType, input, auditCtx, "success", Date.now() - startTime);
      return result;
    } catch (err) {
      const httpStatus = err instanceof HarnessApiError ? err.statusCode : undefined;
      this.emitAuditEvent(def, spec, operation, resourceType, input, auditCtx, "error", Date.now() - startTime, String(err), httpStatus);
      throw err;
    }
  }

  private emitAuditEvent(
    def: ResourceDefinition,
    spec: EndpointSpec,
    operation: string,
    resourceType: string,
    input: Record<string, unknown>,
    auditCtx: AuditContext | undefined,
    outcome: "success" | "error",
    durationMs: number,
    error?: string,
    httpStatus?: number,
  ): void {
    if (!this.auditManager) return;
    const auditScope = isResourceScope(input.resource_scope) ? input.resource_scope : undefined;

    // Resolve path using pathBuilder if present, otherwise use static path
    const resolvedPath = spec.pathBuilder
      ? spec.pathBuilder(input, { HARNESS_ACCOUNT_ID: this.getAccountId(), HARNESS_ORG: this.config.HARNESS_ORG, HARNESS_PROJECT: this.config.HARNESS_PROJECT })
      : spec.path;

    const event: AuditEvent = {
      event_id: randomUUID(),
      timestamp: new Date().toISOString(),
      tool: auditCtx?.tool ?? `harness_${operation}`,
      operation,
      resource_type: resourceType,
      resource_id: auditCtx?.resource_id ?? (input.resource_id as string | undefined),
      action: auditCtx?.action,
      org_id: auditScope
        ? shouldUseOrg(auditScope)
          ? (input.org_id as string | undefined) ?? this.config.HARNESS_ORG
          : undefined
        : def.scope === "account"
          ? undefined
          : (input.org_id as string | undefined) ?? (def.scopeOptional ? undefined : this.config.HARNESS_ORG),
      project_id: auditScope
        ? shouldUseProject(auditScope)
          ? (input.project_id as string | undefined) ?? this.config.HARNESS_PROJECT
          : undefined
        : def.scope === "account" || def.scope === "org"
          ? undefined
          : (input.project_id as string | undefined) ?? (def.scopeOptional ? undefined : this.config.HARNESS_PROJECT),
      account_id: this.getAccountId(),
      risk: spec.operationPolicy?.risk ?? "read",
      confirmation: auditCtx?.confirmation,
      outcome,
      duration_ms: durationMs,
      http_method: spec.method,
      http_path: resolvedPath,
      ...(error ? { error } : {}),
      ...(httpStatus ? { http_status: httpStatus } : {}),
    };

    this.auditManager.emit(event);
  }

  private async executeSpec(
    client: HarnessClient,
    def: ResourceDefinition,
    spec: EndpointSpec,
    input: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<unknown> {
    const resolvedAccountId = this.getAccountId();
    const resolvedConfig: Config = { ...this.config, HARNESS_ACCOUNT_ID: resolvedAccountId };
    const requestedScope = getRequestedScope(def, input);
    const explicitScopeValues = requestedScope ? getExplicitScopeValues(requestedScope, input, this.config) : undefined;
    const pathDefaultScope = requestedScope ?? def.scope;

    // Run preflight hook (e.g. duplicate-check before create) before hitting the API.
    if (spec.preflight) {
      await spec.preflight({ client, input, registry: this, signal });
    }

    // When explicit resource_scope resolved org/project from config defaults,
    // merge them into input so pathBuilder functions see the effective values.
    // Only inject for scopes that actually use those params.
    if (requestedScope && explicitScopeValues) {
      if (shouldUseOrg(requestedScope) && explicitScopeValues.orgId && !input.org_id) input = { ...input, org_id: explicitScopeValues.orgId };
      if (shouldUseProject(requestedScope) && explicitScopeValues.projectId && !input.project_id) input = { ...input, project_id: explicitScopeValues.projectId };
    }

    // Build path with substitutions (or pathBuilder when present)
    let path: string;
    if (spec.pathBuilder) {
      path = spec.pathBuilder(input, resolvedConfig);
    } else {
      path = spec.path;
      if (spec.pathParams) {
        for (const [inputKey, pathPlaceholder] of Object.entries(spec.pathParams)) {
          let value = input[inputKey];
          if (value === undefined || value === "") {
            // Default scope placeholders from config for project/org-scoped resources
            if (pathPlaceholder === "org" && shouldUseOrg(pathDefaultScope)) {
              value = explicitScopeValues?.orgId ?? this.config.HARNESS_ORG;
            } else if (pathPlaceholder === "project" && shouldUseProject(pathDefaultScope)) {
              value = explicitScopeValues?.projectId ?? this.config.HARNESS_PROJECT;
            }
          }
          if (value === undefined || value === "") {
            const supportedScopes = getSupportedScopes(def);
            const scopeHint = supportedScopes.length > 1
              ? ` This resource supports ${supportedScopes.join("/")} scope — pass "${inputKey}" via params, set resource_scope appropriately, or use a Harness URL.`
              : "";
            throw new Error(
              `Missing required field "${inputKey}" for ${def.resourceType}.${scopeHint}`,
            );
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
    if (requestedScope) {
      // Explicit resource scoping: account omits org/project, org injects org only, project injects both.
      if (shouldUseOrg(requestedScope)) {
        params[orgParam] = explicitScopeValues?.orgId;
      }
      if (shouldUseProject(requestedScope)) {
        params[projectParam] = explicitScopeValues?.projectId;
      }
    } else if (def.scopeOptional) {
      // Dynamic scoping: only inject when caller explicitly provides them.
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
      params[def.scopeParams.account] = resolvedAccountId;
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

    // Resolve HTTP method — methodBuilder overrides static method when present.
    const resolvedMethod = spec.methodBuilder ? spec.methodBuilder(input) : spec.method;

    // Inject orgIdentifier/projectIdentifier into the body for mutating operations (POST/PUT).
    // Harness NG APIs require these in the body (not just query params) to scope the resource correctly.
    // Header-scoped APIs and explicit endpoint exceptions scope through headers/path/query and reject
    // generic NG scope fields in their API-specific JSON bodies. Multipart bodies carry scope in
    // query params and must not be mutated as plain JSON.
    const shouldSkipScopeBodyInjection =
      spec.skipScopeBodyInjection || spec.headerBasedScoping || def.headerBasedScoping;
    if (
      body &&
      typeof body === "object" &&
      !isFormDataBody(body) &&
      !shouldSkipScopeBodyInjection &&
      (resolvedMethod === "POST" || resolvedMethod === "PUT")
    ) {
      const bodyRecord = body as Record<string, unknown>;
      // Determine where to inject: inside wrapper if present, otherwise at top level
      const targetRecord = spec.bodyWrapperKey && 
        bodyRecord[spec.bodyWrapperKey] && 
        typeof bodyRecord[spec.bodyWrapperKey] === "object"
          ? (bodyRecord[spec.bodyWrapperKey] as Record<string, unknown>)
          : bodyRecord;
      // Only inject account ID when the endpoint explicitly requires it
      // (gRPC-gateway APIs with body:"*" need it in the body, not just query params)
      // When injectAccountInBody is a string, use it as the field name (e.g. "accountId" for CCM APIs).
      if (spec.injectAccountInBody && resolvedAccountId) {
        const accountField = typeof spec.injectAccountInBody === "string" ? spec.injectAccountInBody : "accountIdentifier";
        if (!targetRecord[accountField]) {
          targetRecord[accountField] = resolvedAccountId;
        }
      }
      if (params.orgIdentifier && !targetRecord.orgIdentifier) {
        targetRecord.orgIdentifier = params.orgIdentifier;
      }
      if (params.projectIdentifier && !targetRecord.projectIdentifier) {
        targetRecord.projectIdentifier = params.projectIdentifier;
      }
    }

    // Validate required fields if bodySchema is defined.
    // When the API body is transformed into a raw array, validate the caller's
    // canonical object-shaped input body so registry behavior matches harness_describe.
    // Multipart validation is enforced inside the resource bodyBuilder.
    if (spec.bodySchema && body && typeof body === "object" && !isFormDataBody(body)) {
      const payload = this.getBodySchemaValidationPayload(spec, input, body);
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
    const product = def.product ?? "harness";
    const baseUrl = resolveProductBaseUrl(this.config, product);
    const productHeaders: Record<string, string> = { ...spec.headers };
    if (product === "fme") {
      const fmeApiKey = resolveFmeApiKey(this.config);
      if (!fmeApiKey) {
        const remediation = this.config.HARNESS_MCP_MODE === "multi-user"
          ? "Ensure the session x-harness-api-key is an FME-entitled Harness PAT/SAT. " +
            "Do not configure HARNESS_FME_API_KEY in multi-user mode."
          : "Ask your Harness administrator to configure an FME/Split Admin credential for hosted MCP, " +
            "or set HARNESS_FME_API_KEY to a legacy Split admin key or FME-entitled Harness PAT/SAT. " +
            "Self-hosted sessions may also provide a non-placeholder HARNESS_API_KEY.";
        throw new HarnessApiError(
          "FME is not configured or authorized for this MCP session. " +
          `${remediation} ` +
          "Hosted OAuth placeholders such as \"dummy\" are not sent to api.split.io.",
          401,
          "FME_AUTH_MISSING",
        );
      }
      productHeaders["Authorization"] = `Bearer ${fmeApiKey}`;
    }

    const requestOpts = {
      method: resolvedMethod,
      path,
      params,
      body,
      ...(baseUrl ? { baseUrl } : {}),
      ...(Object.keys(productHeaders).length > 0 ? { headers: productHeaders } : {}),
      ...(spec.responseType ? { responseType: spec.responseType } : {}),
      ...(product !== "harness" ? { product } : {}),
      ...(spec.headerBasedScoping || def.headerBasedScoping ? { headerBasedScoping: true } : {}),
      ...(spec.operationPolicy?.retryPolicy ? { retryPolicy: spec.operationPolicy.retryPolicy } : {}),
      ...(!spec.pathBuilder ? { tracing: { route: spec.path } } : {}),
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
    let result = spec.responseExtractor ? spec.responseExtractor(raw, input) : raw;

    // Tag ELK/Mongo data source on the response when fallback is active
    if (dataSource && result && typeof result === "object" && !Array.isArray(result)) {
      result = Object.assign({}, result, { _data_source: dataSource });
    }

    // Propagate spec.skipCompact as a non-enumerable marker so the tool layer
    // can opt this result out of the global compactItems pass without leaking
    // the flag into the user-visible JSON output. Must be set AFTER any
    // Object.assign cloning so the marker survives.
    if (spec.skipCompact && result && typeof result === "object" && !Array.isArray(result)) {
      Object.defineProperty(result, "__skipCompact", { value: true, enumerable: false, configurable: true });
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

      // Ensure common deep link placeholders {org} and {project} are resolved
      // even when they aren't declared in pathParams (e.g. project list uses
      // queryParams for org scoping but the deep link template has {org}).
      // For list results, only use explicitly-provided values (not config defaults)
      // since each item may belong to a different org/project. Per-item resolution
      // will fill or override these from item fields.
      if (!baseLinkParams.org) {
        const orgValue = (params.orgIdentifier as string) || (input.org_id as string);
        if (orgValue) baseLinkParams.org = orgValue;
      }
      if (!baseLinkParams.project) {
        const projValue = (params.projectIdentifier as string) || (input.project_id as string);
        if (projValue) baseLinkParams.project = projValue;
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
        // For single-item results, apply config defaults for {org}/{project} if still unset
        if (!baseLinkParams.org && this.config.HARNESS_ORG) {
          baseLinkParams.org = this.config.HARNESS_ORG;
        }
        if (!baseLinkParams.project && this.config.HARNESS_PROJECT) {
          baseLinkParams.project = this.config.HARNESS_PROJECT;
        }
        try {
          let link = buildDeepLink(
            this.config.HARNESS_BASE_URL,
            resolvedAccountId,
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
              const rawValue = itemRecord[pathParamName];
              if (rawValue !== undefined && typeof rawValue !== "object") {
                itemLinkParams[pathParamName] = String(rawValue);
              } else if (itemRecord.identifier !== undefined && typeof itemRecord.identifier !== "object") {
                itemLinkParams[pathParamName] = String(itemRecord.identifier);
              } else if (itemRecord.name !== undefined && typeof itemRecord.name !== "object") {
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
                if (itemRecord[key] !== undefined && typeof itemRecord[key] !== "object") {
                  itemLinkParams[key] = String(itemRecord[key]);
                }
              }
            }

            // Resolve {org} and {project} from item fields, overriding baseLinkParams.
            // Each item may belong to a different org (e.g. account-scoped project list),
            // so the item's own orgIdentifier takes precedence over any default.
            const itemOrg = itemRecord.orgIdentifier ?? itemRecord.org;
            if (itemOrg && typeof itemOrg === "string") itemLinkParams.org = itemOrg;
            const itemProj = itemRecord.projectIdentifier ?? itemRecord.project ?? itemRecord.identifier;
            if (itemProj && typeof itemProj === "string") itemLinkParams.project = itemProj;

            let itemLink = buildDeepLink(
              this.config.HARNESS_BASE_URL,
              resolvedAccountId,
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

  private getBodySchemaValidationPayload(
    spec: EndpointSpec,
    input: Record<string, unknown>,
    body: object,
  ): Record<string, unknown> {
    if (Array.isArray(body)) {
      const inputBody = input.body;
      return inputBody && typeof inputBody === "object" && !Array.isArray(inputBody)
        ? (inputBody as Record<string, unknown>)
        : {};
    }

    const bodyRecord = body as Record<string, unknown>;
    return spec.bodyWrapperKey &&
      bodyRecord[spec.bodyWrapperKey] != null &&
      typeof bodyRecord[spec.bodyWrapperKey] === "object" &&
      !Array.isArray(bodyRecord[spec.bodyWrapperKey])
        ? (bodyRecord[spec.bodyWrapperKey] as Record<string, unknown>)
        : bodyRecord;
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
          supportedScopes: getSupportedScopes(r).length > 1 ? getSupportedScopes(r) : undefined,
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
