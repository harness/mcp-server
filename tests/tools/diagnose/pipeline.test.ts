import { describe, it, expect, vi } from "vitest";
import { pipelineHandler } from "../../../src/tools/diagnose/pipeline.js";
import { makeContext, makeConfig, makeExtra } from "./helpers.js";
import type { HarnessClient } from "../../../src/client/harness-client.js";
import type { Registry } from "../../../src/registry/index.js";

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
  extras: Record<string, Record<string, unknown>> = {},
) {
  return vi.fn(async (_c: unknown, resourceType: string, op: string, input: Record<string, unknown>) => {
    if (resourceType === "execution" && op === "get") return executionData;
    if (resourceType === "execution" && op === "list") {
      return { items: [{ planExecutionId: input.execution_id ?? "exec-001" }] };
    }
    if (resourceType === "pipeline" && op === "get") return { yaml: "pipeline: {}" };
    if (resourceType === "execution_log" && op === "get") {
      return extras.logs?.[(input.prefix as string)] ?? "line1\nline2\nline3";
    }
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
    const registry = { dispatch: makePipelineDispatch(exec), dispatchExecute: vi.fn() } as unknown as Registry;

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

    const registry = { dispatch: makePipelineDispatch(exec), dispatchExecute: vi.fn() } as unknown as Registry;
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

    const registry = { dispatch: makePipelineDispatch(exec), dispatchExecute: vi.fn() } as unknown as Registry;
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

    const registry = { dispatch: makePipelineDispatch(exec), dispatchExecute: vi.fn() } as unknown as Registry;
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
    const registry = { dispatch: makePipelineDispatch(exec), dispatchExecute: vi.fn() } as unknown as Registry;
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

    const registry = { dispatch: makePipelineDispatch(exec), dispatchExecute: vi.fn() } as unknown as Registry;
    const ctx = makeContext({
      input: { execution_id: "exec-001" },
      registry,
      args: { summary: false, include_logs: true },
    });

    const result = await pipelineHandler.diagnose(ctx);

    expect(result.failed_step_logs).toBeDefined();
    const logs = result.failed_step_logs as Record<string, unknown>;
    expect(logs["s1/step1"]).toBe("line1\nline2\nline3");
  });

  it("truncates long logs to log_snippet_lines", async () => {
    const longLog = Array.from({ length: 200 }, (_, i) => `log line ${i + 1}`).join("\n");
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

    const dispatch = vi.fn(async (_c: unknown, resourceType: string, op: string) => {
      if (resourceType === "execution" && op === "get") return exec;
      if (resourceType === "execution_log" && op === "get") return longLog;
      throw new Error(`Unmocked: ${resourceType}.${op}`);
    });

    const registry = { dispatch, dispatchExecute: vi.fn() } as unknown as Registry;
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

  it("returns logs_unavailable for archived zip-queued logs", async () => {
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

    const dispatch = vi.fn(async (_c: unknown, resourceType: string, op: string) => {
      if (resourceType === "execution" && op === "get") return exec;
      if (resourceType === "execution_log" && op === "get") return { link: "https://logs.harness.io/zip/123", status: "queued" };
      throw new Error(`Unmocked: ${resourceType}.${op}`);
    });

    const registry = { dispatch, dispatchExecute: vi.fn() } as unknown as Registry;
    const ctx = makeContext({
      input: { execution_id: "exec-001" },
      registry,
      args: { summary: false, include_logs: true },
    });

    const result = await pipelineHandler.diagnose(ctx);
    const logs = result.failed_step_logs as Record<string, unknown>;
    const entry = logs["s1/st1"] as Record<string, unknown>;

    expect(entry.logs_unavailable).toBe(true);
    expect(entry.reason).toContain("archived");
  });
});
