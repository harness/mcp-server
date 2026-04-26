import fs from "fs";
import path from "path";

/** Fetched from harness/harness-schema (v0 JSON). */
const REMOTE_SCHEMAS = ["pipeline", "template", "trigger"];

/**
 * MCP-local schemas not published under harness-schema v0.
 * Kept in-repo and wired into the index so VALID_SCHEMAS / schema:/// URIs stay stable.
 */
const LOCAL_SCHEMA_ENTRIES = [
  { exportKey: `"pipeline_v1"`, importAs: "pipelineV1", fileBase: "pipeline-v1" },
  { exportKey: `"agent-pipeline"`, importAs: "agentPipeline", fileBase: "agent-pipeline" },
];

const BASE_URL = "https://raw.githubusercontent.com/harness/harness-schema/main/v0";

async function main() {
  const targetDir = "src/data/schemas";
  fs.mkdirSync(targetDir, { recursive: true });

  for (const name of REMOTE_SCHEMAS) {
    console.log(`Downloading ${name} schema...`);
    const res = await fetch(`${BASE_URL}/${name}.json`);
    if (!res.ok) {
      console.error(`Failed to fetch ${name}: ${res.statusText}`);
      process.exit(1);
    }
    const data = await res.text();
    
    // We save them as .ts files exporting the JSON object.
    // This allows tsc to compile them into the build/ directory natively
    // without needing to copy .json files or deal with ESM JSON imports.
    const fileContent = `// Auto-generated from ${BASE_URL}/${name}.json\n// @ts-nocheck\n\nconst schema: Record<string, any> = ${data};\nexport default schema;\n`;
    
    const filePath = path.join(targetDir, `${name}.ts`);
    fs.writeFileSync(filePath, fileContent);
    console.log(`Saved ${filePath}`);
  }

  // Generate index.ts (remote + local-only schema exports)
  const remoteImports = REMOTE_SCHEMAS.map((name) => `import ${name} from "./${name}.js";`).join("\n");
  const localImports = LOCAL_SCHEMA_ENTRIES.map(
    (e) => `import ${e.importAs} from "./${e.fileBase}.js";`
  ).join("\n");
  const remoteProps = REMOTE_SCHEMAS.map((name) => `  ${name},`).join("\n");
  const localProps = LOCAL_SCHEMA_ENTRIES.map(
    (e) => `  ${e.exportKey}: ${e.importAs},`
  ).join("\n");

  const indexContent = `// Auto-generated index of schemas
${remoteImports}
${localImports}

export const SCHEMAS = {
${remoteProps}
${localProps}
} as const;

export const VALID_SCHEMAS = Object.keys(SCHEMAS) as (keyof typeof SCHEMAS)[];
export type SchemaName = keyof typeof SCHEMAS;
`;
  
  const indexFilePath = path.join(targetDir, "index.ts");
  fs.writeFileSync(indexFilePath, indexContent);
  console.log(`Saved ${indexFilePath}`);
}

main().catch(console.error);
