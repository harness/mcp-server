import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

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
});
