import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = join(import.meta.dirname, "..", "..");
const dockerfile = readFileSync(join(repoRoot, "Dockerfile"), "utf-8");
const packageJson = JSON.parse(
  readFileSync(join(repoRoot, "package.json"), "utf-8"),
) as { scripts?: { postinstall?: string } };

const POSTINSTALL_SCRIPTS = [
  "scripts/ensure-secure-adm-zip.mjs",
  "scripts/adm-zip-security-lib.mjs",
];

function stageBlocks(dockerfileText: string): Record<string, string> {
  const blocks: Record<string, string> = {};
  const stageRe = /^FROM .+ AS (\w+)$/gm;
  const matches = [...dockerfileText.matchAll(stageRe)];

  for (let i = 0; i < matches.length; i++) {
    const stageName = matches[i]![1]!;
    const start = matches[i]!.index!;
    const end = i + 1 < matches.length ? matches[i + 1]!.index! : dockerfileText.length;
    blocks[stageName] = dockerfileText.slice(start, end);
  }

  return blocks;
}

function expectScriptsCopiedBeforeInstall(stage: string, stageName: string): void {
  const installIndex = stage.indexOf("RUN pnpm install");
  expect(installIndex, `${stageName} must run pnpm install`).toBeGreaterThanOrEqual(0);

  for (const script of POSTINSTALL_SCRIPTS) {
    const copyIndex = stage.indexOf(script);
    expect(copyIndex, `${stageName} must COPY ${script}`).toBeGreaterThanOrEqual(0);
    expect(
      copyIndex,
      `${stageName} must copy ${script} before pnpm install (postinstall imports it)`,
    ).toBeLessThan(installIndex);
  }
}

describe("Dockerfile deployment contract", () => {
  const stages = stageBlocks(dockerfile);

  it("postinstall security scripts exist and are referenced by package.json", () => {
    expect(packageJson.scripts?.postinstall).toContain("ensure-secure-adm-zip.mjs");
    for (const script of POSTINSTALL_SCRIPTS) {
      expect(() => readFileSync(join(repoRoot, script), "utf-8")).not.toThrow();
    }
  });

  it("copies postinstall security scripts before dependency install in build and production stages", () => {
    expectScriptsCopiedBeforeInstall(stages.build ?? "", "build");
    expectScriptsCopiedBeforeInstall(stages.production ?? "", "production");
  });

  it("uses a glibc Node image with libgomp for onnxruntime-node", () => {
    expect(dockerfile).toMatch(/node:22-bookworm-slim/);
    expect(dockerfile).toMatch(/libgomp1/);
    expect(dockerfile).not.toMatch(/node:22-alpine/);
  });

  it("runs HTTP mode on all interfaces with a configurable port in production", () => {
    const production = stages.production ?? "";
    expect(production).toMatch(/HOST=0\.0\.0\.0/);
    expect(production).toMatch(/PORT=3000/);
    expect(dockerfile).toMatch(/ENTRYPOINT \["node", "build\/index\.js", "http"\]/);
  });

  it("health check probes /health using PORT instead of a hard-coded port", () => {
    expect(dockerfile).toMatch(/HEALTHCHECK/);
    expect(dockerfile).toMatch(/process\.env\.PORT/);
    expect(dockerfile).toMatch(/\/health/);
    expect(dockerfile).not.toMatch(/wget -qO- http:\/\/localhost:3000\/health/);
  });

  it("runs as the non-root node user after copying application files", () => {
    const production = stages.production ?? "";
    const chownIndex = production.indexOf("--chown=node:node");
    const userIndex = production.indexOf("USER node");

    expect(chownIndex).toBeGreaterThanOrEqual(0);
    expect(userIndex).toBeGreaterThanOrEqual(0);
    expect(chownIndex, "application files should be owned by node before USER node").toBeLessThan(userIndex);
    expect(production).not.toMatch(/adduser -S mcp/);
  });
});
