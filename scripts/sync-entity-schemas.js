/**
 * Fetch NG entity YAML schemas and vendor them under src/data/schemas/entities/.
 *
 * Required env:
 *   HARNESS_API_KEY — PAT for a reference account (GitHub Action secret)
 *   HARNESS_ACCOUNT_ID — account identifier (or derivable from pat.<accountId>.* token)
 *
 * Optional env:
 *   HARNESS_BASE_URL — default https://app.harness.io
 *   HARNESS_ORG — required for org/project scope snapshots
 *   HARNESS_PROJECT — required for project scope snapshots
 */
import fs from "fs";
import path from "path";
import {
  LIVE_ENTITY_SCHEMAS,
  ENTITY_SCOPES,
  fetchEntitySchemaFromHarness,
  bundledSchemaKey,
} from "./entity-schema-sync-lib.mjs";

function extractAccountIdFromToken(apiKey) {
  const parts = apiKey.split(".");
  if (parts.length >= 3 && parts[0] === "pat" && parts[1]) return parts[1];
  return undefined;
}

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
  return value;
}

function writeSchemaModule(targetDir, key, schema, meta) {
  const fileName = `${key}.ts`;
  const filePath = path.join(targetDir, fileName);
  const content = `// Auto-generated — do not edit manually. Run \`pnpm sync-entity-schemas\` to regenerate.
// @ts-nocheck
// Synced: ${meta.syncedAt} | entity=${meta.resourceType} | scope=${meta.scope}

const schema: Record<string, any> = ${JSON.stringify(schema, null, 2)};

export default schema;
export const meta = ${JSON.stringify(meta, null, 2)};
`;
  fs.writeFileSync(filePath, content);
  console.log(`Saved ${filePath}`);
  return { key, importAs: key.replace(".", "_"), importPath: `./${key}.js` };
}

function generateIndex(targetDir, entries) {
  const imports = entries
    .map((e) => `import ${e.importAs}, { meta as meta_${e.importAs} } from "${e.importPath}";`)
    .join("\n");

  const schemaProps = entries.map((e) => `  "${e.key}": ${e.importAs},`).join("\n");
  const metaProps = entries.map((e) => `  "${e.key}": meta_${e.importAs},`).join("\n");

  const indexContent = `// Auto-generated — do not edit manually. Run \`pnpm sync-entity-schemas\` to regenerate.
// @ts-nocheck
${imports}

export const ENTITY_BUNDLED_SCHEMAS: Record<string, Record<string, any>> = {
${schemaProps}
};

export type EntityBundledMeta = {
  resourceType: string;
  scope: string;
  syncedAt: string;
  accountId: string;
  orgId?: string;
  projectId?: string;
};

export const ENTITY_BUNDLED_META: Record<string, EntityBundledMeta> = {
${metaProps}
};

export const ENTITY_BUNDLED_KEYS = Object.keys(ENTITY_BUNDLED_SCHEMAS);
`;

  const indexPath = path.join(targetDir, "index.ts");
  fs.writeFileSync(indexPath, indexContent);
  console.log(`Saved ${indexPath}`);
}

async function main() {
  const apiKey = requireEnv("HARNESS_API_KEY");
  const accountId =
    process.env.HARNESS_ACCOUNT_ID?.trim() || extractAccountIdFromToken(apiKey);
  if (!accountId) {
    console.error("Set HARNESS_ACCOUNT_ID or use a PAT with pat.<accountId>.* format");
    process.exit(1);
  }

  const baseUrl = process.env.HARNESS_BASE_URL?.trim() || "https://app.harness.io";
  const orgId = process.env.HARNESS_ORG?.trim();
  const projectId = process.env.HARNESS_PROJECT?.trim();
  const syncedAt = new Date().toISOString();

  const targetDir = "src/data/schemas/entities";
  fs.mkdirSync(targetDir, { recursive: true });

  const entries = [];

  for (const resourceType of Object.keys(LIVE_ENTITY_SCHEMAS)) {
    for (const scope of ENTITY_SCOPES) {
      const key = bundledSchemaKey(resourceType, scope);
      console.log(`Fetching ${key}...`);

      const schema = await fetchEntitySchemaFromHarness({
        baseUrl,
        apiKey,
        accountId,
        resourceType,
        scope,
        orgId,
        projectId,
      });

      const meta = {
        resourceType,
        scope,
        syncedAt,
        accountId,
        ...(orgId ? { orgId } : {}),
        ...(projectId ? { projectId } : {}),
      };

      entries.push(writeSchemaModule(targetDir, key, schema, meta));
    }
  }

  generateIndex(targetDir, entries);

  console.log("\nEntity schema sync complete.");
  console.log(`  entities: ${Object.keys(LIVE_ENTITY_SCHEMAS).join(", ")}`);
  console.log(`  scopes: ${ENTITY_SCOPES.join(", ")}`);
  console.log(`  account: ${accountId}`);
  if (orgId) console.log(`  org: ${orgId}`);
  if (projectId) console.log(`  project: ${projectId}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
