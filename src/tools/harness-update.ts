import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Registry } from "../registry/index.js";
import type { HarnessClient } from "../client/harness-client.js";
import type { Config } from "../config.js";
import type { ResourceDefinition } from "../registry/types.js";
import type { ConfirmationMethod } from "../audit/types.js";
import { jsonResult, errorResult } from "../utils/response-formatter.js";
import { isUserError, isUserFixableApiError, toMcpError } from "../utils/errors.js";
import { confirmViaElicitation } from "../utils/elicitation.js";
import { applyUrlDefaults } from "../utils/url-parser.js";
import { asString, isRecord, coerceRecord } from "../utils/type-guards.js";
import { formatBodyPreview } from "../utils/body-preview.js";
import { resourceScopeSchema, resourceTypeSchema } from "./input-schemas.js";
import { updateOutputSchema } from "./output-schemas.js";
import { applyJsonPatch, extractMutableBody, serializeBody, computeDiff, supportsJsonPatch, type PatchOperation } from "../utils/json-patch.js";

interface UpdateToolArgs {
  resource_type: string;
  resource_id?: string;
  url?: string;
  resource_scope?: string;
  body?: Record<string, unknown> | string;
  operations?: PatchOperation[];
  dry_run?: boolean;
  org_id?: string;
  project_id?: string;
  confirm?: boolean;
  params?: Record<string, unknown>;
}

const jsonPointerSchema = z.string().describe("JSON Pointer (RFC 6901) to the target location, e.g. /pipeline/stages/0/stage/spec/execution/steps/0/step/spec/command");
const jsonPatchValueSchema: z.ZodType<unknown> = z.lazy(() => z.union([
  z.null(),
  z.string(),
  z.number(),
  z.boolean(),
  z.array(jsonPatchValueSchema),
  z.record(z.string(), jsonPatchValueSchema),
]));
const patchValueSchema = jsonPatchValueSchema.describe("Value for add/replace/test operations");

const patchOperationSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("add").describe("Add a value at path"),
    path: jsonPointerSchema,
    value: patchValueSchema,
  }),
  z.object({
    op: z.literal("replace").describe("Replace the value at path"),
    path: jsonPointerSchema,
    value: patchValueSchema,
  }),
  z.object({
    op: z.literal("test").describe("Assert the value at path before later operations run"),
    path: jsonPointerSchema,
    value: patchValueSchema,
  }),
  z.object({
    op: z.literal("remove").describe("Remove the value at path"),
    path: jsonPointerSchema,
  }),
  z.object({
    op: z.literal("move").describe("Move a value from one JSON Pointer to another"),
    from: z.string().describe("Source JSON Pointer for move operations"),
    path: jsonPointerSchema,
  }),
  z.object({
    op: z.literal("copy").describe("Copy a value from one JSON Pointer to another"),
    from: z.string().describe("Source JSON Pointer for copy operations"),
    path: jsonPointerSchema,
  }),
]);

const patchOperationsSchema = z.array(patchOperationSchema).min(1).max(100);

function formatPatchOperationValidationError(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "operations";
      if (issue.path.at(-1) === "value") {
        return `${path}: value is required for add, replace, and test operations`;
      }
      return `${path}: ${issue.message}`;
    })
    .join("; ");
}

function getPatchableResourceTypes(registry: Registry): string[] {
  return registry.getAllResourceTypes()
    .map((resourceType) => registry.getResource(resourceType))
    .filter((resource) => supportsJsonPatch(resource))
    .map((resource) => resource.resourceType);
}

interface ResolvedIdentifier {
  primaryField?: string;
  resolvedResourceId?: string;
  error?: string;
}

// Resolves the canonical resource id for an update from the already-merged input
// (url defaults + resource_id + params). Shared by full-body and JSON Patch modes
// so both fail loudly on conflicting identifiers and resolve params-only ids the
// same way.
function resolveUpdateIdentifier(input: Record<string, unknown>, def: ResourceDefinition): ResolvedIdentifier {
  const identFields = def.identifierFields;
  const primaryField = identFields.length > 1
    ? identFields[identFields.length - 1]!
    : identFields[0];
  const fromResourceId = asString(input.resource_id);
  const fromPrimaryField = primaryField ? asString(input[primaryField]) : undefined;
  if (fromResourceId && fromPrimaryField && fromResourceId !== fromPrimaryField) {
    return {
      primaryField,
      error: `Conflicting identifiers: resource_id/url gives "${fromResourceId}" but params.${primaryField} gives "${fromPrimaryField}". Provide one or ensure they match.`,
    };
  }
  const resolvedResourceId = fromResourceId ?? fromPrimaryField;
  if (!resolvedResourceId) {
    return {
      primaryField,
      error: "resource_id is required for harness_update unless url contains the resource ID or params includes the resource-specific ID field.",
    };
  }
  return { primaryField, resolvedResourceId };
}

function applyVersionLabelDefault(input: Record<string, unknown>, args: UpdateToolArgs): void {
  if (asString(input.version_label)) return;
  if (isRecord(args.body) && "version_label" in args.body) {
    input.version_label = args.body.version_label;
  } else if (args.resource_type === "template") {
    input.version_label = "v1";
  }
}

export function registerUpdateTool(server: McpServer, registry: Registry, client: HarnessClient, config?: Config): void {
  const updatableTypes = registry.getTypesForOperation("update");

  server.registerTool(
    "harness_update",
    {
      description: "Update an existing Harness resource. For pipelines/input sets: pass body as a YAML string directly, or use body.yamlPipeline/body.pipeline. You can pass a Harness URL to auto-extract identifiers. Response includes openInHarness link to the updated resource when applicable. For large YAML-backed pipelines and templates, you can do targeted JSON Patch via 'operations' mode (mutually exclusive with 'body') to change specific fields without resending the whole definition.",
      inputSchema: {
        resource_type: resourceTypeSchema(updatableTypes).describe("The type of resource to update"),
        resource_id: z.string().optional().describe("The identifier of the resource to update. Optional when url contains the resource ID."),
        url: z.string().optional().describe("A Harness UI URL — org, project, resource type, ID, and supported resource_scope are extracted automatically"),
        resource_scope: resourceScopeSchema,
        body: z.union([
          z.record(z.string(), z.unknown()),
          z.string(),
        ]).optional().describe("Full resource definition body (mutually exclusive with operations). For pipelines: pass a YAML string directly, or an object with yamlPipeline (YAML string) or pipeline (JSON object)"),
        operations: patchOperationsSchema.optional().describe("RFC 6902 JSON Patch operations for large YAML-backed pipelines, templates, and input sets (mutually exclusive with body, max 100). Array paths use numeric indices per RFC 6901 (e.g. /pipeline/stages/0/stage/spec). To safely target an array element (stage, step, variable), precede the replace/remove with a `test` op asserting that element's identifier or name at the index. For REMOTE (git-backed) resources, still pass git details in params (branch, store_type, connector_ref, repo_name, file_path, last_object_id, last_commit_id, commit_msg)."),
        dry_run: z.boolean().default(false).optional().describe("When true with operations, validates the patch and returns a preview of changes without actually updating the resource"),
        org_id: z.string().optional().describe("Organization identifier (overrides default)"),
        project_id: z.string().optional().describe("Project identifier (overrides default)"),
        confirm: z.boolean().optional().describe("Set to true to confirm the operation. Required when the client does not support interactive confirmation prompts (e.g. managed MCP)."),
        params: z.record(z.string(), z.unknown()).optional().describe("Additional identifiers (e.g. pipeline_id for triggers/input sets, version_label for templates)."),
      },
      outputSchema: updateOutputSchema,
      annotations: {
        title: "Update Harness Resource",
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (args) => {
      try {
        // Resolve resource_id from the URL when not passed explicitly, mirroring
        // harness_get. The handlers below own the final "required"/"conflicting"
        // identifier errors so params-only id resolution still works.
        if (!args.resource_id && args.url) {
          const fromUrl = asString(applyUrlDefaults({}, args.url).resource_id);
          if (fromUrl) args.resource_id = fromUrl;
        }

        if (args.body !== undefined && args.operations !== undefined) {
          return errorResult("Provide either 'body' (full replacement) or 'operations' (JSON Patch), not both.");
        }
        if (args.body !== undefined && args.dry_run === true) {
          return errorResult("dry_run is only supported with 'operations' JSON Patch mode. Full-body dry_run preview is not implemented.");
        }
        if (args.body === undefined && args.operations === undefined) {
          return errorResult("Provide either 'body' (full replacement) or 'operations' (JSON Patch array).");
        }
        if (args.operations !== undefined) {
          const parsedOperations = patchOperationsSchema.safeParse(args.operations);
          if (!parsedOperations.success) {
            return errorResult(`Invalid JSON Patch operations: ${formatPatchOperationValidationError(parsedOperations.error)}`);
          }
          args.operations = parsedOperations.data as PatchOperation[];
        }

        const def = registry.getResource(args.resource_type);
        if (!def.operations.update) {
          return errorResult(`Resource "${args.resource_type}" does not support "update". Supported: ${Object.keys(def.operations).join(", ")}`);
        }

        const isPatchMode = args.operations !== undefined;

        if (isPatchMode) {
          if (!supportsJsonPatch(def)) {
            const patchableTypes = getPatchableResourceTypes(registry);
            const patchableTypesText = patchableTypes.length > 0 ? patchableTypes.join(", ") : "none in the enabled toolsets";
            return errorResult(
              `JSON Patch is only supported for YAML-backed resources (${patchableTypesText}). ` +
              `"${args.resource_type}" has no mutable-body projector, so patching its GET response is unsafe. Use a full body update instead.`,
            );
          }
          if (!def.operations.get) {
            return errorResult(`JSON Patch requires a "get" operation for "${args.resource_type}", but it only supports: ${Object.keys(def.operations).join(", ")}`);
          }
          return await handlePatchUpdate(server, registry, client, config, def, args);
        }

        return await handleFullBodyUpdate(server, registry, client, config, def, args);
      } catch (err) {
        if (isUserError(err)) return errorResult(err.message);
        if (isUserFixableApiError(err)) return errorResult(err.message);
        throw toMcpError(err);
      }
    },
  );
}

async function handleFullBodyUpdate(server: McpServer, registry: Registry, client: HarnessClient, config: Config | undefined, def: ResourceDefinition, args: UpdateToolArgs) {
  const { params, body, confirm: _confirm, ...rest } = args;
  const coercedBody = typeof body === "string" ? (coerceRecord(body) ?? body) : body;
  const input = applyUrlDefaults({ ...rest, body: coercedBody } as Record<string, unknown>, args.url, { includeResourceScope: true });
  const coercedParams = coerceRecord(params);
  if (coercedParams) Object.assign(input, coercedParams);

  const { primaryField, resolvedResourceId, error } = resolveUpdateIdentifier(input, def);
  if (error) return errorResult(error);

  const risk = def.operations.update!.operationPolicy.risk;
  const bodyPreview = formatBodyPreview(args.body);
  const elicit = await confirmViaElicitation({
    server,
    toolName: "harness_update",
    message: `Update ${args.resource_type} "${resolvedResourceId}"?\n\n${bodyPreview}`,
    risk,
    autoApproveRisk: config?.HARNESS_AUTO_APPROVE_RISK,
    callerConfirmed: args.confirm === true,
  });
  if (!elicit.proceed) {
    return errorResult(
      `Operation ${elicit.reason} by user. Hint: if your client does not support interactive confirmation, pass confirm: true to proceed.`,
    );
  }
  if (primaryField) {
    input[primaryField] = resolvedResourceId;
  }
  applyVersionLabelDefault(input, args);

  const result = await registry.dispatch(client, args.resource_type, "update", input, { tool: "harness_update", confirmation: elicit.method, resource_id: resolvedResourceId });
  return jsonResult(result);
}

async function handlePatchUpdate(server: McpServer, registry: Registry, client: HarnessClient, config: Config | undefined, def: ResourceDefinition, args: UpdateToolArgs) {
  const operations = args.operations as PatchOperation[];
  const dryRun = args.dry_run === true;

  const { params, operations: _ops, dry_run: _dry, confirm: _confirm, ...rest } = args;
  const getInput = applyUrlDefaults({ ...rest } as Record<string, unknown>, args.url);
  const coercedParams = coerceRecord(params);
  if (coercedParams) Object.assign(getInput, coercedParams);

  // Resolve the identifier up front so patch mode fails loudly on conflicting
  // identifiers and surfaces the resolved id in the confirmation/audit path —
  // matching full-body update behavior.
  const { primaryField, resolvedResourceId, error } = resolveUpdateIdentifier(getInput, def);
  if (error) return errorResult(error);
  if (primaryField) getInput[primaryField] = resolvedResourceId;
  applyVersionLabelDefault(getInput, args);

  const opsJson = JSON.stringify(operations, null, 2);
  const opsPreview = opsJson.length > 1000 ? opsJson.slice(0, 1000) + "\n...(truncated)" : opsJson;
  const risk = def.operations.update!.operationPolicy.risk;
  let confirmation: ConfirmationMethod = "not_required";

  if (!dryRun) {
    const elicit = await confirmViaElicitation({
      server,
      toolName: "harness_update",
      message: `Apply ${operations.length} JSON Patch operation(s) to ${args.resource_type} "${resolvedResourceId}"?\n\n${opsPreview}`,
      risk,
      autoApproveRisk: config?.HARNESS_AUTO_APPROVE_RISK,
      callerConfirmed: args.confirm === true,
    });
    if (!elicit.proceed) {
      return errorResult(
        `Operation ${elicit.reason} by user. Hint: if your client does not support interactive confirmation, pass confirm: true to proceed.`,
      );
    }
    confirmation = elicit.method;
  }

  const getResult = await registry.dispatch(client, args.resource_type, "get", getInput);
  const { document, yamlSource } = extractMutableBody(getResult, def);

  const patched = applyJsonPatch(document, operations);

  if (dryRun) {
    return jsonResult({
      dry_run: true,
      operations_applied: operations.length,
      diff: computeDiff(document, patched),
    });
  }

  const serialized = serializeBody(patched, yamlSource);
  // Git context for REMOTE resources (branch, last_object_id, last_commit_id,
  // commit_msg, repo_name, file_path) is supplied by the caller via params — the
  // same way full-body updates require it. Patch mode does not auto-derive it:
  // JSON Patch targets the document body, not git plumbing. Whatever the caller
  // passed already flowed into getInput, so it carries through here unchanged.
  const updateInput: Record<string, unknown> = { ...getInput, body: serialized };

  const result = await registry.dispatch(client, args.resource_type, "update", updateInput, { tool: "harness_update", confirmation, resource_id: resolvedResourceId });
  return jsonResult(result);
}
