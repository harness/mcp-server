import { describe, it, expect } from "vitest";
import {
  extractLiveSchema,
  getDefinitionSections,
  getEntitySchemaSummary,
  getResourceDefinitions,
  getRootDefinition,
  navigateEntitySchemaPath,
} from "../../src/tools/entity-schema/live.js";

const CONNECTOR_SCHEMA = {
  definitions: {
    connector: {
      connector: {
        type: "object",
        properties: {
          name: { type: "string" },
          identifier: { type: "string" },
        },
        required: ["name", "identifier"],
      },
      ConnectorInfoDTO: {
        type: "object",
        properties: {
          connectorType: { type: "string" },
        },
      },
    },
  },
};

describe("getResourceDefinitions", () => {
  it("finds resource definitions by resource type key", () => {
    const defs = getResourceDefinitions(CONNECTOR_SCHEMA, "connector");
    expect(defs).toBeDefined();
    expect(defs).toHaveProperty("connector");
    expect(defs).toHaveProperty("ConnectorInfoDTO");
  });
});

describe("getRootDefinition", () => {
  it("returns the nested resource root definition", () => {
    const root = getRootDefinition(CONNECTOR_SCHEMA, "connector");
    expect(root).toMatchObject({
      type: "object",
      properties: {
        name: { type: "string" },
        identifier: { type: "string" },
      },
    });
  });
});

describe("getDefinitionSections", () => {
  it("lists available sections under the resource definitions", () => {
    expect(getDefinitionSections(CONNECTOR_SCHEMA, "connector")).toEqual([
      "connector",
      "ConnectorInfoDTO",
    ]);
  });
});

describe("navigateEntitySchemaPath", () => {
  it("resolves a direct section key", () => {
    const section = navigateEntitySchemaPath(CONNECTOR_SCHEMA, "connector", "ConnectorInfoDTO");
    expect(section).toMatchObject({
      type: "object",
      properties: { connectorType: { type: "string" } },
    });
  });

  it("falls back to definitions-level dotted navigation", () => {
    const section = navigateEntitySchemaPath(CONNECTOR_SCHEMA, "connector", "connector.connector");
    expect(section).toMatchObject({
      type: "object",
      properties: {
        name: { type: "string" },
      },
    });
  });

  it("returns undefined for a path that does not exist", () => {
    expect(navigateEntitySchemaPath(CONNECTOR_SCHEMA, "connector", "NoSuchSection")).toBeUndefined();
  });
});

describe("getEntitySchemaSummary", () => {
  it("includes bundled-specific guidance in the hint", () => {
    const summary = getEntitySchemaSummary(CONNECTOR_SCHEMA, "connector", "bundled");
    expect(summary.source).toBe("bundled");
    expect(summary.hint).toMatch(/vendored snapshot/);
    expect(summary.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "name", required: true }),
        expect.objectContaining({ name: "identifier", required: true }),
      ]),
    );
  });

  it("includes live API guidance in the hint", () => {
    const summary = getEntitySchemaSummary(CONNECTOR_SCHEMA, "connector", "ng-yaml-schema");
    expect(summary.source).toBe("ng-yaml-schema");
    expect(summary.hint).toMatch(/live NG/);
  });
});

describe("extractLiveSchema alternate response shapes", () => {
  const schema = { type: "object", properties: { x: { type: "string" } } };

  it("extracts schema from yamlSchema envelope key", () => {
    expect(extractLiveSchema({ yamlSchema: schema })).toEqual(schema);
  });

  it("extracts schema from nested data.yaml_schema key", () => {
    expect(extractLiveSchema({ data: { yaml_schema: schema } })).toEqual(schema);
  });

  it("throws when no JSON Schema object is present", () => {
    expect(() => extractLiveSchema({ status: "SUCCESS", message: "ok" })).toThrow(
      /did not contain a JSON Schema object/,
    );
  });
});
