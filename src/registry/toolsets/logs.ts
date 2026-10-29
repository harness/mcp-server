import type { ToolsetDefinition, ParamsSchema } from "../types.js";
import { passthrough } from "../extractors.js";

export const logsToolset: ToolsetDefinition = {
  name: "logs",
  displayName: "Execution Logs",
  description: "Pipeline execution log retrieval",
  resources: [
    {
      resourceType: "execution_log",
      displayName: "Execution Log",
      description: "Pipeline execution logs. Log content is prepared asynchronously, then returned as readable text by default (GET /blob, capped at 2MB with Content-Length short-circuit). Set return_download_url=true to get only a signed download URL. Pass prefix or execution_id; with execution_id, also pass step_id (and stage_id when known) so logs are scoped to one step. When the base logBaseKey is empty, unit keys come from executableResponses logKeys (else unitProgresses / Execute): harness_get returns labeled sections for non-empty units; harness_diagnose uses snippet mode (last non-empty unit, tailed). An explicit prefix alone falls back only to `-commandUnit:Execute` if the base key is empty. When a Harness execution URL includes step/stage query params, those values resolve the matching step log. For failed-run analysis prefer harness_diagnose with include_logs=true.",
      toolset: "logs",
      scope: "project",
      identifierFields: ["prefix"],
      diagnosticHint: "Logs may still be preparing after a run. Retry when the execution has finished, pass step_id with execution_id, or set return_download_url=true. For failures use harness_diagnose with include_logs=true.",
      operations: {
        get: {
          // Log text uses GET /blob (single key). return_download_url still uses
          // POST /blob/download via resolveLogDownloadUrl in the tool handler.
          method: "GET",
          path: "/gateway/log-service/blob",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            // inputKey → queryKey: registry field "prefix" maps to log-service `key`
            prefix: "key",
          },
          responseExtractor: passthrough,
          description: "Fetch execution logs by prefix or execution_id. Returns labeled command-unit log text via GET /blob when the base key is empty, or a download URL when return_download_url=true.",
          paramsSchema: {
            fields: [
              {
                name: "prefix",
                required: false,
                description: "Log prefix / logBaseKey. Use this or execution_id. With prefix alone, empty/404 base keys fall back only to `-commandUnit:Execute` (no graph logKeys/unitProgresses).",
              },
              {
                name: "execution_id",
                required: false,
                description: "Execution identifier used to resolve the log prefix from the graph (also supplies executableResponses logKeys and unitProgresses for command-unit blob selection)",
              },
              {
                name: "step_id",
                required: false,
                description: "Step identifier. Prefer this with execution_id so logs cover one step, not the whole run.",
              },
              {
                name: "stage_id",
                required: false,
                description: "Stage identifier used with step_id when the run has multiple stages",
              },
              {
                name: "stage_execution_id",
                required: false,
                description: "Stage execution identifier when present on the execution URL",
              },
              {
                name: "return_download_url",
                required: false,
                description: "When true, return a signed download URL instead of buffering log text",
              },
            ],
          } satisfies ParamsSchema,
        },
      },
    },
  ],
};
