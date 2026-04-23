import { describe, it, expect, vi } from "vitest";
import { pipelineHandler } from "../../../src/tools/diagnose/pipeline.js";
import { makeContext, makeConfig, makeExtra } from "./helpers.js";
import type { HarnessClient } from "../../../src/client/harness-client.js";
import type { Registry } from "../../../src/registry/index.js";

// Mock resolveLogContent so diagnose tests don't depend on the full log pipeline
vi.mock("../../../src/utils/log-resolver.js", () => ({
  resolveLogContent: vi.fn().mockResolvedValue("resolved log line 1\nresolved log line 2"),
}));

const NOW = 1700000000000;

function makeExecution(overrides: {
  status?: string;
  stages?: Array<{ id: string; name: string; status: string; steps?: Array<{ id: string; name: string; status: string }> }>;
  nodeMapEntries?: Record<string, Record<string, unknown>>;
} = {}) {
  const status = overrides.status ?? "Success";
  const stages = overrides.stages ?? [
    { id: "build", name: "Build", status: "Success", steps: [{ id: "compile", name: "Compile", status: "Success" }] },
  ];

  const layoutNodeMap: Record<string, Record<string, unknown>> = {
    root: {
      nodeType: "ROOT",
      nodeGroup: "ROOT",
      nodeIdentifier: "root",
      name: "pipeline",
      status,
      edgeLayoutList: { currentNodeChildren: stages.map((s) => s.id), nextIds: [] },
    },
  };

  for (const stage of stages) {
    const stepIds = (stage.steps ?? []).map((s) => s.id);
    layoutNodeMap[stage.id] = {
      nodeType: "STAGE",
      nodeGroup: "STAGE",
      nodeIdentifier: stage.id,
      name: stage.name,
      status: stage.status,
      startTs: NOW,
      endTs: NOW + 60000,
      failureInfo: stage.status === "Failed" ? { message: `${stage.name} failed` } : undefined,
      edgeLayoutList: { currentNodeChildren: stepIds, nextIds: [] },
    };

    for (const step of stage.steps ?? []) {
      layoutNodeMap[step.id] = {
        nodeType: "STEP",
        nodeIdentifier: step.id,
        name: step.name,
        status: step.status,
        startTs: NOW,
        endTs: NOW + 30000,
        failureInfo: step.status === "Failed" ? { message: `${step.name} failed` } : undefined,
        edgeLayoutList: { currentNodeChildren: [], nextIds: [] },
      };
    }
  }

  const nodeMap = overrides.nodeMapEntries ?? {};

  return {
    pipelineExecutionSummary: {
      pipelineIdentifier: "test-pipeline",
      name: "Test Pipeline",
      planExecutionId: "exec-001",
      status,
      runSequence: 42,
      startTs: NOW,
      endTs: NOW + 120000,
      layoutNodeMap,
      startingNodeId: "root",
      executionTriggerInfo: { triggerType: "MANUAL", triggeredBy: { identifier: "admin" } },
    },
    executionGraph: { nodeMap },
  };
}

function makePipelineDispatch(
  executionData: unknown,
) {
  return vi.fn(async (_c: unknown, resourceType: string, op: string, input: Record<string, unknown>) => {
    if (resourceType === "execution" && op === "get") return executionData;
    if (resourceType === "execution" && op === "list") {
      return { items: [{ planExecutionId: input.execution_id ?? "exec-001" }] };
    }
    if (resourceType === "pipeline" && op === "get") return { yaml: "pipeline: {}" };
    throw new Error(`Unmocked: ${resourceType}.${op}`);
  });
}

describe("pipelineHandler", () => {
  it("throws when both execution_id and pipeline_id are missing", async () => {
    const ctx = makeContext({ input: {} });
    await expect(pipelineHandler.diagnose(ctx)).rejects.toThrow("execution_id or pipeline_id");
  });

  it("returns summary for successful execution", async () => {
    const exec = makeExecution({ status: "Success" });
    const registry = { dispatch: makePipelineDispatch(exec), dispatchExecute: vi.fn(), getAccountId: () => "test-account" } as unknown as Registry;

    const ctx = makeContext({
      input: { execution_id: "exec-001" },
      registry,
      args: { summary: true },
    });

    const result = await pipelineHandler.diagnose(ctx);
    const execution = result.execution as Record<string, unknown>;
    const pipeline = execution.pipeline as Record<string, unknown>;

    expect(pipeline.name).toBe("Test Pipeline");
    expect((execution.execution as Record<string, unknown>).status).toBe("Success");
    expect(execution.failure).toBeUndefined();

    const stages = execution.stages as Array<Record<string, unknown>>;
    expect(stages).toHaveLength(1);
    expect(stages[0].name).toBe("Build");
  });

  it("reports failed execution with step-level errors", async () => {
    const exec = makeExecution({
      status: "Failed",
      stages: [
        { id: "deploy", name: "Deploy", status: "Failed", steps: [{ id: "helm", name: "HelmDeploy", status: "Failed" }] },
      ],
      nodeMapEntries: {
        helm: {
          uuid: "helm",
          identifier: "helm",
          name: "HelmDeploy",
          baseFqn: "pipeline.stages.deploy.spec.execution.steps.helm",
          status: "Failed",
          failureInfo: { message: "Helm template error: invalid chart" },
          delegateInfoList: [{ name: "k8s-delegate" }],
          logBaseKey: "log/helm",
        },
      },
    });

    const registry = { dispatch: makePipelineDispatch(exec), dispatchExecute: vi.fn(), getAccountId: () => "test-account" } as unknown as Registry;
    const ctx = makeContext({ input: { execution_id: "exec-001" }, registry, args: { summary: true } });

    const result = await pipelineHandler.diagnose(ctx);
    const execution = result.execution as Record<string, unknown>;
    const failure = execution.failure as Record<string, unknown>;

    expect(failure).toBeDefined();
    expect(failure.step).toBe("helm");
    expect(failure.error).toContain("Helm template error");
    expect(failure.delegate).toBe("k8s-delegate");
  });

  it("includes script_context for ShellScript failures", async () => {
    const exec = makeExecution({
      status: "Failed",
      stages: [{ id: "setup", name: "Setup", status: "Failed", steps: [{ id: "sh1", name: "RunScript", status: "Failed" }] }],
      nodeMapEntries: {
        sh1: {
          uuid: "sh1",
          identifier: "sh1",
          name: "RunScript",
          baseFqn: "pipeline.stages.setup.spec.execution.steps.sh1",
          status: "Failed",
          stepType: "ShellScript",
          failureInfo: { message: "Shell Script execution failed" },
          logBaseKey: "log/sh1",
          stepParameters: {
            name: "RunScript",
            timeout: "10m",
            spec: {
              shell: "Bash",
              source: { type: "Inline", spec: { script: "echo hello && exit 1" } },
              environmentVariables: { ENV: "prod" },
            },
          },
        },
      },
    });

    const registry = { dispatch: makePipelineDispatch(exec), dispatchExecute: vi.fn(), getAccountId: () => "test-account" } as unknown as Registry;
    const ctx = makeContext({ input: { execution_id: "exec-001" }, registry, args: { summary: true } });

    const result = await pipelineHandler.diagnose(ctx);
    const execution = result.execution as Record<string, unknown>;
    const failure = execution.failure as Record<string, unknown>;

    expect(failure.script_context).toBeDefined();
    const sc = failure.script_context as Record<string, unknown>;
    expect(sc.shell).toBe("Bash");
    expect(sc.script).toBe("echo hello && exit 1");
    expect(sc.timeout).toBe("10m");
    expect(sc.env_vars).toEqual({ ENV: "prod" });
  });

  it("diagnoses chained pipeline failure via child execution", async () => {
    const exec = makeExecution({
      status: "Failed",
      stages: [{ id: "chain", name: "Chain Stage", status: "Failed" }],
      nodeMapEntries: {
        chain: {
          uuid: "chain",
          identifier: "chain",
          name: "Chain Stage",
          baseFqn: "pipeline.stages.chain.spec.execution.steps.chain",
          status: "Failed",
          failureInfo: { message: "Pipeline stage failed" },
          stepDetails: {
            childPipelineExecutionDetails: {
              planExecutionId: "child-exec-001",
              orgId: "default",
              projectId: "test-project",
            },
          },
        },
      },
    });

    const childNodeMap = {
      childStep: {
        uuid: "childStep",
        identifier: "childStep",
        name: "ChildDeploy",
        baseFqn: "pipeline.stages.childStage.spec.execution.steps.childStep",
        status: "Failed",
        failureInfo: { message: "Child deploy failed" },
        delegateInfoList: [{ name: "child-delegate" }],
      },
    };

    const clientMock = {
      request: vi.fn().mockResolvedValue({
        data: {
          executionGraph: { nodeMap: childNodeMap },
          pipelineExecutionSummary: { planExecutionId: "child-exec-001" },
        },
      }),
      account: "test-account",
    } as unknown as HarnessClient;

    const registry = { dispatch: makePipelineDispatch(exec), dispatchExecute: vi.fn(), getAccountId: () => "test-account" } as unknown as Registry;
    const ctx = makeContext({ input: { execution_id: "exec-001" }, registry, client: clientMock, args: { summary: true } });

    const result = await pipelineHandler.diagnose(ctx);
    const execution = result.execution as Record<string, unknown>;
    const childPipeline = execution.child_pipeline as Record<string, unknown>;

    expect(childPipeline).toBeDefined();
    expect(childPipeline.execution_id).toBe("child-exec-001");
    const childFailure = childPipeline.failure as Record<string, unknown>;
    expect(childFailure.step).toBe("childStep");
    expect(childFailure.error).toContain("Child deploy failed");
  });

  it("includes pipeline YAML when include_yaml is true", async () => {
    const exec = makeExecution();
    const registry = { dispatch: makePipelineDispatch(exec), dispatchExecute: vi.fn(), getAccountId: () => "test-account" } as unknown as Registry;
    const ctx = makeContext({
      input: { execution_id: "exec-001" },
      registry,
      args: { summary: false, include_yaml: true },
    });

    const result = await pipelineHandler.diagnose(ctx);

    expect(result.pipeline).toEqual({ yaml: "pipeline: {}" });
  });

  it("fetches logs for failed steps when include_logs is true", async () => {
    const exec = makeExecution({
      status: "Failed",
      stages: [{ id: "s1", name: "Stage1", status: "Failed", steps: [{ id: "step1", name: "Step1", status: "Failed" }] }],
      nodeMapEntries: {
        step1: {
          uuid: "step1",
          identifier: "step1",
          name: "Step1",
          baseFqn: "pipeline.stages.s1.spec.execution.steps.step1",
          status: "Failed",
          failureInfo: { message: "Step1 error" },
          logBaseKey: "log/step1",
        },
      },
    });

    const registry = { dispatch: makePipelineDispatch(exec), dispatchExecute: vi.fn(), getAccountId: () => "test-account" } as unknown as Registry;
    const ctx = makeContext({
      input: { execution_id: "exec-001" },
      registry,
      args: { summary: false, include_logs: true },
    });

    const result = await pipelineHandler.diagnose(ctx);

    expect(result.failed_step_logs).toBeDefined();
    const logs = result.failed_step_logs as Record<string, unknown>;
    // resolveLogContent is mocked to return "resolved log line 1\nresolved log line 2"
    expect(logs["s1/step1"]).toBe("resolved log line 1\nresolved log line 2");
  });

  it("truncates long logs to log_snippet_lines", async () => {
    // Override resolveLogContent mock to return a long log for this test
    const { resolveLogContent } = await import("../../../src/utils/log-resolver.js");
    const longLog = Array.from({ length: 200 }, (_, i) => `log line ${i + 1}`).join("\n");
    (resolveLogContent as ReturnType<typeof vi.fn>).mockResolvedValueOnce(longLog);

    const exec = makeExecution({
      status: "Failed",
      stages: [{ id: "s1", name: "S1", status: "Failed", steps: [{ id: "st1", name: "ST1", status: "Failed" }] }],
      nodeMapEntries: {
        st1: {
          uuid: "st1", identifier: "st1", name: "ST1",
          baseFqn: "pipeline.stages.s1.spec.execution.steps.st1",
          status: "Failed", failureInfo: { message: "err" }, logBaseKey: "log/st1",
        },
      },
    });

    const registry = { dispatch: makePipelineDispatch(exec), dispatchExecute: vi.fn(), getAccountId: () => "test-account" } as unknown as Registry;
    const ctx = makeContext({
      input: { execution_id: "exec-001" },
      registry,
      args: { summary: false, include_logs: true, log_snippet_lines: 50 },
    });

    const result = await pipelineHandler.diagnose(ctx);
    const logs = result.failed_step_logs as Record<string, unknown>;
    const entry = logs["s1/st1"] as Record<string, unknown>;

    expect(entry.truncated).toBe(true);
    expect(entry.total_lines).toBe(200);
    expect((entry.log_snippet as string)).toContain("lines omitted");
  });

  it("fetches log for explicitly requested step even when it passed", async () => {
    const exec = makeExecution({
      status: "Success",
      stages: [{ id: "s1", name: "Stage1", status: "Success", steps: [{ id: "step-passed", name: "Deploy", status: "Success" }] }],
      nodeMapEntries: {
        "step-passed": {
          uuid: "step-passed",
          identifier: "step-passed",
          name: "Deploy",
          baseFqn: "pipeline.stages.s1.spec.execution.steps.step-passed",
          status: "Success",
          logBaseKey: "log/step-passed",
        },
      },
    });

    const registry = { dispatch: makePipelineDispatch(exec), dispatchExecute: vi.fn(), getAccountId: () => "test-account" } as unknown as Registry;
    const ctx = makeContext({
      // step_id is set by the URL parser from ?step=<nodeExecutionId>
      input: { execution_id: "exec-001", step_id: "step-passed" },
      registry,
      args: { summary: true, include_logs: true },
    });

    const result = await pipelineHandler.diagnose(ctx);

    // No failed_step_logs since nothing failed
    expect(result.failed_step_logs).toBeUndefined();

    // But requested_step_log should be present for the passed step
    expect(result.requested_step_log).toBeDefined();
    const stepLog = result.requested_step_log as Record<string, unknown>;
    expect(stepLog.step_id).toBe("step-passed");
    expect(stepLog.step).toBe("step-passed");
    expect(stepLog.status).toBe("Success");
    expect(stepLog.log).toBe("resolved log line 1\nresolved log line 2");
  });

  it("returns requested_step_log alongside failed_step_logs when step is explicitly requested", async () => {
    const exec = makeExecution({
      status: "Failed",
      stages: [{ id: "s1", name: "S1", status: "Failed", steps: [
        { id: "step-failed", name: "FailedStep", status: "Failed" },
        { id: "step-passed", name: "PassedStep", status: "Success" },
      ]}],
      nodeMapEntries: {
        "step-failed": {
          uuid: "step-failed", identifier: "step-failed", name: "FailedStep",
          baseFqn: "pipeline.stages.s1.spec.execution.steps.step-failed",
          status: "Failed", failureInfo: { message: "step error" }, logBaseKey: "log/step-failed",
        },
        "step-passed": {
          uuid: "step-passed", identifier: "step-passed", name: "PassedStep",
          baseFqn: "pipeline.stages.s1.spec.execution.steps.step-passed",
          status: "Success", logBaseKey: "log/step-passed",
        },
      },
    });

    const registry = { dispatch: makePipelineDispatch(exec), dispatchExecute: vi.fn(), getAccountId: () => "test-account" } as unknown as Registry;
    const ctx = makeContext({
      input: { execution_id: "exec-001", step_id: "step-passed" },
      registry,
      args: { summary: false, include_logs: true },
    });

    const result = await pipelineHandler.diagnose(ctx);

    // Failed step logs still present
    expect(result.failed_step_logs).toBeDefined();
    // Requested passed step log also present
    expect(result.requested_step_log).toBeDefined();
    const stepLog = result.requested_step_log as Record<string, unknown>;
    expect(stepLog.status).toBe("Success");
    expect(stepLog.step).toBe("step-passed");
  });

  it("returns error message when requested step_id is not in execution graph", async () => {
    const exec = makeExecution({ status: "Success" });
    const registry = { dispatch: makePipelineDispatch(exec), dispatchExecute: vi.fn(), getAccountId: () => "test-account" } as unknown as Registry;
    const ctx = makeContext({
      input: { execution_id: "exec-001", step_id: "non-existent-step-id" },
      registry,
      args: { summary: true, include_logs: true },
    });

    const result = await pipelineHandler.diagnose(ctx);

    expect(result.requested_step_log).toBeDefined();
    const stepLog = result.requested_step_log as Record<string, unknown>;
    expect(stepLog.step_id).toBe("non-existent-step-id");
    expect(stepLog.error).toContain("not found in execution graph");
  });

  it("returns error when requested step is in graph but has no logBaseKey", async () => {
    const exec = makeExecution({
      status: "Success",
      nodeMapEntries: {
        "step-no-key": {
          uuid: "step-no-key",
          identifier: "step-no-key",
          name: "TemplateStep",
          baseFqn: "pipeline.stages.s1.spec.execution.steps.step-no-key",
          status: "Success",
          // no logBaseKey — happens with remote template steps
        },
      },
    });

    const registry = { dispatch: makePipelineDispatch(exec), dispatchExecute: vi.fn(), getAccountId: () => "test-account" } as unknown as Registry;
    const ctx = makeContext({
      input: { execution_id: "exec-001", step_id: "step-no-key" },
      registry,
      args: { summary: true, include_logs: true },
    });

    const result = await pipelineHandler.diagnose(ctx);

    expect(result.requested_step_log).toBeDefined();
    const stepLog = result.requested_step_log as Record<string, unknown>;
    expect(stepLog.step).toBe("step-no-key");
    expect(stepLog.status).toBe("Success");
    expect(stepLog.error).toContain("No logBaseKey available");
  });

  it("does not fetch step log when include_logs is false even if step_id is provided", async () => {
    const exec = makeExecution({
      status: "Success",
      nodeMapEntries: {
        "step-passed": {
          uuid: "step-passed", identifier: "step-passed", name: "Deploy",
          baseFqn: "pipeline.stages.s1.spec.execution.steps.step-passed",
          status: "Success", logBaseKey: "log/step-passed",
        },
      },
    });

    const registry = { dispatch: makePipelineDispatch(exec), dispatchExecute: vi.fn(), getAccountId: () => "test-account" } as unknown as Registry;
    const ctx = makeContext({
      input: { execution_id: "exec-001", step_id: "step-passed" },
      registry,
      args: { summary: true, include_logs: false },
    });

    const result = await pipelineHandler.diagnose(ctx);

    expect(result.requested_step_log).toBeUndefined();
  });

  it("returns error in requested_step_log when log resolution fails for requested step", async () => {
    const { resolveLogContent } = await import("../../../src/utils/log-resolver.js");
    (resolveLogContent as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("Log blob not ready after 3 attempts (status: queued)"),
    );

    const exec = makeExecution({
      status: "Success",
      nodeMapEntries: {
        "step-ok": {
          uuid: "step-ok", identifier: "step-ok", name: "Deploy",
          baseFqn: "pipeline.stages.s1.spec.execution.steps.step-ok",
          status: "Success", logBaseKey: "log/step-ok",
        },
      },
    });

    const registry = { dispatch: makePipelineDispatch(exec), dispatchExecute: vi.fn(), getAccountId: () => "test-account" } as unknown as Registry;
    const ctx = makeContext({
      input: { execution_id: "exec-001", step_id: "step-ok" },
      registry,
      args: { summary: true, include_logs: true },
    });

    const result = await pipelineHandler.diagnose(ctx);

    expect(result.requested_step_log).toBeDefined();
    const stepLog = result.requested_step_log as Record<string, unknown>;
    expect(stepLog.status).toBe("Success");
    expect(stepLog.error).toContain("not ready after 3 attempts");
    // log field should not be present on error
    expect(stepLog.log).toBeUndefined();
  });

  it("truncates long log for requested step when log_snippet_lines is set", async () => {
    const { resolveLogContent } = await import("../../../src/utils/log-resolver.js");
    const longLog = Array.from({ length: 200 }, (_, i) => `line ${i + 1}`).join("\n");
    (resolveLogContent as ReturnType<typeof vi.fn>).mockResolvedValueOnce(longLog);

    const exec = makeExecution({
      status: "Success",
      nodeMapEntries: {
        "step-verbose": {
          uuid: "step-verbose", identifier: "step-verbose", name: "VerboseStep",
          baseFqn: "pipeline.stages.s1.spec.execution.steps.step-verbose",
          status: "Success", logBaseKey: "log/step-verbose",
        },
      },
    });

    const registry = { dispatch: makePipelineDispatch(exec), dispatchExecute: vi.fn(), getAccountId: () => "test-account" } as unknown as Registry;
    const ctx = makeContext({
      input: { execution_id: "exec-001", step_id: "step-verbose" },
      registry,
      args: { summary: true, include_logs: true, log_snippet_lines: 50 },
    });

    const result = await pipelineHandler.diagnose(ctx);

    expect(result.requested_step_log).toBeDefined();
    const stepLog = result.requested_step_log as Record<string, unknown>;
    const logEntry = stepLog.log as Record<string, unknown>;
    expect(logEntry.truncated).toBe(true);
    expect(logEntry.total_lines).toBe(200);
    expect((logEntry.log_snippet as string)).toContain("lines omitted");
  });

  it("does not double-fetch log when requested step_id is already a failed step", async () => {
    const exec = makeExecution({
      status: "Failed",
      stages: [{ id: "s1", name: "S1", status: "Failed", steps: [{ id: "step-failed", name: "FailedStep", status: "Failed" }] }],
      nodeMapEntries: {
        "step-failed": {
          uuid: "step-failed", identifier: "step-failed", name: "FailedStep",
          baseFqn: "pipeline.stages.s1.spec.execution.steps.step-failed",
          status: "Failed", failureInfo: { message: "step error" }, logBaseKey: "log/step-failed",
        },
      },
    });

    const { resolveLogContent } = await import("../../../src/utils/log-resolver.js");
    const mockFn = resolveLogContent as ReturnType<typeof vi.fn>;
    mockFn.mockClear();

    const registry = { dispatch: makePipelineDispatch(exec), dispatchExecute: vi.fn(), getAccountId: () => "test-account" } as unknown as Registry;
    const ctx = makeContext({
      // step_id points to the same step that is also in failedNodes
      input: { execution_id: "exec-001", step_id: "step-failed" },
      registry,
      args: { summary: false, include_logs: true },
    });

    const result = await pipelineHandler.diagnose(ctx);

    // Log was fetched only once (for failed_step_logs), not twice
    expect(mockFn).toHaveBeenCalledTimes(1);

    // failed_step_logs still has the entry
    expect(result.failed_step_logs).toBeDefined();

    // requested_step_log is NOT set because the step was already covered in failed_step_logs
    expect(result.requested_step_log).toBeUndefined();
  });

  it("fetches requested_step_log even when step_id is a failed step truncated by max_failed_steps", async () => {
    // If there are more failed steps than max_failed_steps allows, the capped list
    // excludes some. A step_id pointing to a truncated failure must still get
    // requested_step_log — it was never actually fetched in failed_step_logs.
    const exec = makeExecution({
      status: "Failed",
      stages: [{ id: "s1", name: "S1", status: "Failed", steps: [
        { id: "step-a", name: "StepA", status: "Failed" },
        { id: "step-b", name: "StepB", status: "Failed" },
      ]}],
      nodeMapEntries: {
        "step-a": {
          uuid: "step-a", identifier: "step-a", name: "StepA",
          baseFqn: "pipeline.stages.s1.spec.execution.steps.step-a",
          status: "Failed", failureInfo: { message: "err-a" }, logBaseKey: "log/step-a",
        },
        "step-b": {
          uuid: "step-b", identifier: "step-b", name: "StepB",
          baseFqn: "pipeline.stages.s1.spec.execution.steps.step-b",
          status: "Failed", failureInfo: { message: "err-b" }, logBaseKey: "log/step-b",
        },
      },
    });

    const registry = { dispatch: makePipelineDispatch(exec), dispatchExecute: vi.fn(), getAccountId: () => "test-account" } as unknown as Registry;
    const ctx = makeContext({
      // step-b is the second failed step; max_failed_steps=1 caps at step-a only
      input: { execution_id: "exec-001", step_id: "step-b" },
      registry,
      args: { summary: false, include_logs: true, max_failed_steps: 1 },
    });

    const result = await pipelineHandler.diagnose(ctx);

    // Only step-a fetched in failed_step_logs (capped)
    const failedLogs = result.failed_step_logs as Record<string, unknown>;
    expect(Object.keys(failedLogs)).toHaveLength(1);
    expect(failedLogs["s1/step-a"]).toBeDefined();

    // step-b was truncated — must still appear via requested_step_log
    expect(result.requested_step_log).toBeDefined();
    const stepLog = result.requested_step_log as Record<string, unknown>;
    expect(stepLog.step).toBe("step-b");
    expect(stepLog.status).toBe("Failed");
  });

  it("does not set requested_step_log when execution graph has no nodeMap", async () => {
    // Simulates template-based pipelines where executionGraph.nodeMap is not returned
    const exec = {
      pipelineExecutionSummary: {
        pipelineIdentifier: "test-pipeline",
        name: "Test Pipeline",
        planExecutionId: "exec-001",
        status: "Success",
        runSequence: 1,
        startTs: NOW,
        endTs: NOW + 60000,
        layoutNodeMap: {
          root: {
            nodeType: "ROOT", nodeGroup: "ROOT", nodeIdentifier: "root",
            name: "pipeline", status: "Success",
            edgeLayoutList: { currentNodeChildren: [], nextIds: [] },
          },
        },
        startingNodeId: "root",
        executionTriggerInfo: { triggerType: "MANUAL", triggeredBy: { identifier: "admin" } },
      },
      executionGraph: {}, // no nodeMap — as seen in remote-template pipelines
    };

    const registry = { dispatch: makePipelineDispatch(exec), dispatchExecute: vi.fn(), getAccountId: () => "test-account" } as unknown as Registry;
    const ctx = makeContext({
      input: { execution_id: "exec-001", step_id: "some-step-id" },
      registry,
      args: { summary: true, include_logs: true },
    });

    const result = await pipelineHandler.diagnose(ctx);

    // When graph has no nodeMap, graphNodeMap is undefined — condition short-circuits,
    // no requested_step_log is set (caller gets no false positives)
    expect(result.requested_step_log).toBeUndefined();
  });

  it("returns error when log resolution fails", async () => {
    // Override resolveLogContent mock to throw for this test
    const { resolveLogContent } = await import("../../../src/utils/log-resolver.js");
    (resolveLogContent as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("Log blob not ready after 3 attempts (status: queued)"),
    );

    const exec = makeExecution({
      status: "Failed",
      stages: [{ id: "s1", name: "S1", status: "Failed", steps: [{ id: "st1", name: "ST1", status: "Failed" }] }],
      nodeMapEntries: {
        st1: {
          uuid: "st1", identifier: "st1", name: "ST1",
          baseFqn: "pipeline.stages.s1.spec.execution.steps.st1",
          status: "Failed", failureInfo: { message: "err" }, logBaseKey: "log/st1",
        },
      },
    });

    const registry = { dispatch: makePipelineDispatch(exec), dispatchExecute: vi.fn(), getAccountId: () => "test-account" } as unknown as Registry;
    const ctx = makeContext({
      input: { execution_id: "exec-001" },
      registry,
      args: { summary: false, include_logs: true },
    });

    const result = await pipelineHandler.diagnose(ctx);
    const logs = result.failed_step_logs as Record<string, unknown>;
    const entry = logs["s1/st1"] as Record<string, unknown>;

    expect(entry.error).toContain("not ready after 3 attempts");
  });

  it("auto-fetches log for main step when execution succeeds and no step_id is given", async () => {
    const exec = makeExecution({
      status: "Success",
      stages: [{ id: "build", name: "Build", status: "Success", steps: [{ id: "run_tests", name: "RunTests", status: "Success" }] }],
      nodeMapEntries: {
        "stage-node": {
          uuid: "stage-node",
          identifier: "build",
          baseFqn: "pipeline.stages.build",
          status: "Success",
          logBaseKey: "log/build",
        },
        "run_tests": {
          uuid: "run_tests",
          identifier: "run_tests",
          name: "RunTests",
          baseFqn: "pipeline.stages.build.spec.execution.steps.run_tests",
          status: "Success",
          logBaseKey: "log/build/steps/run_tests",
        },
      },
    });

    const registry = { dispatch: makePipelineDispatch(exec), dispatchExecute: vi.fn(), getAccountId: () => "test-account" } as unknown as Registry;
    const ctx = makeContext({
      input: { execution_id: "exec-001" },  // no step_id
      registry,
      args: { summary: true, include_logs: true },
    });

    const result = await pipelineHandler.diagnose(ctx);

    // No failed steps
    expect(result.failed_step_logs).toBeUndefined();

    // Auto-detected the deepest step and fetched its log
    expect(result.requested_step_log).toBeDefined();
    const stepLog = result.requested_step_log as Record<string, unknown>;
    expect(stepLog.step).toBe("run_tests");
    expect(stepLog.status).toBe("Success");
    expect(stepLog.log).toBe("resolved log line 1\nresolved log line 2");
  });

  it("does not auto-fetch logs when include_logs is false even for successful execution", async () => {
    const exec = makeExecution({
      status: "Success",
      nodeMapEntries: {
        "run_tests": {
          uuid: "run_tests", identifier: "run_tests", name: "RunTests",
          baseFqn: "pipeline.stages.build.spec.execution.steps.run_tests",
          status: "Success", logBaseKey: "log/build/steps/run_tests",
        },
      },
    });

    const registry = { dispatch: makePipelineDispatch(exec), dispatchExecute: vi.fn(), getAccountId: () => "test-account" } as unknown as Registry;
    const ctx = makeContext({
      input: { execution_id: "exec-001" },
      registry,
      args: { summary: true, include_logs: false },
    });

    const result = await pipelineHandler.diagnose(ctx);

    expect(result.requested_step_log).toBeUndefined();
  });

  it("does not auto-fetch when execution has failed steps (uses failed_step_logs instead)", async () => {
    const exec = makeExecution({
      status: "Failed",
      stages: [{ id: "s1", name: "S1", status: "Failed", steps: [{ id: "step1", name: "FailStep", status: "Failed" }] }],
      nodeMapEntries: {
        step1: {
          uuid: "step1", identifier: "step1", name: "FailStep",
          baseFqn: "pipeline.stages.s1.spec.execution.steps.step1",
          status: "Failed", failureInfo: { message: "err" }, logBaseKey: "log/step1",
        },
      },
    });

    const { resolveLogContent } = await import("../../../src/utils/log-resolver.js");
    const mockFn = resolveLogContent as ReturnType<typeof vi.fn>;
    mockFn.mockClear();

    const registry = { dispatch: makePipelineDispatch(exec), dispatchExecute: vi.fn(), getAccountId: () => "test-account" } as unknown as Registry;
    const ctx = makeContext({
      input: { execution_id: "exec-001" },  // no step_id
      registry,
      args: { summary: false, include_logs: true },
    });

    const result = await pipelineHandler.diagnose(ctx);

    // Failed step logs are present
    expect(result.failed_step_logs).toBeDefined();

    // Auto-fetch should NOT have run because failed_step_logs was already populated
    // resolveLogContent should have been called exactly once (for the failed step)
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it("auto-fetch picks deepest step when multiple steps have logBaseKeys", async () => {
    const exec = makeExecution({
      status: "Success",
      stages: [{ id: "build", name: "Build", status: "Success", steps: [
        { id: "setup", name: "Setup", status: "Success" },
        { id: "test", name: "Test", status: "Success" },
      ]}],
      nodeMapEntries: {
        "setup": {
          uuid: "setup", identifier: "setup", name: "Setup",
          baseFqn: "pipeline.stages.build.spec.execution.steps.setup",
          status: "Success", logBaseKey: "log/setup",
        },
        "test": {
          uuid: "test", identifier: "test", name: "Test",
          baseFqn: "pipeline.stages.build.spec.execution.steps.test",
          status: "Success", logBaseKey: "log/build/steps/test/longer",
        },
      },
    });

    const registry = { dispatch: makePipelineDispatch(exec), dispatchExecute: vi.fn(), getAccountId: () => "test-account" } as unknown as Registry;
    const ctx = makeContext({
      input: { execution_id: "exec-001" },
      registry,
      args: { summary: true, include_logs: true },
    });

    const result = await pipelineHandler.diagnose(ctx);

    expect(result.requested_step_log).toBeDefined();
    const stepLog = result.requested_step_log as Record<string, unknown>;
    // Should pick "test" — it has the longer logBaseKey
    expect(stepLog.step).toBe("test");
  });

  it("auto-fetch does not run when no nodeMap is available", async () => {
    const exec = {
      pipelineExecutionSummary: {
        pipelineIdentifier: "test-pipeline",
        name: "Test Pipeline",
        planExecutionId: "exec-001",
        status: "Success",
        runSequence: 1,
        startTs: NOW,
        endTs: NOW + 60000,
        layoutNodeMap: {
          root: {
            nodeType: "ROOT", nodeGroup: "ROOT", nodeIdentifier: "root",
            name: "pipeline", status: "Success",
            edgeLayoutList: { currentNodeChildren: [], nextIds: [] },
          },
        },
        startingNodeId: "root",
        executionTriggerInfo: { triggerType: "MANUAL", triggeredBy: { identifier: "admin" } },
      },
      executionGraph: {}, // no nodeMap
    };

    const registry = { dispatch: makePipelineDispatch(exec), dispatchExecute: vi.fn(), getAccountId: () => "test-account" } as unknown as Registry;
    const ctx = makeContext({
      input: { execution_id: "exec-001" },
      registry,
      args: { summary: true, include_logs: true },
    });

    const result = await pipelineHandler.diagnose(ctx);

    // No nodeMap → auto-fetch should not run
    expect(result.requested_step_log).toBeUndefined();
  });

  it("auto-fetch skips when no nodes have logBaseKeys", async () => {
    const exec = makeExecution({
      status: "Success",
      nodeMapEntries: {
        "step-no-key": {
          uuid: "step-no-key", identifier: "step-no-key", name: "TemplateStep",
          baseFqn: "pipeline.stages.s1.spec.execution.steps.step-no-key",
          status: "Success",
          // no logBaseKey
        },
      },
    });

    const registry = { dispatch: makePipelineDispatch(exec), dispatchExecute: vi.fn(), getAccountId: () => "test-account" } as unknown as Registry;
    const ctx = makeContext({
      input: { execution_id: "exec-001" },
      registry,
      args: { summary: true, include_logs: true },
    });

    const result = await pipelineHandler.diagnose(ctx);

    // No logBaseKey in any node → no auto-fetch
    expect(result.requested_step_log).toBeUndefined();
  });

  it("auto-fetch does not run when explicit step_id is provided", async () => {
    const exec = makeExecution({
      status: "Success",
      nodeMapEntries: {
        "step-a": {
          uuid: "step-a", identifier: "step-a", name: "StepA",
          baseFqn: "pipeline.stages.s1.spec.execution.steps.step-a",
          status: "Success", logBaseKey: "log/step-a",
        },
        "step-b": {
          uuid: "step-b", identifier: "step-b", name: "StepB",
          baseFqn: "pipeline.stages.s1.spec.execution.steps.step-b",
          status: "Success", logBaseKey: "log/step-b/deeper",
        },
      },
    });

    const registry = { dispatch: makePipelineDispatch(exec), dispatchExecute: vi.fn(), getAccountId: () => "test-account" } as unknown as Registry;
    const ctx = makeContext({
      // Explicit step_id — should use the requested_step path, not auto-fetch
      input: { execution_id: "exec-001", step_id: "step-a" },
      registry,
      args: { summary: true, include_logs: true },
    });

    const result = await pipelineHandler.diagnose(ctx);

    // Should fetch step-a specifically, not auto-detect step-b
    expect(result.requested_step_log).toBeDefined();
    const stepLog = result.requested_step_log as Record<string, unknown>;
    expect(stepLog.step).toBe("step-a");
  });

  it("auto-fetch handles resolveLogContent failure gracefully", async () => {
    const { resolveLogContent } = await import("../../../src/utils/log-resolver.js");
    (resolveLogContent as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("Download timeout"),
    );

    const exec = makeExecution({
      status: "Success",
      nodeMapEntries: {
        "step-ok": {
          uuid: "step-ok", identifier: "step-ok", name: "MainStep",
          baseFqn: "pipeline.stages.s1.spec.execution.steps.step-ok",
          status: "Success", logBaseKey: "log/step-ok",
        },
      },
    });

    const registry = { dispatch: makePipelineDispatch(exec), dispatchExecute: vi.fn(), getAccountId: () => "test-account" } as unknown as Registry;
    const ctx = makeContext({
      input: { execution_id: "exec-001" },
      registry,
      args: { summary: true, include_logs: true },
    });

    const result = await pipelineHandler.diagnose(ctx);

    // Should still populate requested_step_log with error, not throw
    expect(result.requested_step_log).toBeDefined();
    const stepLog = result.requested_step_log as Record<string, unknown>;
    expect(stepLog.step).toBe("step-ok");
    expect(stepLog.error).toContain("Download timeout");
    expect(stepLog.log).toBeUndefined();
  });
});
