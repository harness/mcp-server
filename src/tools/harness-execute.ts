import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Registry } from "../registry/index.js";
import type { HarnessClient } from "../client/harness-client.js";
import { jsonResult, errorResult } from "../utils/response-formatter.js";
import { isUserError, isUserFixableApiError, toMcpError, HarnessApiError } from "../utils/errors.js";
import { confirmViaElicitation } from "../utils/elicitation.js";
import { createLogger, logAudit } from "../utils/logger.js";
import { applyUrlDefaults } from "../utils/url-parser.js";
import { asRecord, asString, coerceRecord } from "../utils/type-guards.js";
import { isFlatKeyValueInputs, isResolvableInputs, flattenInputs, resolveRuntimeInputs, type ResolutionResult } from "../utils/runtime-input-resolver.js";
import { applyInputExpansions } from "../utils/input-expander.js";
import { materializeInputSetsToRuntimeYaml } from "../utils/materialize-input-sets.js";
import { resourceTypeSchema } from "./input-schemas.js";

const log = createLogger("execute");

export function registerExecuteTool(server: McpServer, registry: Registry, client: HarnessClient): void {
  const executableTypes = registry.getTypesWithExecuteActions();

  server.registerTool(
    "harness_execute",
    {
      description: "Execute an action on a Harness resource: run/retry/interrupt pipelines, kill/restore FME feature flags, test connectors, sync GitOps apps, run chaos experiments. You can pass a Harness URL to auto-extract identifiers.",
      inputSchema: {
        resource_type: resourceTypeSchema(
          executableTypes,
          "Resource type with executable actions. Auto-detected from url.",
        ).optional(),
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
        const coercedParams = coerceRecord(params);
        if (coercedParams) Object.assign(input, coercedParams);
        log.debug("Execute input after params merge", { input: JSON.stringify(input), params: JSON.stringify(params) });
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

        // Pass input_set_ids as string[] so HarnessClient emits repeated `inputSetIdentifiers=` query keys
        // (grpc-gateway array style). Comma-joined single param is ignored by pipeline execute.
        if (args.input_set_ids && args.input_set_ids.length > 0) {
          input.input_set_ids = [...args.input_set_ids];
        }

        // When only input_set_ids are provided, fetch each input set and build runtime YAML.
        // Harness execute often does not apply `inputSetIdentifiers` from the query string alone;
        // sending the merged `pipeline` fragment as the YAML body matches the working UI path.
        if (
          resourceType === "pipeline" &&
          args.action === "run" &&
          args.input_set_ids &&
          args.input_set_ids.length > 0 &&
          args.inputs === undefined
        ) {
          const pipelineId = asString(input.pipeline_id) ?? resourceId;
          const orgId = asString(input.org_id) || registry.orgId;
          const projectId = asString(input.project_id) || registry.projectId;
          if (!pipelineId) {
            return errorResult(
              "pipeline_id is required when using input_set_ids without inputs. Provide resource_id or params.pipeline_id.",
            );
          }
          if (!projectId) {
            return errorResult(
              "project_id is required when using input_set_ids. Pass project_id or set HARNESS_PROJECT.",
            );
          }
          try {
            const yaml = await materializeInputSetsToRuntimeYaml(client, {
              pipelineId,
              orgId,
              projectId,
              inputSetIds: args.input_set_ids,
            });
            if (yaml) {
              input.inputs = yaml;
              delete input.input_set_ids;
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return errorResult(`Could not load input set(s) for execution: ${msg}`);
          }
        }

        // Auto-resolve flat key-value runtime inputs for pipeline run
        let resolved: ResolutionResult | undefined;
        const hasInputSets = args.input_set_ids && args.input_set_ids.length > 0;

        if (
          resourceType === "pipeline" &&
          args.action === "run" &&
          isResolvableInputs(args.inputs)
        ) {
          // Apply declarative input expansions (e.g. {branch: "main"} -> full build structure)
          const actionSpec = registry.getExecuteActions(resourceType)?.[args.action];
          if (actionSpec?.inputExpansions?.length) {
            args.inputs = applyInputExpansions(
              args.inputs as Record<string, unknown>,
              actionSpec.inputExpansions,
            );
          }

          const pipelineId = asString(input.pipeline_id);
          if (!pipelineId) {
            return errorResult("pipeline_id is required to auto-resolve runtime inputs. Provide it via resource_id, params.pipeline_id, or a Harness URL.");
          }
          try {
            // Flatten nested inputs (e.g. codebase build objects) into dot-path keys
            // for template matching. Flat inputs pass through unchanged.
            const inputsToResolve = isFlatKeyValueInputs(args.inputs)
              ? args.inputs
              : flattenInputs(args.inputs);
            resolved = await resolveRuntimeInputs(client, inputsToResolve, {
              pipelineId,
              orgId: asString(input.org_id) || registry.orgId,
              projectId: asString(input.project_id) || registry.projectId,
              branch: asString(input.branch),
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

        const auditBase = { operation: "execute", resource_type: resourceType, resource_id: resourceId, action: args.action, org_id: input.org_id as string, project_id: input.project_id as string };

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
            logAudit({ ...auditBase, action: "run (retry fallback)", outcome: "success" });
            return jsonResult({ ...(asRecord(result) ?? {}), _note: "Retry was not available (405). Executed a fresh pipeline run instead." });
          }
          throw err;
        }

        logAudit({ ...auditBase, outcome: "success" });

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
        logAudit({ operation: "execute", resource_type: args.resource_type ?? "unknown", resource_id: args.resource_id, action: args.action, outcome: "error", error: String(err) });
        if (isUserError(err)) return errorResult(err.message);
        if (isUserFixableApiError(err)) return errorResult(err.message);
        throw toMcpError(err);
      }
    },
  );
}

const STRUCTURAL_FIELDS = new Set([
  "infrastructure", "execution", "spec", "template",
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
        orgIdentifier: String(input.org_id || registry.orgId),
        projectIdentifier: String(input.project_id || registry.projectId),
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
