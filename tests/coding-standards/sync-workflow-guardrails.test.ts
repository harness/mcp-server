/**
 * Guardrails for auto-sync CI workflows (sync-schemas, sync-entity-schemas).
 * PR #536 added pnpm standards:check before sync scripts so accidental src/
 * changes in schema-only PRs fail CI instead of shipping regressions.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";

type WorkflowStep = {
  name?: string;
  run?: string;
  uses?: string;
  with?: Record<string, unknown>;
};

type SyncWorkflow = {
  jobs: Record<string, { steps: WorkflowStep[] }>;
};

const REPO_ROOT = join(import.meta.dirname, "../..");

const SYNC_WORKFLOWS = [
  {
    path: ".github/workflows/sync-schemas.yml",
    syncStepName: "Run sync script",
  },
  {
    path: ".github/workflows/sync-entity-schemas.yml",
    syncStepName: "Sync entity schemas from Harness NG API",
  },
] as const;

function readWorkflow(relativePath: string): SyncWorkflow {
  return parse(readFileSync(join(REPO_ROOT, relativePath), "utf8")) as SyncWorkflow;
}

function jobSteps(workflow: SyncWorkflow): WorkflowStep[] {
  const job = Object.values(workflow.jobs)[0];
  expect(job, "workflow must define at least one job").toBeDefined();
  return job!.steps;
}

function stepIndex(steps: WorkflowStep[], name: string): number {
  return steps.findIndex((step) => step.name === name);
}

describe("Coding standards — schema sync workflow guardrails", () => {
  for (const { path, syncStepName } of SYNC_WORKFLOWS) {
    describe(path, () => {
      const steps = jobSteps(readWorkflow(path));

      it("installs dependencies with frozen lockfile before standards:check", () => {
        const installIdx = stepIndex(steps, "Install dependencies");
        const standardsIdx = stepIndex(
          steps,
          "Verify coding standards (guard against accidental src/ changes)",
        );

        expect(installIdx).toBeGreaterThanOrEqual(0);
        expect(standardsIdx).toBeGreaterThan(installIdx);
        expect(steps[installIdx]?.run).toContain("pnpm install --frozen-lockfile");
      });

      it("runs pnpm build and standards:check before the sync script", () => {
        const standardsIdx = stepIndex(
          steps,
          "Verify coding standards (guard against accidental src/ changes)",
        );
        const syncIdx = stepIndex(steps, syncStepName);

        expect(standardsIdx).toBeGreaterThanOrEqual(0);
        expect(syncIdx).toBeGreaterThan(standardsIdx);

        const run = steps[standardsIdx]?.run ?? "";
        expect(run).toContain("pnpm build");
        expect(run).toContain("pnpm standards:check");
      });

      it("uses pnpm/action-setup and caches pnpm in setup-node", () => {
        expect(steps.some((step) => step.uses === "pnpm/action-setup@v4")).toBe(true);

        const setupNode = steps.find((step) => step.name === "Setup Node.js");
        expect(setupNode?.with?.cache).toBe("pnpm");
      });
    });
  }
});
