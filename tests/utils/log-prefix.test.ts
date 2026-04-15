import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildLogPrefixFromExecution } from "../../src/utils/log-prefix.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import type { Registry } from "../../src/registry/index.js";

describe("buildLogPrefixFromExecution", () => {
  const mockClient = { account: "acct1" } as HarnessClient;
  let mockRegistry: Registry;
  let dispatchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    dispatchMock = vi.fn();
    mockRegistry = { dispatch: dispatchMock } as unknown as Registry;
  });

  it("returns simplified prefix when shouldUseSimplifiedKey is true", async () => {
    dispatchMock.mockResolvedValue({
      pipelineExecutionSummary: {
        pipelineIdentifier: "my-pipe",
        runSequence: 42,
        shouldUseSimplifiedKey: true,
      },
    });

    const result = await buildLogPrefixFromExecution(
      mockClient, mockRegistry, "exec-123", { org_id: "org1", project_id: "proj1" },
    );

    expect(result).toBe("acct1/pipeline/my-pipe/42/-exec-123");
  });

  it("returns simplified prefix when shouldUseSimplifiedKey is absent (default)", async () => {
    dispatchMock.mockResolvedValue({
      pipelineExecutionSummary: {
        pipelineIdentifier: "my-pipe",
        runSequence: 7,
      },
    });

    const result = await buildLogPrefixFromExecution(
      mockClient, mockRegistry, "exec-456", {},
    );

    expect(result).toBe("acct1/pipeline/my-pipe/7/-exec-456");
  });

  it("returns standard prefix when shouldUseSimplifiedKey is false", async () => {
    dispatchMock.mockResolvedValue({
      pipelineExecutionSummary: {
        pipelineIdentifier: "legacy-pipe",
        runSequence: 10,
        shouldUseSimplifiedKey: false,
        orgIdentifier: "myorg",
        projectIdentifier: "myproj",
      },
    });

    const result = await buildLogPrefixFromExecution(
      mockClient, mockRegistry, "exec-789", {},
    );

    expect(result).toBe(
      "accountId:acct1/orgId:myorg/projectId:myproj/pipelineId:legacy-pipe/runSequence:10/level0:pipeline",
    );
  });

  it("falls back to input org/project for standard prefix when missing from execution", async () => {
    dispatchMock.mockResolvedValue({
      pipelineExecutionSummary: {
        pipelineIdentifier: "legacy-pipe",
        runSequence: 3,
        shouldUseSimplifiedKey: false,
      },
    });

    const result = await buildLogPrefixFromExecution(
      mockClient, mockRegistry, "exec-abc", { org_id: "fallback-org", project_id: "fallback-proj" },
    );

    expect(result).toBe(
      "accountId:acct1/orgId:fallback-org/projectId:fallback-proj/pipelineId:legacy-pipe/runSequence:3/level0:pipeline",
    );
  });

  it("uses pipeline node logBaseKey when execution graph provides it", async () => {
    dispatchMock.mockResolvedValue({
      pipelineExecutionSummary: {
        pipelineIdentifier: "my-pipe",
        runSequence: 42,
        shouldUseSimplifiedKey: true,
      },
      executionGraph: {
        nodeMap: {
          pipelineNode: {
            uuid: "pipelineNode",
            identifier: "pipeline",
            baseFqn: "pipeline",
            logBaseKey: "accountId:acct1/orgId:org1/projectId:proj1/pipelineId:my-pipe/runSequence:42/level0:pipeline",
          },
        },
      },
    });

    const result = await buildLogPrefixFromExecution(
      mockClient, mockRegistry, "exec-123", { org_id: "org1", project_id: "proj1" },
    );

    expect(result).toBe("accountId:acct1/orgId:org1/projectId:proj1/pipelineId:my-pipe/runSequence:42/level0:pipeline");
  });

  it("uses the matching step logBaseKey when a step target is provided", async () => {
    dispatchMock.mockResolvedValue({
      pipelineExecutionSummary: {
        pipelineIdentifier: "sample-pipeline",
        runSequence: 931,
        shouldUseSimplifiedKey: true,
      },
      executionGraph: {
        nodeMap: {
          stageNode: {
            uuid: "stage-exec-123",
            identifier: "build_stage",
            baseFqn: "pipeline.stages.build_stage",
            logBaseKey: "accountId:acct1/orgId:test-org/projectId:test-project/pipelineId:sample-pipeline/runSequence:931/level0:pipeline/level1:stages/level2:build_stage",
          },
          stepNode: {
            uuid: "step-uuid-123",
            identifier: "run_tests",
            baseFqn: "pipeline.stages.build_stage.spec.execution.steps.run_tests",
            logBaseKey: "accountId:acct1/orgId:test-org/projectId:test-project/pipelineId:sample-pipeline/runSequence:931/level0:pipeline/level1:stages/level2:build_stage/level3:spec/level4:execution/level5:steps/level6:run_tests",
          },
        },
      },
    });

    const result = await buildLogPrefixFromExecution(
      mockClient,
      mockRegistry,
      "exec-123",
      {
        step_id: "step-uuid-123",
        stage_execution_id: "stage-exec-123",
        org_id: "test-org",
        project_id: "test-project",
      },
    );

    expect(result).toBe(
      "accountId:acct1/orgId:test-org/projectId:test-project/pipelineId:sample-pipeline/runSequence:931/level0:pipeline/level1:stages/level2:build_stage/level3:spec/level4:execution/level5:steps/level6:run_tests",
    );
  });

  it("throws when pipelineIdentifier is missing", async () => {
    dispatchMock.mockResolvedValue({
      pipelineExecutionSummary: {
        runSequence: 1,
      },
    });

    await expect(
      buildLogPrefixFromExecution(mockClient, mockRegistry, "exec-bad", {}),
    ).rejects.toThrow("Could not extract pipelineIdentifier/runSequence");
  });

  it("throws when runSequence is missing", async () => {
    dispatchMock.mockResolvedValue({
      pipelineExecutionSummary: {
        pipelineIdentifier: "my-pipe",
      },
    });

    await expect(
      buildLogPrefixFromExecution(mockClient, mockRegistry, "exec-bad", {}),
    ).rejects.toThrow("Could not extract pipelineIdentifier/runSequence");
  });

  it("falls back to any available logBaseKey when no step or stage is targeted", async () => {
    dispatchMock.mockResolvedValue({
      pipelineExecutionSummary: {
        pipelineIdentifier: "sample-pipeline",
        runSequence: 7,
        shouldUseSimplifiedKey: true,
      },
      executionGraph: {
        nodeMap: {
          stageNode: {
            uuid: "stage-uuid",
            identifier: "build_stage",
            baseFqn: "pipeline.stages.build_stage",
            logBaseKey: "acct1/stages/build_stage",
          },
          stepNode: {
            uuid: "step-uuid",
            identifier: "run_tests",
            baseFqn: "pipeline.stages.build_stage.spec.execution.steps.run_tests",
            logBaseKey: "acct1/stages/build_stage/steps/run_tests",
          },
          pipelineNode: {
            uuid: "pipeline-uuid",
            identifier: "pipeline",
            baseFqn: "pipeline",
            // no logBaseKey on pipeline node
          },
        },
      },
    });

    const result = await buildLogPrefixFromExecution(
      mockClient, mockRegistry, "exec-123", {},
    );

    // Should pick the deepest (longest) logBaseKey — the step node
    expect(result).toBe("acct1/stages/build_stage/steps/run_tests");
  });

  it("falls back to synthesized prefix when no node has a logBaseKey", async () => {
    dispatchMock.mockResolvedValue({
      pipelineExecutionSummary: {
        pipelineIdentifier: "my-pipe",
        runSequence: 42,
        shouldUseSimplifiedKey: true,
      },
      executionGraph: {
        nodeMap: {
          someNode: {
            uuid: "node-uuid",
            identifier: "some_step",
            baseFqn: "pipeline.stages.build.steps.some_step",
            // no logBaseKey
          },
        },
      },
    });

    const result = await buildLogPrefixFromExecution(
      mockClient, mockRegistry, "exec-123", {},
    );

    // No logBaseKey in any node — should fall back to synthesized prefix
    expect(result).toBe("acct1/pipeline/my-pipe/42/-exec-123");
  });

  it("prefers step target logBaseKey over fallback when step_id is provided", async () => {
    dispatchMock.mockResolvedValue({
      pipelineExecutionSummary: {
        pipelineIdentifier: "pipe",
        runSequence: 1,
        shouldUseSimplifiedKey: true,
      },
      executionGraph: {
        nodeMap: {
          stageNode: {
            uuid: "stage-1",
            identifier: "build",
            baseFqn: "pipeline.stages.build",
            logBaseKey: "acct1/stages/build",
          },
          stepA: {
            uuid: "step-a-uuid",
            identifier: "step_a",
            baseFqn: "pipeline.stages.build.spec.execution.steps.step_a",
            logBaseKey: "acct1/stages/build/steps/step_a",
          },
          stepB: {
            uuid: "step-b-uuid",
            identifier: "step_b",
            baseFqn: "pipeline.stages.build.spec.execution.steps.step_b",
            logBaseKey: "acct1/stages/build/steps/step_b_longer_key",
          },
        },
      },
    });

    // Even though step_b has a longer key, step_a should be selected because step_id matches it
    const result = await buildLogPrefixFromExecution(
      mockClient, mockRegistry, "exec-1", { step_id: "step-a-uuid" },
    );
    expect(result).toBe("acct1/stages/build/steps/step_a");
  });

  it("prefers stage target logBaseKey when stage_id is provided but not step_id", async () => {
    dispatchMock.mockResolvedValue({
      pipelineExecutionSummary: {
        pipelineIdentifier: "pipe",
        runSequence: 1,
        shouldUseSimplifiedKey: true,
      },
      executionGraph: {
        nodeMap: {
          stageNode: {
            uuid: "stage-1",
            identifier: "deploy",
            baseFqn: "pipeline.stages.deploy",
            logBaseKey: "acct1/stages/deploy",
          },
          stepNode: {
            uuid: "step-1",
            identifier: "helm",
            baseFqn: "pipeline.stages.deploy.spec.execution.steps.helm",
            logBaseKey: "acct1/stages/deploy/steps/helm_very_long_key",
          },
        },
      },
    });

    // stage_id matches stageNode — should pick stage key, not fallback to longest
    const result = await buildLogPrefixFromExecution(
      mockClient, mockRegistry, "exec-1", { stage_id: "stage-1" },
    );
    expect(result).toBe("acct1/stages/deploy");
  });

  it("fallback picks deepest key among multiple nodes with logBaseKeys", async () => {
    dispatchMock.mockResolvedValue({
      pipelineExecutionSummary: {
        pipelineIdentifier: "pipe",
        runSequence: 1,
        shouldUseSimplifiedKey: true,
      },
      executionGraph: {
        nodeMap: {
          short: { uuid: "a", identifier: "a", logBaseKey: "key/short" },
          medium: { uuid: "b", identifier: "b", logBaseKey: "key/medium/path" },
          deep: { uuid: "c", identifier: "c", logBaseKey: "key/deepest/path/here" },
        },
      },
    });

    const result = await buildLogPrefixFromExecution(
      mockClient, mockRegistry, "exec-1", {},
    );
    expect(result).toBe("key/deepest/path/here");
  });

  it("fallback works with single node in nodeMap", async () => {
    dispatchMock.mockResolvedValue({
      pipelineExecutionSummary: {
        pipelineIdentifier: "pipe",
        runSequence: 1,
        shouldUseSimplifiedKey: true,
      },
      executionGraph: {
        nodeMap: {
          onlyStep: { uuid: "only", identifier: "only_step", logBaseKey: "log/only" },
        },
      },
    });

    const result = await buildLogPrefixFromExecution(
      mockClient, mockRegistry, "exec-1", {},
    );
    expect(result).toBe("log/only");
  });

  it("fallback returns synthesized prefix when nodeMap is empty", async () => {
    dispatchMock.mockResolvedValue({
      pipelineExecutionSummary: {
        pipelineIdentifier: "pipe",
        runSequence: 1,
        shouldUseSimplifiedKey: true,
      },
      executionGraph: {
        nodeMap: {},
      },
    });

    const result = await buildLogPrefixFromExecution(
      mockClient, mockRegistry, "exec-1", {},
    );
    expect(result).toBe("acct1/pipeline/pipe/1/-exec-1");
  });

  it("handles flat execution object (no pipelineExecutionSummary wrapper)", async () => {
    dispatchMock.mockResolvedValue({
      pipelineIdentifier: "flat-pipe",
      runSequence: 5,
      shouldUseSimplifiedKey: true,
    });

    const result = await buildLogPrefixFromExecution(
      mockClient, mockRegistry, "exec-flat", {},
    );

    expect(result).toBe("acct1/pipeline/flat-pipe/5/-exec-flat");
  });
});
