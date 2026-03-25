/**
 * Core types for the resource registry and dispatch system.
 */

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type ToolsetName =
  | "pipelines"
  | "services"
  | "environments"
  | "infrastructure"
  | "connectors"
  | "secrets"
  | "logs"
  | "audit"
  | "delegates"
  | "repositories"
  | "registries"
  | "templates"
  | "dashboards"
  | "idp"
  | "pull-requests"
  | "feature-flags"
  | "gitops"
  | "chaos"
  | "ccm"
  | "sei"
  | "scs"
  | "sto"
  | "access_control"
  | "settings"
  | "platform"

  | "visualizations"
  | "governance"
  | "freeze"
  | "overrides";

export type ProductName = "harness" | "fme";

export type OperationName = "list" | "get" | "create" | "update" | "delete";

/**
 * Lightweight field descriptor for body schemas.
 * Pure data (not Zod) — serializable to JSON for harness_describe output.
 */
export interface BodyFieldSpec {
  /** Field name as the API expects it */
  name: string;
  /** Data type hint */
  type: "string" | "number" | "boolean" | "object" | "array" | "yaml";
  /** Whether the field is required for the operation to succeed */
  required: boolean;
  /** Brief description (shown to agents) */
  description: string;
  /** For "object" type: nested fields */
  fields?: BodyFieldSpec[];
  /** For "array" type: item type description */
  itemType?: string;
}

/**
 * Body schema for a write operation (create/update/execute action).
 * Advisory — bodyBuilder still does actual transformation.
 */
export interface BodySchema {
  /** Brief description of what the body represents */
  description: string;
  /** The fields the body expects */
  fields: BodyFieldSpec[];
}

/**
 * Descriptor for a filter field that can be used in list operations.
 */
export interface FilterFieldSpec {
  /** Field name as it appears in the API */
  name: string;
  /** Human-readable description for LLMs */
  description: string;
  /** Value type — defaults to "string" when omitted */
  type?: "string" | "number" | "boolean";
  /** Allowed values, if the field is constrained to a known set */
  enum?: string[];
  /** When true, this filter is mandatory for the list operation to succeed.
   *  The registry validates required filters before making the API call. */
  required?: boolean;
}

/**
 * Declarative rule for expanding shorthand input keys into full nested structures.
 * Applied before runtime input resolution so the template matcher sees the expanded form.
 */
export interface InputExpansionRule {
  /** Input key that triggers the expansion (e.g. "branch", "tag") */
  triggerKey: string;
  /** Structure to merge into inputs. Use "$value" as placeholder for the trigger key's value. */
  expand: Record<string, unknown>;
  /** If set, skip expansion when user already provided this key (prevents double-expand). */
  skipIfPresent?: string;
}

/**
 * Config type for pathBuilder (avoids circular import).
 */
export type PathBuilderConfig = { HARNESS_ACCOUNT_ID?: string; HARNESS_DEFAULT_ORG_ID?: string; HARNESS_DEFAULT_PROJECT_ID?: string };

/**
 * Specifies how a single CRUD operation maps to the Harness API.
 */
export interface EndpointSpec {
  method: HttpMethod;
  /** Path template, e.g. "/pipeline/api/pipelines/{pipelineIdentifier}". Ignored when pathBuilder is set. */
  path: string;
  /** Optional dynamic path builder. When set, used instead of path + pathParams for account-scoped or multi-endpoint resources. */
  pathBuilder?: (input: Record<string, unknown>, config: PathBuilderConfig) => string;
  /** Maps tool input field names to path param placeholders */
  pathParams?: Record<string, string>;
  /** Maps tool input field names to query param names */
  queryParams?: Record<string, string>;
  /** Static query parameters always included in the request (not derived from input) */
  staticQueryParams?: Record<string, string>;
  /** Default query params to include if not overridden by input */
  defaultQueryParams?: Record<string, string>;
  /** Override default scope query param names (e.g. for APIs using snake_case) */
  scopeParams?: { account?: string; org?: string; project?: string };
  /** For POST/PUT: how to build the request body from tool input */
  bodyBuilder?: (input: Record<string, unknown>) => unknown;
  /** Static headers to merge into the request (e.g. Content-Type override) */
  headers?: Record<string, string>;
  /** For GET: extract the useful part from the raw response */
  responseExtractor?: (raw: unknown) => unknown;
  /** Request binary (ArrayBuffer) response instead of JSON. Used for ZIP download endpoints. */
  responseType?: "json" | "buffer";
  /** Description shown in harness_describe output */
  description?: string;
  /** Optional body schema for write operations — exposed via harness_describe */
  bodySchema?: BodySchema;
  /**
   * When the bodyBuilder wraps user fields inside a single key
   * (e.g. `{ project: { identifier, name } }`), set this to the wrapper key
   * so required-field validation checks the inner object, not the wrapper.
   */
  bodyWrapperKey?: string;
  /**
   * When true, block the operation if user confirmation cannot be obtained
   * (e.g. elicitation unavailable). Used for high-risk operations like
   * protection rules. Default: false (create/update proceed without confirmation).
   */
  blockWithoutConfirmation?: boolean;
  /**
   * Declarative input expansion rules. When present, matching shorthand keys
   * in user input are expanded into full nested structures before resolution.
   */
  inputExpansions?: InputExpansionRule[];
  /** When true, the API uses 1-based pagination. The registry adds 1 to the
   *  0-based `page` value from harness_list before sending the request. */
  pageOneIndexed?: boolean;
  /** When an API error message matches one of these patterns, return an empty
   *  list/result instead of throwing. Useful for backends that return 500 for
   *  "no data" scenarios (e.g. disconnected GitOps agent). */
  emptyOnErrorPatterns?: RegExp[];
  /** When true, omit the automatic `accountIdentifier` query param from the
   *  request URL. Some APIs (e.g. SEI) use only the `Harness-Account` header. */
  headerBasedScoping?: boolean;
  /**
   * When true, inject `accountIdentifier` from config into the POST/PUT request body.
   * Required for gRPC-gateway APIs (e.g. GitOps) where `body: "*"` means the entire
   * JSON body IS the proto message — query-param-only accountIdentifier is invisible
   * to the handler.
   */
  injectAccountInBody?: boolean;
}

/**
 * Declarative definition of a Harness resource type and how it maps to CRUD endpoints.
 */
export interface ResourceDefinition {
  /** Unique key: "pipeline", "service", "connector", etc. */
  resourceType: string;
  /** Human-readable name: "Pipeline", "Service", etc. */
  displayName: string;
  /** Brief description for harness_describe output */
  description: string;
  /** Which toolset this resource belongs to (for HARNESS_TOOLSETS filtering) */
  toolset: ToolsetName;
  /** Scope level: "project" | "org" | "account" */
  scope: "project" | "org" | "account";
  /**
   * When true, org/project params are only added if explicitly provided in input.
   * Use for resources that support multiple scopes (e.g., Harness Code repos/PRs
   * which can be account, org, or project scoped depending on where they live).
   * Default: false (scope params always added based on `scope` field).
   */
  scopeOptional?: boolean;
  /**
   * Override default scope query parameter names.
   * Standard NG API uses orgIdentifier / projectIdentifier.
   * Some APIs (e.g., Chaos) use organizationIdentifier instead.
   * STO uses accountId / orgId / projectId.
   * When `account` is set, an additional account param is injected from config.
   */
  scopeParams?: { account?: string; org?: string; project?: string };
  /** Primary identifier field names: ["pipeline_id"], ["service_id"], etc. */
  identifierFields: string[];
  /** Additional filter fields for list operations */
  listFilterFields?: FilterFieldSpec[];
  /** Harness UI deep-link URL template */
  deepLinkTemplate?: string;
  /** Troubleshooting guidance for LLMs. Describes how to diagnose issues with this resource type. */
  diagnosticHint?: string;
  /** Execution guidance for LLMs. Describes how to discover and provide runtime inputs. */
  executeHint?: string;
  /** CRUD endpoint mappings */
  operations: Partial<Record<OperationName, EndpointSpec>>;
  /** Execute action mappings (e.g. run pipeline, toggle FF) */
  executeActions?: Record<string, EndpointSpec & { actionDescription: string }>;
  /**
   * Product backend for this resource. Defaults to "harness" (uses HARNESS_BASE_URL).
   * Set to "fme" to use the Split.io API at https://api.split.io.
   */
  product?: ProductName;
  baseUrlOverride?: "fme";
  /**
   * When true, this resource uses header-based scoping (Harness-Account header)
   * instead of the standard `accountIdentifier` query param. Also prevents
   * automatic org/project injection into POST/PUT request bodies.
   * Used by SEI APIs which scope entirely via headers and query params.
   */
  headerBasedScoping?: boolean;
}

/**
 * A toolset groups related ResourceDefinitions together.
 */
export interface ToolsetDefinition {
  name: ToolsetName;
  displayName: string;
  description: string;
  resources: ResourceDefinition[];
}
