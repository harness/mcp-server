import type { ToolsetDefinition, ParamsSchema } from "../types.js";
import { testCaseListExtract } from "../extractors.js";
import { MC_SCOPE } from "./scopes.js";

// Source of truth: harness-ti `GET /api/v1/test-cases` (ti-service/openapi.yaml, operationId
// listPublicTestCases; handler/public_test_cases.go). Only these query params are honored;
// the server silently ignores all others and pins report=junit.
export const ciToolset: ToolsetDefinition = {
  name: "ci",
  displayName: "CI",
  description: "Harness CI: test results (test cases) reported by test steps of pipeline executions",
  optIn: true,
  resources: [
    {
      resourceType: "test_case",
      displayName: "Test Case",
      description:
        "Individual JUnit test results (name, suite, class, result status, duration_ms, flaky/quarantine " +
        "flags, truncated stdout/stderr) for ONE pipeline execution, e.g. which tests failed or how many ran. " +
        "Requires pipeline_id and build_id (execution run number); stage_id/step_id narrow it. Returns one page " +
        "(size 1-1000, default 10). Does not return logs, execution status or coverage.",
      toolset: "ci",
      scope: "project",
      scopeParams: MC_SCOPE,
      identifierFields: [],
      listFilterFields: [
        { name: "pipeline_id", required: true, description: "Pipeline identifier" },
        { name: "build_id", required: true, description: "Execution run number (build id) of the pipeline" },
        { name: "stage_id", description: "Narrow results to one stage" },
        { name: "step_id", description: "Narrow results to one step" },
      ],
      diagnosticHint:
        "400: missing/invalid account, org, project or pipeline identifier, or size outside 1-1000. " +
        "401: PAT missing or invalid. 403: PAT lacks pipeline view permission, or the API is not enabled " +
        "for this account. 204/empty: no test cases for that execution.",
      operations: {
        list: {
          method: "GET",
          path: "/gateway/ti-service/api/v1/test-cases",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            pipeline_id: "pipelineId",
            build_id: "buildId",
            stage_id: "stageId",
            step_id: "stepId",
            page: "pageIndex",
            size: "pageSize",
          },
          responseExtractor: testCaseListExtract,
          description:
            "List test cases for one pipeline execution. Gives: name, suite_name, class_name, file_name, " +
            "result.status (passed/failed/error/skipped/skipped_by_ti) with message, duration_ms, " +
            "flaky/quarantine/problematic flags per test, truncated stdout/stderr. Paging: size 1-1000 " +
            "(default 10; larger returns 400), page is 0-based; fetch further pages for large runs. " +
            "Does NOT filter or sort server-side: status, suite_name, search, sort and flaky are silently " +
            "ignored (not rejected), so filter/sort the results yourself. Only JUnit reports are returned. " +
            "Empty result (HTTP 204) means no test cases exist for that execution; retrying will not help. " +
            "The flaky flag is per returned test, not a cross-build analysis. Does NOT return console logs, " +
            "execution/pipeline status or code coverage. Needs a PAT with pipeline view permission; a 403 " +
            "can also mean the API is not enabled for the account.",
          paramsSchema: {
            fields: [
              { name: "pipeline_id", required: true, description: "Pipeline identifier" },
              { name: "build_id", required: true, description: "Execution run number (build id) of the pipeline" },
              { name: "stage_id", required: false, description: "Narrow results to one stage" },
              { name: "step_id", required: false, description: "Narrow results to one step" },
              { name: "page", required: false, description: "0-based page index (default 0)" },
              { name: "size", required: false, description: "Page size 1-1000 (default 10)" },
            ],
          } satisfies ParamsSchema,
        },
      },
    },
  ],
};
