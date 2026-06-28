import { describe, it, expect, vi } from "vitest";
import type { HarnessClient } from "../../src/client/harness-client.js";
import { HarnessApiError } from "../../src/utils/errors.js";
import {
  mergeRuntimePipelineFragments,
  materializeInputSetsToRuntimeYaml,
} from "../../src/utils/materialize-input-sets.js";

function makeClient(requestFn: (...args: unknown[]) => unknown): HarnessClient {
  return {
    request: requestFn,
    account: "test-account",
  } as unknown as HarnessClient;
}

describe("mergeRuntimePipelineFragments", () => {
  it("overrides pipeline variables by name from the later fragment", () => {
    const a = {
      identifier: "P",
      variables: [{ name: "var1", type: "String", value: "a" }],
    };
    const b = {
      identifier: "P",
      variables: [{ name: "var1", type: "String", value: "b" }],
    };
    const out = mergeRuntimePipelineFragments(a, b);
    expect(out.variables).toEqual([{ name: "var1", type: "String", value: "b" }]);
  });

  it("merges stage variables for the same stage identifier", () => {
    const a = {
      identifier: "P",
      stages: [
        {
          stage: {
            identifier: "ci",
            type: "CI",
            variables: [{ name: "demo", type: "String", value: "old" }],
          },
        },
      ],
    };
    const b = {
      identifier: "P",
      stages: [
        {
          stage: {
            identifier: "ci",
            type: "CI",
            variables: [{ name: "demo", type: "String", value: "new" }],
          },
        },
      ],
    };
    const out = mergeRuntimePipelineFragments(a, b);
    expect(out.stages).toHaveLength(1);
    const st = (out.stages as unknown[])[0] as { stage: { variables: unknown[] } };
    expect(st.stage.variables).toEqual([{ name: "demo", type: "String", value: "new" }]);
  });

  it("appends stages without identifiers instead of merging them", () => {
    const base = {
      identifier: "P",
      stages: [{ stage: { identifier: "ci", type: "CI" } }],
    };
    const next = {
      identifier: "P",
      stages: [{ parallel: { stages: [] } }],
    };
    const out = mergeRuntimePipelineFragments(base, next);
    expect(out.stages).toHaveLength(2);
    expect((out.stages as unknown[])[1]).toEqual({ parallel: { stages: [] } });
  });

  it("keeps distinct stages and merges variables only within matching identifiers", () => {
    const base = {
      identifier: "P",
      stages: [
        {
          stage: {
            identifier: "build",
            variables: [{ name: "image", type: "String", value: "node:20" }],
          },
        },
      ],
    };
    const next = {
      identifier: "P",
      stages: [
        {
          stage: {
            identifier: "deploy",
            variables: [{ name: "env", type: "String", value: "prod" }],
          },
        },
      ],
    };
    const out = mergeRuntimePipelineFragments(base, next);
    expect(out.stages).toHaveLength(2);
    const stages = out.stages as Array<{ stage: { identifier: string; variables: unknown[] } }>;
    expect(stages.map((s) => s.stage.identifier)).toEqual(["build", "deploy"]);
    expect(stages[0]!.stage.variables).toEqual([{ name: "image", type: "String", value: "node:20" }]);
    expect(stages[1]!.stage.variables).toEqual([{ name: "env", type: "String", value: "prod" }]);
  });

  it("merges variable metadata when overriding by name", () => {
    const base = {
      identifier: "P",
      variables: [{ name: "tag", type: "String", value: "v1", description: "release tag" }],
    };
    const next = {
      identifier: "P",
      variables: [{ name: "tag", value: "v2" }],
    };
    const out = mergeRuntimePipelineFragments(base, next);
    expect(out.variables).toEqual([{ name: "tag", type: "String", value: "v2", description: "release tag" }]);
  });
});

describe("materializeInputSetsToRuntimeYaml", () => {
  it("returns undefined when no input set ids are provided", async () => {
    const client = makeClient(vi.fn());
    await expect(
      materializeInputSetsToRuntimeYaml(client, {
        pipelineId: "pipe",
        orgId: "org",
        projectId: "proj",
        inputSetIds: [],
      }),
    ).resolves.toBeUndefined();
    expect(client.request).not.toHaveBeenCalled();
  });

  it("merges multiple input sets in order with later ids overriding earlier values", async () => {
    const baseYaml = `inputSet:
  pipeline:
    identifier: mat_pipe
    variables:
      - name: env
        type: String
        value: dev
      - name: tag
        type: String
        value: v1
`;
    const overrideYaml = `inputSet:
  pipeline:
    identifier: mat_pipe
    variables:
      - name: env
        type: String
        value: prod
`;
    const mockRequest = vi.fn()
      .mockResolvedValueOnce({ status: "SUCCESS", data: { inputSetYaml: baseYaml } })
      .mockResolvedValueOnce({ status: "SUCCESS", data: { inputSetYaml: overrideYaml } });
    const client = makeClient(mockRequest);

    const yaml = await materializeInputSetsToRuntimeYaml(client, {
      pipelineId: "mat_pipe",
      orgId: "default",
      projectId: "test-project",
      inputSetIds: ["base_defaults", "prod_overrides"],
    });

    expect(mockRequest).toHaveBeenCalledTimes(2);
    expect(mockRequest.mock.calls[0]![0]).toMatchObject({
      method: "GET",
      path: "/pipeline/api/inputSets/base_defaults",
      params: {
        orgIdentifier: "default",
        projectIdentifier: "test-project",
        pipelineIdentifier: "mat_pipe",
      },
    });
    expect(yaml).toContain("mat_pipe");
    expect(yaml).toContain("env");
    expect(yaml).toContain("prod");
    expect(yaml).toContain("tag");
    expect(yaml).toContain("v1");
    expect(yaml).not.toContain("dev");
  });

  it("throws HarnessApiError when input set GET returns ERROR status", async () => {
    const mockRequest = vi.fn().mockResolvedValueOnce({
      status: "ERROR",
      code: "INPUT_SET_NOT_FOUND",
      message: "Input set missing",
      correlationId: "corr-123",
    });
    const client = makeClient(mockRequest);

    await expect(
      materializeInputSetsToRuntimeYaml(client, {
        pipelineId: "pipe",
        orgId: "org",
        projectId: "proj",
        inputSetIds: ["missing_set"],
      }),
    ).rejects.toMatchObject({
      name: "HarnessApiError",
      message: "Input set missing",
      statusCode: 400,
      harnessCode: "INPUT_SET_NOT_FOUND",
      correlationId: "corr-123",
    });
  });

  it("throws 404 when input set response has no pipeline fragment", async () => {
    const mockRequest = vi.fn().mockResolvedValueOnce({
      status: "SUCCESS",
      data: { inputSetYaml: "inputSet:\n  name: empty\n" },
    });
    const client = makeClient(mockRequest);

    await expect(
      materializeInputSetsToRuntimeYaml(client, {
        pipelineId: "pipe",
        orgId: "org",
        projectId: "proj",
        inputSetIds: ["empty_set"],
      }),
    ).rejects.toMatchObject({
      name: "HarnessApiError",
      statusCode: 404,
      message: expect.stringContaining('Input set "empty_set" not found'),
    });
  });
});
