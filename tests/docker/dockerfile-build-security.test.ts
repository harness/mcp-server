/**
 * Static guards for production Dockerfile security regressions (postinstall scripts,
 * OpenSSL floor, Debian apt cache bust). No docker build required.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "../..");
const DOCKERFILE = join(REPO_ROOT, "Dockerfile");

function readDockerfile(): string {
  return readFileSync(DOCKERFILE, "utf8");
}

/** Split multi-stage Dockerfile into named stage bodies (last FROM wins for unnamed). */
function stageBodies(content: string): Map<string, string> {
  const stages = new Map<string, string>();
  const parts = content.split(/\n(?=FROM )/);
  for (const part of parts) {
    const nameMatch = part.match(/^FROM .+ AS ([\w-]+)/m);
    if (nameMatch) {
      stages.set(nameMatch[1], part);
    }
  }
  return stages;
}

function linesBeforeFirstPnpmInstall(stageBody: string): string[] {
  const lines = stageBody.split("\n");
  const installIndex = lines.findIndex((line) => /^\s*RUN pnpm install\b/.test(line));
  expect(installIndex, "stage must run pnpm install").toBeGreaterThan(-1);
  return lines.slice(0, installIndex);
}

describe("Dockerfile — build security", () => {
  const content = readDockerfile();
  const stages = stageBodies(content);

  it("copies adm-zip postinstall scripts before pnpm install in dependency stages", () => {
    for (const stageName of ["build", "production-dependencies"] as const) {
      const body = stages.get(stageName);
      expect(body, `missing stage ${stageName}`).toBeTruthy();

      const prelude = linesBeforeFirstPnpmInstall(body!).join("\n");
      expect(prelude, `${stageName}: ensure-secure-adm-zip.mjs must precede install`).toMatch(
        /COPY[^\n]*ensure-secure-adm-zip\.mjs/,
      );
      expect(prelude, `${stageName}: adm-zip-security-lib.mjs must precede install`).toMatch(
        /COPY[^\n]*adm-zip-security-lib\.mjs/,
      );
    }
  });

  it("documents package.json postinstall dependency on adm-zip security scripts", () => {
    const pkg = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8")) as {
      scripts?: { postinstall?: string };
    };
    expect(pkg.scripts?.postinstall).toContain("ensure-secure-adm-zip.mjs");
  });

  it("production runtime stage pins OpenSSL packages and busts stale apt cache", () => {
    const production = stages.get("production");
    expect(production).toBeTruthy();
    expect(production!).toMatch(/ARG DEBIAN_SECURITY_REFRESH=/);
    expect(production!).toMatch(/libssl3/);
    expect(production!).toMatch(/openssl/);
    expect(production!).toMatch(
      /dpkg --compare-versions.*libssl3.*ge 3\.0\.22-1~deb12u2/,
    );
    expect(production!).toMatch(
      /dpkg --compare-versions.*openssl.*ge 3\.0\.22-1~deb12u2/,
    );
  });

  it("production image copies only the Node binary from the toolchain stage", () => {
    const production = stages.get("production");
    expect(production).toBeTruthy();
    expect(production!).toMatch(/COPY --from=toolchain \/usr\/local\/bin\/node/);
    expect(production!).not.toMatch(/COPY --from=toolchain[^\n]*corepack/);
    expect(production!).not.toMatch(/COPY --from=toolchain[^\n]*pnpm/);
  });
});
