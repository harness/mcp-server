import { ResourceTemplate } from "@modelcontextprotocol/server";
import type { McpServer } from "@modelcontextprotocol/server";
import { createLogger } from "../utils/logger.js";
import { VALID_SCHEMAS, type SchemaName } from "../data/schemas/catalog.js";
import type { SchemaEntry } from "../data/schemas/types.js";

const log = createLogger("resource:harness-schema");

export function isValidSchemaName(name: string, validNames: readonly string[] = VALID_SCHEMAS): name is SchemaName {
  return validNames.includes(name);
}

export function registerHarnessSchemaResource(
  server: McpServer,
  additionalSchemas?: Record<string, SchemaEntry>,
): void {
  if (additionalSchemas) {
    for (const key of Object.keys(additionalSchemas)) {
      if ((VALID_SCHEMAS as string[]).includes(key)) {
        throw new Error(`additionalSchemas key '${key}' conflicts with a built-in schema name`);
      }
    }
  }
  const allSchemaNames = [...VALID_SCHEMAS, ...Object.keys(additionalSchemas ?? {})];

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
      description:
        `Harness JSON Schema definitions (bundled). Valid schema names: ${allSchemaNames.join(", ")}. ` +
        "For connector, environment, service, secret, and infrastructure schemas, use the harness_schema tool " +
        "(live fetch from NG /yaml-schema). For release_process and release_activity, use harness_schema " +
        "(live fetch from /gateway/rmg/api/yamlSchema) — they are not available via schema:/// resources.",
      mimeType: "application/schema+json",
    },
    async (uri) => {
      const schemaName = uri.pathname.replace(/^\/+/, "");

      if (!isValidSchemaName(schemaName, allSchemaNames)) {
        throw new Error(
          `Unknown schema '${schemaName}'. Valid schemas: ${allSchemaNames.join(", ")}`,
        );
      }

      const schema = additionalSchemas?.[schemaName]?.schema
        ?? (await import("../data/schemas/index.js")).SCHEMAS[schemaName];

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

