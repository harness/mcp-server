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

  it("copies adm-zip postinstall scripts before pnpm install in build stages", () => {
    const admZipScriptCopy =
      "COPY scripts/ensure-secure-adm-zip.mjs scripts/adm-zip-security-lib.mjs scripts/";
    const buildStage = dockerfile.indexOf("FROM toolchain AS build");
    const prodDepsStage = dockerfile.indexOf("FROM toolchain AS production-dependencies");
    expect(buildStage).toBeGreaterThan(-1);
    expect(prodDepsStage).toBeGreaterThan(-1);

    const buildSegment = dockerfile.slice(buildStage, prodDepsStage);
    const prodDepsSegment = dockerfile.slice(
      prodDepsStage,
      dockerfile.indexOf("FROM ${RUNTIME_IMAGE} AS production"),
    );
    expect(buildSegment).toContain(admZipScriptCopy);
    expect(buildSegment.indexOf(admZipScriptCopy)).toBeLessThan(buildSegment.indexOf("pnpm install"));
    expect(prodDepsSegment).toContain(admZipScriptCopy);
    expect(prodDepsSegment.indexOf(admZipScriptCopy)).toBeLessThan(
      prodDepsSegment.indexOf("pnpm install"),
    );
  });
});
