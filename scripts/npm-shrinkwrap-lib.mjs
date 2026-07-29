import {
  isSecureAdmZipVersion,
  SECURE_ADM_ZIP_VERSION,
} from "./adm-zip-security-lib.mjs";

/** @param {Record<string, string>} [value] */
export function sortedEntries(value = {}) {
  return Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
}

/**
 * Mirror pnpm.overrides into npm-native overrides, excluding direct deps (npm EOVERRIDE).
 * @param {{ dependencies?: Record<string, string>, optionalDependencies?: Record<string, string>, pnpm?: { overrides?: Record<string, string> } }} pkg
 * @returns {Record<string, string>}
 */
export function buildTransitiveOverrides(pkg) {
  const directDeps = new Set([
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.optionalDependencies ?? {}),
  ]);
  return Object.fromEntries(
    Object.entries(pkg.pnpm?.overrides ?? {}).filter(([name]) => !directDeps.has(name)),
  );
}

/**
 * @param {{ name: string, version: string, dependencies?: Record<string, string>, optionalDependencies?: Record<string, string>, pnpm?: { overrides?: Record<string, string> } }} pkg
 */
export function buildStagingManifest(pkg) {
  return {
    name: pkg.name,
    version: pkg.version,
    private: true,
    dependencies: pkg.dependencies,
    optionalDependencies: pkg.optionalDependencies,
    overrides: buildTransitiveOverrides(pkg),
  };
}

/**
 * Validate npm-shrinkwrap.json metadata without regenerating the lockfile.
 * @param {{ name: string, version: string, dependencies?: Record<string, string>, optionalDependencies?: Record<string, string> }} pkg
 * @param {{ packages?: Record<string, { name?: string, version?: string, dependencies?: Record<string, string>, optionalDependencies?: Record<string, string> }> }} shrinkwrap
 * @returns {string | null} error message when invalid, otherwise null
 */
export function validateShrinkwrapMetadata(pkg, shrinkwrap) {
  const root = shrinkwrap.packages?.[""];
  if (!root) {
    return "root package metadata is missing";
  }
  if (root.name !== pkg.name || root.version !== pkg.version) {
    return `root metadata does not match ${pkg.name}@${pkg.version}`;
  }
  if (
    JSON.stringify(sortedEntries(root.dependencies)) !==
    JSON.stringify(sortedEntries(pkg.dependencies))
  ) {
    return "root dependencies do not match package.json";
  }
  if (
    JSON.stringify(sortedEntries(root.optionalDependencies)) !==
    JSON.stringify(sortedEntries(pkg.optionalDependencies))
  ) {
    return "root optionalDependencies do not match package.json";
  }

  const hoistedAdmZipVersion = shrinkwrap.packages?.["node_modules/adm-zip"]?.version;
  if (
    !hoistedAdmZipVersion ||
    !isSecureAdmZipVersion(hoistedAdmZipVersion, SECURE_ADM_ZIP_VERSION)
  ) {
    return `hoisted adm-zip is ${hoistedAdmZipVersion ?? "missing"}`;
  }

  return null;
}
