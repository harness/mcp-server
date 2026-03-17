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
  | "intelligence"
  | "visualizations";

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
  /** For POST/PUT: how to build the request body from tool input */
  bodyBuilder?: (input: Record<string, unknown>) => unknown;
  /** Static headers to merge into the request (e.g. Content-Type override) */
  headers?: Record<string, string>;
  /** For GET: extract the useful part from the raw response */
  responseExtractor?: (raw: unknown) => unknown;
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
   * Override base URL for this resource. Set to "fme" to use HARNESS_FME_BASE_URL
   * (Split.io API at https://api.split.io) instead of HARNESS_BASE_URL.
   */
  baseUrlOverride?: "fme";
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
