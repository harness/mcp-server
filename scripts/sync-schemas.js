import fs from "fs";
import path from "path";

const SCHEMAS = ["pipeline", "template", "trigger"];
const BASE_URL = "https://raw.githubusercontent.com/harness/harness-schema/main/v0";

async function main() {
  const targetDir = "src/data/schemas";
  fs.mkdirSync(targetDir, { recursive: true });

  for (const name of SCHEMAS) {
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
}

main().catch(console.error);
