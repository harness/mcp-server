import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dockerfile = readFileSync(join(process.cwd(), "Dockerfile"), "utf8");

describe("Production Dockerfile — Debian OpenSSL refresh (#1154)", () => {
  it("bumps DEBIAN_SECURITY_REFRESH so GHA cache replays apt upgrades", () => {
    expect(dockerfile).toMatch(/ARG DEBIAN_SECURITY_REFRESH=\d{4}-\d{2}-\d{2}/);
    expect(dockerfile).toContain("debian-security-refresh=${DEBIAN_SECURITY_REFRESH}");
  });

  it("runs apt upgrade and enforces libssl3/openssl package floors", () => {
    expect(dockerfile).toMatch(/apt-get upgrade -y/);
    expect(dockerfile).toContain("libssl3");
    expect(dockerfile).toContain("openssl");
    expect(dockerfile).toContain("dpkg --compare-versions");
    expect(dockerfile).toContain("3.0.22-1~deb12u2");
  });

  it("keeps production runtime free of package managers", () => {
    expect(dockerfile).toMatch(/copy only the Node executable/i);
    expect(dockerfile).toContain("COPY --from=toolchain /usr/local/bin/node");
    expect(dockerfile).not.toMatch(/pnpm install.*production-dependencies/);
  });
});
