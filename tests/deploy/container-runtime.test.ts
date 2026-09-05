import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const dockerfile = readFileSync(join(root, "Dockerfile"), "utf8");
const ciWorkflow = readFileSync(join(root, ".github/workflows/ci.yml"), "utf8");

describe("production Dockerfile contract", () => {
  it("uses a multi-stage build with a Debian slim runtime and copied Node binary", () => {
    expect(dockerfile).toMatch(/FROM \$\{NODE_IMAGE\} AS toolchain/);
    expect(dockerfile).toMatch(/FROM \$\{RUNTIME_IMAGE\} AS production/);
    expect(dockerfile).toContain("debian:bookworm-slim");
    expect(dockerfile).toContain("COPY --from=toolchain /usr/local/bin/node /usr/local/bin/node");
  });

  it("installs ONNX runtime glibc dependencies and runs as non-root", () => {
    expect(dockerfile).toContain("libgomp1");
    expect(dockerfile).toContain("libstdc++6");
    expect(dockerfile).toContain("ca-certificates");
    expect(dockerfile).toMatch(/USER node\b/);
  });

  it("exposes HTTP transport with a container healthcheck", () => {
    expect(dockerfile).toContain('ENTRYPOINT ["node", "build/index.js", "http"]');
    expect(dockerfile).toContain("HEALTHCHECK");
    expect(dockerfile).toContain("/health");
  });

  it("does not copy package managers into the production stage", () => {
    const productionStage = dockerfile.split("FROM ${RUNTIME_IMAGE} AS production")[1] ?? "";
    expect(productionStage).not.toContain("corepack");
    expect(productionStage).not.toContain("pnpm install");
    expect(productionStage).not.toMatch(/COPY --from=toolchain.*pnpm/);
  });
});

describe("CI container-build contract", () => {
  it("builds the image and scans with a pinned Trivy action", () => {
    expect(ciWorkflow).toContain("container-build:");
    expect(ciWorkflow).toContain("docker/build-push-action@v7");
    expect(ciWorkflow).toContain(
      "aquasecurity/trivy-action@a9c7b0f06e461e9d4b4d1711f154ee024b8d7ab8",
    );
    expect(ciWorkflow).toContain("severity: CRITICAL,HIGH");
  });

  it("rejects package managers in the production image", () => {
    expect(ciWorkflow).toContain("Verify production image excludes package managers");
    for (const command of ["npm", "npx", "corepack", "pnpm", "yarn", "yarnpkg"]) {
      expect(ciWorkflow).toContain(command);
    }
  });

  it("smoke-tests HTTP health and requires auth on /mcp", () => {
    expect(ciWorkflow).toContain("Smoke test HTTP reachability and auth");
    expect(ciWorkflow).toContain("http://127.0.0.1:3000/health");
    expect(ciWorkflow).toContain('test "$status" = "401"');
    expect(ciWorkflow).toContain("HARNESS_MCP_MODE=multi-user");
  });
});
