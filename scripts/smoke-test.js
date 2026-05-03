#!/usr/bin/env node

/**
 * Smoke test: loads the registry (toolsets, optional read-only dispatch checks),
 * then boots the compiled MCP server on stdio, sends initialize +
 * notifications/initialized + tools/list + tools/call harness_describe using newline-delimited JSON-RPC,
 * and asserts tools + live resource type count — catching bootstrap issues and toolset filtering regressions.
 *
 * Exit 0 = pass, exit 1 = failure.
 */

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

async function main() {
  const { Registry } = await import(join(ROOT, "build", "registry", "index.js"));

  const baseConfig = {
    HARNESS_API_KEY: "pat.smoke.test.token",
    HARNESS_ACCOUNT_ID: "smoke-test",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "default",
    HARNESS_PROJECT: "smoke",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 3,
    LOG_LEVEL: "error",
  };

  const config = {
    ...baseConfig,
    ...(process.env.HARNESS_TOOLSETS ? { HARNESS_TOOLSETS: process.env.HARNESS_TOOLSETS } : {}),
    ...(process.env.HARNESS_READ_ONLY ? { HARNESS_READ_ONLY: process.env.HARNESS_READ_ONLY === "true" } : {}),
    ...(process.env.HARNESS_PIPELINE_VERSION ? { HARNESS_PIPELINE_VERSION: process.env.HARNESS_PIPELINE_VERSION } : {}),
  };

  const registry = new Registry(config);
  const resourceTypes = registry.getAllResourceTypes();
  const toolsets = registry.getAllToolsets();

  const checks = [];
  let pass = true;

  // Basic: registry loaded something
  checks.push(check("resource types > 0", resourceTypes.length > 0, `got ${resourceTypes.length}`));
  checks.push(check("toolsets > 0", toolsets.length > 0, `got ${toolsets.length}`));

  // Toolset filtering — Registry.parseToolsetFilter() handles all modes
  // (explicit, +additive, -subtractive, mixed). Just verify it resolved.
  if (process.env.HARNESS_TOOLSETS) {
    checks.push(check(
      `HARNESS_TOOLSETS="${process.env.HARNESS_TOOLSETS}" → ${toolsets.length} toolset(s)`,
      toolsets.length > 0,
      "no toolsets loaded",
    ));
    const { HARNESS_TOOLSETS: _ignoreToolsets, ...registryConfigWithoutToolsets } = config;
    const baseRegistry = new Registry(registryConfigWithoutToolsets);
    const baseTypes = baseRegistry.getAllResourceTypes();
    const filtered = resourceTypes.length !== baseTypes.length;
    checks.push(check(
      `HARNESS_TOOLSETS filtering: ${resourceTypes.length} types (base ${baseTypes.length})`,
      filtered,
      `filtering had no effect (${resourceTypes.length} = ${baseTypes.length})`,
    ));
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

  const serverEnv = {
    ...process.env,
    HARNESS_API_KEY: "pat.smoke.test.token",
    HARNESS_ACCOUNT_ID: "smoke-test",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "default",
    HARNESS_PROJECT: "smoke",
    HARNESS_API_TIMEOUT_MS: "30000",
    HARNESS_MAX_RETRIES: "3",
    LOG_LEVEL: "error",
    ...(process.env.HARNESS_TOOLSETS ? { HARNESS_TOOLSETS: process.env.HARNESS_TOOLSETS } : {}),
    ...(process.env.HARNESS_READ_ONLY ? { HARNESS_READ_ONLY: process.env.HARNESS_READ_ONLY } : {}),
    ...(process.env.HARNESS_PIPELINE_VERSION ? { HARNESS_PIPELINE_VERSION: process.env.HARNESS_PIPELINE_VERSION } : {}),
  };

  // Real MCP server over stdio (catches bootstrap / transport regressions)
  const serverPath = join(ROOT, "build", "index.js");
  const startupOk = await checkServerStartup(serverPath, serverEnv, resourceTypes.length);
  checks.push(startupOk);
  if (!startupOk) pass = false;

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

/** MCP stdio transport: one JSON-RPC object per line (see sdk shared/stdio.js). */
function mcpNdjson(message) {
  return `${JSON.stringify(message)}\n`;
}

/**
 * Spawn build/index.js, send initialize → notifications/initialized → tools/list → harness_describe, verify counts.
 * @param {number} expectedResourceCount — from Registry.getAllResourceTypes().length with same env as child
 * @returns {Promise<boolean>}
 */
function checkServerStartup(serverPath, env, expectedResourceCount) {
  return new Promise((resolve) => {
    let settled = false;
    /** @type {import("node:child_process").ChildProcessWithoutNullStreams | undefined} */
    let child;

    const finish = (ok, detail) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (child && !child.killed) {
        try {
          child.kill("SIGTERM");
        } catch {
          // ignore
        }
      }
      if (ok) {
        console.error("  [+] MCP server startup + tools/list + harness_describe");
        resolve(true);
      } else {
        console.error(`  [-] MCP server startup (${detail})`);
        resolve(false);
      }
    };

    const timer = setTimeout(() => {
      if (child && !child.killed) {
        try {
          child.kill("SIGKILL");
        } catch {
          // ignore
        }
      }
      finish(false, "timed out after 15s");
    }, 15_000);

    let stdoutBuf = "";
    let stderrBuf = "";
    let phase = "init";

    try {
      child = spawn(
        process.execPath,
        [serverPath],
        {
          cwd: ROOT,
          env,
          stdio: ["pipe", "pipe", "pipe"],
        },
      );
    } catch (err) {
      clearTimeout(timer);
      console.error(`  [-] MCP server startup (${err instanceof Error ? err.message : String(err)})`);
      resolve(false);
      return;
    }

    child.on("error", (err) => {
      finish(false, err.message);
    });

    child.on("exit", (code, signal) => {
      if (settled) return;
      const tail = stderrBuf.trim().slice(-500);
      if (code !== 0 && code !== null) {
        finish(false, `exit ${code}${tail ? ` — ${tail}` : ""}`);
      } else if (signal) {
        finish(false, `signal ${signal}`);
      }
    });

    child.stderr?.on("data", (chunk) => {
      stderrBuf += chunk.toString();
      if (stderrBuf.length > 8000) {
        stderrBuf = stderrBuf.slice(-8000);
      }
    });

    child.stdout?.on("data", (chunk) => {
      stdoutBuf += chunk.toString();

      while (true) {
        const nl = stdoutBuf.indexOf("\n");
        if (nl === -1) break;

        const line = stdoutBuf.slice(0, nl).replace(/\r$/, "").trim();
        stdoutBuf = stdoutBuf.slice(nl + 1);
        if (!line) continue;

        let msg;
        try {
          msg = JSON.parse(line);
        } catch {
          finish(false, `non-JSON on stdout: ${line.slice(0, 120)}`);
          return;
        }

        if (phase === "init" && msg.id === 1) {
          if (msg.error) {
            finish(false, msg.error.message || "initialize error");
            return;
          }
          if (msg.result?.serverInfo) {
            phase = "tools";
            child.stdin.write(
              mcpNdjson({
                jsonrpc: "2.0",
                method: "notifications/initialized",
                params: {},
              }),
            );
            child.stdin.write(
              mcpNdjson({
                jsonrpc: "2.0",
                id: 2,
                method: "tools/list",
                params: {},
              }),
            );
          }
          continue;
        }

        if (phase === "tools" && msg.id === 2) {
          if (msg.error) {
            finish(false, msg.error.message || "tools/list error");
            return;
          }
          const tools = msg.result?.tools;
          if (!Array.isArray(tools)) {
            finish(false, "tools/list missing tools array");
            return;
          }
          if (tools.length === 0) {
            finish(false, "tools/list returned no tools");
            return;
          }
          phase = "describe";
          child.stdin.write(
            mcpNdjson({
              jsonrpc: "2.0",
              id: 3,
              method: "tools/call",
              params: {
                name: "harness_describe",
                arguments: {},
              },
            }),
          );
          continue;
        }

        if (phase === "describe" && msg.id === 3) {
          if (msg.error) {
            finish(false, msg.error.message || "tools/call harness_describe error");
            return;
          }
          const text = msg.result?.content?.[0]?.text;
          let liveTypes = -1;
          if (typeof text === "string" && text) {
            try {
              const parsed = JSON.parse(text);
              liveTypes = parsed.total_resource_types ?? parsed.resource_types?.length ?? -1;
            } catch {
              finish(false, "harness_describe returned non-JSON text");
              return;
            }
          } else {
            finish(false, "harness_describe missing text content");
            return;
          }
          if (liveTypes !== expectedResourceCount) {
            finish(false, `resource type mismatch: live=${liveTypes} expected=${expectedResourceCount}`);
            return;
          }
          finish(true);
          return;
        }
      }
    });

    child.stdin.write(
      mcpNdjson({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "smoke-test", version: "1.0.0" },
        },
      }),
    );
  });
}

main().catch((err) => {
  console.error("Smoke test crashed:", err);
  process.exit(1);
});
