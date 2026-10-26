import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = join(import.meta.dirname, "../..");
const dockerfile = readFileSync(join(repoRoot, "Dockerfile"), "utf8");

function stageSlice(fromLabel: string, toLabel?: string): string {
  const fromIndex = dockerfile.indexOf(fromLabel);
  expect(fromIndex, `missing Dockerfile stage marker ${fromLabel}`).toBeGreaterThanOrEqual(0);
  const endIndex = toLabel ? dockerfile.indexOf(toLabel, fromIndex + 1) : dockerfile.length;
  expect(endIndex, `missing Dockerfile stage marker after ${fromLabel}`).toBeGreaterThan(fromIndex);
  return dockerfile.slice(fromIndex, endIndex);
}

describe("production Dockerfile security guardrails", () => {
  it("copies adm-zip postinstall scripts before pnpm install in dependency stages", () => {
    for (const stage of ["FROM toolchain AS build", "FROM toolchain AS production-dependencies"]) {
      const section = stageSlice(stage, stage === "FROM toolchain AS build" ? "FROM toolchain AS production-dependencies" : "FROM ${RUNTIME_IMAGE} AS production");
      const copyIndex = section.indexOf("COPY scripts/ensure-secure-adm-zip.mjs");
      const installIndex = section.indexOf("RUN pnpm install");
      expect(copyIndex, `${stage} must COPY adm-zip scripts`).toBeGreaterThanOrEqual(0);
      expect(installIndex, `${stage} must run pnpm install`).toBeGreaterThanOrEqual(0);
      expect(copyIndex).toBeLessThan(installIndex);
    }
  });

  it("pins Debian OpenSSL packages during the production apt upgrade", () => {
    const production = stageSlice("FROM ${RUNTIME_IMAGE} AS production");
    expect(production).toContain("ARG DEBIAN_SECURITY_REFRESH=");
    expect(production).toMatch(/libssl3.*ge 3\.0\.22-1~deb12u2/);
    expect(production).toMatch(/openssl.*ge 3\.0\.22-1~deb12u2/);
    expect(production).toContain("apt-get upgrade -y");
  });

  it("keeps the runtime image free of package managers", () => {
    const production = stageSlice("FROM ${RUNTIME_IMAGE} AS production");
    expect(production).toContain('COPY --from=toolchain /usr/local/bin/node /usr/local/bin/node');
    expect(production).not.toMatch(/apt-get install -y.*\bnpm\b/);
    expect(production).not.toMatch(/corepack/);
  });
});
