import { describe, it, expect, vi } from "vitest";
import YAML from "yaml";
import type { HarnessClient } from "../../src/client/harness-client.js";
import { HarnessApiError } from "../../src/utils/errors.js";
import {
  materializeInputSetsToRuntimeYaml,
  mergeRuntimePipelineFragments,
} from "../../src/utils/materialize-input-sets.js";

function makeClient(requestFn: ReturnType<typeof vi.fn>): HarnessClient {
  return { request: requestFn, account: "acct" } as unknown as HarnessClient;
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
});

describe("materializeInputSetsToRuntimeYaml", () => {
  it("returns undefined when inputSetIds is empty", async () => {
    const client = makeClient(vi.fn());
    const result = await materializeInputSetsToRuntimeYaml(client, {
      pipelineId: "pipe",
      orgId: "org",
      projectId: "proj",
      inputSetIds: [],
    });
    expect(result).toBeUndefined();
    expect(client.request).not.toHaveBeenCalled();
  });

  it("throws HarnessApiError when GET returns ERROR envelope", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      status: "ERROR",
      message: "Input set not accessible",
      code: "ACCESS_DENIED",
      correlationId: "corr-1",
    });
    const client = makeClient(mockRequest);

    await expect(
      materializeInputSetsToRuntimeYaml(client, {
        pipelineId: "pipe",
        orgId: "org",
        projectId: "proj",
        inputSetIds: ["set-1"],
      }),
    ).rejects.toMatchObject({
      message: "Input set not accessible",
      statusCode: 400,
      harnessCode: "ACCESS_DENIED",
      correlationId: "corr-1",
    });
  });

  it("throws HarnessApiError when GET returns FAILURE envelope", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      status: "FAILURE",
      message: "Backend failure",
    });
    const client = makeClient(mockRequest);

    await expect(
      materializeInputSetsToRuntimeYaml(client, {
        pipelineId: "pipe",
        orgId: "org",
        projectId: "proj",
        inputSetIds: ["set-1"],
      }),
    ).rejects.toBeInstanceOf(HarnessApiError);
  });

  it("throws 404 when input set response has no pipeline YAML fragment", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      status: "SUCCESS",
      data: { identifier: "set-1" },
    });
    const client = makeClient(mockRequest);

    await expect(
      materializeInputSetsToRuntimeYaml(client, {
        pipelineId: "pipe",
        orgId: "org",
        projectId: "proj",
        inputSetIds: ["set-1"],
      }),
    ).rejects.toMatchObject({
      statusCode: 404,
    });
    await expect(
      materializeInputSetsToRuntimeYaml(client, {
        pipelineId: "pipe",
        orgId: "org",
        projectId: "proj",
        inputSetIds: ["set-1"],
      }),
    ).rejects.toThrow('Input set "set-1" not found or has no pipeline fragment');
  });

  it("GETs each input set in order and merges fragments into runtime YAML", async () => {
    const yaml1 = YAML.stringify({
      inputSet: {
        pipeline: {
          identifier: "pipe",
          variables: [{ name: "a", type: "String", value: "1" }],
        },
      },
    });
    const yaml2 = YAML.stringify({
      inputSet: {
        pipeline: {
          identifier: "pipe",
          variables: [{ name: "b", type: "String", value: "2" }],
        },
      },
    });
    const mockRequest = vi.fn()
      .mockResolvedValueOnce({ data: { inputSetYaml: yaml1 } })
      .mockResolvedValueOnce({ data: { inputSetYaml: yaml2 } });
    const client = makeClient(mockRequest);

    const result = await materializeInputSetsToRuntimeYaml(client, {
      pipelineId: "pipe",
      orgId: "org",
      projectId: "proj",
      inputSetIds: ["set-1", "set-2"],
    });

    expect(mockRequest).toHaveBeenCalledTimes(2);
    expect(mockRequest.mock.calls[0]![0]).toMatchObject({
      method: "GET",
      path: "/pipeline/api/inputSets/set-1",
      params: {
        orgIdentifier: "org",
        projectIdentifier: "proj",
        pipelineIdentifier: "pipe",
      },
    });
    expect(mockRequest.mock.calls[1]![0]).toMatchObject({
      path: "/pipeline/api/inputSets/set-2",
    });

    const parsed = YAML.parse(result!) as { pipeline: { variables: Array<{ name: string }> } };
    expect(parsed.pipeline.variables.map((v) => v.name).sort()).toEqual(["a", "b"]);
    expect(result).toContain("pipeline:");
  });
});
