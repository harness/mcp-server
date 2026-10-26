/**
 * Keep docs/coding-standards.md aligned with enforced architecture constants.
 * Prevents drift (e.g. reverting to "10 tools" or Zod v3) without updating tests.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CONSOLIDATED_MCP_TOOLS, CONSOLIDATED_MCP_TOOL_COUNT } from "./consolidated-tools.js";

const SECURITY_REGRESSION_TEST_PATHS = [
  "tests/docker/production-dockerfile.test.ts",
  "tests/scripts/cve-dependency-pins.test.ts",
];

const REPO_ROOT = join(import.meta.dirname, "../..");
const STANDARDS_PATH = join(REPO_ROOT, "docs/coding-standards.md");
const README_PATH = join(REPO_ROOT, "README.md");
const AGENTS_PATH = join(REPO_ROOT, "AGENTS.md");
const CONTRIBUTING_PATH = join(REPO_ROOT, "CONTRIBUTING.md");

const OUTDATED_TEN_TOOLS = /10 consolidated tool handlers?/i;
const OUTDATED_ZOD_V3_ROW = /\|\s*Schema validation\s*\|\s*Zod v3\s*\|/;

function assertElevenConsolidatedToolsDoc(content: string, label: string): void {
  expect(content, `${label}: missing 11-tool count`).toMatch(
    new RegExp(`${CONSOLIDATED_MCP_TOOL_COUNT} consolidated tool`),
  );
  expect(content, `${label}: outdated 10-tool wording`).not.toMatch(OUTDATED_TEN_TOOLS);
  for (const tool of CONSOLIDATED_MCP_TOOLS) {
    expect(content, `${label}: missing ${tool}`).toContain(tool);
  }
}

describe("Coding standards — documentation consistency", () => {
  const standardsContent = readFileSync(STANDARDS_PATH, "utf8");

  it("docs/coding-standards.md documents 11 consolidated MCP tools including harness_schema", () => {
    assertElevenConsolidatedToolsDoc(standardsContent, "docs/coding-standards.md");
    expect(standardsContent).toMatch(/11 consolidated tool handlers/);
  });

  it("docs/coding-standards.md references Zod v4 (not v3)", () => {
    expect(standardsContent).toMatch(/Zod v4/);
    expect(standardsContent).not.toMatch(OUTDATED_ZOD_V3_ROW);
  });

  it("docs/coding-standards.md documents pnpm standards:check guardrails", () => {
    expect(standardsContent).toContain("pnpm standards:check");
    expect(standardsContent).toContain("tests/coding-standards/enforcement-map.test.ts");
    expect(standardsContent).toMatch(/## Automated Enforcement/);
  });

  it("package.json standards:check runs Docker and CVE dependency regression guards", () => {
    const packageJson = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8")) as {
      scripts: { "standards:check": string };
    };
    const script = packageJson.scripts["standards:check"];
    for (const path of SECURITY_REGRESSION_TEST_PATHS) {
      expect(script, `standards:check must include ${path}`).toContain(path);
    }
  });

  it("docs/coding-standards.md forbids new harness-*.ts handler files", () => {
    expect(standardsContent).toMatch(/Do NOT add new `harness-\*\.ts` handler files/);
  });

  it("README.md documents 11 consolidated tools (no outdated 10-tool snapshot)", () => {
    const readme = readFileSync(README_PATH, "utf8");
    assertElevenConsolidatedToolsDoc(readme, "README.md");
  });

  it("AGENTS.md documents 11 consolidated tools and Zod v4", () => {
    const agents = readFileSync(AGENTS_PATH, "utf8");
    assertElevenConsolidatedToolsDoc(agents, "AGENTS.md");
    expect(agents).toMatch(/Zod v4/);
    expect(agents).not.toMatch(OUTDATED_ZOD_V3_ROW);
    expect(agents).toMatch(/Do NOT add per-endpoint tool handlers/);
    expect(agents).toContain("src/registry/toolsets/");
  });

  it("CONTRIBUTING.md documents registry-driven onboarding (declarative toolsets, no new handlers)", () => {
    const contributing = readFileSync(CONTRIBUTING_PATH, "utf8");
    expect(contributing, "CONTRIBUTING.md: outdated 10-tool wording").not.toMatch(OUTDATED_TEN_TOOLS);
    expect(contributing).toMatch(/11 generic MCP tools/);
    expect(contributing).toContain("harness_schema");
    expect(contributing).toContain("src/registry/toolsets/");
    expect(contributing).toMatch(/declarative data/i);
    expect(contributing).toContain("docs/coding-standards.md");
    expect(contributing).toMatch(/no new tool handlers/i);
  });
});
