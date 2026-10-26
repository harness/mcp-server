import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dockerfile = readFileSync(join(process.cwd(), "Dockerfile"), "utf8");

describe("production Dockerfile — Debian/OpenSSL security gates", () => {
  it("bumps DEBIAN_SECURITY_REFRESH so GHA cache replays apt upgrade after CVE fixes", () => {
    expect(dockerfile).toMatch(/ARG DEBIAN_SECURITY_REFRESH=\d{4}-\d{2}-\d{2}/);
    expect(dockerfile).toContain("debian-security-refresh=${DEBIAN_SECURITY_REFRESH}");
  });

  it("upgrades apt packages and enforces minimum libssl3/openssl versions", () => {
    expect(dockerfile).toContain("apt-get upgrade -y --no-install-recommends");
    expect(dockerfile).toMatch(
      /dpkg --compare-versions "\$\(dpkg-query -W -f='\$\{Version\}' libssl3\)" ge 3\.0\.22-1~deb12u2/,
    );
    expect(dockerfile).toMatch(
      /dpkg --compare-versions "\$\(dpkg-query -W -f='\$\{Version\}' openssl\)" ge 3\.0\.22-1~deb12u2/,
    );
  });

  it("keeps package managers out of the production runtime stage", () => {
    const productionStage = dockerfile.split("FROM ${RUNTIME_IMAGE} AS production")[1] ?? "";
    expect(productionStage).toContain('COPY --from=toolchain /usr/local/bin/node /usr/local/bin/node');
    expect(productionStage).not.toMatch(/COPY --from=toolchain \/usr\/local\/bin\/pnpm/);
  });
});
