import { execSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function readCheckStandardsScript(): string {
  return readFileSync(join(root, "scripts/check-standards.js"), "utf8");
}

function extractAllowlist(script: string, setName: string): string[] {
  const match = script.match(new RegExp(`${setName} = new Set\\(\\[([\\s\\S]*?)\\]\\)`));
  expect(match, `Expected ${setName} in check-standards.js`).toBeTruthy();
  return [...match![1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

function lineUsesGlobalFetch(line: string): boolean {
  const trimmed = line.trimStart();
  if (/^(?:async\s+)?fetch\s*\(/.test(trimmed)) return false;
  return /(?<!\.)fetch\s*\(/.test(line);
}

function fileUsesGlobalFetch(content: string): boolean {
  return content.split("\n").some(lineUsesGlobalFetch);
}

describe("architecture standards check", () => {
  it("passes on the current codebase", () => {
    const output = execSync("node scripts/check-standards.js", {
      encoding: "utf8",
      cwd: root,
    });
    expect(output).toContain("Standards check passed");
  });

  it("is wired into CI after build and test", () => {
    const ci = parse(readFileSync(join(root, ".github/workflows/ci.yml"), "utf8")) as {
      jobs: { "build-and-test": { steps: Array<{ run?: string }> } };
    };
    const steps = ci.jobs["build-and-test"].steps
      .map((step) => step.run)
      .filter((run): run is string => Boolean(run));

    expect(steps).toContain("pnpm standards:check");
    expect(steps.indexOf("pnpm test")).toBeLessThan(steps.indexOf("pnpm standards:check"));
  });

  it("allowlisted tool handlers cover every harness-*.ts file in src/tools", () => {
    const allowed = extractAllowlist(readCheckStandardsScript(), "ALLOWED_TOOL_HANDLERS");
    const handlers = readdirSync(join(root, "src/tools")).filter(
      (file) => file.startsWith("harness-") && file.endsWith(".ts"),
    );

    for (const handler of handlers) {
      expect(allowed, `${handler} should be allowlisted in check-standards.js`).toContain(handler);
    }
  });

  it("scans nested TypeScript files under src/", () => {
    const tsFiles = walkTsFiles(join(root, "src"));
    expect(tsFiles.length).toBeGreaterThan(50);
    expect(tsFiles.some((file) => file.endsWith("src/registry/toolsets/ccm.ts"))).toBe(true);
  });

  it("fetch allowlist matches files that call global fetch() in src/", () => {
    const allowed = new Set(extractAllowlist(readCheckStandardsScript(), "FETCH_ALLOWLIST"));

    for (const absolutePath of walkTsFiles(join(root, "src"))) {
      const normalized = relative(root, absolutePath).replace(/\\/g, "/");
      const content = readFileSync(absolutePath, "utf8");
      if (!fileUsesGlobalFetch(content)) continue;
      expect(allowed.has(normalized), `${normalized} uses fetch() but is not allowlisted`).toBe(true);
    }
  });
});

function walkTsFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      results.push(...walkTsFiles(full));
    } else if (st.isFile() && full.endsWith(".ts")) {
      results.push(full);
    }
  }
  return results;
}
