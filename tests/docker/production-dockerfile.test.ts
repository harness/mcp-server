import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dockerfilePath = join(process.cwd(), "Dockerfile");

describe("production Dockerfile (Trivy / Debian base image)", () => {
  const dockerfile = readFileSync(dockerfilePath, "utf8");

  it("bumps DEBIAN_SECURITY_REFRESH so GHA layer cache replays apt security upgrades", () => {
    const argMatch = dockerfile.match(/^ARG DEBIAN_SECURITY_REFRESH=(\d{4}-\d{2}-\d{2})/m);
    expect(argMatch, "expected ARG DEBIAN_SECURITY_REFRESH=YYYY-MM-DD in Dockerfile").not.toBeNull();

    expect(dockerfile).toContain('echo "debian-security-refresh=${DEBIAN_SECURITY_REFRESH}"');
    expect(dockerfile).toMatch(/apt-get update[\s\S]*apt-get upgrade -y --no-install-recommends/);
  });

  it("installs OpenSSL runtime packages patched for recent Debian CVEs", () => {
    const productionStage = dockerfile.slice(dockerfile.indexOf("FROM ${RUNTIME_IMAGE} AS production"));
    expect(productionStage).toMatch(
      /apt-get install -y --no-install-recommends[\s\S]*\blibssl3\b[\s\S]*\bopenssl\b/,
    );
    expect(productionStage).toMatch(/rm -rf \/var\/lib\/apt\/lists\/\*/);
  });

  it("uses the Debian bookworm-slim runtime image for the production stage", () => {
    expect(dockerfile).toMatch(/^ARG RUNTIME_IMAGE=debian:bookworm-slim/m);
    const productionStage = dockerfile.slice(dockerfile.indexOf("FROM ${RUNTIME_IMAGE} AS production"));
    expect(productionStage).toContain("COPY --from=toolchain /usr/local/bin/node /usr/local/bin/node");
    expect(productionStage).not.toMatch(/\bpnpm\b|\bcorepack\b|\bnpm install\b/);
  });
});
