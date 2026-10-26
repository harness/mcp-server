import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dockerfilePath = join(process.cwd(), "Dockerfile");

const ADM_ZIP_SCRIPT_COPY =
  "COPY scripts/ensure-secure-adm-zip.mjs scripts/adm-zip-security-lib.mjs scripts/";

function dockerStage(dockerfile: string, stageName: string): string {
  const marker = `FROM toolchain AS ${stageName}`;
  const start = dockerfile.indexOf(marker);
  expect(start, `expected ${stageName} stage in Dockerfile`).toBeGreaterThan(-1);
  const nextFrom = dockerfile.indexOf("\nFROM ", start + marker.length);
  return nextFrom === -1 ? dockerfile.slice(start) : dockerfile.slice(start, nextFrom);
}

describe("Dockerfile adm-zip postinstall prerequisites", () => {
  const dockerfile = readFileSync(dockerfilePath, "utf8");

  it("copies adm-zip security scripts before pnpm install in dependency stages", () => {
    for (const stageName of ["build", "production-dependencies"] as const) {
      const stage = dockerStage(dockerfile, stageName);
      expect(stage).toContain(ADM_ZIP_SCRIPT_COPY);

      const copyIndex = stage.indexOf(ADM_ZIP_SCRIPT_COPY);
      const installIndex = stage.indexOf("pnpm install");
      expect(installIndex, `${stageName} must run pnpm install`).toBeGreaterThan(-1);
      expect(copyIndex, `${stageName} must copy adm-zip scripts before install`).toBeLessThan(
        installIndex,
      );
    }
  });

  it("does not copy adm-zip scripts into the production runtime stage", () => {
    const productionMarker = "FROM ${RUNTIME_IMAGE} AS production";
    const production = dockerfile.slice(dockerfile.indexOf(productionMarker));
    expect(production).not.toContain("ensure-secure-adm-zip.mjs");
    expect(production).not.toContain("adm-zip-security-lib.mjs");
  });
});
