import { describe, it, expect } from "vitest";
import { substituteValue, applyInputExpansions } from "../../src/utils/input-expander.js";
import type { InputExpansionRule } from "../../src/registry/types.js";

describe("substituteValue", () => {
  it("replaces exact $value strings with the provided value", () => {
    const template = { type: "branch", spec: { branch: "$value" } };
    const result = substituteValue(template, "main");
    expect(result).toEqual({ type: "branch", spec: { branch: "main" } });
  });

  it("replaces $value at multiple nesting levels", () => {
    const template = { a: "$value", b: { c: "$value" } };
    const result = substituteValue(template, "x");
    expect(result).toEqual({ a: "x", b: { c: "x" } });
  });

  it("does NOT do partial string replacement", () => {
    const template = { path: "refs/heads/$value", exact: "$value" };
    const result = substituteValue(template, "main");
    expect(result).toEqual({ path: "refs/heads/$value", exact: "main" });
  });

  it("handles non-string values (numbers)", () => {
    const template = { spec: { number: "$value" } };
    const result = substituteValue(template, 42);
    expect(result).toEqual({ spec: { number: 42 } });
  });

  it("preserves static string values in template", () => {
    const template = { type: "branch", spec: { branch: "$value" } };
    const result = substituteValue(template, "feature/xyz");
    expect(result).toEqual({ type: "branch", spec: { branch: "feature/xyz" } });
    expect(result.type).toBe("branch");
  });

  it("does not mutate the original template", () => {
    const template = { spec: { branch: "$value" } };
    const original = JSON.parse(JSON.stringify(template));
    substituteValue(template, "main");
    expect(template).toEqual(original);
  });

  it("handles $value inside arrays", () => {
    const template = { items: ["$value", "static"] };
    const result = substituteValue(template, "replaced");
    expect(result).toEqual({ items: ["replaced", "static"] });
  });
});

describe("applyInputExpansions", () => {
  const codebaseRules: InputExpansionRule[] = [
    {
      triggerKey: "branch",
      expand: { build: { type: "branch", spec: { branch: "$value" } } },
      skipIfPresent: "build",
    },
    {
      triggerKey: "tag",
      expand: { build: { type: "tag", spec: { tag: "$value" } } },
      skipIfPresent: "build",
    },
    {
      triggerKey: "pr_number",
      expand: { build: { type: "PR", spec: { number: "$value" } } },
      skipIfPresent: "build",
    },
    {
      triggerKey: "commit_sha",
      expand: { build: { type: "commitSha", spec: { commitSha: "$value" } } },
      skipIfPresent: "build",
    },
  ];

  it("expands branch shorthand into full build structure", () => {
    const result = applyInputExpansions({ branch: "main" }, codebaseRules);
    expect(result).toEqual({
      branch: "main",
      build: { type: "branch", spec: { branch: "main" } },
    });
  });

  it("expands tag shorthand", () => {
    const result = applyInputExpansions({ tag: "v1.0.0" }, codebaseRules);
    expect(result).toEqual({
      tag: "v1.0.0",
      build: { type: "tag", spec: { tag: "v1.0.0" } },
    });
  });

  it("expands pr_number shorthand", () => {
    const result = applyInputExpansions({ pr_number: "42" }, codebaseRules);
    expect(result).toEqual({
      pr_number: "42",
      build: { type: "PR", spec: { number: "42" } },
    });
  });

  it("expands commit_sha shorthand", () => {
    const result = applyInputExpansions({ commit_sha: "abc123" }, codebaseRules);
    expect(result).toEqual({
      commit_sha: "abc123",
      build: { type: "commitSha", spec: { commitSha: "abc123" } },
    });
  });

  it("skips expansion when build already provided by user", () => {
    const inputs = {
      branch: "main",
      build: { type: "tag", spec: { tag: "v2.0" } },
    };
    const result = applyInputExpansions(inputs, codebaseRules);
    expect(result.build).toEqual({ type: "tag", spec: { tag: "v2.0" } });
  });

  it("skips when trigger key is not present in inputs", () => {
    const result = applyInputExpansions({ env: "prod" }, codebaseRules);
    expect(result).toEqual({ env: "prod" });
    expect(result.build).toBeUndefined();
  });

  it("preserves other input keys alongside expansion", () => {
    const result = applyInputExpansions(
      { branch: "main", env: "prod", region: "us-east-1" },
      codebaseRules,
    );
    expect(result.env).toBe("prod");
    expect(result.region).toBe("us-east-1");
    expect(result.branch).toBe("main");
    expect(result.build).toEqual({ type: "branch", spec: { branch: "main" } });
  });

  it("first matching rule wins when multiple trigger keys present (both write to build)", () => {
    const result = applyInputExpansions(
      { branch: "main", tag: "v1.0" },
      codebaseRules,
    );
    // branch rule fires first, sets build; tag rule skips because build is now present
    expect(result.build).toEqual({ type: "branch", spec: { branch: "main" } });
  });

  it("multiple rules can fire when they write to different keys", () => {
    const rules: InputExpansionRule[] = [
      { triggerKey: "env", expand: { infra: { envId: "$value" } } },
      { triggerKey: "region", expand: { location: { code: "$value" } } },
    ];
    const result = applyInputExpansions({ env: "prod", region: "us-east-1" }, rules);
    expect(result.infra).toEqual({ envId: "prod" });
    expect(result.location).toEqual({ code: "us-east-1" });
  });

  it("does not mutate the original inputs", () => {
    const inputs = { branch: "main" };
    const original = { ...inputs };
    applyInputExpansions(inputs, codebaseRules);
    expect(inputs).toEqual(original);
  });

  it("returns inputs unchanged when rules array is empty", () => {
    const inputs = { branch: "main", env: "prod" };
    const result = applyInputExpansions(inputs, []);
    expect(result).toEqual(inputs);
  });
});
