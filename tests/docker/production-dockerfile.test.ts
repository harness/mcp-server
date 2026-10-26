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

  it("copies adm-zip postinstall scripts before pnpm install in dependency stages", () => {
    const stageSnippet = (marker: string) => {
      const after = dockerfile.split(marker)[1];
      expect(after, `missing Dockerfile stage ${marker}`).toBeTruthy();
      return after!.split(/^FROM /m)[0]!;
    };

    for (const stage of [
      stageSnippet("FROM toolchain AS build"),
      stageSnippet("FROM toolchain AS production-dependencies"),
    ]) {
      const copyIdx = stage.indexOf(
        "COPY scripts/ensure-secure-adm-zip.mjs scripts/adm-zip-security-lib.mjs scripts/",
      );
      const installIdx = stage.indexOf("RUN pnpm install");
      expect(copyIdx).toBeGreaterThan(-1);
      expect(installIdx).toBeGreaterThan(copyIdx);
    }
  });
});
