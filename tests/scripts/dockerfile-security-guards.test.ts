/**
 * Ensures the production image Dockerfile keeps Debian/OpenSSL refresh hooks
 * introduced for container CVE remediation (fix/security-alerts-oct26).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dockerfile = readFileSync(join(process.cwd(), "Dockerfile"), "utf8");

describe("Dockerfile security guards", () => {
  it("bumps Debian security refresh when apt packages need CVE fixes", () => {
    expect(dockerfile).toMatch(/ARG DEBIAN_SECURITY_REFRESH=/);
    expect(dockerfile).toContain("debian-security-refresh=${DEBIAN_SECURITY_REFRESH}");
    expect(dockerfile).toMatch(/apt-get upgrade -y/);
  });

  it("pins minimum libssl3 and openssl package versions after apt upgrade", () => {
    expect(dockerfile).toContain("dpkg --compare-versions");
    expect(dockerfile).toMatch(/libssl3.*ge 3\.0\.22-1~deb12u2/);
    expect(dockerfile).toMatch(/openssl.*ge 3\.0\.22-1~deb12u2/);
  });

  it("does not ship package managers in the production runtime stage", () => {
    const productionStage = dockerfile.split("FROM ${RUNTIME_IMAGE} AS production")[1] ?? "";
    expect(productionStage).toContain('COPY --from=toolchain /usr/local/bin/node /usr/local/bin/node');
    expect(productionStage).not.toMatch(/COPY --from=toolchain \/usr\/local\/bin\/pnpm/);
    expect(productionStage).not.toMatch(/corepack prepare/);
  });
});
