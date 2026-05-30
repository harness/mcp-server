import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Registry } from "../registry/index.js";
import type { HarnessClient } from "../client/harness-client.js";
import type { Config } from "../config.js";
import type { ResourceDefinition } from "../registry/types.js";
import { jsonResult, errorResult } from "../utils/response-formatter.js";
import { isUserError, isUserFixableApiError, toMcpError } from "../utils/errors.js";
import { confirmViaElicitation } from "../utils/elicitation.js";
import { applyUrlDefaults } from "../utils/url-parser.js";
import { asString, isRecord, coerceRecord } from "../utils/type-guards.js";
import { resourceScopeSchema, resourceTypeSchema } from "./input-schemas.js";
import { updateOutputSchema } from "./output-schemas.js";
import { applyJsonPatch, extractMutableBody, serializeBody, computeDiff, type PatchOperation } from "../utils/json-patch.js";

interface UpdateToolArgs {
  resource_type: string;
  resource_id: string;
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

const patchOperationSchema = z.object({
  op: z.enum(["add", "remove", "replace", "move", "copy", "test"]).describe("RFC 6902 operation type"),
  path: z.string().describe("JSON Pointer (RFC 6901) to the target location, e.g. /pipeline/stages/0/stage/spec/execution/steps/0/step/spec/command"),
  value: z.unknown().describe("Value for add/replace/test operations").optional(),
  from: z.string().describe("Source JSON Pointer for move/copy operations").optional(),
});

export function registerUpdateTool(server: McpServer, registry: Registry, client: HarnessClient, config?: Config): void {
  const updatableTypes = registry.getTypesForOperation("update");

  server.registerTool(
    "harness_update",
    {
      description: "Update an existing Harness resource. Two modes: (1) Full body replacement — pass 'body' with the complete resource definition. (2) JSON Patch (RFC 6902) — pass 'operations' with targeted patch ops (the tool fetches the current resource, applies patches server-side, and sends the merged result). Use operations to change specific fields without outputting the entire resource. body and operations are mutually exclusive.",
      inputSchema: {
        resource_type: resourceTypeSchema(updatableTypes).describe("The type of resource to update"),
        resource_id: z.string().describe("The identifier of the resource to update"),
        url: z.string().describe("A Harness UI URL — org, project, resource type, and ID are extracted automatically").optional(),
        resource_scope: resourceScopeSchema,
        body: z.union([
          z.record(z.string(), z.unknown()),
          z.string(),
        ]).describe("Full resource definition body (mutually exclusive with operations). For pipelines: pass a YAML string directly, or an object with yamlPipeline (YAML string) or pipeline (JSON object)").optional(),
        operations: z.array(patchOperationSchema).max(100).describe("RFC 6902 JSON Patch operations (mutually exclusive with body, max 100). The tool fetches the current resource, applies these operations server-side, and sends the merged result. Array paths use numeric indices per RFC 6901 (e.g. /pipeline/stages/0/stage/spec). To safely target an array element (stage, step, variable), precede the replace/remove with a `test` op asserting that element's identifier or name at the index.").optional(),
        dry_run: z.boolean().default(false).describe("When true with operations, validates the patch and returns a preview of changes without actually updating the resource").optional(),
        org_id: z.string().describe("Organization identifier (overrides default)").optional(),
        project_id: z.string().describe("Project identifier (overrides default)").optional(),
        confirm: z.boolean().describe("Set to true to confirm the operation. Required when the client does not support interactive confirmation prompts (e.g. managed MCP).").optional(),
        params: z.record(z.string(), z.unknown()).describe("Additional identifiers (e.g. pipeline_id for triggers/input sets, version_label for templates).").optional(),
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
        if (args.body !== undefined && args.operations !== undefined) {
          return errorResult("Provide either 'body' (full replacement) or 'operations' (JSON Patch), not both.");
        }
        if (args.body === undefined && args.operations === undefined) {
          return errorResult("Provide either 'body' (full replacement) or 'operations' (JSON Patch array).");
        }

        const def = registry.getResource(args.resource_type);
        if (!def.operations.update) {
          return errorResult(`Resource "${args.resource_type}" does not support "update". Supported: ${Object.keys(def.operations).join(", ")}`);
        }

        const isPatchMode = args.operations !== undefined;

        if (isPatchMode) {
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
  const risk = def.operations.update!.operationPolicy.risk;
  const bodyPreview = typeof args.body === "string"
    ? (args.body.length > 500 ? args.body.slice(0, 500) + "\n...(truncated)" : args.body)
    : JSON.stringify(args.body, null, 2);
  const elicit = await confirmViaElicitation({
    server,
    toolName: "harness_update",
    message: `Update ${args.resource_type} "${args.resource_id}"?\n\n${bodyPreview}`,
    risk,
    autoApproveRisk: config?.HARNESS_AUTO_APPROVE_RISK,
    callerConfirmed: args.confirm === true,
  });
  if (!elicit.proceed) {
    return errorResult(
      `Operation ${elicit.reason} by user. Hint: if your client does not support interactive confirmation, pass confirm: true to proceed.`,
    );
  }
  const { params, body, confirm: _confirm, ...rest } = args;
  const coercedBody = typeof body === "string" ? (coerceRecord(body) ?? body) : body;
  const input = applyUrlDefaults({ ...rest, body: coercedBody } as Record<string, unknown>, args.url);
  const coercedParams = coerceRecord(params);
  if (coercedParams) Object.assign(input, coercedParams);
  const identFields = def.identifierFields;
  const primaryField = identFields.length > 1
    ? identFields[identFields.length - 1]!
    : identFields[0];
  if (primaryField && args.resource_id) {
    input[primaryField] = args.resource_id;
  }
  const versionLabel = asString(input.version_label);
  if (versionLabel) { /* already set via params */ }
  else if (isRecord(args.body) && "version_label" in args.body) {
    input.version_label = args.body.version_label;
  } else if (args.resource_type === "template") {
    input.version_label = "v1";
  }

  const result = await registry.dispatch(client, args.resource_type, "update", input, { tool: "harness_update", confirmation: elicit.method, resource_id: args.resource_id });
  return jsonResult(result);
}

async function handlePatchUpdate(server: McpServer, registry: Registry, client: HarnessClient, config: Config | undefined, def: ResourceDefinition, args: UpdateToolArgs) {
  const operations = args.operations as PatchOperation[];
  const dryRun = args.dry_run === true;

  const opsJson = JSON.stringify(operations, null, 2);
  const opsPreview = opsJson.length > 1000 ? opsJson.slice(0, 1000) + "\n...(truncated)" : opsJson;
  const risk = def.operations.update!.operationPolicy.risk;

  if (!dryRun) {
    const elicit = await confirmViaElicitation({
      server,
      toolName: "harness_update",
      message: `Apply ${operations.length} JSON Patch operation(s) to ${args.resource_type} "${args.resource_id}"?\n\n${opsPreview}`,
      risk,
      autoApproveRisk: config?.HARNESS_AUTO_APPROVE_RISK,
      callerConfirmed: args.confirm === true,
    });
    if (!elicit.proceed) {
      return errorResult(
        `Operation ${elicit.reason} by user. Hint: if your client does not support interactive confirmation, pass confirm: true to proceed.`,
      );
    }
  }

  const { params, operations: _ops, dry_run: _dry, confirm: _confirm, ...rest } = args;
  const getInput = applyUrlDefaults({ ...rest } as Record<string, unknown>, args.url);
  const coercedParams = coerceRecord(params);
  if (coercedParams) Object.assign(getInput, coercedParams);

  const identFields = def.identifierFields;
  const primaryField = identFields.length > 1
    ? identFields[identFields.length - 1]!
    : identFields[0];
  if (primaryField && args.resource_id) {
    getInput[primaryField] = args.resource_id;
  }

  const getResult = await registry.dispatch(client, args.resource_type, "get", getInput);
  const { document, yamlSource, metadata } = extractMutableBody(getResult, args.resource_type);

  const patched = applyJsonPatch(document, operations);

  if (dryRun) {
    return jsonResult({
      dry_run: true,
      operations_applied: operations.length,
      diff: computeDiff(document, patched),
    });
  }

  const serialized = serializeBody(patched, yamlSource);
  const updateInput: Record<string, unknown> = { ...getInput, body: serialized };

  if (metadata.lastObjectId) updateInput.last_object_id = metadata.lastObjectId;
  if (metadata.lastCommitId) updateInput.last_commit_id = metadata.lastCommitId;
  if (metadata.storeType) updateInput.store_type = metadata.storeType;
  if (metadata.connectorRef) updateInput.connector_ref = metadata.connectorRef;

  const result = await registry.dispatch(client, args.resource_type, "update", updateInput, { tool: "harness_update", confirmation: "auto_approved", resource_id: args.resource_id });
  return jsonResult(result);
}
