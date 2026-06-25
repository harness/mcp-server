/**
 * Contract tests for pipeline_v1 example YAML.
 *
 * Examples are curated to match real v1 converter output (not the bundled JSON
 * schema, which is stricter). These tests catch regressions back to v0-style
 * `identifier` / `type: run` / `type: agent` patterns that agents copy from.
 */
import { describe, it, expect } from "vitest";
import { parse as parseYaml } from "yaml";
import { getExamplesForResource } from "../../src/data/examples/index.js";
import "../../src/data/examples/load-all.js";

const PIPELINE_ROOT_KEYS = new Set([
  "clone",
  "id",
  "name",
  "stages",
  "inputs",
  "notifications",
  "template",
  "delegate",
  "barriers",
]);

const STEP_KIND_KEYS = ["run", "template", "group", "parallel", "approval"] as const;

const FORBIDDEN_YAML_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /^\s+identifier:\s/m, reason: "pipeline_v1 uses id:, not identifier:" },
  { pattern: /^\s+version:\s/m, reason: "v1 converter output does not include version:" },
  { pattern: /^\s+type:\s+run\s*$/m, reason: "v1 steps use run:, not type: run" },
  { pattern: /^\s+type:\s+agent\s*$/m, reason: "v1 pipeline_v1 has no type: agent steps" },
  { pattern: /^\s+mcp_servers:\s/m, reason: "mcp_servers belongs to agent-pipeline schema, not pipeline_v1" },
  { pattern: /^\s+tools:\s/m, reason: "tools: blocks belong to agent-pipeline schema, not pipeline_v1" },
  { pattern: /^\s+vm:\s/m, reason: "v1 runtime uses shell: or kubernetes:, not vm:" },
];

type Violation = { example: string; path: string; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function stepKind(step: Record<string, unknown>): string | undefined {
  return STEP_KIND_KEYS.find((key) => key in step);
}

function walkStages(stages: unknown, onStage: (stage: Record<string, unknown>, path: string) => void, path = "stages"): void {
  if (!Array.isArray(stages)) return;

  for (let i = 0; i < stages.length; i++) {
    const entry = stages[i];
    if (!isRecord(entry)) continue;

    if (Array.isArray(entry.parallel?.stages)) {
      walkStages(entry.parallel.stages, onStage, `${path}[${i}].parallel.stages`);
      continue;
    }

    onStage(entry, `${path}[${i}]`);
  }
}

function walkSteps(steps: unknown, onStep: (step: Record<string, unknown>, path: string) => void, path: string): void {
  if (!Array.isArray(steps)) return;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (!isRecord(step)) continue;

    onStep(step, `${path}[${i}]`);

    if (isRecord(step.group)) {
      walkSteps(step.group.steps, onStep, `${path}[${i}].group.steps`);
    }
    if (isRecord(step.parallel)) {
      walkSteps(step.parallel.steps, onStep, `${path}[${i}].parallel.steps`);
    }
  }
}

function validateExampleStructure(name: string, yaml: string): Violation[] {
  const violations: Violation[] = [];
  let doc: unknown;

  try {
    doc = parseYaml(yaml);
  } catch (err) {
    violations.push({
      example: name,
      path: "yaml",
      message: `invalid YAML: ${err instanceof Error ? err.message : String(err)}`,
    });
    return violations;
  }

  if (!isRecord(doc) || !isRecord(doc.pipeline)) {
    violations.push({ example: name, path: "pipeline", message: "root must contain a pipeline: object" });
    return violations;
  }

  const pipeline = doc.pipeline;

  for (const key of Object.keys(pipeline)) {
    if (!PIPELINE_ROOT_KEYS.has(key)) {
      violations.push({
        example: name,
        path: `pipeline.${key}`,
        message: `unexpected pipeline root key "${key}" (converter allows only ${[...PIPELINE_ROOT_KEYS].sort().join(", ")})`,
      });
    }
  }

  if (!("id" in pipeline)) {
    violations.push({ example: name, path: "pipeline", message: "pipeline must declare id:" });
  }
  if ("identifier" in pipeline) {
    violations.push({ example: name, path: "pipeline.identifier", message: "use pipeline.id instead of pipeline.identifier" });
  }

  walkStages(pipeline.stages, (stage, stagePath) => {
    const runtime = stage.runtime;
    if (runtime == null) return;
    if (!isRecord(runtime)) return;

    if ("vm" in runtime) {
      violations.push({ example: name, path: `${stagePath}.runtime.vm`, message: "use shell: or kubernetes: runtime" });
    }
    if ("cloud" in runtime) {
      violations.push({ example: name, path: `${stagePath}.runtime.cloud`, message: "use shell: or kubernetes: runtime" });
    }
    if ("shell" in runtime && runtime.shell !== true) {
      violations.push({
        example: name,
        path: `${stagePath}.runtime.shell`,
        message: "converter shell runtime is shell: true",
      });
    }

    walkSteps(stage.steps, (step, stepPath) => {
      if ("type" in step) {
        violations.push({
          example: name,
          path: `${stepPath}.type`,
          message: `v1 steps declare a kind key (${STEP_KIND_KEYS.join(", ")}), not type:`,
        });
      }
      if ("spec" in step && stepKind(step) == null) {
        violations.push({
          example: name,
          path: `${stepPath}.spec`,
          message: "v0-style spec: without a v1 kind key is not valid converter output",
        });
      }

      const kind = stepKind(step);
      if (kind == null) {
        violations.push({
          example: name,
          path: stepPath,
          message: `step must include one of: ${STEP_KIND_KEYS.join(", ")}`,
        });
      }
    }, `${stagePath}.steps`);

    walkSteps(stage.rollback, (step, stepPath) => {
      const kind = stepKind(step);
      if (kind == null) {
        violations.push({
          example: name,
          path: stepPath,
          message: `rollback step must include one of: ${STEP_KIND_KEYS.join(", ")}`,
        });
      }
    }, `${stagePath}.rollback`);
  });

  return violations;
}

function validateForbiddenPatterns(name: string, yaml: string): Violation[] {
  return FORBIDDEN_YAML_PATTERNS.flatMap(({ pattern, reason }) =>
    pattern.test(yaml) ? [{ example: name, path: "yaml", message: reason }] : [],
  );
}

const v1Examples = getExamplesForResource("pipeline_v1");

describe("pipeline_v1 example converter contract", () => {
  it("registers a meaningful catalog of v1 examples", () => {
    expect(v1Examples.length).toBeGreaterThanOrEqual(10);
  });

  it.each(v1Examples.map((ex) => [ex.name, ex.yaml] as const))(
    "%s parses as YAML with a pipeline root",
    (name, yaml) => {
      const doc = parseYaml(yaml);
      expect(isRecord(doc?.pipeline)).toBe(true);
      expect(doc.pipeline.id, `${name} pipeline.id`).toBeTypeOf("string");
    },
  );

  it.each(v1Examples.map((ex) => [ex.name, ex.yaml] as const))(
    "%s avoids v0 and agent-schema anti-patterns",
    (name, yaml) => {
      const violations = validateForbiddenPatterns(name, yaml);
      expect(violations, violations.map((v) => v.message).join("\n")).toEqual([]);
    },
  );

  it.each(v1Examples.map((ex) => [ex.name, ex.yaml] as const))(
    "%s matches v1 converter structural idioms",
    (name, yaml) => {
      const violations = validateExampleStructure(name, yaml);
      expect(violations, violations.map((v) => `${v.path}: ${v.message}`).join("\n")).toEqual([]);
    },
  );
});

describe("pipeline_v1 example PR #428 regression guards", () => {
  it("minimal-v1 uses shell runtime and run: steps", () => {
    const ex = v1Examples.find((e) => e.name === "minimal-v1");
    expect(ex).toBeDefined();
    const pipeline = parseYaml(ex!.yaml).pipeline;
    expect(pipeline.id).toBe("simple_build");
    expect(pipeline.clone?.enabled).toBe(false);
    expect(pipeline.stages[0].runtime.shell).toBe(true);
    expect(pipeline.stages[0].steps[0].run.shell).toBe("sh");
  });

  it("agent-pipeline models agent work as a run step with container, not type: agent", () => {
    const ex = v1Examples.find((e) => e.name === "agent-pipeline");
    expect(ex).toBeDefined();
    expect(ex!.yaml).not.toMatch(/type:\s+agent/);
    expect(ex!.yaml).not.toMatch(/mcp_servers:/);

    const pipeline = parseYaml(ex!.yaml).pipeline;
    const step = pipeline.stages[0].steps[0];
    expect(step.run.container.image).toContain("agent");
    expect(step.run.env.ANTHROPIC_MODEL).toContain("<+pipeline.variables.model>");
    expect(pipeline.stages[0].runtime.kubernetes.connector).toBe("account.k8s_build_cluster");
  });

  it("ci-docker-build-v1 uses kubernetes runtime, not vm pool", () => {
    const ex = v1Examples.find((e) => e.name === "ci-docker-build-v1");
    expect(ex).toBeDefined();
    expect(ex!.yaml).not.toMatch(/vm:/);

    const runtime = parseYaml(ex!.yaml).pipeline.stages[0].runtime;
    expect(runtime.kubernetes.namespace).toBe("harness-builds");
    expect(runtime.kubernetes.node).toEqual({});
  });
});
