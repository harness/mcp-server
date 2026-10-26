import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dockerfilePath = join(process.cwd(), "Dockerfile");

/** Bump when Debian/OpenSSL CVE fixes require invalidating the production apt layer cache. */
const MIN_DEBIAN_SECURITY_REFRESH = "2026-10-26";

function productionStage(dockerfile: string): string {
  const marker = "FROM ${RUNTIME_IMAGE} AS production";
  const start = dockerfile.indexOf(marker);
  expect(start, "expected production stage in Dockerfile").toBeGreaterThan(-1);
  return dockerfile.slice(start);
}

function stageBetween(dockerfile: string, startMarker: string, endMarker: string | null): string {
  const start = dockerfile.indexOf(startMarker);
  expect(start, `expected stage marker ${startMarker}`).toBeGreaterThan(-1);
  const end = endMarker ? dockerfile.indexOf(endMarker, start + startMarker.length) : dockerfile.length;
  expect(end, `expected end marker after ${startMarker}`).toBeGreaterThan(start);
  return dockerfile.slice(start, end);
}

describe("production Dockerfile (Trivy / Debian base image)", () => {
  const dockerfile = readFileSync(dockerfilePath, "utf8");

  it("copies adm-zip patch scripts before pnpm install in dependency stages", () => {
    for (const marker of ["FROM toolchain AS build", "FROM toolchain AS production-dependencies"]) {
      const stage = stageBetween(dockerfile, marker, "FROM ");
      expect(stage).toContain("COPY scripts/ensure-secure-adm-zip.mjs scripts/adm-zip-security-lib.mjs scripts/");
      const copyIndex = stage.indexOf("ensure-secure-adm-zip.mjs");
      const installIndex = stage.indexOf("pnpm install");
      expect(copyIndex, `${marker} must copy adm-zip scripts`).toBeGreaterThan(-1);
      expect(installIndex, `${marker} must run pnpm install`).toBeGreaterThan(-1);
      expect(copyIndex).toBeLessThan(installIndex);
    }
  });

  it("bumps DEBIAN_SECURITY_REFRESH so GHA layer cache replays apt security upgrades", () => {
    const argMatch = dockerfile.match(/^ARG DEBIAN_SECURITY_REFRESH=(\d{4}-\d{2}-\d{2})/m);
    expect(argMatch, "expected ARG DEBIAN_SECURITY_REFRESH=YYYY-MM-DD in Dockerfile").not.toBeNull();

    expect(dockerfile).toContain('echo "debian-security-refresh=${DEBIAN_SECURITY_REFRESH}"');
    expect(dockerfile).toMatch(/apt-get update[\s\S]*apt-get upgrade -y --no-install-recommends/);

    const refreshDate = argMatch![1];
    expect(refreshDate >= MIN_DEBIAN_SECURITY_REFRESH, `DEBIAN_SECURITY_REFRESH ${refreshDate} is below ${MIN_DEBIAN_SECURITY_REFRESH}`).toBe(
      true,
    );
  });

  it("installs OpenSSL runtime packages patched for recent Debian CVEs", () => {
    const stage = productionStage(dockerfile);
    expect(stage).toMatch(
      /apt-get install -y --no-install-recommends[\s\S]*\blibssl3\b[\s\S]*\bopenssl\b/,
    );
    expect(stage).toMatch(/rm -rf \/var\/lib\/apt\/lists\/\*/);
  });

  it("installs libpcre2-8-0 for Trivy-flagged PCRE2 CVEs in the production runtime image", () => {
    const stage = productionStage(dockerfile);
    expect(stage).toMatch(
      /apt-get install -y --no-install-recommends[\s\S]*\blibpcre2-8-0\b/,
    );
  });

  it("keeps DEBIAN_SECURITY_REFRESH only in the production stage so toolchain layers stay cacheable", () => {
    const productionMarker = "FROM ${RUNTIME_IMAGE} AS production";
    const beforeProduction = dockerfile.slice(0, dockerfile.indexOf(productionMarker));
    expect(beforeProduction).not.toContain("DEBIAN_SECURITY_REFRESH");
    expect(productionStage(dockerfile)).toContain("ARG DEBIAN_SECURITY_REFRESH=");
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
