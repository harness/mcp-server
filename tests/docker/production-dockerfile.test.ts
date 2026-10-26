/**
 * Guards production-image Dockerfile security gates introduced for Trivy/OpenSSL fixes.
 * Fails CI if apt packages or dpkg version floors are removed without review.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(import.meta.dirname, "../..");
const DOCKERFILE_PATH = join(REPO_ROOT, "Dockerfile");

const MIN_LIBSSL3_VERSION = "3.0.22-1~deb12u2";
const MIN_OPENSSL_VERSION = "3.0.22-1~deb12u2";

describe("production Dockerfile — container security gates", () => {
  const dockerfile = readFileSync(DOCKERFILE_PATH, "utf8");

  it("bumps DEBIAN_SECURITY_REFRESH so GHA cache replays apt upgrade after CVE fixes", () => {
    expect(dockerfile).toMatch(/ARG DEBIAN_SECURITY_REFRESH=\d{4}-\d{2}-\d{2}/);
    expect(dockerfile).toContain('echo "debian-security-refresh=${DEBIAN_SECURITY_REFRESH}"');
  });

  it("installs OpenSSL packages and enforces patched Debian floor versions", () => {
    const productionStage = dockerfile.slice(dockerfile.indexOf("FROM ${RUNTIME_IMAGE} AS production"));
    expect(productionStage).toContain("libssl3");
    expect(productionStage).toContain("openssl");
    expect(productionStage).toContain("dpkg-query -W -f='${Version}' libssl3)");
    expect(productionStage).toContain(`ge ${MIN_LIBSSL3_VERSION}`);
    expect(productionStage).toContain("dpkg-query -W -f='${Version}' openssl)");
    expect(productionStage).toContain(`ge ${MIN_OPENSSL_VERSION}`);
  });

  it("keeps libpcre2-8-0 in the production runtime apt install line", () => {
    const productionStage = dockerfile.slice(dockerfile.indexOf("FROM ${RUNTIME_IMAGE} AS production"));
    expect(productionStage).toMatch(
      /apt-get install -y --no-install-recommends [^\n]*libpcre2-8-0/,
    );
  });

  it("scopes DEBIAN_SECURITY_REFRESH and dpkg gates to the production stage only", () => {
    const beforeProduction = dockerfile.slice(0, dockerfile.indexOf("FROM ${RUNTIME_IMAGE} AS production"));
    expect(beforeProduction).not.toContain("DEBIAN_SECURITY_REFRESH");
    expect(beforeProduction).not.toContain("dpkg --compare-versions");
  });
});
