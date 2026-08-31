import { describe, expect, it } from "vitest";
import { agentExtract } from "../../src/registry/extractors.js";

describe("agentExtract", () => {
  it("aliases id onto identifier for a bare create/get entity", () => {
    expect(agentExtract({ id: "ca_new", name: "New" })).toEqual({
      id: "ca_new",
      name: "New",
      identifier: "ca_new",
    });
  });

  it("aliases uid onto identifier when id is absent", () => {
    expect(agentExtract({ uid: "ca_new", name: "New" })).toEqual({
      uid: "ca_new",
      name: "New",
      identifier: "ca_new",
    });
  });

  it("unwraps { data: { id } } create/get envelope and aliases identifier", () => {
    expect(
      agentExtract({
        status: "SUCCESS",
        data: { id: "ca_new", name: "New" },
      }),
    ).toEqual({
      id: "ca_new",
      name: "New",
      identifier: "ca_new",
    });
  });

  it("does not overwrite an existing identifier", () => {
    expect(agentExtract({ id: "internal", identifier: "canonical" })).toEqual({
      id: "internal",
      identifier: "canonical",
    });
  });

  it("normalizes a raw list array to { items, total } with aliased identifiers", () => {
    expect(
      agentExtract([
        { id: "a1", name: "One" },
        { uid: "a2", name: "Two" },
      ]),
    ).toEqual({
      items: [
        { id: "a1", name: "One", identifier: "a1" },
        { uid: "a2", name: "Two", identifier: "a2" },
      ],
      total: 2,
    });
  });

  it("normalizes { data: [...] } list envelope to { items, total }", () => {
    expect(
      agentExtract({
        status: "SUCCESS",
        data: [{ id: "a1", name: "One" }],
      }),
    ).toEqual({
      items: [{ id: "a1", name: "One", identifier: "a1" }],
      total: 1,
    });
  });

  it("aliases items already wrapped as { items }", () => {
    expect(agentExtract({ items: [{ id: "a1" }], total: 1 })).toEqual({
      items: [{ id: "a1", identifier: "a1" }],
      total: 1,
    });
  });

  it("leaves delete-style { data: true } alone", () => {
    expect(agentExtract({ data: true })).toEqual({ data: true });
  });

  it("aliases nested object envelopes (items/data/content as objects, not arrays)", () => {
    expect(agentExtract({ items: { id: "nested" } })).toEqual({
      items: { id: "nested", identifier: "nested" },
    });
    expect(agentExtract({ content: { uid: "from-uid" } })).toEqual({
      content: { uid: "from-uid", identifier: "from-uid" },
    });
  });

  it("aliases numeric id onto identifier as a string", () => {
    expect(agentExtract({ id: 42 })).toEqual({ id: 42, identifier: "42" });
  });

  it("does not alias object id or uid onto identifier", () => {
    const objectId = { oid: "pipeline_lister_agent" };
    expect(agentExtract({ id: objectId, name: "New" })).toEqual({
      id: objectId,
      name: "New",
    });
  });
});
