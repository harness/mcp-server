import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createLogger } from "../utils/logger.js";
import { SCHEMAS, VALID_SCHEMAS, type SchemaName } from "../data/schemas/index.js";

const log = createLogger("resource:harness-schema");

export function isValidSchemaName(name: string, validNames: readonly string[] = VALID_SCHEMAS): name is SchemaName {
  return validNames.includes(name);
}

export function registerHarnessSchemaResource(
  server: McpServer,
  additionalSchemas?: Record<string, Record<string, any>>,
): void {
  if (additionalSchemas) {
    for (const key of Object.keys(additionalSchemas)) {
      if (key in SCHEMAS) {
        log.warn(`additionalSchemas key '${key}' overrides a built-in schema`);
      }
    }
  }
  const allSchemas: Record<string, Record<string, any>> = additionalSchemas
    ? { ...SCHEMAS, ...additionalSchemas }
    : { ...SCHEMAS };
  const allSchemaNames = Object.keys(allSchemas);

  const template = new ResourceTemplate("schema:///{schemaName}", {
    list: async () => ({
      resources: allSchemaNames.map((name) => ({
        uri: `schema:///${name}`,
        name: `${name} schema`,
      })),
    }),
    complete: {
      schemaName: (value) =>
        allSchemaNames.filter((s) => s.startsWith(value)),
    },
  });

  server.registerResource(
    "harness-schema",
    template,
    {
      title: "Harness Schema",
      description: `Harness JSON Schema definitions. Valid schema names: ${allSchemaNames.join(", ")}. Use these to understand the required body format for harness_create.`,
      mimeType: "application/schema+json",
    },
    async (uri) => {
      const schemaName = uri.pathname.replace(/^\/+/, "");

      if (!isValidSchemaName(schemaName, allSchemaNames)) {
        throw new Error(
          `Unknown schema '${schemaName}'. Valid schemas: ${allSchemaNames.join(", ")}`,
        );
      }

      const schema = allSchemas[schemaName];

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

