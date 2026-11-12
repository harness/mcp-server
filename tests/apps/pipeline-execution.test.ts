import { describe, it, expect } from "vitest";
import { buildPendingExecutionView, buildPipelineExecutionView, type ExecutionViewContext } from "../../src/apps/pipeline-execution.js";

const ctx: ExecutionViewContext = {
  orgId: "Field_Engineering",
  projectId: "AcmeLabs",
  deepLink: (template, params) =>
    "https://app.harness.io" +
    template.replace("{accountId}", "acct").replace(/\{(\w+)\}/g, (_, key: string) => params[key] ?? ""),
};

function layoutNode(id: string, name: string, status: string, extra: Record<string, unknown> = {}) {
  return {
    nodeType: "Deployment",
    nodeGroup: "STAGE",
    nodeIdentifier: id,
    name,
    status,
    edgeLayoutList: { currentNodeChildren: [], nextIds: [] as string[] },
    ...extra,
  };
}

/** Build → [Scan | Test] (parallel) → Deploy (skipped). Build failed. */
function failedExecution() {
  return {
    pipelineExecutionSummary: {
      planExecutionId: "hXQzWgq5",
      pipelineIdentifier: "AIDLC_Banking",
      name: "AI SDLC Banking",
      orgIdentifier: "sandbox",
      projectIdentifier: "luisredda",
      runSequence: 307,
      status: "Failed",
      startTs: 1_000_000,
      endTs: 1_009_000,
      executionTriggerInfo: { triggerType: "MANUAL", triggeredBy: { identifier: "luis", extraInfo: { email: "luis.redda@harness.io" } } },
      executionErrorInfo: { message: "Manual codebase git task needs one of PR number, branch, commitSha or tag." },
      startingNodeId: "n-build",
      layoutNodeMap: {
        "n-build": { ...layoutNode("build", "Build", "Failed", { startTs: 1_000_000, endTs: 1_009_000 }), edgeLayoutList: { currentNodeChildren: [], nextIds: ["n-par"] } },
        "n-par": { nodeType: "parallel", nodeGroup: "STAGE", edgeLayoutList: { currentNodeChildren: ["n-scan", "n-test"], nextIds: ["n-deploy"] } },
        "n-scan": layoutNode("scan", "Scan", "Skipped"),
        "n-test": layoutNode("test", "Test", "Skipped"),
        "n-deploy": layoutNode("deploy", "Deploy", "NotStarted"),
      },
    },
    executionGraph: {
      nodeMap: {
        a: { baseFqn: "pipeline.stages.build.spec.execution.steps.clone", name: "Clone", status: "Failed", stepType: "GitClone", startTs: 1, failureInfo: { message: "clone failed" } },
        b: { baseFqn: "pipeline.stages.build.spec.execution.steps.compile", name: "Compile", status: "NotStarted", stepType: "Run", startTs: 2 },
        c: { baseFqn: "pipeline.stages.build.spec.execution", name: "Execution", status: "Failed", stepType: "NG_EXECUTION" },
      },
    },
  };
}

describe("buildPipelineExecutionView", () => {
  it("builds the failed-run card from the execution v2 response", () => {
    const view = buildPipelineExecutionView(failedExecution(), ctx)!;
    expect(view).toMatchObject({
      kind: "pipeline_execution",
      execution_id: "hXQzWgq5",
      run_sequence: 307,
      pipeline: { name: "AI SDLC Banking", identifier: "AIDLC_Banking" },
      scope: { org: "sandbox", project: "luisredda" },
      status: { label: "Failed", tone: "danger" },
      terminal: true,
      started_at: 1_000_000,
      ended_at: 1_009_000,
      trigger: { type: "MANUAL", by: "luis.redda@harness.io" },
      current_stage_index: 0,
      failure: {
        stage: "Build",
        step: "Clone",
        message: "Manual codebase git task needs one of PR number, branch, commitSha or tag.",
      },
    });
    expect(view.awaiting_action).toBeUndefined();
  });

  it("walks stages in order, groups parallel stages, and marks skipped ones", () => {
    const view = buildPipelineExecutionView(failedExecution(), ctx)!;
    expect(view.stages.map((s) => [s.id, s.parallel_group, s.skipped ?? false])).toEqual([
      ["build", undefined, false],
      ["scan", "n-par", true],
      ["test", "n-par", true],
      ["deploy", undefined, false],
    ]);
    expect(view.stages[0]).toMatchObject({ steps_total: 2, steps_done: 1 });
  });

  it("links to the execution in its own org and project, and refreshes with harness_get in that scope", () => {
    const view = buildPipelineExecutionView(failedExecution(), ctx)!;
    expect(view.open_in_harness).toBe(
      "https://app.harness.io/ng/account/acct/all/orgs/sandbox/projects/luisredda/pipelines/AIDLC_Banking/deployments/hXQzWgq5/pipeline",
    );
    expect(view.refresh).toEqual({
      tool: "harness_get",
      arguments: { resource_type: "execution", resource_id: "hXQzWgq5", org_id: "sandbox", project_id: "luisredda" },
    });
  });

  it("shows the running stage, its current step, and keeps refreshing", () => {
    const raw = failedExecution();
    const pes = raw.pipelineExecutionSummary as Record<string, unknown>;
    pes.status = "Running";
    delete pes.endTs;
    delete pes.executionErrorInfo;
    (pes.layoutNodeMap as Record<string, Record<string, unknown>>)["n-build"]!.status = "Running";
    const nodes = raw.executionGraph.nodeMap as Record<string, Record<string, unknown>>;
    nodes.a!.status = "Success";
    nodes.b!.status = "Running";

    const view = buildPipelineExecutionView(raw, ctx)!;
    expect(view.status).toEqual({ label: "Running", tone: "info", live: true });
    expect(view.terminal).toBe(false);
    expect(view.ended_at).toBeUndefined();
    expect(view.failure).toBeUndefined();
    expect(view.stages[0]).toMatchObject({ current_step: "Compile", steps_done: 1, steps_total: 2 });
  });

  it("flags runs waiting on approval so the card can point to Harness", () => {
    const raw = failedExecution();
    raw.pipelineExecutionSummary.status = "ApprovalWaiting";
    const view = buildPipelineExecutionView(raw, ctx)!;
    expect(view).toMatchObject({ awaiting_action: true, terminal: false, status: { label: "Waiting for approval", tone: "warning" } });
    expect(view.failure).toBeUndefined();
  });

  it("returns undefined for responses that are not executions", () => {
    expect(buildPipelineExecutionView({ identifier: "p1" }, ctx)).toBeUndefined();
    expect(buildPipelineExecutionView(null, ctx)).toBeUndefined();
  });

  it("omits the link when org or project is unknown rather than building a wrong URL", () => {
    const raw = failedExecution();
    delete (raw.pipelineExecutionSummary as Record<string, unknown>).orgIdentifier;
    const view = buildPipelineExecutionView(raw, { ...ctx, orgId: undefined })!;
    expect(view.open_in_harness).toBeUndefined();
  });
});

describe("buildPendingExecutionView", () => {
  it("starts a live card with no stages right after a run is triggered", () => {
    const view = buildPendingExecutionView("exec-1", { ...ctx, pipelineId: "build_app", status: "Queued" });
    expect(view).toMatchObject({
      kind: "pipeline_execution",
      execution_id: "exec-1",
      pipeline: { identifier: "build_app" },
      status: { label: "Queued", tone: "neutral", live: true },
      terminal: false,
      stages: [],
      refresh: { tool: "harness_get", arguments: { resource_type: "execution", resource_id: "exec-1" } },
    });
    expect(view.open_in_harness).toContain("/pipelines/build_app/deployments/exec-1/pipeline");
  });

  it("uses an interrupt label and stays live until the refreshed status is terminal", () => {
    const view = buildPendingExecutionView("exec-1", { ...ctx, label: "Aborting" });
    expect(view.status).toEqual({ label: "Aborting", tone: "neutral", live: true });
    expect(view.terminal).toBe(false);
    expect(view.open_in_harness).toBeUndefined();
  });

  it("is terminal when a waited run already finished", () => {
    expect(buildPendingExecutionView("exec-1", { ...ctx, status: "Success" }).terminal).toBe(true);
  });
});
