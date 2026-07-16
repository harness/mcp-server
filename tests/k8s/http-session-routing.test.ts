import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ConfigSchema } from "../../src/config.js";

const root = process.cwd();

function defaultSessionTtlSeconds(): number {
  const parsed = ConfigSchema.safeParse({
    HARNESS_API_KEY: "pat.acct123.tokenId.secret",
    HARNESS_ACCOUNT_ID: "acct123",
  });
  if (!parsed.success) {
    throw new Error("Failed to parse default config for session TTL");
  }
  return parsed.data.MCP_SESSION_TTL_MS / 1000;
}

describe("k8s HTTP session routing", () => {
  it("runs a single replica until in-memory sessions are externalized", () => {
    const deployment = readFileSync(join(root, "k8s/deployment.yaml"), "utf8");
    expect(deployment).toMatch(/replicas:\s*1\b/);
    expect(deployment).toContain("Session not found");
  });

  it("pins clients to the same pod via ClientIP session affinity", () => {
    const service = readFileSync(join(root, "k8s/service.yaml"), "utf8");
    expect(service).toContain("sessionAffinity: ClientIP");
    expect(service).toMatch(/timeoutSeconds:\s*1800/);
  });

  it("keeps Service session affinity timeout aligned with MCP_SESSION_TTL_MS default", () => {
    const service = readFileSync(join(root, "k8s/service.yaml"), "utf8");
    const match = service.match(/timeoutSeconds:\s*(\d+)/);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBe(defaultSessionTtlSeconds());
  });
});
