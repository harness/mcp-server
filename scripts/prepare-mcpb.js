#!/usr/bin/env node

import { copyFileSync, cpSync, existsSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const outDir = join(root, "dist", "mcpb");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? root,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, ...options.env },
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

run("pnpm", ["build"]);

for (const path of ["build", "package.json", "LICENSE", "NOTICE", "icon.png"]) {
  const from = join(root, path);
  if (existsSync(from)) {
    cpSync(from, join(outDir, path), { recursive: true });
  }
}

copyFileSync(join(root, "mcp-directory", "manifest.json"), join(outDir, "manifest.json"));

run("npm", ["install", "--omit=dev", "--ignore-scripts", "--package-lock=false"], { cwd: outDir });

const mcpbPath = join(root, "mcp-server.mcpb");
rmSync(mcpbPath, { force: true });
run("zip", ["-r", mcpbPath, "."], { cwd: outDir });

console.error(`[mcpb] Bundle created: ${mcpbPath}`);
