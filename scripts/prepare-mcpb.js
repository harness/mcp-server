#!/usr/bin/env node

import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { spawnSync } from "node:child_process";

export const MCPB_CLI_PACKAGE = "@anthropic-ai/mcpb@2.1.2";

export function assetNameForVersion(version) {
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(`Invalid MCPB version: ${version}`);
  }
  return `harness-mcp-server-${version}.mcpb`;
}

export function normalizeBundleManifest(manifest, version) {
  if (manifest.version !== version) {
    throw new Error(
      `Bundle manifest version ${manifest.version} does not match package version ${version}`,
    );
  }

  return {
    ...manifest,
    server: {
      ...manifest.server,
      entry_point: "server/index.js",
      mcp_config: {
        ...manifest.server.mcp_config,
        args: manifest.server.mcp_config.args.map((arg) =>
          arg === "${__dirname}/build/index.js" ? "${__dirname}/server/index.js" : arg,
        ),
      },
    },
  };
}

export function bundlePackageJson(packageJson) {
  const directDependencies = new Set([
    ...Object.keys(packageJson.dependencies ?? {}),
    ...Object.keys(packageJson.optionalDependencies ?? {}),
  ]);
  const overrides = Object.fromEntries(
    Object.entries(packageJson.pnpm?.overrides ?? {}).filter(
      ([name]) => !directDependencies.has(name),
    ),
  );

  return {
    name: packageJson.name,
    version: packageJson.version,
    description: packageJson.description,
    private: true,
    type: packageJson.type,
    license: packageJson.license,
    engines: packageJson.engines,
    dependencies: packageJson.dependencies,
    optionalDependencies: packageJson.optionalDependencies,
    overrides,
  };
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status ?? "unknown"}`);
  }
}

export function prepareMcpb({ sourceDir = process.cwd(), outputDir } = {}) {
  const sourceRoot = resolve(sourceDir);
  const toolingRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const outputRoot = resolve(outputDir ?? join(sourceRoot, "dist"));
  const stageDir = join(outputRoot, "mcpb");
  const packageJson = readJson(join(sourceRoot, "package.json"));
  const manifest = normalizeBundleManifest(
    readJson(join(sourceRoot, "mcp-directory", "manifest.json")),
    packageJson.version,
  );
  const bundlePath = join(outputRoot, assetNameForVersion(packageJson.version));

  rmSync(stageDir, { recursive: true, force: true });
  rmSync(bundlePath, { force: true });
  mkdirSync(stageDir, { recursive: true });

  run("pnpm", ["build"], sourceRoot);

  cpSync(join(sourceRoot, "build"), join(stageDir, "server"), { recursive: true });
  for (const path of ["npm-shrinkwrap.json", "LICENSE", "NOTICE"]) {
    const from = join(sourceRoot, path);
    if (existsSync(from)) {
      cpSync(from, join(stageDir, path), { recursive: true });
    }
  }
  cpSync(join(toolingRoot, "icon.png"), join(stageDir, "icon.png"));
  writeFileSync(
    join(stageDir, "package.json"),
    `${JSON.stringify(bundlePackageJson(packageJson), null, 2)}\n`,
  );
  writeFileSync(join(stageDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

  run("npm", ["ci", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund"], stageDir);
  run("npx", ["--yes", MCPB_CLI_PACKAGE, "validate", join(stageDir, "manifest.json")], sourceRoot);
  run("npx", ["--yes", MCPB_CLI_PACKAGE, "pack", stageDir, bundlePath], sourceRoot);
  run("npx", ["--yes", MCPB_CLI_PACKAGE, "info", bundlePath], sourceRoot);

  console.error(`[mcpb] Bundle created: ${bundlePath}`);
  return bundlePath;
}

function main() {
  const { values } = parseArgs({
    options: {
      "source-dir": { type: "string" },
      "output-dir": { type: "string" },
    },
  });

  prepareMcpb({
    sourceDir: values["source-dir"],
    outputDir: values["output-dir"],
  });
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : undefined;
if (invokedPath && fileURLToPath(import.meta.url) === invokedPath) {
  try {
    main();
  } catch (error) {
    console.error(`[mcpb] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
