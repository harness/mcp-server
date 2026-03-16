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
      description: "Pipeline execution logs. Returns readable log text (not just a URL). Accepts a raw Harness logBaseKey prefix, or an execution_id to auto-resolve the real log key from the execution graph. When a Harness execution URL includes step/stage query params, the MCP uses them to resolve the matching step log key. Use harness_diagnose with include_logs=true for the best failure analysis experience.",
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
