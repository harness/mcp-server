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
});
