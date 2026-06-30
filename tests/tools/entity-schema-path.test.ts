/**
 * Unit tests for live entity schema path navigation — the #368 fallback walk
 * from definitions root when a section is not nested under the resource key.
 */
import { describe, it, expect } from "vitest";
import {
  navigateEntitySchemaPath,
  getResourceDefinitions,
  getDefinitionSections,
} from "../../src/tools/entity-schema/live.js";
import type { JsonObject } from "../../src/tools/entity-schema/normalize.js";

const CONNECTOR_SCHEMA: JsonObject = {
  definitions: {
    connector: {
      connector: {
        type: "object",
        properties: {
          name: { type: "string" },
          spec: { $ref: "#/definitions/shared/ConnectorSpecDTO" },
        },
      },
    },
    shared: {
      ConnectorSpecDTO: {
        type: "object",
        title: "ConnectorSpecDTO",
        properties: { url: { type: "string" } },
      },
    },
  },
};

describe("navigateEntitySchemaPath", () => {
  it("resolves a direct key under resource definitions", () => {
    const node = navigateEntitySchemaPath(CONNECTOR_SCHEMA, "connector", "connector");
    expect(node).toMatchObject({ type: "object", properties: { name: { type: "string" } } });
  });

  it("falls back to definitions root when path is outside resourceDefs tree", () => {
    const node = navigateEntitySchemaPath(CONNECTOR_SCHEMA, "connector", "shared.ConnectorSpecDTO");
    expect(node).toMatchObject({
      title: "ConnectorSpecDTO",
      properties: { url: { type: "string" } },
    });
  });

  it("returns undefined and lists no section when path is missing", () => {
    expect(navigateEntitySchemaPath(CONNECTOR_SCHEMA, "connector", "DoesNotExist")).toBeUndefined();
    expect(getDefinitionSections(CONNECTOR_SCHEMA, "connector")).toContain("connector");
  });
});

describe("getResourceDefinitions alias keys", () => {
  it("matches entityType key Connectors for connector resource_type", () => {
    const schema: JsonObject = {
      definitions: {
        Connectors: {
          ConnectorInfoDTO: { type: "object", properties: { id: { type: "string" } } },
        },
      },
    };
    const defs = getResourceDefinitions(schema, "connector");
    expect(defs).toBeDefined();
    expect(defs?.ConnectorInfoDTO).toMatchObject({ type: "object" });
  });
});
