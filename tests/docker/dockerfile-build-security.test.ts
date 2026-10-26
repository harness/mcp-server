import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dockerfilePath = join(process.cwd(), "Dockerfile");
const packageJsonPath = join(process.cwd(), "package.json");

const ADM_ZIP_SCRIPT_COPY =
  "COPY scripts/ensure-secure-adm-zip.mjs scripts/adm-zip-security-lib.mjs scripts/";

function stageBlock(dockerfile: string, stageName: string): string {
  const marker = `FROM toolchain AS ${stageName}`;
  const start = dockerfile.indexOf(marker);
  expect(start, `expected ${marker} in Dockerfile`).toBeGreaterThan(-1);
  const nextFrom = dockerfile.indexOf("\nFROM ", start + 1);
  return nextFrom === -1 ? dockerfile.slice(start) : dockerfile.slice(start, nextFrom);
}

function indexBeforeInstall(stage: string): { copyIndex: number; installIndex: number } {
  const copyIndex = stage.indexOf(ADM_ZIP_SCRIPT_COPY);
  const installIndex = stage.indexOf("pnpm install");
  expect(copyIndex, "expected adm-zip security scripts COPY in stage").toBeGreaterThan(-1);
  expect(installIndex, "expected pnpm install in stage").toBeGreaterThan(-1);
  return { copyIndex, installIndex };
}

describe("Dockerfile build stages (adm-zip postinstall / layer cache)", () => {
  const dockerfile = readFileSync(dockerfilePath, "utf8");

  it("documents why adm-zip scripts must exist before pnpm install in the build stage", () => {
    expect(dockerfile).toContain(
      "# package.json postinstall imports both files, so they must exist before install.",
    );
  });

  it("copies adm-zip security scripts before pnpm install in the build stage", () => {
    const stage = stageBlock(dockerfile, "build");
    const { copyIndex, installIndex } = indexBeforeInstall(stage);
    expect(copyIndex).toBeLessThan(installIndex);
    expect(stage).toMatch(/pnpm install --frozen-lockfile/);
  });

  it("copies adm-zip security scripts before prod-only install in production-dependencies", () => {
    const stage = stageBlock(dockerfile, "production-dependencies");
    const { copyIndex, installIndex } = indexBeforeInstall(stage);
    expect(copyIndex).toBeLessThan(installIndex);
    expect(stage).toContain("pnpm install --frozen-lockfile --prod");
  });

  it("keeps postinstall wired to ensure-secure-adm-zip for Docker and npm consumers", () => {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
      scripts: { postinstall?: string };
      files: string[];
    };
    expect(packageJson.scripts.postinstall).toBe("node scripts/ensure-secure-adm-zip.mjs");
    expect(packageJson.files).toEqual(
      expect.arrayContaining([
        "scripts/adm-zip-security-lib.mjs",
        "scripts/ensure-secure-adm-zip.mjs",
      ]),
    );
  });

  it("pins toolchain Node and pnpm versions used for reproducible image builds", () => {
    expect(dockerfile).toMatch(/^ARG NODE_IMAGE=node:22-bookworm-slim/m);
    expect(dockerfile).toContain("corepack prepare pnpm@10.18.2 --activate");
  });
});
