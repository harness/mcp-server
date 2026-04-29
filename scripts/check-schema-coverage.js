/**
 * Build-time validation: ensures every *.json schema in harness-schema v0/ and v1/
 * is either synced or explicitly excluded. Exits non-zero if a new upstream schema
 * appears that we haven't accounted for.
 *
 * Usage: node scripts/check-schema-coverage.js
 */

const GITHUB_API = "https://api.github.com/repos/harness/harness-schema/contents";

const SYNCED_V0 = new Set(["pipeline", "template", "trigger"]);
const SYNCED_V1 = new Set(["pipeline", "template", "trigger", "inputSet", "overlayInputSet", "service", "infra"]);

// Schemas we know exist upstream but intentionally skip (add names here to suppress warnings)
const EXCLUDED_V0 = new Set([]);
const EXCLUDED_V1 = new Set([]);

async function listJsonFiles(dirPath) {
  const url = `${GITHUB_API}/${dirPath}?ref=main`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/vnd.github.v3+json",
      ...(process.env.GITHUB_TOKEN ? { Authorization: `token ${process.env.GITHUB_TOKEN}` } : {}),
    },
  });
  if (!res.ok) {
    console.error(`Failed to list ${dirPath}: ${res.status} ${res.statusText}`);
    process.exit(1);
  }
  const items = await res.json();
  return items
    .filter((f) => f.type === "file" && f.name.endsWith(".json"))
    .map((f) => f.name.replace(/\.json$/, ""));
}

async function main() {
  let hasError = false;

  for (const [version, synced, excluded] of [
    ["v0", SYNCED_V0, EXCLUDED_V0],
    ["v1", SYNCED_V1, EXCLUDED_V1],
  ]) {
    const upstream = await listJsonFiles(version);
    for (const name of upstream) {
      if (!synced.has(name) && !excluded.has(name)) {
        console.error(
          `[MISSING] ${version}/${name}.json exists upstream but is not synced or excluded. ` +
          `Add "${name}" to ${version === "v0" ? "V0_SCHEMAS" : "V1_SCHEMAS"} in scripts/sync-schemas.js ` +
          `or to EXCLUDED_${version.toUpperCase()} in scripts/check-schema-coverage.js.`,
        );
        hasError = true;
      }
    }

    for (const name of synced) {
      if (!upstream.includes(name)) {
        console.warn(`[STALE] ${version}/${name}.json is synced but no longer exists upstream.`);
      }
    }
  }

  if (hasError) {
    console.error("\nSchema coverage check failed. See errors above.");
    process.exit(1);
  }

  console.log("Schema coverage check passed — all upstream schemas accounted for.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
