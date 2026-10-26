import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dockerfilePath = join(process.cwd(), "Dockerfile");

function extractStage(dockerfile: string, stageName: string): string {
  const start = dockerfile.indexOf(`FROM toolchain AS ${stageName}`);
  expect(start, `missing FROM toolchain AS ${stageName}`).toBeGreaterThanOrEqual(0);
  const nextFrom = dockerfile.indexOf("\nFROM ", start + 1);
  return nextFrom === -1 ? dockerfile.slice(start) : dockerfile.slice(start, nextFrom);
}

describe("Dockerfile adm-zip postinstall prerequisites", () => {
  const dockerfile = readFileSync(dockerfilePath, "utf8");

  for (const stage of ["build", "production-dependencies"] as const) {
    it(`copies adm-zip security scripts before pnpm install in the ${stage} stage`, () => {
      const stageText = extractStage(dockerfile, stage);
      expect(stageText).toMatch(
        /COPY scripts\/ensure-secure-adm-zip\.mjs scripts\/adm-zip-security-lib\.mjs scripts\/[\s\S]*pnpm install/,
      );
    });
  }

  it("documents why postinstall scripts must exist before the install layer", () => {
    expect(dockerfile).toContain(
      "package.json postinstall imports both files, so they must exist before install.",
    );
  });
});
