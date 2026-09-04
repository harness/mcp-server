/**
 * Dockerfile contract tests for the hardened production container runtime.
 *
 * These guard against regressions in multi-stage separation (build tooling vs
 * minimal runtime), ONNX native dependencies, non-root execution, and the
 * postinstall security script ordering required by package.json.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(import.meta.dirname, "../..");
const DOCKERFILE_PATH = join(REPO_ROOT, "Dockerfile");

function readDockerfile(): string {
  return readFileSync(DOCKERFILE_PATH, "utf8");
}

function stageBlock(dockerfile: string, stageName: string): string {
  const pattern = new RegExp(`FROM [^\\n]+ AS ${stageName}\\s*\\n[\\s\\S]*?(?=\\r?\\nFROM |$)`);
  const match = dockerfile.match(pattern);
  expect(match, `Expected Dockerfile stage ${stageName}`).toBeTruthy();
  return match![0];
}

describe("Dockerfile — hardened production runtime contract", () => {
  const dockerfile = readDockerfile();

  it("declares separate toolchain, build, production-dependencies, and production stages", () => {
    expect(dockerfile).toMatch(/FROM \$\{NODE_IMAGE\} AS toolchain/);
    expect(dockerfile).toMatch(/FROM toolchain AS build/);
    expect(dockerfile).toMatch(/FROM toolchain AS production-dependencies/);
    expect(dockerfile).toMatch(/FROM \$\{RUNTIME_IMAGE\} AS production/);
  });

  it("uses Debian bookworm-slim for the production runtime base image", () => {
    expect(dockerfile).toMatch(/ARG RUNTIME_IMAGE=debian:bookworm-slim/);
    expect(stageBlock(dockerfile, "production")).toMatch(/FROM \$\{RUNTIME_IMAGE\} AS production/);
  });

  it("copies only the Node executable into production, not the full Node image toolchain", () => {
    const production = stageBlock(dockerfile, "production");
    expect(production).toMatch(/COPY --from=toolchain \/usr\/local\/bin\/node \/usr\/local\/bin\/node/);
    expect(production).not.toMatch(/corepack/);
    expect(production).not.toMatch(/pnpm install/);
    expect(production).not.toMatch(/pnpm-lock\.yaml/);
  });

  it("installs production dependencies in an isolated stage before copying node_modules", () => {
    const deps = stageBlock(dockerfile, "production-dependencies");
    expect(deps).toMatch(/pnpm install --frozen-lockfile --prod/);
    expect(stageBlock(dockerfile, "production")).toMatch(
      /COPY --from=production-dependencies --chown=node:node \/app\/node_modules node_modules\//,
    );
  });

  it("installs ONNX runtime native dependencies in the production image", () => {
    const production = stageBlock(dockerfile, "production");
    expect(production).toMatch(/ca-certificates/);
    expect(production).toMatch(/libgomp1/);
    expect(production).toMatch(/libstdc\+\+6/);
  });

  it("creates and runs as the non-root node user (uid/gid 1000)", () => {
    const production = stageBlock(dockerfile, "production");
    expect(production).toMatch(/groupadd --gid 1000 node/);
    expect(production).toMatch(/useradd --uid 1000 --gid node/);
    expect(production).toMatch(/\nUSER node\n/);
  });

  it("copies adm-zip security scripts before pnpm install in build and production-dependencies", () => {
    for (const stage of ["build", "production-dependencies"]) {
      const block = stageBlock(dockerfile, stage);
      const scriptCopy = block.indexOf("COPY scripts/ensure-secure-adm-zip.mjs");
      const install = block.indexOf("pnpm install");
      expect(scriptCopy, `${stage}: security scripts must be copied`).toBeGreaterThanOrEqual(0);
      expect(install, `${stage}: pnpm install must exist`).toBeGreaterThanOrEqual(0);
      expect(scriptCopy, `${stage}: scripts before install`).toBeLessThan(install);
    }
  });

  it("binds HTTP on all interfaces with a PORT-aware healthcheck", () => {
    const production = stageBlock(dockerfile, "production");
    expect(production).toMatch(/HOST=0\.0\.0\.0/);
    expect(production).toMatch(/PORT=3000/);
    expect(dockerfile).toMatch(/process\.env\.PORT\|\|'3000'/);
    expect(dockerfile).toMatch(/127\.0\.0\.1:\$\{port\}\/health/);
  });

  it("ships only runtime artifacts into production (package.json, build output, model cache)", () => {
    const production = stageBlock(dockerfile, "production");
    expect(production).toMatch(/COPY --chown=node:node package\.json \.\//);
    expect(production).toMatch(/COPY --from=build --chown=node:node \/app\/build build\//);
    expect(production).toMatch(/COPY --from=build --chown=node:node \/app\/\.cache\/hf/);
    expect(production).not.toMatch(/COPY tsconfig\.json/);
    expect(production).not.toMatch(/COPY src\//);
  });
});
