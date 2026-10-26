import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dockerfile = readFileSync(join(process.cwd(), "Dockerfile"), "utf8");

describe("Production Dockerfile — Debian OpenSSL refresh (#1154)", () => {
  it("bumps DEBIAN_SECURITY_REFRESH so GHA cache replays apt upgrades", () => {
    expect(dockerfile).toMatch(/ARG DEBIAN_SECURITY_REFRESH=\d{4}-\d{2}-\d{2}/);
    expect(dockerfile).toContain("debian-security-refresh=${DEBIAN_SECURITY_REFRESH}");
  });

  it("runs apt upgrade and enforces libssl3/openssl package floors", () => {
    expect(dockerfile).toMatch(/apt-get upgrade -y/);
    expect(dockerfile).toContain("libssl3");
    expect(dockerfile).toContain("openssl");
    expect(dockerfile).toContain("dpkg --compare-versions");
    expect(dockerfile).toContain("3.0.22-1~deb12u2");
  });

  it("keeps production runtime free of package managers", () => {
    expect(dockerfile).toMatch(/copy only the Node executable/i);
    expect(dockerfile).toContain("COPY --from=toolchain /usr/local/bin/node");
    expect(dockerfile).not.toMatch(/pnpm install.*production-dependencies/);
  });
});

describe("Production Dockerfile — adm-zip postinstall scripts before pnpm install", () => {
  const dependencyStages = ["build", "production-dependencies"];

  function toolchainStageBlock(stage: string): string {
    const marker = `FROM toolchain AS ${stage}`;
    const start = dockerfile.indexOf(marker);
    expect(start, `missing ${marker}`).toBeGreaterThanOrEqual(0);
    const nextFrom = dockerfile.indexOf("\nFROM ", start + marker.length);
    return nextFrom === -1 ? dockerfile.slice(start) : dockerfile.slice(start, nextFrom);
  }

  it("copies adm-zip patch scripts before pnpm install in every dependency stage", () => {
    for (const stage of dependencyStages) {
      const block = toolchainStageBlock(stage);
      const copyScripts = block.indexOf(
        "COPY scripts/ensure-secure-adm-zip.mjs scripts/adm-zip-security-lib.mjs scripts/",
      );
      const pnpmInstall = block.indexOf("pnpm install");
      expect(copyScripts, `${stage}: adm-zip scripts COPY`).toBeGreaterThan(-1);
      expect(pnpmInstall, `${stage}: pnpm install`).toBeGreaterThan(-1);
      expect(pnpmInstall, `${stage}: install must run after postinstall scripts exist`).toBeGreaterThan(
        copyScripts,
      );
    }
  });
});
