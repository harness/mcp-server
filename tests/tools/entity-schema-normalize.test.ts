import { describe, it, expect } from "vitest";
import {
  normalizeEntitySchema,
  removeIdentifierConstFromSchema,
} from "../../src/tools/entity-schema/normalize.js";

describe("entity-schema normalize", () => {
  it("removes const from orgIdentifier and projectIdentifier", () => {
    const schema = {
      properties: {
        orgIdentifier: { type: "string", const: "my-org" },
        projectIdentifier: { type: "string", const: "my-project" },
        name: { type: "string" },
      },
    };

    const result = removeIdentifierConstFromSchema(schema);
    expect(result.properties).toEqual({
      orgIdentifier: { type: "string" },
      projectIdentifier: { type: "string" },
      name: { type: "string" },
    });
  });

  it("drops org/project from required when not in scope", () => {
    const schema = {
      required: ["name", "orgIdentifier", "projectIdentifier"],
      properties: { name: { type: "string" } },
    };

    const accountScope = normalizeEntitySchema("environment", schema);
    expect(accountScope.required).toEqual(["name"]);

    const orgScope = normalizeEntitySchema("environment", schema, "org1");
    expect(orgScope.required).toEqual(["name", "orgIdentifier"]);

    const projectScope = normalizeEntitySchema("environment", schema, "org1", "proj1");
    expect(projectScope.required).toEqual(["name", "orgIdentifier", "projectIdentifier"]);
  });

  it("fixes connector identifier pattern", () => {
    const schema = {
      definitions: {
        ConnectorInfoDTO: {
          properties: {
            identifier: { type: "string", const: "fixed-id" },
          },
        },
      },
    };

    const result = normalizeEntitySchema("connector", schema);
    const identifier = (result.definitions as Record<string, unknown>).ConnectorInfoDTO as Record<
      string,
      unknown
    >;
    const props = identifier.properties as Record<string, unknown>;
    expect(props.identifier).toMatchObject({
      type: "string",
      pattern: "^[a-zA-Z_][a-zA-Z0-9_$]{0,127}$",
    });
    expect(props.identifier).not.toHaveProperty("const");
  });
});
