/**
 * Docs and workflow alignment with docs/coding-standards.md and the fixed tool surface.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import packageJson from "../../package.json" with { type: "json" };
import { ALLOWED_MCP_TOOLS } from "./allowed-tools.js";

const REPO_ROOT = join(import.meta.dirname, "../..");

function readRepoFile(relPath: string): string {
  return readFileSync(join(REPO_ROOT, relPath), "utf8");
}

describe("Coding standards — documentation consistency", () => {
  const codingStandards = readRepoFile("docs/coding-standards.md");
  const contributing = readRepoFile("CONTRIBUTING.md");
  const ciWorkflow = readRepoFile(".github/workflows/ci.yml");
  const prTemplate = readRepoFile(".github/PULL_REQUEST_TEMPLATE.md");

  it("docs/coding-standards.md documents all 11 consolidated MCP tools", () => {
    const violations: string[] = [];

    for (const tool of ALLOWED_MCP_TOOLS) {
      if (!codingStandards.includes(tool)) {
        violations.push(`docs/coding-standards.md missing tool name: ${tool}`);
      }
    }

    expect(
      violations,
      `Document every allowed MCP tool in docs/coding-standards.md:\n${violations.join("\n")}`,
    ).toEqual([]);

    expect(codingStandards).toMatch(/11 consolidated tool handlers/);
    expect(codingStandards).not.toMatch(/10 consolidated tool handlers/);
  });

  it("docs/coding-standards.md documents Zod v4 (not legacy v3)", () => {
    expect(codingStandards).toMatch(/zod\/v4/);
    expect(codingStandards).toMatch(/Zod v4/);
    expect(codingStandards).not.toMatch(/\| Zod v3 \|/);
  });

  it("CONTRIBUTING.md and PR template reference pnpm standards:check", () => {
    expect(contributing).toContain("pnpm standards:check");
    expect(prTemplate).toContain("pnpm standards:check");
    expect(prTemplate).toContain("docs/coding-standards.md");
  });

  it("package.json exposes standards:check script", () => {
    expect(packageJson.scripts?.["standards:check"]).toMatch(/tests\/coding-standards/);
  });

  it("CI workflow runs standards:check", () => {
    expect(ciWorkflow).toContain("pnpm standards:check");
  });

  it("docs/coding-standards.md documents global fetch() exceptions", () => {
    for (const file of [
      "src/client/harness-client.ts",
      "src/utils/log-resolver.ts",
      "src/audit/sinks/webhook.ts",
      "src/search/remote-provider.ts",
    ]) {
      expect(codingStandards, `docs must document fetch exception: ${file}`).toContain(file);
    }
  });

  it("docs/coding-standards.md documents client.request() exception for harness_schema", () => {
    expect(codingStandards).toContain("src/tools/entity-schema/live.ts");
    expect(codingStandards).toMatch(/client\.request\(\)/);
  });
});

describe("Coding standards — sync workflow guardrails", () => {
  it("schema sync workflows run standards:check before opening PRs", () => {
    for (const workflow of [
      ".github/workflows/sync-schemas.yml",
      ".github/workflows/sync-entity-schemas.yml",
    ]) {
      const content = readRepoFile(workflow);
      expect(content, workflow).toContain("pnpm standards:check");
      expect(content, workflow).toContain("pnpm install");
    }
  });
});
