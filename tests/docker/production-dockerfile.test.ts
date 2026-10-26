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

function dockerStage(dockerfile: string, stageName: string, nextStageName?: string): string {
  const marker = `FROM toolchain AS ${stageName}`;
  const start = dockerfile.indexOf(marker);
  expect(start, `expected ${marker} in Dockerfile`).toBeGreaterThan(-1);
  const end =
    nextStageName === undefined
      ? dockerfile.length
      : dockerfile.indexOf(`FROM toolchain AS ${nextStageName}`, start + 1);
  return dockerfile.slice(start, end === -1 ? dockerfile.length : end);
}

const ADM_ZIP_SCRIPT_COPY =
  /COPY scripts\/ensure-secure-adm-zip\.mjs scripts\/adm-zip-security-lib\.mjs scripts\//;

describe("Dockerfile dependency stages (adm-zip postinstall)", () => {
  const dockerfile = readFileSync(dockerfilePath, "utf8");

  it("copies adm-zip postinstall scripts before pnpm install in the build stage", () => {
    const stage = dockerStage(dockerfile, "build", "production-dependencies");
    const copyIndex = stage.search(ADM_ZIP_SCRIPT_COPY);
    const installIndex = stage.indexOf("RUN pnpm install --frozen-lockfile");
    expect(copyIndex, "build stage must COPY adm-zip scripts").toBeGreaterThan(-1);
    expect(installIndex, "build stage must run pnpm install").toBeGreaterThan(-1);
    expect(copyIndex).toBeLessThan(installIndex);
    expect(stage).toMatch(
      /package\.json postinstall imports both files, so they must exist before install/,
    );
  });

  it("copies adm-zip postinstall scripts before prod-only pnpm install", () => {
    const stage = dockerStage(dockerfile, "production-dependencies", undefined);
    const bounded = stage.split("FROM ${RUNTIME_IMAGE} AS production")[0]!;
    const copyIndex = bounded.search(ADM_ZIP_SCRIPT_COPY);
    const installIndex = bounded.indexOf("RUN pnpm install --frozen-lockfile --prod");
    expect(copyIndex, "production-dependencies stage must COPY adm-zip scripts").toBeGreaterThan(-1);
    expect(installIndex, "production-dependencies stage must run pnpm install --prod").toBeGreaterThan(
      -1,
    );
    expect(copyIndex).toBeLessThan(installIndex);
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

  it("installs ONNX runtime glibc dependencies on the production apt line", () => {
    const stage = productionStage(dockerfile);
    expect(stage).toMatch(
      /apt-get install -y --no-install-recommends[\s\S]*\bca-certificates\b[\s\S]*\blibgomp1\b[\s\S]*\blibstdc\+\+6\b/,
    );
    expect(dockerfile).toMatch(/ONNX Runtime's Node binding needs glibc and libgomp/);
  });

  it("keeps libpcre2 on the production apt install line for ONNX runtime bindings", () => {
    const stage = productionStage(dockerfile);
    expect(stage).toMatch(
      /apt-get install -y --no-install-recommends[\s\S]*\blibpcre2-8-0\b/,
    );
  });

  it("scopes DEBIAN_SECURITY_REFRESH to the production stage so apt cache busting affects runtime layers", () => {
    const stage = productionStage(dockerfile);
    expect(stage).toMatch(/^ARG DEBIAN_SECURITY_REFRESH=\d{4}-\d{2}-\d{2}/m);
    const buildStages = dockerfile.split("FROM ${RUNTIME_IMAGE} AS production")[0];
    expect(buildStages).not.toMatch(/DEBIAN_SECURITY_REFRESH/);
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
