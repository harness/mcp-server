/**
 * Guards production-image security invariants from Trivy/OpenSSL cache-bust fixes.
 * Fails when Dockerfile drops apt upgrade, version floors, or the refresh ARG.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "../..");
const DOCKERFILE_PATH = join(REPO_ROOT, "Dockerfile");

/** Bookworm OpenSSL floor patched in #1154 — keep in sync with Dockerfile dpkg checks. */
const MIN_OPENSSL_DEB_VERSION = "3.0.22-1~deb12u2";

describe("Dockerfile production security", () => {
  const dockerfile = readFileSync(DOCKERFILE_PATH, "utf8");

  it("bumps Debian apt layer via DEBIAN_SECURITY_REFRESH (GHA cache bust)", () => {
    expect(dockerfile).toMatch(/ARG DEBIAN_SECURITY_REFRESH=\d{4}-\d{2}-\d{2}/);
    expect(dockerfile).toContain("debian-security-refresh=${DEBIAN_SECURITY_REFRESH}");
  });

  it("runs apt-get upgrade before pinning runtime packages", () => {
    const productionStage = dockerfile.slice(dockerfile.indexOf("FROM ${RUNTIME_IMAGE} AS production"));
    expect(productionStage).toMatch(/apt-get upgrade -y/);
    expect(productionStage).toMatch(/apt-get install -y --no-install-recommends[\s\S]*libssl3 openssl/);
  });

  it("asserts libssl3 and openssl meet the patched Bookworm floor at image build time", () => {
    expect(dockerfile).toContain(`libssl3)" ge ${MIN_OPENSSL_DEB_VERSION}`);
    expect(dockerfile).toContain(`openssl)" ge ${MIN_OPENSSL_DEB_VERSION}`);
  });

  it("does not ship package managers in the production stage", () => {
    const productionStage = dockerfile.slice(dockerfile.indexOf("FROM ${RUNTIME_IMAGE} AS production"));
    expect(productionStage).not.toMatch(/corepack prepare/);
    expect(productionStage).not.toMatch(/pnpm install/);
    expect(productionStage).toContain('COPY --from=toolchain /usr/local/bin/node /usr/local/bin/node');
  });

  it("copies adm-zip postinstall scripts before pnpm install in build stages", () => {
    for (const stageName of ["build", "production-dependencies"] as const) {
      const marker = `FROM toolchain AS ${stageName}`;
      const stage = dockerfile.slice(dockerfile.indexOf(marker), dockerfile.indexOf(marker) + 600);
      const copyIndex = stage.indexOf("COPY scripts/ensure-secure-adm-zip.mjs");
      const installIndex = stage.indexOf("RUN pnpm install");
      expect(copyIndex, `${stageName}: missing adm-zip script COPY`).toBeGreaterThan(-1);
      expect(installIndex, `${stageName}: missing pnpm install`).toBeGreaterThan(-1);
      expect(copyIndex, `${stageName}: adm-zip scripts must precede pnpm install`).toBeLessThan(installIndex);
    }
  });
});
