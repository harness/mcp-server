import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerSummarizePipelinePrompt(server: McpServer): void {
  server.registerPrompt(
    "pipeline_summarizer",
    {
      description:
        "Fetch and summarize ALL step logs from a pipeline execution. Returns a table with every step's name, status, duration, and a log-based summary of what happened.",
      argsSchema: {
        executionId: z
          .string()
          .describe("The execution ID, pipeline ID, or a Harness URL")
          .optional(),
        projectId: z.string().describe("Project identifier").optional(),
      },
    },
    async ({ executionId, projectId }) => {
      const isUrl = executionId?.startsWith("http");
      const idParam = isUrl
        ? `url="${executionId}"`
        : `execution_id="${executionId}"`;

      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: `You are a pipeline execution summarizer for Harness CI/CD pipelines (IACM, CCM, CD, CI, STO).

Your job is to summarize EVERY step in the execution by extracting concrete outputs from the logs. Do NOT skip any steps.

## Steps

1. Call harness_diagnose with ${idParam}${projectId ? `, project_id="${projectId}"` : ""}, options={include_logs: true, include_all_step_logs: true} to get the full stage/step tree with ALL step logs.
   - Note: harness_diagnose rejects non-terminal executions (Running, Queued). For in-progress runs, use harness_get with resource_type="execution" and resource_id=<execution_id> instead.
2. For each step in the all_step_logs response, extract the specific outputs based on step type (see "What to Extract" below).
3. If there are more than 10 steps, present results in batches of 5 rows at a time so the user sees partial progress instead of waiting for the full table. After each batch, continue immediately with the next batch until all steps are covered.
4. Present results as the table below. DO NOT skip any steps — summarize every single one, even if the step succeeded with no issues.

## What to Extract (by step type)

For each step, look for these concrete outputs in the logs:

- **IACM / Terraform**: Resources created/changed/destroyed (e.g. "3 added, 1 changed, 0 destroyed"), resource names/IDs provisioned, state file changes, plan drift detected
- **CD / Deploy**: Service deployed, environment/namespace, image tag or artifact version, replicas, rollback info, health check results
- **CI / Build**: Image built and pushed (repo:tag), build duration, cache hit/miss, test results (passed/failed/skipped counts), artifacts produced
- **STO / Security**: Vulnerabilities found (critical/high/medium/low counts), policy violations, exemptions applied, scan tool used
- **CCM / Cost**: Budget alerts, anomalies detected, recommendations applied, savings realized
- **Approval**: Who approved/rejected, how long it waited
- **Plugin / Run steps**: Command executed, exit code, key output lines (errors, warnings, final status messages)

If a step's log has no meaningful output (e.g. initialization), note what it did briefly (e.g. "Initialized workspace", "Pulled image X").

## Required Output

### Execution Overview
- **Pipeline**: [name]
- **Execution ID**: [id]
- **Status**: [Success / Failed / Aborted]
- **Duration**: [total wall-clock time]
- **Trigger**: [manual / webhook / cron / API]

### Step Summary

| Step Name | Status | Duration | What Happened (outputs from logs) |
|-----------|--------|----------|-----------------------------------|
| ...       | ...    | ...      | Concrete outputs: what was provisioned/deployed/built/scanned |

### Key Observations
- Resources provisioned or modified (total count across all steps)
- Deployments: services, environments, artifact versions
- Security: vulnerability counts, policy pass/fail
- Performance bottlenecks or unusually slow steps
- Errors or warnings worth investigating`,
            },
          },
        ],
      };
    },
  );
}
