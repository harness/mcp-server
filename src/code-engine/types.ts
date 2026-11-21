/**
 * Core types for the universal Resource-as-Code inspection, preview, and patching engine.
 *
 * Pure data declarations (`ResourceCodeSpec`, `AddressableCollectionSpec`, `YamlTreeLevelSpec`)
 * are re-exported from `src/registry/types.ts` so declarative toolsets can opt in without
 * importing runtime logic.
 */

export type CodeFormat = "yaml" | "json" | "rego" | "antlr4";

export type DynamicExpressionFlavor = "harness_jexl" | "v1_expr" | "idp_param";

export interface AddressableCollectionSpec {
  /** Short logical segment name used in selectors, e.g. "stage", "step", "policy", "manifest". */
  segment: string;
  /** Dotted path from parent (or document root) to the array/map container, e.g. "pipeline.stages" or "policies". */
  path: string;
  /** Optional wrapper object key around each array element (e.g. "stage" or "step" in Harness v0 YAML). */
  itemWrapperKey?: string;
  /** Key field(s) used to match an item deterministically (never by array index). */
  keyFields: readonly string[];
  /** Optional display name field surfaced in outlines (e.g. "name", "title"). */
  labelField?: string;
  /** Optional type/kind field surfaced in outlines (e.g. "type", "severity"). */
  typeField?: string;
}

/**
 * Declarative grammar rule for hierarchical YAML trees (stages -> stepGroups -> steps,
 * phases -> activities, etc.) so new recursive resource structures require zero custom AST code.
 */
export interface YamlChildContainerRule {
  /** Dotted path from the current node to a child sequence, e.g. "stages" or "spec.execution.steps". */
  sequencePath: string;
  /** Wrapper keys that transparently group children without adding a selector level (e.g. ["parallel"]). */
  passThroughKeys?: readonly string[];
  /** Candidate node variants inside this sequence. Checked in order. */
  variants: readonly YamlNodeVariantRule[];
}

export interface YamlNodeVariantRule {
  /** Selector segment tag, e.g. "stage", "group", "step", "rollback_step". */
  segment: string;
  /** Optional single-key object wrapper around the item (e.g. "stage", "stepGroup", "step", "group"). */
  wrapperKey?: string;
  /** Fields checked in order to extract the node's unique ID (e.g. ["identifier"] or ["id", "identifier", "name"]). */
  idFields: readonly string[];
  /** Field(s) checked to determine `node_type` (or shorthand keys like ["run", "action", "template"]). */
  typeFields?: readonly string[];
  /** Shorthand presence keys that imply `node_type` when `type` field is absent (e.g. v1 ["run", "action", "approval"]). */
  shorthandTypeKeys?: readonly string[];
  /** Whether this variant can recursively contain the parent rule's `selfRecurseContainers` (e.g. stepGroup -> steps). */
  childContainers?: readonly YamlChildContainerRule[];
  /** When true, recurse using the enclosing sequence's variants (for arbitrarily nested `stepGroup` / `group`). */
  recurseSameLevelOn?: readonly {
    sequencePath: string;
    overrideSegment?: string;
  }[];
}

export interface YamlTreeGrammarSpec {
  /** Optional root wrapper key (e.g. "pipeline", "template", "process"). */
  rootWrapperKey?: string;
  /** Selector name for the root node (defaults to `rootWrapperKey ?? "root"`). */
  rootSegment?: string;
  /** ID fields on the root node. */
  rootIdFields?: readonly string[];
  /** Hierarchical sequence rules starting from the root map. */
  containers: readonly YamlChildContainerRule[];
}

/**
 * Pure-data Resource-as-Code specification attached to a `ResourceDefinition`
 * (or auto-inferred from `SCHEMAS`, `LIVE_ENTITY_SCHEMAS`, and `bodySchema`).
 * Must remain 100% JSON-serializable (no functions) — enforced by `pnpm standards:check`.
 */
export interface ResourceCodeSpec {
  /** Underlying code/document representation. */
  format: CodeFormat;
  /**
   * Dotted path(s) in the `harness_get` response where the authored code lives.
   * Checked in order; omit when the `harness_get` object itself is the structured JSON document.
   */
  sourcePaths?: readonly string[];
  /**
   * How a patched source document is placed into `input.body` for `harness_update`.
   */
  writeShape?:
    | "raw_string"
    | "root_object"
    | {
        field: string;
        carryFields?: readonly string[];
        carryFromPath?: string;
      };
  /** Schema reference used for pre-commit validation (synced automatically from upstream). */
  schemaRef?: {
    kind: "bundled" | "live_bundled";
    key: string;
  };
  /** Declarative hierarchical YAML tree grammar (used for recursive resources like pipelines/processes). */
  treeGrammar?: YamlTreeGrammarSpec;
  /** Declarative flat/nested keyed collections for deterministic selector resolution and outlines. */
  collections?: readonly AddressableCollectionSpec[];
  /** Dynamic expression syntaxes that require `replace_dynamic: true` before overwriting. */
  dynamicExpressions?: readonly DynamicExpressionFlavor[];
  /** Optional read-only `executeActions` key on the same resource for backend validation. */
  validateAction?: string;
}

// ---------------------------------------------------------------------------
// Pluggable Codec Contract (Open/Closed Principle for new formats)
// ---------------------------------------------------------------------------

export interface CodecInspectParams {
  rawDoc: unknown;
  sourceText?: string;
  codeSpec: ResourceCodeSpec;
  revPrefix: string;
  view: "outline" | "select";
  select?: string;
  cursor?: string;
  pageSize?: number;
}

export interface CodecInspectResult {
  nodes: InspectedNode[];
  totalNodes: number;
  truncated: boolean;
  nextCursor?: string;
}

export interface CodecPatchParams {
  rawDoc: unknown;
  sourceText?: string;
  codeSpec: ResourceCodeSpec;
  revPrefix: string;
  operations: readonly PatchOperation[];
}

export interface CodecPatchResult {
  patchedText?: string;
  patchedObject?: Record<string, unknown>;
  changes: FieldChangeSummary[];
  diagnostics: CodeDiagnostic[];
}

export interface CodeCodec {
  readonly format: CodeFormat;
  readonly supportsWrite: boolean;
  inspect(params: CodecInspectParams): CodecInspectResult;
  applyPatches?(params: CodecPatchParams): CodecPatchResult;
}

// ---------------------------------------------------------------------------
// Value Provenance & Inspection Output
// ---------------------------------------------------------------------------

export type ValueProvenance =
  | "literal"
  | "runtime_input"
  | "expression"
  | "template_input"
  | "template_owned"
  | "object"
  | "array"
  | "absent";

export interface ValueDescriptor {
  kind: ValueProvenance;
  value?: unknown;
  expression?: string;
  owning_template?: string;
}

export interface RevisionInfo {
  /** Compact revision token usable as `expected_revision`. */
  revision: string;
  /** SHA-256 hex digest of the authored source at read time. */
  sha256: string;
  /** Storage backing when known ("INLINE" | "REMOTE" | "API"). */
  source_kind?: "INLINE" | "REMOTE" | "API";
  /** Git object/blob SHA for REMOTE entities. */
  git_object_id?: string;
  /** Git commit SHA for REMOTE entities. */
  git_commit_id?: string;
  /** Git branch for REMOTE entities. */
  git_branch?: string;
  /** Backend entity version when present. */
  entity_version?: string | number;
}

export interface InspectedNode {
  /** Canonical selector string that uniquely addresses this node. */
  selector: string;
  /** Opaque revision-bound node reference (`nr_<revPrefix>_<selectorB64>`). */
  node_ref: string;
  /** Node category (e.g. "stage", "step", "step_group", "rule", "policy", "field", "section"). */
  kind: string;
  /** Identifier or key of the node. */
  id: string;
  /** Display name when present. */
  name?: string;
  /** Subtype (e.g. "Run", "Background", "CI", "Kubernetes", "deny"). */
  node_type?: string;
  /** Template metadata when backed by a Harness template. */
  template?: {
    template_ref: string;
    version_label?: string;
    editable_inputs?: string[];
  };
  /** Supported patch operations on this node. */
  supported_ops: readonly PatchOpName[];
  /** Summarized scalar/key fields with provenance (never unbounded nested blobs). */
  fields?: Record<string, ValueDescriptor>;
  /** For DSL/grammar blocks: bounded source snippet + block hash. */
  block?: {
    hash: string;
    lines: [number, number];
    source: string;
  };
  /** Child node count for outline mode. */
  children_count?: number;
}

export interface InspectResponse {
  resource_type: string;
  resource_id?: string;
  format: CodeFormat;
  view: "outline" | "select";
  revision: RevisionInfo;
  total_nodes: number;
  nodes: InspectedNode[];
  truncated?: boolean;
  next_cursor?: string;
}

// ---------------------------------------------------------------------------
// Patch Operations & Preview / Apply Output
// ---------------------------------------------------------------------------

export type PatchOpName = "set" | "unset" | "upsert_item" | "remove_item" | "replace_block";

export interface StructuredStepSelector {
  stage_id?: string;
  group_ids?: string[];
  step_id?: string;
  section?: "execution" | "rollback";
}

export type SelectorTarget =
  | string
  | { node_ref: string }
  | { selector: string | StructuredStepSelector };

export interface PatchOperation {
  op: PatchOpName;
  /** Target node selector (`"stage:CI/step:integration_tests"`, `"rule:deny"`, `{ node_ref }`, or `""` for root). */
  target?: SelectorTarget;
  /** Field path relative to the target node (required for `set` and `unset`; collection path for `upsert_item`/`remove_item`). */
  field?: string;
  /** New value for `set`, `upsert_item`, or `replace_block`. */
  value?: unknown;
  /** Key field name for `upsert_item` / `remove_item` (e.g. `"identifier"`, `"name"`). */
  key_field?: string;
  /** Key value to match for `upsert_item` / `remove_item`. */
  key_value?: string;
  /** Explicit scope when editing a template-backed node (`"local"` default vs `"template_input"`). */
  edit_scope?: "local" | "template_input";
  /** Must be `true` to overwrite a `<+input>`, `<+...>`, or `${{ ... }}` dynamic expression. */
  replace_dynamic?: boolean;
  /** Optional expected block hash for `replace_block` optimistic verification. */
  expected_hash?: string;
}

export type CodeEngineErrorCode =
  | "UNSUPPORTED_CODE_RESOURCE"
  | "INVALID_PATCH_OPERATION"
  | "TARGET_NOT_FOUND"
  | "TARGET_AMBIGUOUS"
  | "MATRIX_INSTANCE_UNSUPPORTED"
  | "FIELD_OWNED_BY_TEMPLATE"
  | "DYNAMIC_VALUE_REPLACEMENT_REQUIRED"
  | "ALIAS_TARGET_UNSAFE"
  | "OVERLAPPING_OPERATIONS"
  | "UNINTENDED_DIFF_DETECTED"
  | "VALIDATION_FAILED"
  | "POLICY_DENIED"
  | "REVISION_CONFLICT"
  | "PREVIEW_EXPIRED"
  | "PREVIEW_MISMATCH"
  | "IDEMPOTENCY_KEY_CONFLICT";

export interface CodeDiagnostic {
  code: CodeEngineErrorCode | string;
  severity: "error" | "warning" | "info";
  selector?: string;
  field?: string;
  message: string;
  remediation?: string;
  candidates?: string[];
}

export interface FieldChangeSummary {
  target: string;
  field: string;
  op: PatchOpName;
  before: ValueDescriptor;
  after: ValueDescriptor;
  source: "authored" | "template_input" | "dsl_block";
}

export interface PreviewEditResponse {
  status: "ready" | "no_change" | "preview_only" | "invalid";
  resource_type: string;
  resource_id: string;
  base_revision: RevisionInfo;
  candidate_sha256?: string;
  preview_token?: string;
  expires_at?: string;
  changes: FieldChangeSummary[];
  diagnostics: CodeDiagnostic[];
}

export interface ApplyEditResponse {
  status: "applied";
  resource_type: string;
  resource_id: string;
  base_revision: string;
  committed_revision: RevisionInfo;
  changes: FieldChangeSummary[];
  diagnostics: CodeDiagnostic[];
  replayed?: boolean;
  result?: unknown;
}

export class CodeEngineError extends Error {
  readonly code: CodeEngineErrorCode;
  readonly diagnostics: CodeDiagnostic[];

  constructor(code: CodeEngineErrorCode, message: string, diagnostics?: CodeDiagnostic[]) {
    super(`[${code}] ${message}`);
    this.name = "CodeEngineError";
    this.code = code;
    this.diagnostics = diagnostics ?? [{ code, severity: "error", message }];
  }
}
