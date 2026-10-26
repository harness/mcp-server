import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dockerfile = readFileSync(join(process.cwd(), "Dockerfile"), "utf8");

const ADM_ZIP_COPY =
  "COPY scripts/ensure-secure-adm-zip.mjs scripts/adm-zip-security-lib.mjs scripts/";

function stageBlock(stageName: string): string {
  const marker = `FROM toolchain AS ${stageName}`;
  const start = dockerfile.indexOf(marker);
  expect(start, `missing Dockerfile stage ${stageName}`).toBeGreaterThanOrEqual(0);
  const nextFrom = dockerfile.indexOf("\nFROM ", start + marker.length);
  return nextFrom === -1 ? dockerfile.slice(start) : dockerfile.slice(start, nextFrom);
}

function assertAdmZipScriptsBeforePnpmInstall(stage: string, block: string): void {
  const copyIdx = block.indexOf(ADM_ZIP_COPY);
  const installIdx = block.indexOf("RUN pnpm install");
  expect(copyIdx, `${stage}: adm-zip security scripts must be COPY'd into the image`).toBeGreaterThanOrEqual(
    0,
  );
  expect(installIdx, `${stage}: expected pnpm install layer`).toBeGreaterThanOrEqual(0);
  expect(
    copyIdx < installIdx,
    `${stage}: postinstall runs during pnpm install — COPY adm-zip scripts before RUN pnpm install`,
  ).toBe(true);
}

describe("Dockerfile — adm-zip postinstall prerequisites", () => {
  it("documents why adm-zip scripts are copied before install", () => {
    expect(dockerfile).toContain(
      "package.json postinstall imports both files, so they must exist before install.",
    );
  });

  it("copies adm-zip security scripts before pnpm install in build and production-dependencies", () => {
    assertAdmZipScriptsBeforePnpmInstall("build", stageBlock("build"));
    assertAdmZipScriptsBeforePnpmInstall(
      "production-dependencies",
      stageBlock("production-dependencies"),
    );
  });
});
