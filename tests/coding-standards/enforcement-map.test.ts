/**
 * Maps docs/coding-standards.md Commit Checklist items to automated guardrails.
 * Fails if a documented rule loses its enforcing test (file missing or renamed).
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "../..");

type EnforcementEntry = {
  /** Short label matching docs/coding-standards.md Commit Checklist */
  checklist: string;
  automated: boolean;
  testFile?: string;
  /** Stable substring that must remain in the enforcing test file */
  needle?: string;
};

/**
 * Keep in sync with docs/coding-standards.md § Commit Checklist.
 * Items marked automated must stay backed by a test needle below.
 */
const ENFORCEMENT_MAP: EnforcementEntry[] = [
  {
    checklist: "No new registerTool() outside the 11 harness handlers",
    automated: true,
    testFile: "tests/coding-standards/architecture.test.ts",
    needle: "only allows registerTool() in the 11 harness handler files",
  },
  {
    checklist: "No console.log() in src/",
    automated: true,
    testFile: "tests/coding-standards/architecture.test.ts",
    needle: "never uses console.log() in src/",
  },
  {
    checklist: "No undocumented global fetch()",
    automated: true,
    testFile: "tests/coding-standards/architecture.test.ts",
    needle: "only uses global fetch() in documented exception files",
  },
  {
    checklist: "No new harness-*.ts handler files",
    automated: true,
    testFile: "tests/coding-standards/architecture.test.ts",
    needle: "does not add new harness-*.ts handler files",
  },
  {
    checklist: "Toolset purity (no HarnessClient / MCP SDK / Registry / createLogger)",
    automated: true,
    testFile: "tests/coding-standards/architecture.test.ts",
    needle: "toolset files do not import HarnessClient, McpServer, or Registry",
  },
  {
    checklist: "Zod v4 import path and describe-after-optional/default chaining",
    automated: true,
    testFile: "tests/coding-standards/architecture.test.ts",
    needle: "tool handlers use .describe() after .optional()",
  },
  {
    checklist: "Shared response extractors (no new inline extractors without allowance)",
    automated: true,
    testFile: "tests/coding-standards/architecture.test.ts",
    needle: "does not add new inline responseExtractor functions",
  },
  {
    checklist: "Registry scope, identifierFields, operationPolicy",
    automated: true,
    testFile: "tests/coding-standards/registry-contract.test.ts",
    needle: "every endpoint spec declares operationPolicy",
  },
  {
    checklist: "Optional org_id / project_id on dispatch handlers",
    automated: true,
    testFile: "tests/coding-standards/scope-params.test.ts",
    needle: "API-dispatch handlers declare optional org_id and project_id",
  },
  {
    checklist: "inputSchema snake_case and harness_list pagination defaults",
    automated: true,
    testFile: "tests/coding-standards/input-conventions.test.ts",
    needle: "harness_list uses pagination defaults page=0 and size=20 (max 100)",
  },
  {
    checklist: "src/tools/ file organization",
    automated: true,
    testFile: "tests/coding-standards/file-organization.test.ts",
    needle: "src/tools/ contains only the 11 harness handlers",
  },
  {
    checklist: "Error handling (toMcpError + errorResult)",
    automated: true,
    testFile: "tests/coding-standards/error-handling.test.ts",
    needle: "throw toMcpError(err) for unexpected failures",
  },
  {
    checklist: "Write handlers use confirmViaElicitation",
    automated: true,
    testFile: "tests/coding-standards/registry-metadata.test.ts",
    needle: "write/execute handlers use confirmViaElicitation before dispatch",
  },
  {
    checklist: "Every inputSchema property has .describe()",
    automated: true,
    testFile: "tests/coding-standards/registry-metadata.test.ts",
    needle: "every harness handler inputSchema property chains .describe()",
  },
  {
    checklist: "Docs aligned with 11-tool model and Zod v4",
    automated: true,
    testFile: "tests/coding-standards/docs-consistency.test.ts",
    needle: "does not regress to outdated 10-tool architecture copy",
  },
  {
    checklist: "Consolidated tool list matches handlers",
    automated: true,
    testFile: "tests/coding-standards/consolidated-tools.test.ts",
    needle: "lists exactly 11 tools",
  },
  {
    checklist: "pnpm build / typecheck / test",
    automated: false,
  },
  {
    checklist: "No secrets exposed in tool responses (metadata only)",
    automated: false,
  },
];

describe("Coding standards — enforcement map", () => {
  it("every automated Commit Checklist item has a living guardrail test", () => {
    const missing: string[] = [];

    for (const entry of ENFORCEMENT_MAP) {
      if (!entry.automated) continue;
      if (!entry.testFile || !entry.needle) {
        missing.push(`${entry.checklist}: incomplete enforcement map entry`);
        continue;
      }

      const path = join(REPO_ROOT, entry.testFile);
      if (!existsSync(path)) {
        missing.push(`${entry.checklist}: missing ${entry.testFile}`);
        continue;
      }

      const content = readFileSync(path, "utf8");
      if (!content.includes(entry.needle)) {
        missing.push(
          `${entry.checklist}: ${entry.testFile} no longer contains guardrail needle`,
        );
      }
    }

    expect(missing, missing.join("\n")).toEqual([]);
  });

  it("documents manual checklist gaps (no false sense of full automation)", () => {
    const manual = ENFORCEMENT_MAP.filter((e) => !e.automated).map((e) => e.checklist);
    expect(manual).toEqual([
      "pnpm build / typecheck / test",
      "No secrets exposed in tool responses (metadata only)",
    ]);
  });
});
