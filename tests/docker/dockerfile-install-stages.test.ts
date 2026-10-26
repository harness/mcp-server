import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dockerfilePath = join(process.cwd(), "Dockerfile");

const ADM_ZIP_SCRIPT_COPY =
  "COPY scripts/ensure-secure-adm-zip.mjs scripts/adm-zip-security-lib.mjs scripts/";

function stageBody(dockerfile: string, stageName: string): string {
  const marker = `FROM ${stageName}`;
  const start = dockerfile.indexOf(marker);
  expect(start, `expected stage ${stageName} in Dockerfile`).toBeGreaterThan(-1);
  const nextFrom = dockerfile.indexOf("\nFROM ", start + 1);
  return nextFrom === -1 ? dockerfile.slice(start) : dockerfile.slice(start, nextFrom);
}

function indexBeforeInstall(stage: string, needle: string): void {
  const copyIndex = stage.indexOf(needle);
  const installIndex = stage.indexOf("RUN pnpm install");
  expect(copyIndex, `expected ${needle} in stage`).toBeGreaterThan(-1);
  expect(installIndex, "expected RUN pnpm install in stage").toBeGreaterThan(-1);
  expect(copyIndex).toBeLessThan(installIndex);
}

describe("Dockerfile install stages (postinstall adm-zip security scripts)", () => {
  const dockerfile = readFileSync(dockerfilePath, "utf8");

  it("copies adm-zip patch scripts before pnpm install in the build stage", () => {
    const stage = stageBody(dockerfile, "toolchain AS build");
    indexBeforeInstall(stage, ADM_ZIP_SCRIPT_COPY);
    expect(stage).toMatch(/package\.json postinstall imports both files/);
  });

  it("copies adm-zip patch scripts before pnpm install in production-dependencies", () => {
    const stage = stageBody(dockerfile, "toolchain AS production-dependencies");
    indexBeforeInstall(stage, ADM_ZIP_SCRIPT_COPY);
  });

  it("ships adm-zip security scripts in the published npm package files list", () => {
    const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
      files: string[];
    };
    expect(packageJson.files).toContain("scripts/adm-zip-security-lib.mjs");
    expect(packageJson.files).toContain("scripts/ensure-secure-adm-zip.mjs");
  });
});
