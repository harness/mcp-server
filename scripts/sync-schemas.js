import fs from "fs";
import path from "path";

const BASE_URL = "https://raw.githubusercontent.com/harness/harness-schema/main";

const V0_SCHEMAS = ["pipeline", "template", "trigger"];
const V1_SCHEMAS = ["pipeline", "template", "trigger", "inputSet", "overlayInputSet", "service", "infra"];

/**
 * MCP-local schemas not published under harness-schema.
 * Kept in src/data/schemas/local/ and wired into the generated index.
 */
const LOCAL_SCHEMA_ENTRIES = [
  { schemaKey: "agent-pipeline", importAs: "agentPipeline", fileBase: "agent-pipeline" },
];

/**
 * Map from v1 JSON filename (without extension) to the definition namespace
 * used inside that file's `definitions` object. The harness_schema tool
 * resolves paths via `definitions[schemaKey]`, so v1 schemas whose internal
 * namespace differs from their schemaKey need rewriting.
 */
const V1_DEF_NAMESPACE = {
  pipeline: "pipeline",
  template: "pipeline",
  trigger: "trigger",
  inputSet: null,
  overlayInputSet: null,
  service: "serviceEntity",
  infra: "infraStructureEntity",
};

/**
 * Rewrite a v1 schema's `definitions` keys and all `$ref` pointers so the
 * harness_schema tool can navigate via `definitions[schemaKey]`.
 *
 * For example, v1/pipeline.json has `definitions.pipeline` but the tool
 * looks for `definitions.pipeline_v1`, so we rename the namespace.
 */
function rewriteDefinitionKeys(json, originalNamespace, targetNamespace) {
  if (!originalNamespace || originalNamespace === targetNamespace) return json;

  const text = JSON.stringify(json);
  const rewritten = text
    .replaceAll(
      `"#/definitions/${originalNamespace}/`,
      `"#/definitions/${targetNamespace}/`,
    )
    .replaceAll(
      `"#/definitions/${originalNamespace}"`,
      `"#/definitions/${targetNamespace}"`,
    );

  const parsed = JSON.parse(rewritten);

  if (parsed.definitions?.[originalNamespace]) {
    parsed.definitions[targetNamespace] = parsed.definitions[originalNamespace];
    delete parsed.definitions[originalNamespace];
  }

  return parsed;
}

function schemaKey(version, name) {
  return version === "v0" ? name : `${name}_v1`;
}

function camelCase(str) {
  return str.replace(/[-_]([a-z])/g, (_, c) => c.toUpperCase());
}

async function fetchSchema(version, name) {
  const url = `${BASE_URL}/${version}/${name}.json`;
  console.log(`Downloading ${version}/${name} schema...`);
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`Failed to fetch ${version}/${name}: ${res.statusText}`);
    process.exit(1);
  }
  return { url, data: await res.text() };
}

function writeSchemaFile(targetDir, version, name, url, jsonData) {
  const key = schemaKey(version, name);
  let parsed = JSON.parse(jsonData);

  if (version === "v1") {
    const origNs = V1_DEF_NAMESPACE[name];
    if (origNs !== undefined) {
      parsed = rewriteDefinitionKeys(parsed, origNs, key);
    }
    parsed.title = key;
  }

  const content = JSON.stringify(parsed, null, 2);
  const fileContent = `// Auto-generated from ${url}\n// @ts-nocheck\n\nconst schema: Record<string, any> = ${content};\nexport default schema;\n`;

  const filePath = path.join(targetDir, version, `${name}.ts`);
  fs.writeFileSync(filePath, fileContent);
  console.log(`Saved ${filePath}`);
  return { key, importAs: camelCase(key), importPath: `./${version}/${name}.js` };
}

function generateIndex(targetDir, entries) {
  const v0Keys = V0_SCHEMAS.map((n) => `"${schemaKey("v0", n)}"`);
  const v1Keys = V1_SCHEMAS.map((n) => `"${schemaKey("v1", n)}"`);
  const localKeys = LOCAL_SCHEMA_ENTRIES.map((e) => `"${e.schemaKey}"`);

  const imports = entries.map((e) => `import ${e.importAs} from "${e.importPath}";`).join("\n");
  const props = entries.map((e) => `  "${e.key}": ${e.importAs},`).join("\n");

  const indexContent = `// Auto-generated — do not edit manually. Run \`pnpm sync-schemas\` to regenerate.
// @ts-nocheck
${imports}

type V0SchemaKey = ${v0Keys.join(" | ")};
type V1SchemaKey = ${v1Keys.join(" | ")};
type LocalSchemaKey = ${localKeys.join(" | ")};
type AllSchemaKeys = V0SchemaKey | V1SchemaKey | LocalSchemaKey;

export const SCHEMAS: Record<AllSchemaKeys, Record<string, any>> = {
${props}
};

export const VALID_SCHEMAS = Object.keys(SCHEMAS) as AllSchemaKeys[];
export type SchemaName = AllSchemaKeys;

export const V0_SCHEMA_KEYS: V0SchemaKey[] = [${v0Keys.join(", ")}];
export const V1_SCHEMA_KEYS: V1SchemaKey[] = [${v1Keys.join(", ")}];
`;

  const indexPath = path.join(targetDir, "index.ts");
  fs.writeFileSync(indexPath, indexContent);
  console.log(`Saved ${indexPath}`);
}

async function main() {
  const targetDir = "src/data/schemas";
  fs.mkdirSync(path.join(targetDir, "v0"), { recursive: true });
  fs.mkdirSync(path.join(targetDir, "v1"), { recursive: true });
  fs.mkdirSync(path.join(targetDir, "local"), { recursive: true });

  const entries = [];

  for (const name of V0_SCHEMAS) {
    const { url, data } = await fetchSchema("v0", name);
    entries.push(writeSchemaFile(targetDir, "v0", name, url, data));
  }

  for (const name of V1_SCHEMAS) {
    const { url, data } = await fetchSchema("v1", name);
    entries.push(writeSchemaFile(targetDir, "v1", name, url, data));
  }

  for (const local of LOCAL_SCHEMA_ENTRIES) {
    entries.push({
      key: local.schemaKey,
      importAs: local.importAs,
      importPath: `./local/${local.fileBase}.js`,
    });
  }

  generateIndex(targetDir, entries);

  console.log("\nSync complete. Schemas:");
  console.log(`  v0: ${V0_SCHEMAS.join(", ")}`);
  console.log(`  v1: ${V1_SCHEMAS.join(", ")}`);
  console.log(`  local: ${LOCAL_SCHEMA_ENTRIES.map((e) => e.schemaKey).join(", ")}`);
}

main().catch(console.error);
