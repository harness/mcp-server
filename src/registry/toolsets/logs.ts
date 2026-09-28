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
      description: "Pipeline execution logs. Log content is prepared asynchronously, then returned as readable text by default. Set return_download_url=true to get only a signed download URL. Pass prefix or execution_id; with execution_id, also pass step_id (and stage_id when known) so logs are scoped to one step. When a Harness execution URL includes step/stage query params, those values resolve the matching step log. For failed-run analysis prefer harness_diagnose with include_logs=true.",
      toolset: "logs",
      scope: "project",
      identifierFields: ["prefix"],
      diagnosticHint: "Logs may still be preparing after a run. Retry when the execution has finished, pass step_id with execution_id, or set return_download_url=true. For failures use harness_diagnose with include_logs=true.",
      operations: {
        get: {
          method: "POST",
          path: "/gateway/log-service/blob/download",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            prefix: "prefix",
          },
          responseExtractor: passthrough,
          description: "Fetch execution logs by prefix or execution_id. Returns log text, or a download URL when return_download_url=true.",
          paramsSchema: {
            fields: [
              {
                name: "prefix",
                required: false,
                description: "Log prefix. Use this or execution_id.",
              },
              {
                name: "execution_id",
                required: false,
                description: "Execution identifier used to resolve the log prefix",
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
