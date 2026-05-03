#!/usr/bin/env node

/**
 * Smoke test: starts the MCP server in-process, lists tools, and validates
 * expectations based on environment variables (HARNESS_TOOLSETS, HARNESS_READ_ONLY).
 *
 * Used in CI to verify startup across deployment patterns.
 *
 * Exit 0 = pass, exit 1 = failure.
 */

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

async function main() {
  const { Registry } = await import(join(ROOT, "build", "registry", "index.js"));

  const config = {
    HARNESS_API_KEY: "pat.smoke.test.token",
    HARNESS_ACCOUNT_ID: "smoke-test",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "default",
    HARNESS_PROJECT: "smoke",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 3,
    LOG_LEVEL: "error",
    ...(process.env.HARNESS_TOOLSETS ? { HARNESS_TOOLSETS: process.env.HARNESS_TOOLSETS } : {}),
    ...(process.env.HARNESS_READ_ONLY ? { HARNESS_READ_ONLY: process.env.HARNESS_READ_ONLY === "true" } : {}),
  };

  const registry = new Registry(config);
  const resourceTypes = registry.getAllResourceTypes();
  const toolsets = registry.getAllToolsets();

  const checks = [];
  let pass = true;

  // Basic: registry loaded something
  checks.push(check("resource types > 0", resourceTypes.length > 0, `got ${resourceTypes.length}`));
  checks.push(check("toolsets > 0", toolsets.length > 0, `got ${toolsets.length}`));

  // Toolset filtering
  if (process.env.HARNESS_TOOLSETS) {
    const tsEnv = process.env.HARNESS_TOOLSETS;
    if (tsEnv.startsWith("+")) {
      const optIn = tsEnv.slice(1);
      checks.push(check(`opt-in toolset "${optIn}" loaded`, toolsets.some((t) => t.name === optIn), `toolsets: ${toolsets.map((t) => t.name).join(", ")}`));
    } else {
      const requested = tsEnv.split(",").map((s) => s.trim());
      checks.push(check(`exact toolsets match`, toolsets.length === requested.length, `expected ${requested.length}, got ${toolsets.length}`));
      for (const name of requested) {
        checks.push(check(`toolset "${name}" loaded`, toolsets.some((t) => t.name === name), `not found`));
      }
    }
  }

  // Read-only mode: verify dispatch rejects writes
  if (config.HARNESS_READ_ONLY) {
    const sampleType = resourceTypes.find((t) => {
      const def = registry.getResource(t);
      return def.operations.create;
    });
    if (sampleType) {
      let blocked = false;
      try {
        await registry.dispatch(null, sampleType, "create", {});
      } catch (err) {
        if (String(err).includes("Read-only mode")) blocked = true;
      }
      checks.push(check("read-only: create dispatch blocked", blocked, "dispatch did not throw"));

      let execBlocked = false;
      try {
        await registry.dispatchExecute(null, sampleType, "run", {});
      } catch (err) {
        if (String(err).includes("Read-only mode")) execBlocked = true;
      }
      checks.push(check("read-only: execute dispatch blocked", execBlocked, "dispatch did not throw"));
    }
  }

  // Summary
  console.error("");
  console.error(`Smoke test: ${checks.filter((c) => c).length}/${checks.length} passed`);
  if (!pass) {
    console.error("SMOKE TEST FAILED");
    process.exit(1);
  }
  console.error("SMOKE TEST PASSED");

  function check(name, condition, detail) {
    const status = condition ? "PASS" : "FAIL";
    const icon = condition ? "+" : "-";
    console.error(`  [${icon}] ${name}${condition ? "" : ` (${detail})`}`);
    if (!condition) pass = false;
    return condition;
  }
}

main().catch((err) => {
  console.error("Smoke test crashed:", err);
  process.exit(1);
});
