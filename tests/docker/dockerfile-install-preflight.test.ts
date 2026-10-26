import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dockerfilePath = join(process.cwd(), "Dockerfile");

const ADM_ZIP_SCRIPTS = [
  "scripts/ensure-secure-adm-zip.mjs",
  "scripts/adm-zip-security-lib.mjs",
];

function stageBlock(dockerfile: string, stageName: string): string {
  const marker = `FROM toolchain AS ${stageName}`;
  const start = dockerfile.indexOf(marker);
  expect(start, `expected ${marker} in Dockerfile`).toBeGreaterThan(-1);
  const nextFrom = dockerfile.indexOf("\nFROM ", start + marker.length);
  return nextFrom === -1 ? dockerfile.slice(start) : dockerfile.slice(start, nextFrom);
}

describe("Dockerfile install preflight (adm-zip postinstall)", () => {
  const dockerfile = readFileSync(dockerfilePath, "utf8");

  for (const stage of ["build", "production-dependencies"] as const) {
    it(`copies adm-zip security scripts before pnpm install in the ${stage} stage`, () => {
      const block = stageBlock(dockerfile, stage);
      for (const script of ADM_ZIP_SCRIPTS) {
        expect(block).toContain(script);
      }

      const copyIndex = block.indexOf("COPY scripts/ensure-secure-adm-zip.mjs");
      const installIndex = block.indexOf("pnpm install");
      expect(copyIndex, `${stage}: expected COPY of adm-zip scripts`).toBeGreaterThan(-1);
      expect(installIndex, `${stage}: expected pnpm install`).toBeGreaterThan(-1);
      expect(copyIndex).toBeLessThan(installIndex);
    });
  }

  it("does not run pnpm install in the production runtime stage", () => {
    const marker = "FROM ${RUNTIME_IMAGE} AS production";
    const start = dockerfile.indexOf(marker);
    expect(start).toBeGreaterThan(-1);
    const production = dockerfile.slice(start);
    expect(production).not.toMatch(/\bpnpm install\b/);
  });
});
