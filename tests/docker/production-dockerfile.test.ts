import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dockerfilePath = join(process.cwd(), "Dockerfile");

const OPENSSL_DEBIAN_FLOOR = "3.0.22-1~deb12u2";
const MIN_DEBIAN_SECURITY_REFRESH = "2026-10-26";

describe("production Dockerfile (Trivy / Debian base image)", () => {
  const dockerfile = readFileSync(dockerfilePath, "utf8");
  const productionStage = dockerfile.slice(dockerfile.indexOf("FROM ${RUNTIME_IMAGE} AS production"));

  it("bumps DEBIAN_SECURITY_REFRESH so GHA layer cache replays apt security upgrades", () => {
    const argMatch = dockerfile.match(/^ARG DEBIAN_SECURITY_REFRESH=(\d{4}-\d{2}-\d{2})/m);
    expect(argMatch, "expected ARG DEBIAN_SECURITY_REFRESH=YYYY-MM-DD in Dockerfile").not.toBeNull();
    expect(argMatch![1] >= MIN_DEBIAN_SECURITY_REFRESH).toBe(true);

    expect(dockerfile).toContain('echo "debian-security-refresh=${DEBIAN_SECURITY_REFRESH}"');
    expect(dockerfile).toMatch(/apt-get update[\s\S]*apt-get upgrade -y/);
  });

  it("installs OpenSSL runtime packages patched for recent Debian CVEs", () => {
    expect(productionStage).toMatch(
      /apt-get install -y --no-install-recommends[\s\S]*\blibssl3\b[\s\S]*\bopenssl\b/,
    );
  });

  it("installs libpcre2-8-0 in the production runtime image (Trivy / bookworm-slim)", () => {
    expect(productionStage).toMatch(
      /apt-get install -y --no-install-recommends[\s\S]*\blibpcre2-8-0\b/,
    );
  });

  it("keeps OpenSSL dpkg version gates only in the production stage", () => {
    const beforeProduction = dockerfile.slice(0, dockerfile.indexOf("FROM ${RUNTIME_IMAGE} AS production"));
    expect(beforeProduction).not.toContain("dpkg --compare-versions");
    expect(beforeProduction).not.toMatch(/\blibssl3\b/);
    expect(productionStage).toContain("dpkg --compare-versions");
  });

  it("fails the image build when bookworm OpenSSL packages are below the patched floor", () => {
    const libsslGate =
      "dpkg --compare-versions \"$(dpkg-query -W -f='${Version}' libssl3)\" ge " + OPENSSL_DEBIAN_FLOOR;
    const opensslGate =
      "dpkg --compare-versions \"$(dpkg-query -W -f='${Version}' openssl)\" ge " + OPENSSL_DEBIAN_FLOOR;
    expect(productionStage).toContain(libsslGate);
    expect(productionStage).toContain(opensslGate);
  });

  it("uses debian:bookworm-slim for the production runtime stage", () => {
    expect(dockerfile).toMatch(/ARG RUNTIME_IMAGE=debian:bookworm-slim/);
    expect(productionStage).toMatch(/^FROM \$\{RUNTIME_IMAGE\} AS production/m);
  });

  it("copies adm-zip postinstall scripts before pnpm install in dependency stages", () => {
    for (const stage of ["build", "production-dependencies"]) {
      const stageMatch = dockerfile.match(
        new RegExp(`FROM toolchain AS ${stage}([\\s\\S]*?)(?=\\nFROM )`),
      );
      expect(stageMatch, `expected ${stage} stage in Dockerfile`).not.toBeNull();
      const body = stageMatch![1];
      const copyIdx = body.indexOf("COPY scripts/ensure-secure-adm-zip.mjs scripts/adm-zip-security-lib.mjs scripts/");
      const installIdx = body.indexOf("RUN pnpm install");
      expect(copyIdx).toBeGreaterThan(-1);
      expect(installIdx).toBeGreaterThan(copyIdx);
    }
  });
});
