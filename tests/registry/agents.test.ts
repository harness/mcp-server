import { describe, expect, it } from "vitest";
import { agentsToolset } from "../../src/registry/toolsets/agents.js";
import type { EndpointSpec, ResourceDefinition } from "../../src/registry/types.js";

function findResource(resourceType: string): ResourceDefinition {
  const resource = agentsToolset.resources.find((r) => r.resourceType === resourceType);
  if (!resource) throw new Error(`Resource type "${resourceType}" not found`);
  return resource;
}

function getOperation(resourceType: string, operation: string): EndpointSpec {
  const resource = findResource(resourceType);
  const spec = resource.operations[operation as keyof typeof resource.operations];
  if (!spec) throw new Error(`Operation "${operation}" not found on "${resourceType}"`);
  return spec;
}

describe("agent create bodyBuilder", () => {
  const createSpec = getOperation("agent", "create");
  const bodyBuilder = createSpec.bodyBuilder!;

  it("generates uid from name when uid is omitted", () => {
    const body = { name: "DevOps Assistant", spec: "agent:\n  name: DevOps Assistant" };
    expect(bodyBuilder({ body })).toEqual({
      name: "DevOps Assistant",
      spec: "agent:\n  name: DevOps Assistant",
      uid: "devops_assistant",
    });
  });

  it("does not overwrite an explicit uid", () => {
    const body = { uid: "custom_id", name: "DevOps Assistant", spec: "..." };
    expect(bodyBuilder({ body })).toEqual(body);
  });

  it("trims leading and trailing underscores from generated uid", () => {
    const body = { name: "__Foo!!", spec: "..." };
    expect(bodyBuilder({ body }).uid).toBe("foo");
  });

  it("throws when body is missing", () => {
    expect(() => bodyBuilder({})).toThrow("body is required for agent creation");
  });

  it("throws when neither uid nor name is provided", () => {
    expect(() => bodyBuilder({ body: { spec: "..." } })).toThrow(
      "uid is required (or name must be provided to generate uid)",
    );
  });
});
