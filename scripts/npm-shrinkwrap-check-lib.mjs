import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  isSecureAdmZipVersion,
  SECURE_ADM_ZIP_VERSION,
} from "./adm-zip-security-lib.mjs";

function sortedEntries(value = {}) {
  return Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
}

/**
 * @typedef {{ ok: true }} NpmShrinkwrapCheckSuccess
 * @typedef {{ ok: false, message: string }} NpmShrinkwrapCheckFailure
 */

/**
 * Same validation as `node scripts/generate-npm-shrinkwrap.mjs --check`, without exiting the process.
 * @param {string} repoRoot
 * @returns {NpmShrinkwrapCheckSuccess | NpmShrinkwrapCheckFailure}
 */
export function validateNpmShrinkwrapCheck(repoRoot) {
  const shrinkwrapPath = join(repoRoot, "npm-shrinkwrap.json");
  const packageJsonPath = join(repoRoot, "package.json");

  if (!existsSync(shrinkwrapPath)) {
    return {
      ok: false,
      message: "file is missing — run: node scripts/generate-npm-shrinkwrap.mjs",
    };
  }

  const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  const shrinkwrap = JSON.parse(readFileSync(shrinkwrapPath, "utf8"));
  const root = shrinkwrap.packages?.[""];
  if (!root) {
    return { ok: false, message: "root package metadata is missing" };
  }
  if (root.name !== pkg.name || root.version !== pkg.version) {
    return { ok: false, message: `root metadata does not match ${pkg.name}@${pkg.version}` };
  }

  if (
    JSON.stringify(sortedEntries(root.dependencies)) !==
    JSON.stringify(sortedEntries(pkg.dependencies))
  ) {
    return { ok: false, message: "root dependencies do not match package.json" };
  }
  if (
    JSON.stringify(sortedEntries(root.optionalDependencies)) !==
    JSON.stringify(sortedEntries(pkg.optionalDependencies))
  ) {
    return { ok: false, message: "root optionalDependencies do not match package.json" };
  }

  const admZipInstalls = Object.entries(shrinkwrap.packages ?? {}).filter(([path]) =>
    path.endsWith("node_modules/adm-zip"),
  );
  const insecureAdmZipInstalls = admZipInstalls.filter(
    ([, metadata]) => !isSecureAdmZipVersion(metadata?.version, SECURE_ADM_ZIP_VERSION),
  );
  if (admZipInstalls.length === 0 || insecureAdmZipInstalls.length > 0) {
    const details = insecureAdmZipInstalls
      .map(([path, metadata]) => `${path}@${metadata?.version ?? "missing"}`)
      .join(", ");
    return { ok: false, message: details || "adm-zip is missing" };
  }

  return { ok: true };
}
