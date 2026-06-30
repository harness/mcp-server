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

  it("applies later input-set fragments in order (later ids win on conflicts)", () => {
    const first = {
      identifier: "P",
      variables: [
        { name: "env", type: "String", value: "dev" },
        { name: "tag", type: "String", value: "v1" },
      ],
    };
    const second = {
      identifier: "P",
      variables: [{ name: "env", type: "String", value: "prod" }],
    };
    const merged = mergeRuntimePipelineFragments(
      mergeRuntimePipelineFragments(first, second),
      { identifier: "P", variables: [{ name: "tag", type: "String", value: "v2" }] },
    );
    expect(merged.variables).toEqual([
      { name: "env", type: "String", value: "prod" },
      { name: "tag", type: "String", value: "v2" },
    ]);
  });
});

describe("materializeInputSetsToRuntimeYaml", () => {
  const baseParams = {
    pipelineId: "my-pipe",
    orgId: "my-org",
    projectId: "my-project",
    inputSetIds: ["set-a"],
  };

  it("returns undefined when inputSetIds is empty", async () => {
    const client = makeClient(vi.fn());
    const result = await materializeInputSetsToRuntimeYaml(client, {
      ...baseParams,
      inputSetIds: [],
    });
    expect(result).toBeUndefined();
  });

  it("GETs each input set with org/project/pipeline scope params", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      status: "SUCCESS",
      data: {
        inputSetYaml: "inputSet:\n  pipeline:\n    identifier: my-pipe\n    variables:\n      - name: x\n        type: String\n        value: \"1\"\n",
      },
    });
    const client = makeClient(mockRequest);

    await materializeInputSetsToRuntimeYaml(client, baseParams);

    expect(mockRequest).toHaveBeenCalledOnce();
    const call = mockRequest.mock.calls[0]![0] as {
      method?: string;
      path?: string;
      params?: Record<string, string>;
    };
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/pipeline/api/inputSets/set-a");
    expect(call.params).toEqual({
      orgIdentifier: "my-org",
      projectIdentifier: "my-project",
      pipelineIdentifier: "my-pipe",
    });
  });

  it("merges multiple input sets in id order into runtime YAML", async () => {
    const mockRequest = vi
      .fn()
      .mockResolvedValueOnce({
        status: "SUCCESS",
        data: {
          inputSetYaml: "inputSet:\n  pipeline:\n    identifier: my-pipe\n    variables:\n      - name: env\n        type: String\n        value: dev\n",
        },
      })
      .mockResolvedValueOnce({
        status: "SUCCESS",
        data: {
          inputSetYaml: "inputSet:\n  pipeline:\n    identifier: my-pipe\n    variables:\n      - name: env\n        type: String\n        value: prod\n",
        },
      });
    const client = makeClient(mockRequest);

    const yaml = await materializeInputSetsToRuntimeYaml(client, {
      ...baseParams,
      inputSetIds: ["set-a", "set-b"],
    });

    expect(mockRequest).toHaveBeenCalledTimes(2);
    expect(yaml).toContain("my-pipe");
    expect(yaml).toContain("prod");
    expect(yaml).not.toContain("dev");
  });

  it("throws HarnessApiError when input set GET returns ERROR envelope", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      status: "ERROR",
      code: "INPUT_SET_NOT_FOUND",
      message: "Input set missing",
      correlationId: "cid-1",
    });
    const client = makeClient(mockRequest);

    await expect(materializeInputSetsToRuntimeYaml(client, baseParams)).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof HarnessApiError
        && err.message === "Input set missing"
        && err.statusCode === 400
        && err.harnessCode === "INPUT_SET_NOT_FOUND"
        && err.correlationId === "cid-1",
    );
  });

  it("throws HarnessApiError when input set GET returns FAILURE envelope", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      status: "FAILURE",
      message: "Access denied",
    });
    const client = makeClient(mockRequest);

    await expect(materializeInputSetsToRuntimeYaml(client, baseParams)).rejects.toBeInstanceOf(
      HarnessApiError,
    );
  });

  it("throws 404 when input set has no pipeline fragment in YAML", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      status: "SUCCESS",
      data: { inputSetYaml: "inputSet:\n  name: empty\n" },
    });
    const client = makeClient(mockRequest);

    await expect(materializeInputSetsToRuntimeYaml(client, baseParams)).rejects.toMatchObject({
      message: expect.stringContaining('Input set "set-a" not found'),
      statusCode: 404,
    });
  });
});
