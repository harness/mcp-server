import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Registry } from "../registry/index.js";
import type { HarnessClient } from "../client/harness-client.js";
import { jsonResult, errorResult } from "../utils/response-formatter.js";
import { isUserError, isUserFixableApiError, toMcpError, HarnessApiError } from "../utils/errors.js";
import { confirmViaElicitation } from "../utils/elicitation.js";
import { createLogger } from "../utils/logger.js";
import { applyUrlDefaults } from "../utils/url-parser.js";
import { asRecord, asString } from "../utils/type-guards.js";
import { isFlatKeyValueInputs, resolveRuntimeInputs, type ResolutionResult } from "../utils/runtime-input-resolver.js";

const log = createLogger("execute");

export function registerExecuteTool(server: McpServer, registry: Registry, client: HarnessClient): void {
  server.registerTool(
    "harness_execute",
    {
      description: "Execute an action on a Harness resource: run/retry/interrupt pipelines, toggle feature flags, test connectors, sync GitOps apps, run chaos experiments. You can pass a Harness URL to auto-extract identifiers.",
      inputSchema: {
        resource_type: z.string().describe("Resource type (e.g. pipeline, execution, feature_flag, connector). Auto-detected from url.").optional(),
        url: z.string().describe("Harness UI URL — auto-extracts org, project, type, and ID").optional(),
        action: z.string().describe("Action to execute (e.g. run, retry, interrupt, toggle, test_connection, sync)"),
        resource_id: z.string().describe("Primary resource identifier").optional(),
        org_id: z.string().describe("Organization identifier (overrides default)").optional(),
        project_id: z.string().describe("Project identifier (overrides default)").optional(),
        inputs: z.union([z.string(), z.record(z.string(), z.unknown())]).describe("Pipeline runtime inputs: key-value pairs like {branch: 'main'} (auto-resolved), or full YAML string. Check runtime_input_template first via harness_get.").optional(),
        input_set_ids: z.array(z.string()).describe("Input set IDs for complex pipelines. List available: harness_list(resource_type='input_set', filters={pipeline_id: '...'}).").optional(),
        body: z.record(z.string(), z.unknown()).describe("Additional body payload for the action").optional(),
        params: z.record(z.string(), z.unknown()).describe("Action-specific parameters. Call harness_describe for available fields per resource_type.").optional(),
      },
      annotations: {
        title: "Execute Harness Action",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (args) => {
      try {
        const { params, ...rest } = args;
        const input = applyUrlDefaults(rest as Record<string, unknown>, args.url);
        if (params) Object.assign(input, params);
        const resourceType = asString(input.resource_type);
        if (!resourceType) {
          return errorResult("resource_type is required. Provide it explicitly or via a Harness URL.");
        }
        const resourceId = asString(input.resource_id);

        // Validate resource_type and action before asking user to confirm
        const def = registry.getResource(resourceType);
        if (!def.executeActions?.[args.action]) {
          const available = def.executeActions ? Object.keys(def.executeActions).join(", ") : "none";
          return errorResult(`Resource "${resourceType}" has no execute action "${args.action}". Available: ${available}`);
        }

        const elicit = await confirmViaElicitation({
          server,
          toolName: "harness_execute",
          message: `Execute "${args.action}" on ${resourceType}${resourceId ? ` "${resourceId}"` : ""}?`,
        });
        if (!elicit.proceed) {
          return errorResult(`Operation ${elicit.reason} by user.`);
        }

        // Map resource_id to the primary identifier field
        const primaryField = def.identifierFields[0];
        if (primaryField && resourceId) {
          input[primaryField] = resourceId;
        }

        // Pass input_set_ids through to the dispatch input
        if (args.input_set_ids && args.input_set_ids.length > 0) {
          input.input_set_ids = args.input_set_ids.join(",");
        }

        // Auto-resolve flat key-value runtime inputs for pipeline run
        let resolved: ResolutionResult | undefined;
        const hasInputSets = args.input_set_ids && args.input_set_ids.length > 0;

        if (
          resourceType === "pipeline" &&
          args.action === "run" &&
          isFlatKeyValueInputs(args.inputs)
        ) {
          const pipelineId = asString(input.pipeline_id);
          if (!pipelineId) {
            return errorResult("pipeline_id is required to auto-resolve runtime inputs. Provide it via resource_id, params.pipeline_id, or a Harness URL.");
          }
          try {
            resolved = await resolveRuntimeInputs(client, args.inputs, {
              pipelineId,
              orgId: asString(input.org_id) || registry.defaultOrgId,
              projectId: asString(input.project_id) || registry.defaultProjectId,
            });

            // Smart pre-flight: only block on required unmatched fields when no input sets cover them
            if (!hasInputSets && resolved.unmatchedRequired.length > 0) {
              const parts: string[] = [];
              if (resolved.matched.length > 0) {
                parts.push(`Matched ${resolved.matched.length} input(s): ${resolved.matched.join(", ")}.`);
              }

              const structuralFields = resolved.unmatchedRequired.filter(f => isStructuralField(f));
              const simpleFields = resolved.unmatchedRequired.filter(f => !isStructuralField(f));

              parts.push(`${resolved.unmatchedRequired.length} required field(s) still need values: ${resolved.unmatchedRequired.join(", ")}.`);

              if (structuralFields.length > 0) {
                parts.push(`Fields [${structuralFields.join(", ")}] likely need complex objects (not simple strings). Use an input set or provide full YAML.`);
              }

              if (resolved.unmatchedOptional.length > 0) {
                parts.push(`${resolved.unmatchedOptional.length} optional field(s) have defaults and can be omitted: ${resolved.unmatchedOptional.join(", ")}.`);
              }

              // Fetch available input sets to suggest them
              const inputSetHint = await fetchInputSetHint(client, pipelineId, input, registry);
              if (inputSetHint) parts.push(inputSetHint);

              parts.push(`Expected keys: [${resolved.expectedKeys.join(", ")}]. You provided: [${Object.keys(args.inputs).join(", ")}].`);
              parts.push(`Tip: use harness_get(resource_type="runtime_input_template", resource_id="${pipelineId}") to see the full template.`);

              return errorResult(parts.join("\n\n"));
            }

            input.inputs = resolved.yaml;
          } catch (err) {
            log.warn("Failed to auto-resolve runtime inputs, passing through as-is", { error: String(err) });
          }
        }

        let result: unknown;
        try {
          result = await registry.dispatchExecute(client, resourceType, args.action, input);
        } catch (err) {
          // If retry fails with 405, fall back to a fresh pipeline run
          if (
            args.action === "retry" &&
            resourceType === "pipeline" &&
            err instanceof HarnessApiError &&
            err.statusCode === 405
          ) {
            log.info("Retry returned 405, falling back to fresh pipeline run");
            let pipelineId = asString(input.pipeline_id);

            if (!pipelineId && input.execution_id) {
              try {
                const exec = asRecord(await registry.dispatch(client, "execution", "get", input));
                const pes = asRecord(exec?.pipelineExecutionSummary);
                pipelineId = asString(pes?.pipelineIdentifier);
              } catch {
                // Fall through — will error below
              }
            }

            if (!pipelineId) {
              return errorResult("Retry is not available for this execution (405). Provide pipeline_id to run a fresh execution instead.");
            }

            input.pipeline_id = pipelineId;
            result = await registry.dispatchExecute(client, "pipeline", "run", input);
            return jsonResult({ ...(asRecord(result) ?? {}), _note: "Retry was not available (405). Executed a fresh pipeline run instead." });
          }
          throw err;
        }

        if (resolved) {
          return jsonResult({
            ...(asRecord(result) ?? {}),
            _inputResolution: {
              mode: hasInputSets ? "input_set_with_overrides" : "auto_resolved",
              matched: resolved.matched,
              ...(resolved.unmatchedOptional.length > 0 ? { defaulted: resolved.unmatchedOptional } : {}),
            },
          });
        }

        return jsonResult(result);
      } catch (err) {
        if (isUserError(err)) return errorResult(err.message);
        if (isUserFixableApiError(err)) return errorResult(err.message);
        throw toMcpError(err);
      }
    },
  );
}

const STRUCTURAL_FIELDS = new Set([
  "build", "infrastructure", "execution", "spec", "template",
  "templateinputs", "servicedefinition", "artifacts", "manifests",
]);

function isStructuralField(fieldName: string): boolean {
  return STRUCTURAL_FIELDS.has(fieldName.toLowerCase());
}

async function fetchInputSetHint(
  client: HarnessClient,
  pipelineId: string,
  input: Record<string, unknown>,
  registry: Registry,
): Promise<string | null> {
  try {
    const raw = await client.request<unknown>({
      method: "GET",
      path: "/pipeline/api/inputSets",
      params: {
        pipelineIdentifier: pipelineId,
        orgIdentifier: String(input.org_id || registry.defaultOrgId),
        projectIdentifier: String(input.project_id || registry.defaultProjectId),
        size: "5",
      },
    });
    const data = asRecord(asRecord(raw)?.data);
    const content = data?.content;
    if (!Array.isArray(content) || content.length === 0) return null;

    const ids = content
      .map((item: unknown) => asString(asRecord(item)?.identifier))
      .filter(Boolean);
    if (ids.length === 0) return null;

    const total = typeof data?.totalElements === "number" ? data.totalElements : ids.length;
    return `Available input sets for this pipeline (${total} total): [${ids.join(", ")}]. Use input_set_ids=["<id>"] to apply one.`;
  } catch {
    return null;
  }
}
