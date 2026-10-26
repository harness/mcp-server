import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const generator = join(root, "scripts/generate-npm-shrinkwrap.mjs");

function runShrinkwrapCheck(): { status: number | null; stderr: string; stdout: string } {
  const result = spawnSync(process.execPath, [generator, "--check"], {
    cwd: root,
    encoding: "utf8",
  });
  return {
    status: result.status,
    stderr: result.stderr ?? "",
    stdout: result.stdout ?? "",
  };
}

describe("npm-shrinkwrap guardrails", () => {
  it("package.json wires npm-shrinkwrap:check and prepublishOnly", () => {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    expect(packageJson.scripts["npm-shrinkwrap:check"]).toBe(
      "node scripts/generate-npm-shrinkwrap.mjs --check",
    );
    expect(packageJson.scripts.prepublishOnly).toContain("pnpm npm-shrinkwrap:check");
  });

  it("generate-npm-shrinkwrap.mjs --check passes on the committed shrinkwrap", () => {
    const { status, stderr, stdout } = runShrinkwrapCheck();
    expect(status, `${stderr}${stdout}`).toBe(0);
    expect(stderr).toContain("npm-shrinkwrap.json metadata is up to date");
  });

  it("fails --check when root shrinkwrap metadata drifts from package.json", () => {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      name: string;
      version: string;
    };
    const shrinkwrapPath = join(root, "npm-shrinkwrap.json");
    const original = readFileSync(shrinkwrapPath, "utf8");
    const shrinkwrap = JSON.parse(original) as {
      packages: Record<string, { name?: string; version?: string }>;
    };
    shrinkwrap.packages[""] = {
      ...shrinkwrap.packages[""],
      version: `${packageJson.version}-drift-test`,
    };

    try {
      writeFileSync(shrinkwrapPath, `${JSON.stringify(shrinkwrap)}\n`);
      const { status, stderr } = runShrinkwrapCheck();
      expect(status).toBe(1);
      expect(stderr).toContain("out of date");
      expect(stderr).toContain(packageJson.name);
    } finally {
      writeFileSync(shrinkwrapPath, original);
      const restored = runShrinkwrapCheck();
      expect(restored.status, restored.stderr).toBe(0);
    }
  });
});
