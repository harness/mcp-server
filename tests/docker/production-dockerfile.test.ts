/**
 * Static guards for production image build hardening (apt CVE refresh, OpenSSL floor,
 * adm-zip postinstall ordering). Fails CI if a security Dockerfile regression lands
 * without updating these assertions.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(import.meta.dirname, "../..");
const DOCKERFILE_PATH = join(REPO_ROOT, "Dockerfile");

function readDockerfile(): string {
  return readFileSync(DOCKERFILE_PATH, "utf8");
}

function stageBody(content: string, stageName: string): string {
  const match = content.match(
    new RegExp(
      `FROM [^\\n]+ AS ${stageName}\\s*\\n([\\s\\S]*?)(?=\\nFROM [^\\n]+ AS |$)`,
    ),
  );
  expect(match, `Dockerfile missing stage ${stageName}`).toBeTruthy();
  return match![1];
}

describe("production Dockerfile — security build guards", () => {
  const dockerfile = readDockerfile();

  it("declares DEBIAN_SECURITY_REFRESH so cached apt layers invalidate on CVE patches", () => {
    expect(dockerfile).toMatch(/ARG DEBIAN_SECURITY_REFRESH=\d{4}-\d{2}-\d{2}/);
    expect(dockerfile).toContain("debian-security-refresh=${DEBIAN_SECURITY_REFRESH}");
  });

  it("installs OpenSSL packages and enforces Debian security floor versions", () => {
    const production = stageBody(dockerfile, "production");
    expect(production).toMatch(/\blibssl3\b/);
    expect(production).toMatch(/\bopenssl\b/);
    expect(production).toMatch(
      /dpkg --compare-versions "\$\(dpkg-query -W -f='\$\{Version\}' libssl3\)" ge 3\.0\.22-1~deb12u2/,
    );
    expect(production).toMatch(
      /dpkg --compare-versions "\$\(dpkg-query -W -f='\$\{Version\}' openssl\)" ge 3\.0\.22-1~deb12u2/,
    );
  });

  it("copies adm-zip postinstall scripts before pnpm install in dependency stages", () => {
    for (const stage of ["build", "production-dependencies"] as const) {
      const body = stageBody(dockerfile, stage);
      const copyAt = body.indexOf("ensure-secure-adm-zip.mjs");
      const installAt = body.indexOf("pnpm install");
      expect(copyAt, `${stage}: missing adm-zip script COPY`).toBeGreaterThan(-1);
      expect(installAt, `${stage}: missing pnpm install`).toBeGreaterThan(-1);
      expect(copyAt, `${stage}: postinstall scripts must precede pnpm install`).toBeLessThan(installAt);
    }
  });

  it("ships a package-manager-free runtime running as the node user", () => {
    const production = stageBody(dockerfile, "production");
    expect(production).toMatch(/\bUSER node\b/);
    expect(dockerfile).toContain("COPY --from=toolchain /usr/local/bin/node /usr/local/bin/node");
    expect(production).not.toMatch(/\bpnpm install\b/);
    expect(production).not.toMatch(/\bnpm install\b/);
  });
});
