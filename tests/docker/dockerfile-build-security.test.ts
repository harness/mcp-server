import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dockerfilePath = join(process.cwd(), "Dockerfile");

function stageBody(dockerfile: string, stageName: string): string {
  const marker = `FROM toolchain AS ${stageName}`;
  const start = dockerfile.indexOf(marker);
  expect(start, `expected ${stageName} stage in Dockerfile`).toBeGreaterThan(-1);
  const nextFrom = dockerfile.indexOf("\nFROM ", start + 1);
  return nextFrom === -1 ? dockerfile.slice(start) : dockerfile.slice(start, nextFrom);
}

describe("Dockerfile build stages (postinstall / adm-zip security)", () => {
  const dockerfile = readFileSync(dockerfilePath, "utf8");

  for (const stage of ["build", "production-dependencies"] as const) {
    it(`copies adm-zip security scripts before pnpm install in ${stage} stage`, () => {
      const body = stageBody(dockerfile, stage);
      const copyIndex = body.indexOf("COPY scripts/ensure-secure-adm-zip.mjs scripts/adm-zip-security-lib.mjs scripts/");
      const installIndex = body.indexOf("pnpm install");
      expect(copyIndex, `${stage} must COPY adm-zip scripts`).toBeGreaterThan(-1);
      expect(installIndex, `${stage} must run pnpm install`).toBeGreaterThan(-1);
      expect(copyIndex).toBeLessThan(installIndex);
    });
  }

  it("keeps lockfile COPY before adm-zip scripts so install layer cache stays valid", () => {
    const body = stageBody(dockerfile, "build");
    const lockCopy = body.indexOf("COPY package.json pnpm-lock.yaml ./");
    const scriptsCopy = body.indexOf("COPY scripts/ensure-secure-adm-zip.mjs");
    expect(lockCopy).toBeGreaterThan(-1);
    expect(scriptsCopy).toBeGreaterThan(-1);
    expect(lockCopy).toBeLessThan(scriptsCopy);
  });
});
