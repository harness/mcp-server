import type { EndpointHandlerContext, ToolsetDefinition } from "../types.js";
import { isRecord } from "../../utils/type-guards.js";

const TI_REPORTS_PATH = "/gateway/ti-service/reports";
const DEFAULT_REPORT = "junit";
const FAILED_STATUS = "failed";
const CAPTURE_FAILURES_STEP_ID = "captureFailures";
const SUITE_PAGE_INDEX = 0;
const SUITE_PAGE_SIZE = 20;
const CASE_PAGE_INDEX = 0;
const CASE_PAGE_SIZE = 100;

type QueryParams = Record<string, string | number | boolean | string[] | undefined>;

interface FailedTestCase {
  stage_id: string;
  suite_name: string;
  test_name?: string;
  status: string;
  duration?: string | number;
  error_message?: string;
  stack_trace?: string;
}

interface FailedTestCaseOutput {
  stage_id: string;
  suite_name: string;
  test_method: string;
}

interface StageStep {
  stageId: string;
  stepId: string;
}

function getString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return undefined;
}

function getStringOrNumber(record: Record<string, unknown>, keys: string[]): string | number | undefined {
  for (const key of keys) {
    const value = record[key];
    if ((typeof value === "string" && value.length > 0) || typeof value === "number") return value;
  }
  return undefined;
}

function unwrapData(raw: unknown): unknown {
  if (isRecord(raw) && "data" in raw) return raw.data;
  return raw;
}

function extractItems(raw: unknown, candidateKeys: string[]): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (!isRecord(raw)) return [];
  for (const key of candidateKeys) {
    const value = raw[key];
    if (Array.isArray(value)) return value;
    if (isRecord(value)) {
      const nested = extractItems(value, candidateKeys);
      if (nested.length > 0) return nested;
    }
  }

  const unwrapped = unwrapData(raw);
  if (unwrapped !== raw) return extractItems(unwrapped, candidateKeys);

  return [];
}

function extractTotal(raw: unknown, fallback: number): number {
  const unwrapped = unwrapData(raw);
  if (!isRecord(unwrapped)) return fallback;

  for (const key of ["total", "totalItems", "totalElements", "itemCount", "count"]) {
    const value = unwrapped[key];
    if (typeof value === "number") return value;
  }

  return fallback;
}

function normalizeStageSteps(raw: unknown): StageStep[] {
  const stages = extractItems(raw, ["stages", "items", "content"]);
  const pairs = stages
    .filter(isRecord)
    .map((stage) => {
      const stageId = getString(stage, ["stage", "stageId", "stage_id", "id", "identifier", "stageIdentifier"]);
      if (!stageId) return undefined;
      return {
        stageId,
        stepId: getString(stage, ["step", "stepId", "step_id", "stepIdentifier"]) ?? CAPTURE_FAILURES_STEP_ID,
      };
    })
    .filter((stage): stage is StageStep => stage !== undefined);

  const seen = new Set<string>();
  return pairs.filter((stage) => {
    const key = `${stage.stageId}:${stage.stepId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractRunSequence(raw: unknown): string | undefined {
  const data = unwrapData(raw);
  if (!isRecord(data)) return undefined;
  const summary = isRecord(data.pipelineExecutionSummary) ? data.pipelineExecutionSummary : data;
  const runSequence = summary.runSequence ?? summary.runsequence;
  if (typeof runSequence === "number" || typeof runSequence === "string") {
    return String(runSequence);
  }
  return undefined;
}

function normalizeSuiteNames(raw: unknown): string[] {
  const suites = extractItems(raw, ["testSuites", "test_suites", "suites", "items", "content"]);
  const names = suites
    .filter(isRecord)
    .map((suite) => getString(suite, ["suite_name", "suiteName", "name"]))
    .filter((suiteName): suiteName is string => suiteName !== undefined);

  return [...new Set(names)];
}

function normalizeFailedCases(raw: unknown, stageId: string, suiteName: string): FailedTestCase[] {
  return extractItems(raw, ["testCases", "test_cases", "tests", "items", "content"])
    .filter(isRecord)
    .map((testCase) => {
      const result: FailedTestCase = {
        stage_id: stageId,
        suite_name: suiteName,
        status: getString(testCase, ["status"]) ?? FAILED_STATUS,
      };

      const testName = getString(testCase, ["test_name", "testName", "name", "identifier"]);
      const duration = getStringOrNumber(testCase, ["duration", "duration_ms", "durationMs", "time"]);
      const errorMessage = getString(testCase, ["error_message", "errorMessage", "failure_message", "failureMessage", "message"]);
      const stackTrace = getString(testCase, ["stack_trace", "stackTrace", "stacktrace", "error_stack_trace", "errorStackTrace"]);

      if (testName) result.test_name = testName;
      if (duration !== undefined) result.duration = duration;
      if (errorMessage) result.error_message = errorMessage;
      if (stackTrace) result.stack_trace = stackTrace;

      return result;
    });
}

function toFailureOutput(item: FailedTestCase): FailedTestCaseOutput {
  return {
    stage_id: item.stage_id,
    suite_name: item.suite_name,
    test_method: item.test_name ?? "",
  };
}

function failuresText(items: FailedTestCase[]): string {
  const rows = items
    .map((item) => [item.stage_id, item.suite_name, item.test_name ?? ""].join("\t"))
    .join("\n");

  return `Number of failed tests: ${items.length}${rows ? `\n\n${rows}` : ""}`;
}

function requiredString(input: Record<string, unknown>, key: string): string {
  const value = input[key];
  if (typeof value === "string" && value.length > 0) return value;
  throw new Error(`Missing required filter "${key}" for test_failure. Pass it via filters: { ${key}: "..." }.`);
}

async function listTestFailures({ client, input, config, signal }: EndpointHandlerContext): Promise<unknown> {
  const accountId = config.HARNESS_ACCOUNT_ID ?? client.account;
  const orgId = (input.org_id as string | undefined) ?? config.HARNESS_ORG;
  const projectId = (input.project_id as string | undefined) ?? config.HARNESS_PROJECT;
  const pipelineId = requiredString(input, "pipeline_id");
  const requestedBuildId = requiredString(input, "build_id");

  if (!orgId) throw new Error("org_id is required for test_failure because no HARNESS_ORG default is configured.");
  if (!projectId) throw new Error("project_id is required for test_failure because no HARNESS_PROJECT default is configured.");

  const makeBaseParams = (buildId: string): QueryParams => ({
    routingId: accountId,
    accountId,
    orgId,
    projectId,
    pipelineId,
    buildId,
  });

  let effectiveBuildId = requestedBuildId;
  let baseParams = makeBaseParams(effectiveBuildId);
  let stagesRaw = await client.request({
    method: "GET",
    path: `${TI_REPORTS_PATH}/info`,
    params: baseParams,
    headerBasedScoping: true,
    signal,
  });
  let stageSteps = normalizeStageSteps(stagesRaw);

  if (stageSteps.length === 0 && !/^\d+$/.test(requestedBuildId)) {
    const executionRaw = await client.request({
      method: "GET",
      path: `/pipeline/api/pipelines/execution/${encodeURIComponent(requestedBuildId)}`,
      params: {
        orgIdentifier: orgId,
        projectIdentifier: projectId,
      },
      signal,
    });
    const runSequence = extractRunSequence(executionRaw);
    if (runSequence) {
      effectiveBuildId = runSequence;
      baseParams = makeBaseParams(effectiveBuildId);
      stagesRaw = await client.request({
        method: "GET",
        path: `${TI_REPORTS_PATH}/info`,
        params: baseParams,
        headerBasedScoping: true,
        signal,
      });
      stageSteps = normalizeStageSteps(stagesRaw);
    }
  }

  const items: FailedTestCase[] = [];

  for (const { stageId, stepId } of stageSteps) {
    const suitesRaw = await client.request({
      method: "GET",
      path: `${TI_REPORTS_PATH}/test_suites`,
      params: {
        ...baseParams,
        report: DEFAULT_REPORT,
        pageIndex: SUITE_PAGE_INDEX,
        pageSize: SUITE_PAGE_SIZE,
        status: FAILED_STATUS,
        order: "DESC",
        stageId,
        stepId,
      },
      headerBasedScoping: true,
      signal,
    });

    for (const suiteName of normalizeSuiteNames(suitesRaw)) {
      const casesRaw = await client.request({
        method: "GET",
        path: `${TI_REPORTS_PATH}/test_cases`,
        params: {
          ...baseParams,
          report: DEFAULT_REPORT,
          suite_name: suiteName,
          status: FAILED_STATUS,
          sort: "status",
          order: "ASC",
          pageIndex: CASE_PAGE_INDEX,
          pageSize: CASE_PAGE_SIZE,
          stageId,
          stepId,
        },
        headerBasedScoping: true,
        signal,
      });

      items.push(...normalizeFailedCases(casesRaw, stageId, suiteName));
    }
  }

  return {
    failed_tests: items.length,
    format: "stage_id<TAB>suite_name<TAB>test_method",
    text: failuresText(items),
    items: items.map(toFailureOutput),
    pipeline_id: pipelineId,
    build_id: effectiveBuildId,
  };
}

export const testIntelligenceToolset: ToolsetDefinition = {
  name: "test-intelligence",
  displayName: "Test Intelligence",
  description: "Harness Test Intelligence — CI test failure reports",
  resources: [
    {
      resourceType: "test_failure",
      displayName: "Test Failure",
      description: "Failed Harness CI test cases for a pipeline build. Supports list with pipeline_id and build_id.",
      toolset: "test-intelligence",
      scope: "project",
      scopeParams: { account: "accountId", org: "orgId", project: "projectId" },
      identifierFields: [],
      listFilterFields: [
        { name: "pipeline_id", description: "Pipeline identifier for the CI build", required: true },
        { name: "build_id", description: "Build identifier for the CI run", required: true },
      ],
      searchAliases: ["test failures", "failed tests", "ci test failures", "test intelligence", "junit failures"],
      operations: {
        list: {
          method: "GET",
          path: `${TI_REPORTS_PATH}/test_cases`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          handler: listTestFailures,
          responseExtractor: (raw: unknown) => raw,
          description: "List failed test cases for a Harness CI pipeline build. Required filters: pipeline_id, build_id.",
        },
      },
    },
  ],
};
