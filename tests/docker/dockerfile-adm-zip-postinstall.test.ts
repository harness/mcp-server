/**
 * package.json postinstall runs ensure-secure-adm-zip.mjs during `pnpm install`.
 * Docker build stages must COPY those scripts before install or the image build fails.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(import.meta.dirname, "../..");
const DOCKERFILE_PATH = join(REPO_ROOT, "Dockerfile");

function dockerfileStageSlice(dockerfile: string, stageMarker: string): string {
  const start = dockerfile.indexOf(stageMarker);
  expect(start, `missing Dockerfile stage: ${stageMarker}`).toBeGreaterThan(-1);
  const nextFrom = dockerfile.indexOf("\nFROM ", start + 1);
  return nextFrom === -1 ? dockerfile.slice(start) : dockerfile.slice(start, nextFrom);
}

describe("Dockerfile — adm-zip postinstall prerequisites", () => {
  const dockerfile = readFileSync(DOCKERFILE_PATH, "utf8");

  for (const stageMarker of ["FROM toolchain AS build", "FROM toolchain AS production-dependencies"]) {
    it(`copies adm-zip security scripts before pnpm install in ${stageMarker}`, () => {
      const stage = dockerfileStageSlice(dockerfile, stageMarker);
      const copyIndex = stage.indexOf("scripts/ensure-secure-adm-zip.mjs");
      const installIndex = stage.indexOf("pnpm install");
      expect(copyIndex).toBeGreaterThan(-1);
      expect(stage).toContain("scripts/adm-zip-security-lib.mjs");
      expect(installIndex).toBeGreaterThan(copyIndex);
    });
  }

  it("documents why postinstall scripts must exist before install in the build stage", () => {
    const buildStage = dockerfileStageSlice(dockerfile, "FROM toolchain AS build");
    expect(buildStage).toMatch(/postinstall imports both files/i);
  });
});
