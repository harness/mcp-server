/**
 * Dockerfile build stages must COPY adm-zip postinstall scripts before pnpm install.
 * Otherwise postinstall imports fail and cached layers can ship vulnerable transitive adm-zip.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dockerfilePath = join(process.cwd(), "Dockerfile");

function stageByAlias(dockerfile: string, alias: string): string {
  const re = new RegExp(`FROM [^\\n]+ AS ${alias}\\s+([\\s\\S]*?)(?=\\nFROM |$)`);
  const match = dockerfile.match(re);
  expect(match, `expected Dockerfile stage alias ${alias}`).not.toBeNull();
  return match![1]!;
}

function assertAdmZipScriptsBeforeInstall(stage: string, alias: string): void {
  const copyLine =
    "COPY scripts/ensure-secure-adm-zip.mjs scripts/adm-zip-security-lib.mjs scripts/";
  const installLine = "RUN pnpm install";

  expect(stage, `${alias} must document postinstall script ordering`).toMatch(
    /package\.json postinstall imports both files/,
  );
  expect(stage).toContain(copyLine);

  const copyIndex = stage.indexOf(copyLine);
  const installIndex = stage.indexOf(installLine);
  expect(copyIndex, `${alias} must COPY adm-zip scripts`).toBeGreaterThan(-1);
  expect(installIndex, `${alias} must run pnpm install`).toBeGreaterThan(-1);
  expect(copyIndex).toBeLessThan(installIndex);
}

describe("Dockerfile build stages (adm-zip postinstall)", () => {
  const dockerfile = readFileSync(dockerfilePath, "utf8");

  it("copies adm-zip security scripts before install in the build stage", () => {
    assertAdmZipScriptsBeforeInstall(stageByAlias(dockerfile, "build"), "build");
  });

  it("copies adm-zip security scripts before prod install in production-dependencies", () => {
    const stage = stageByAlias(dockerfile, "production-dependencies");
    const copyLine =
      "COPY scripts/ensure-secure-adm-zip.mjs scripts/adm-zip-security-lib.mjs scripts/";
    const installIndex = stage.indexOf("RUN pnpm install --frozen-lockfile --prod");
    const copyIndex = stage.indexOf(copyLine);
    expect(copyIndex).toBeGreaterThan(-1);
    expect(installIndex).toBeGreaterThan(-1);
    expect(copyIndex).toBeLessThan(installIndex);
  });
});
