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
