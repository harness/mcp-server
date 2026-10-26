/**
 * Static contract for tests/eval/eval-runner.mjs — write tool calls must use the
 * harness_* `confirm` input (not the audit-only `confirmation` field).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(import.meta.dirname, "../..");
const EVAL_RUNNER_PATH = join(REPO_ROOT, "tests/eval/eval-runner.mjs");

describe("eval-runner — write tool argument contract", () => {
  const content = readFileSync(EVAL_RUNNER_PATH, "utf8");

  it("uses confirm: true for autonomous CRUD/execute (not confirmation: true)", () => {
    expect(content).not.toMatch(/confirmation:\s*true/);
    expect(content.match(/confirm:\s*true/g)?.length ?? 0).toBeGreaterThanOrEqual(8);
  });

  it("eval write-tool cases and inline callTool invocations include confirm: true", () => {
    const writeTools = ["harness_create", "harness_update", "harness_delete", "harness_execute"];
    for (const tool of writeTools) {
      const casePattern = new RegExp(
        `tool:\\s*"${tool}"\\s*,\\s*\\n\\s*args:\\s*\\{[\\s\\S]*?confirm:\\s*true`,
        "g",
      );
      expect(content.match(casePattern)?.length ?? 0).toBeGreaterThan(0);
    }

    const inlineWriteCalls = content.matchAll(
      /callTool\(client,\s*"(harness_create|harness_update|harness_delete|harness_execute)",\s*\{/g,
    );
    for (const match of inlineWriteCalls) {
      const start = match.index ?? 0;
      const snippet = content.slice(start, start + 400);
      expect(snippet, `${match[1]} callTool args`).toMatch(/confirm:\s*true/);
    }

    expect(content).toMatch(/const deleteArgs = \{[^}]*confirm:\s*true/);
  });
});
