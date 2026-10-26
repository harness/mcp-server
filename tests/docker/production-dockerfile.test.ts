import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dockerfilePath = join(process.cwd(), "Dockerfile");

const STAGE_MARKERS: Record<string, string> = {
  build: "FROM toolchain AS build",
  "production-dependencies": "FROM toolchain AS production-dependencies",
  production: "FROM ${RUNTIME_IMAGE} AS production",
};

function dockerStage(dockerfile: string, stageName: string): string {
  const marker = STAGE_MARKERS[stageName];
  expect(marker, `unknown Dockerfile stage ${stageName}`).toBeTruthy();
  const start = dockerfile.indexOf(marker);
  expect(start, `expected ${stageName} stage in Dockerfile`).toBeGreaterThan(-1);
  const nextFrom = dockerfile.indexOf("\nFROM ", start + marker.length);
  return nextFrom === -1 ? dockerfile.slice(start) : dockerfile.slice(start, nextFrom);
}

function productionStage(dockerfile: string): string {
  return dockerStage(dockerfile, "production");
}

function pnpmInstallStageCopiesAdmZipScriptsBeforeInstall(stage: string): void {
  const copyScripts = stage.indexOf("COPY scripts/ensure-secure-adm-zip.mjs");
  const pnpmInstall = stage.indexOf("RUN pnpm install");
  expect(copyScripts, "stage must COPY adm-zip postinstall scripts").toBeGreaterThan(-1);
  expect(pnpmInstall, "stage must run pnpm install").toBeGreaterThan(-1);
  expect(copyScripts).toBeLessThan(pnpmInstall);
  expect(stage).toContain("scripts/adm-zip-security-lib.mjs");
}

describe("Dockerfile — dependency install stages (adm-zip postinstall)", () => {
  const dockerfile = readFileSync(dockerfilePath, "utf8");

  it("copies adm-zip patch scripts before pnpm install in the build stage", () => {
    pnpmInstallStageCopiesAdmZipScriptsBeforeInstall(dockerStage(dockerfile, "build"));
  });

  it("copies adm-zip patch scripts before pnpm install in production-dependencies", () => {
    pnpmInstallStageCopiesAdmZipScriptsBeforeInstall(dockerStage(dockerfile, "production-dependencies"));
  });
});

describe("production Dockerfile (Trivy / Debian base image)", () => {
  const dockerfile = readFileSync(dockerfilePath, "utf8");

  it("bumps DEBIAN_SECURITY_REFRESH so GHA layer cache replays apt security upgrades", () => {
    const argMatch = dockerfile.match(/^ARG DEBIAN_SECURITY_REFRESH=(\d{4}-\d{2}-\d{2})/m);
    expect(argMatch, "expected ARG DEBIAN_SECURITY_REFRESH=YYYY-MM-DD in Dockerfile").not.toBeNull();

    const refreshDate = argMatch![1];
    const minimumRefresh = "2026-10-26";
    expect(refreshDate >= minimumRefresh, `DEBIAN_SECURITY_REFRESH must be >= ${minimumRefresh}`).toBe(
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

  it("installs libpcre2-8-0 in the production runtime (Trivy / bookworm base)", () => {
    const stage = productionStage(dockerfile);
    expect(stage).toMatch(
      /apt-get install -y --no-install-recommends[\s\S]*\blibpcre2-8-0\b/,
    );
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
});
