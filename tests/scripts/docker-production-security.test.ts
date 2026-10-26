/**
 * Guards Debian/OpenSSL hardening in the production Docker image build.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const OPENSSL_DEBIAN_FLOOR = "3.0.22-1~deb12u2";

describe("Docker production image security", () => {
  const dockerfile = readFileSync(join(root, "Dockerfile"), "utf8");

  it("installs libssl3 and openssl in the runtime stage", () => {
    expect(dockerfile).toContain("libssl3 openssl");
  });

  it("fails the build when libssl3 or openssl are below the Debian security floor", () => {
    expect(dockerfile).toContain(
      "dpkg --compare-versions \"$(dpkg-query -W -f='${Version}' libssl3)\" ge " + OPENSSL_DEBIAN_FLOOR,
    );
    expect(dockerfile).toContain(
      "dpkg --compare-versions \"$(dpkg-query -W -f='${Version}' openssl)\" ge " + OPENSSL_DEBIAN_FLOOR,
    );
  });

  it("uses a refresh ARG so apt security upgrades are not stuck behind GHA layer cache", () => {
    expect(dockerfile).toMatch(/ARG DEBIAN_SECURITY_REFRESH=\d{4}-\d{2}-\d{2}/);
    expect(dockerfile).toContain("debian-security-refresh=${DEBIAN_SECURITY_REFRESH}");
  });
});
