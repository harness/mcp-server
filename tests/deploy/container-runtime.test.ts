import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("production container runtime contract", () => {
  const dockerfile = readFileSync(join(root, "Dockerfile"), "utf8");
  const ciWorkflow = readFileSync(join(root, ".github/workflows/ci.yml"), "utf8");

  it("uses a multi-stage build with a package-manager-free Debian runtime", () => {
    expect(dockerfile).toMatch(/FROM \$\{NODE_IMAGE\} AS toolchain/);
    expect(dockerfile).toMatch(/FROM toolchain AS build/);
    expect(dockerfile).toMatch(/FROM toolchain AS production-dependencies/);
    expect(dockerfile).toMatch(/FROM \$\{RUNTIME_IMAGE\} AS production/);
    expect(dockerfile).toContain("package-manager-free image");
    expect(dockerfile).toContain('COPY --from=toolchain /usr/local/bin/node /usr/local/bin/node');
  });

  it("runs as non-root node user with a health check on /health", () => {
    expect(dockerfile).toMatch(/USER node\b/);
    expect(dockerfile).toContain("HEALTHCHECK");
    expect(dockerfile).toContain("/health");
    expect(dockerfile).toContain('ENTRYPOINT ["node", "build/index.js", "http"]');
  });

  it("installs only runtime libs needed by ONNX and serves on PORT 3000", () => {
    expect(dockerfile).toContain("libgomp1");
    expect(dockerfile).toContain("libstdc++6");
    expect(dockerfile).toMatch(/PORT=3000/);
    expect(dockerfile).toContain("EXPOSE 3000");
  });

  it("CI builds the image, scans with Trivy, and smoke-tests HTTP auth", () => {
    expect(ciWorkflow).toContain("container-build:");
    expect(ciWorkflow).toContain("harness-mcp-server:ci");
    expect(ciWorkflow).toContain("aquasecurity/trivy-action");
    expect(ciWorkflow).toContain("Verify production image excludes package managers");
    expect(ciWorkflow).toContain("Smoke test HTTP reachability and auth");
    expect(ciWorkflow).toMatch(/for command in npm npx corepack pnpm yarn yarnpkg/);
    expect(ciWorkflow).toContain("HARNESS_MCP_AUTH_TOKEN=ci-smoke-token");
    expect(ciWorkflow).toMatch(/test "\$status" = "401"/);
  });
});
