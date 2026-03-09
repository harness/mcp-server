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
      description: "Pipeline execution step logs. Requires a 'prefix' query param in the format: {accountId}/pipeline/{pipelineId}/{runSequence}/-{executionId} (pipeline-level) or appended with /{stageId}/{stepId} (step-level).",
      toolset: "logs",
      scope: "project",
      identifierFields: ["prefix"],
      listFilterFields: [],
      operations: {
        get: {
          method: "POST",
          path: "/gateway/log-service/blob/download",
          queryParams: {
            prefix: "prefix",
          },
          responseExtractor: passthrough,
          description: "Download execution logs by prefix",
        },
      },
    },
  ],
};
