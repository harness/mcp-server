import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dockerfilePath = join(process.cwd(), "Dockerfile");

function productionStage(dockerfile: string): string {
  const marker = "FROM ${RUNTIME_IMAGE} AS production";
  const start = dockerfile.indexOf(marker);
  expect(start, "expected production stage in Dockerfile").toBeGreaterThan(-1);
  return dockerfile.slice(start);
}

describe("production Dockerfile (Trivy / Debian base image)", () => {
  const dockerfile = readFileSync(dockerfilePath, "utf8");

  it("bumps DEBIAN_SECURITY_REFRESH so GHA layer cache replays apt security upgrades", () => {
    const argMatch = dockerfile.match(/^ARG DEBIAN_SECURITY_REFRESH=(\d{4}-\d{2}-\d{2})/m);
    expect(argMatch, "expected ARG DEBIAN_SECURITY_REFRESH=YYYY-MM-DD in Dockerfile").not.toBeNull();

    const refreshDate = argMatch![1];
    expect(refreshDate >= "2026-10-26", "bump DEBIAN_SECURITY_REFRESH when Debian apt CVEs are patched").toBe(
      true,
    );

    expect(dockerfile).toContain('echo "debian-security-refresh=${DEBIAN_SECURITY_REFRESH}"');
    expect(dockerfile).toMatch(/apt-get update[\s\S]*apt-get upgrade -y --no-install-recommends/);
  });

  it("installs OpenSSL runtime packages patched for recent Debian CVEs", () => {
    const stage = productionStage(dockerfile);
    expect(stage).toMatch(
      /apt-get install -y --no-install-recommends[\s\S]*\blibssl3\b[\s\S]*\bopenssl\b/,
    );
    expect(stage).toMatch(/rm -rf \/var\/lib\/apt\/lists\/\*/);
  });

  it("runs apt upgrade before installing OpenSSL so cached layers pick up Debian security fixes", () => {
    const stage = productionStage(dockerfile);
    const upgradeIndex = stage.indexOf("apt-get upgrade");
    const opensslInstallIndex = stage.indexOf("libssl3");
    expect(upgradeIndex, "production stage must apt-get upgrade").toBeGreaterThan(-1);
    expect(opensslInstallIndex, "production stage must install libssl3").toBeGreaterThan(-1);
    expect(upgradeIndex).toBeLessThan(opensslInstallIndex);
  });

  it("fails the image build when Debian OpenSSL packages are below the patched bookworm floor", () => {
    const stage = productionStage(dockerfile);
    const opensslFloor = "3.0.22-1~deb12u2";
    expect(stage).toContain("dpkg --compare-versions \"$(dpkg-query -W -f='${Version}' libssl3)\" ge");
    expect(stage).toContain("dpkg --compare-versions \"$(dpkg-query -W -f='${Version}' openssl)\" ge");
    expect(stage).toContain(opensslFloor);
  });

  it("uses the Debian bookworm-slim runtime image for the production stage", () => {
    expect(dockerfile).toMatch(/^ARG RUNTIME_IMAGE=debian:bookworm-slim/m);
    const stage = productionStage(dockerfile);
    expect(stage).toContain("COPY --from=toolchain /usr/local/bin/node /usr/local/bin/node");
    expect(stage).not.toMatch(/\bpnpm\b|\bcorepack\b|\bnpm install\b/);
  });

  it("installs ONNX / Node native runtime libraries in the production stage", () => {
    const stage = productionStage(dockerfile);
    for (const pkg of ["ca-certificates", "libgomp1", "libstdc++6", "libpcre2-8-0"]) {
      expect(stage, `production stage must install ${pkg}`).toContain(pkg);
    }
  });
});

function dependencyInstallStage(dockerfile: string, stageName: "build" | "production-dependencies"): string {
  const marker = `FROM toolchain AS ${stageName}`;
  const start = dockerfile.indexOf(marker);
  expect(start, `expected ${stageName} stage in Dockerfile`).toBeGreaterThan(-1);
  const nextFrom = dockerfile.indexOf("\nFROM ", start + marker.length);
  return nextFrom === -1 ? dockerfile.slice(start) : dockerfile.slice(start, nextFrom);
}

describe("Dockerfile dependency stages (adm-zip postinstall)", () => {
  const dockerfile = readFileSync(dockerfilePath, "utf8");

  for (const stageName of ["build", "production-dependencies"] as const) {
    it(`${stageName}: copies adm-zip patch scripts before pnpm install`, () => {
      const stage = dependencyInstallStage(dockerfile, stageName);
      const ensureIndex = stage.indexOf("scripts/ensure-secure-adm-zip.mjs");
      const installIndex = stage.indexOf("pnpm install");
      expect(ensureIndex, `${stageName} must COPY ensure-secure-adm-zip.mjs`).toBeGreaterThan(-1);
      expect(stage).toContain("scripts/adm-zip-security-lib.mjs");
      expect(installIndex, `${stageName} must run pnpm install`).toBeGreaterThan(-1);
      expect(ensureIndex).toBeLessThan(installIndex);
    });
  }
});
