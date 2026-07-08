import { describe, it, expect, vi } from "vitest";
import type { HarnessClient } from "../../src/client/harness-client.js";
import { HarnessApiError } from "../../src/utils/errors.js";
import {
  mergeRuntimePipelineFragments,
  materializeInputSetsToRuntimeYaml,
} from "../../src/utils/materialize-input-sets.js";

function makeClient(request: ReturnType<typeof vi.fn>): HarnessClient {
  return { request } as unknown as HarnessClient;
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

  it("appends stages without an identifier instead of merging by id", () => {
    const base = {
      identifier: "P",
      stages: [{ stage: { identifier: "ci", type: "CI" } }],
    };
    const next = {
      identifier: "P",
      stages: [{ parallel: { stages: [{ stage: { identifier: "deploy" } }] } }],
    };
    const out = mergeRuntimePipelineFragments(base, next);
    expect(out.stages).toHaveLength(2);
  });

  it("preserves later identifier when both fragments define one", () => {
    const out = mergeRuntimePipelineFragments(
      { identifier: "old-id", variables: [] },
      { identifier: "new-id", variables: [{ name: "x", value: "1" }] },
    );
    expect(out.identifier).toBe("new-id");
    expect(out.variables).toEqual([{ name: "x", value: "1" }]);
  });
});

describe("materializeInputSetsToRuntimeYaml", () => {
  const baseParams = {
    pipelineId: "my-pipe",
    orgId: "my-org",
    projectId: "my-project",
  };

  it("returns undefined when inputSetIds is empty", async () => {
    const request = vi.fn();
    const client = makeClient(request);

    const result = await materializeInputSetsToRuntimeYaml(client, {
      ...baseParams,
      inputSetIds: [],
    });

    expect(result).toBeUndefined();
    expect(request).not.toHaveBeenCalled();
  });

  it("merges multiple input sets in order so later ids override", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({
        status: "SUCCESS",
        data: {
          inputSetYaml: `inputSet:
  pipeline:
    identifier: my-pipe
    variables:
      - name: env
        type: String
        value: dev
`,
        },
      })
      .mockResolvedValueOnce({
        status: "SUCCESS",
        data: {
          inputSetYaml: `inputSet:
  pipeline:
    identifier: my-pipe
    variables:
      - name: env
        type: String
        value: prod
`,
        },
      });
    const client = makeClient(request);

    const yaml = await materializeInputSetsToRuntimeYaml(client, {
      ...baseParams,
      inputSetIds: ["set-a", "set-b"],
    });

    expect(request).toHaveBeenCalledTimes(2);
    expect(yaml).toContain("env");
    expect(yaml).toContain("prod");
    expect(yaml).not.toContain("dev");
  });

  it("throws HarnessApiError when input set GET returns ERROR status", async () => {
    const request = vi.fn().mockResolvedValueOnce({
      status: "ERROR",
      message: "Input set not found",
      code: "INPUT_SET_NOT_FOUND",
      correlationId: "corr-1",
    });
    const client = makeClient(request);

    await expect(
      materializeInputSetsToRuntimeYaml(client, {
        ...baseParams,
        inputSetIds: ["missing-set"],
      }),
    ).rejects.toMatchObject({
      message: "Input set not found",
      statusCode: 400,
      harnessCode: "INPUT_SET_NOT_FOUND",
      correlationId: "corr-1",
    });
    expect(request).toHaveBeenCalledOnce();
  });

  it("throws HarnessApiError when input set GET returns FAILURE status", async () => {
    const request = vi.fn().mockResolvedValueOnce({
      status: "FAILURE",
      message: "Access denied",
    });
    const client = makeClient(request);

    await expect(
      materializeInputSetsToRuntimeYaml(client, {
        ...baseParams,
        inputSetIds: ["denied-set"],
      }),
    ).rejects.toBeInstanceOf(HarnessApiError);
  });

  it("throws when an input set has no pipeline fragment in its YAML", async () => {
    const request = vi.fn().mockResolvedValueOnce({
      status: "SUCCESS",
      data: { inputSetYaml: "inputSet:\n  name: empty-set\n" },
    });
    const client = makeClient(request);

    await expect(
      materializeInputSetsToRuntimeYaml(client, {
        ...baseParams,
        inputSetIds: ["empty-set"],
      }),
    ).rejects.toMatchObject({
      message: expect.stringContaining('Input set "empty-set" not found'),
      statusCode: 404,
    });
  });

  it("passes scope identifiers on each input set GET", async () => {
    const request = vi.fn().mockResolvedValueOnce({
      status: "SUCCESS",
      data: {
        inputSetYaml: `inputSet:
  pipeline:
    identifier: my-pipe
`,
      },
    });
    const client = makeClient(request);

    await materializeInputSetsToRuntimeYaml(client, {
      ...baseParams,
      inputSetIds: ["set-1"],
    });

    expect(request).toHaveBeenCalledWith({
      method: "GET",
      path: "/pipeline/api/inputSets/set-1",
      params: {
        orgIdentifier: "my-org",
        projectIdentifier: "my-project",
        pipelineIdentifier: "my-pipe",
        // Git params are present but undefined for inline sets; the client's
        // query serializer drops undefined/empty values.
        branch: undefined,
        repoName: undefined,
        connectorRef: undefined,
        storeType: undefined,
      },
    });
  });

  it("forwards git context so remote input sets resolve from the right branch", async () => {
    const request = vi.fn().mockResolvedValueOnce({
      status: "SUCCESS",
      data: {
        inputSetYaml: `inputSet:
  pipeline:
    identifier: my-pipe
    variables:
      - name: env
        type: String
        value: staging
`,
      },
    });
    const client = makeClient(request);

    await materializeInputSetsToRuntimeYaml(client, {
      ...baseParams,
      inputSetIds: ["remote-set"],
      gitContext: {
        branch: "feature/x",
        repoName: "my-repo",
        connectorRef: "gh_conn",
        storeType: "REMOTE",
      },
    });

    expect(request).toHaveBeenCalledWith({
      method: "GET",
      path: "/pipeline/api/inputSets/remote-set",
      params: {
        orgIdentifier: "my-org",
        projectIdentifier: "my-project",
        pipelineIdentifier: "my-pipe",
        branch: "feature/x",
        repoName: "my-repo",
        connectorRef: "gh_conn",
        storeType: "REMOTE",
      },
    });
  });

  it("accepts input set YAML whose pipeline fragment is at the document root", async () => {
    const request = vi.fn().mockResolvedValueOnce({
      status: "SUCCESS",
      data: {
        inputSetYaml: `pipeline:
  identifier: my-pipe
  variables:
    - name: tier
      type: String
      value: gold
`,
      },
    });
    const client = makeClient(request);

    const yaml = await materializeInputSetsToRuntimeYaml(client, {
      ...baseParams,
      inputSetIds: ["root-shape-set"],
    });

    expect(yaml).toContain("tier");
    expect(yaml).toContain("gold");
  });
});
