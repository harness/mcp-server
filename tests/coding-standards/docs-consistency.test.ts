/**
 * Keep docs/coding-standards.md aligned with enforced architecture constants.
 * Prevents drift (e.g. reverting to "10 tools" or Zod v3) without updating tests.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CONSOLIDATED_MCP_TOOLS, CONSOLIDATED_TOOL_COUNT } from "./consolidated-tools.js";

const REPO_ROOT = join(import.meta.dirname, "../..");
const STANDARDS_PATH = join(REPO_ROOT, "docs/coding-standards.md");
const AGENTS_PATH = join(REPO_ROOT, "AGENTS.md");
const README_PATH = join(REPO_ROOT, "README.md");
const CONTRIBUTING_PATH = join(REPO_ROOT, "CONTRIBUTING.md");

const OUTDATED_ARCHITECTURE_PATTERNS = [
  /10 consolidated tool handlers/,
  /\bserver\.tool\(\)/,
  /\|\s*Schema validation\s*\|\s*Zod v3\s*\|/,
];

describe("Coding standards — documentation consistency", () => {
  const content = readFileSync(STANDARDS_PATH, "utf8");

  it(`docs/coding-standards.md documents ${CONSOLIDATED_TOOL_COUNT} consolidated MCP tools`, () => {
    expect(content).toMatch(
      new RegExp(`${CONSOLIDATED_TOOL_COUNT} consolidated tool handlers`),
    );
    for (const tool of CONSOLIDATED_MCP_TOOLS) {
      expect(content, `missing ${tool} in docs/coding-standards.md`).toContain(tool);
    }
  });

  it("docs/coding-standards.md references Zod v4 (not v3)", () => {
    expect(content).toMatch(/Zod v4/);
    expect(content).not.toMatch(/\|\s*Schema validation\s*\|\s*Zod v3\s*\|/);
  });

  it("docs/coding-standards.md documents pnpm standards:check guardrails", () => {
    expect(content).toContain("pnpm standards:check");
  });

  it("docs/coding-standards.md forbids new harness-*.ts handler files", () => {
    expect(content).toMatch(/Do NOT add new `harness-\*\.ts` handler files/);
  });

  it("docs/coding-standards.md does not regress to outdated architecture copy", () => {
    for (const pattern of OUTDATED_ARCHITECTURE_PATTERNS) {
      expect(content).not.toMatch(pattern);
    }
  });

  it("docs/coding-standards.md documents registry dispatch and registerTool registration", () => {
    expect(content).toMatch(/registry-driven/i);
    expect(content).toContain("Registry.dispatch()");
    expect(content).toContain("server.registerTool()");
  });

  it("AGENTS.md stays aligned with the 11-tool registry model and Zod v4", () => {
    const agents = readFileSync(AGENTS_PATH, "utf8");
    expect(agents).toMatch(/11 consolidated tools/);
    expect(agents).toContain("harness_schema");
    expect(agents).toMatch(/Zod v4/);
    expect(agents).toContain("pnpm standards:check");
    expect(agents).not.toMatch(/10 consolidated tool/);
    expect(agents).not.toMatch(/\bserver\.tool\(\)/);
    for (const tool of CONSOLIDATED_MCP_TOOLS) {
      expect(agents, `missing ${tool} in AGENTS.md`).toContain(tool);
    }
  });

  it("CONTRIBUTING.md points contributors at standards guardrails", () => {
    const contributing = readFileSync(CONTRIBUTING_PATH, "utf8");
    expect(contributing).toContain("pnpm standards:check");
    expect(contributing).toContain("docs/coding-standards.md");
  });

  it(`README.md stays aligned with the ${CONSOLIDATED_TOOL_COUNT}-tool registry model`, () => {
    const readme = readFileSync(README_PATH, "utf8");
    expect(readme).toMatch(new RegExp(`${CONSOLIDATED_TOOL_COUNT} consolidated tools`));
    expect(readme).toContain("harness_schema");
    expect(readme).not.toMatch(/10 consolidated tools/);
    for (const pattern of OUTDATED_ARCHITECTURE_PATTERNS) {
      expect(readme).not.toMatch(pattern);
    }
  });

  it("enforced tool count matches docs/coding-standards.md headline", () => {
    const headline = content.match(/(\d+) consolidated tool handlers/);
    expect(headline?.[1], "docs/coding-standards.md missing consolidated tool handlers headline").toBe(
      String(CONSOLIDATED_TOOL_COUNT),
    );
  });
});
