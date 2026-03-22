import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createLogger } from "../utils/logger.js";
import { SCHEMAS, VALID_SCHEMAS, type SchemaName } from "../data/schemas/index.js";

const log = createLogger("resource:harness-schema");

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

      const schema = SCHEMAS[schemaName];

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/schema+json",
            text: JSON.stringify(schema, null, 2),
          },
        ],
      };
    },
  );
}

// Exported for testing
export { isValidSchemaName };
