import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("npm publish security manifest", () => {
  const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
    files: string[];
    scripts: Record<string, string>;
    overrides: Record<string, { "adm-zip"?: string }>;
    pnpm: { overrides: Record<string, string> };
  };

  const dockerfile = readFileSync(join(root, "Dockerfile"), "utf8");

  it("ships shrinkwrap and adm-zip postinstall helpers in the published tarball", () => {
    expect(packageJson.files).toEqual(
      expect.arrayContaining([
        "build/",
        "npm-shrinkwrap.json",
        "scripts/adm-zip-security-lib.mjs",
        "scripts/ensure-secure-adm-zip.mjs",
      ]),
    );

    for (const relativePath of [
      "scripts/adm-zip-security-lib.mjs",
      "scripts/ensure-secure-adm-zip.mjs",
      "npm-shrinkwrap.json",
    ]) {
      expect(existsSync(join(root, relativePath)), `${relativePath} must exist on disk`).toBe(true);
    }
  });

  it("runs adm-zip verification on postinstall and shrinkwrap check before publish", () => {
    expect(packageJson.scripts.postinstall).toBe("node scripts/ensure-secure-adm-zip.mjs");
    expect(packageJson.scripts.prepublishOnly).toContain("pnpm build");
    expect(packageJson.scripts.prepublishOnly).toContain("pnpm npm-shrinkwrap:check");
  });

  it("pins adm-zip for both pnpm and npm parent overrides", () => {
    expect(packageJson.pnpm.overrides["adm-zip"]).toBe(">=0.6.1");
    expect(packageJson.overrides["onnxruntime-node"]?.["adm-zip"]).toBe("0.6.1");
  });

  it("copies adm-zip security scripts before install in Docker build layers", () => {
    const copyLine =
      "COPY scripts/ensure-secure-adm-zip.mjs scripts/adm-zip-security-lib.mjs scripts/";
    expect(dockerfile).toContain(copyLine);

    const buildStage = dockerfile.slice(0, dockerfile.indexOf("FROM ${RUNTIME_IMAGE} AS production"));
    const copyIndex = buildStage.indexOf(copyLine);
    const installIndex = buildStage.indexOf("pnpm install --frozen-lockfile");
    expect(copyIndex, "Docker build must copy adm-zip scripts before pnpm install").toBeGreaterThan(-1);
    expect(installIndex).toBeGreaterThan(copyIndex);
  });
});
