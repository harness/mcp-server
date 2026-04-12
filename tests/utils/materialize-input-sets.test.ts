import { describe, it, expect } from "vitest";
import { mergeRuntimePipelineFragments } from "../../src/utils/materialize-input-sets.js";

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
