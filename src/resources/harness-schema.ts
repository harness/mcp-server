import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("resource:harness-schema");

const VALID_SCHEMAS = ["pipeline", "template", "trigger"] as const;
type SchemaName = (typeof VALID_SCHEMAS)[number];

const SCHEMA_BASE_URL =
  "https://raw.githubusercontent.com/harness/harness-schema/main/v0";

function buildSchemaUrl(name: SchemaName): string {
  return `${SCHEMA_BASE_URL}/${name}.json`;
}

let schemaCache = new Map<SchemaName, string>();

/** Clear the schema cache (for testing). */
function clearSchemaCache(): void {
  schemaCache = new Map();
}

async function fetchSchema(name: SchemaName): Promise<string> {
  const cached = schemaCache.get(name);
  if (cached) {
    log.debug("Returning cached schema", { name });
    return cached;
  }

  const url = buildSchemaUrl(name);
  log.info("Fetching schema from GitHub", { name, url });

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch schema '${name}': HTTP ${response.status} ${response.statusText}`,
    );
  }

  const text = await response.text();
  schemaCache.set(name, text);
  return text;
}

function isValidSchemaName(name: string): name is SchemaName {
  return (VALID_SCHEMAS as readonly string[]).includes(name);
}

export function registerHarnessSchemaResource(server: McpServer): void {
  const template = new ResourceTemplate("schema:///{schemaName}", {
    list: async () => ({
      resources: VALID_SCHEMAS.map((name) => ({
        uri: `schema:///${name}`,
        name: `${name} schema`,
      })),
    }),
    complete: {
      schemaName: (value) =>
        VALID_SCHEMAS.filter((s) => s.startsWith(value)),
    },
  });

  server.registerResource(
    "harness-schema",
    template,
    {
      title: "Harness Schema",
      description: `Harness JSON Schema definitions. Valid schema names: ${VALID_SCHEMAS.join(", ")}. Use these to understand the required body format for harness_create.`,
      mimeType: "application/schema+json",
    },
    async (uri) => {
      const schemaName = uri.pathname.replace(/^\/+/, "");

      if (!isValidSchemaName(schemaName)) {
        throw new Error(
          `Unknown schema '${schemaName}'. Valid schemas: ${VALID_SCHEMAS.join(", ")}`,
        );
      }

      const text = await fetchSchema(schemaName);

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/schema+json",
            text,
          },
        ],
      };
    },
  );
}

// Exported for testing
export { VALID_SCHEMAS, buildSchemaUrl, isValidSchemaName, clearSchemaCache };
