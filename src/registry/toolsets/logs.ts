import type { ToolsetDefinition } from "../types.js";
import { passthrough } from "../extractors.js";

export const logsToolset: ToolsetDefinition = {
  name: "logs",
  displayName: "Execution Logs",
  description: "Pipeline execution log retrieval",
  resources: [
    {
      resourceType: "execution_log",
      displayName: "Execution Log",
      description: "Pipeline execution step logs. Returns readable log text (not just a URL). Accepts either a 'prefix' in the format {accountId}/pipeline/{pipelineId}/{runSequence}/-{executionId} (pipeline-level) or appended with /{stageId}/{stepId} (step-level), OR an 'execution_id' to auto-build the prefix. Use harness_diagnose with include_logs=true for the best failure analysis experience.",
      toolset: "logs",
      scope: "project",
      identifierFields: ["prefix"],
      listFilterFields: [
        { name: "execution_id", description: "Execution identifier — auto-builds log prefix from execution metadata" },
      ],
      operations: {
        get: {
          method: "POST",
          path: "/gateway/log-service/blob/download",
          queryParams: {
            prefix: "prefix",
          },
          responseExtractor: passthrough,
          description: "Download and return execution log content by prefix",
        },
      },
    },
  ],
};
