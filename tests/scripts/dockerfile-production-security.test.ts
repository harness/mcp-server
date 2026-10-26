/**
 * Regression guard for production-image Debian/OpenSSL security pins in Dockerfile.
 * Complements scripts/adm-zip-security-lib tests for npm dependency floors.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "../..");
const DOCKERFILE_PATH = join(REPO_ROOT, "Dockerfile");

/** Minimum patched OpenSSL packages on Debian bookworm (Oct 2026 security refresh). */
const MIN_DEBIAN_OPENSSL = "3.0.22-1~deb12u2";

describe("Dockerfile — production runtime security", () => {
  const content = readFileSync(DOCKERFILE_PATH, "utf8");
  const productionStage = content.slice(content.indexOf("FROM ${RUNTIME_IMAGE} AS production"));

  it("installs libssl3/openssl and fails the build below the patched Debian revision", () => {
    expect(productionStage).toContain("libssl3 openssl");
    expect(productionStage).toContain("dpkg-query -W -f='${Version}' libssl3");
    expect(productionStage).toContain("dpkg-query -W -f='${Version}' openssl");
    expect(productionStage).toContain(`ge ${MIN_DEBIAN_OPENSSL}`);
  });

  it("documents DEBIAN_SECURITY_REFRESH so apt security layers are not silently cached", () => {
    expect(productionStage).toMatch(/ARG DEBIAN_SECURITY_REFRESH=\d{4}-\d{2}-\d{2}/);
    expect(productionStage).toContain("debian-security-refresh=${DEBIAN_SECURITY_REFRESH}");
  });

  it("copies only the Node binary from toolchain (no package managers in production)", () => {
    expect(content).toMatch(/copy only the Node executable/i);
    expect(productionStage).toContain("COPY --from=toolchain /usr/local/bin/node /usr/local/bin/node");
    expect(productionStage).not.toMatch(/COPY --from=toolchain[^\n]*pnpm/);
  });
});
