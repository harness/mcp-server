import { describe, it, expect } from "vitest";
import { resolveConfirmNote, withConfirmNote } from "../../src/utils/confirm-note.js";

describe("resolveConfirmNote", () => {
  it("no confirmNote, or no spec: no note, and the message is unchanged", () => {
    expect(resolveConfirmNote(undefined, {})).toBeUndefined();
    expect(resolveConfirmNote({}, {})).toBeUndefined();
    expect(withConfirmNote("Create x?\n\n{}", undefined)).toBe("Create x?\n\n{}");
  });

  it("a string note is used as is, as its own paragraph", () => {
    expect(withConfirmNote("Delete x?", resolveConfirmNote({ confirmNote: "Archives it." }, {}))).toBe("Delete x?\n\nArchives it.");
  });

  it("a function note reads the input but gets a copy, so it cannot change what is sent", () => {
    const input = { org_id: "acme", body: { categories: [{ category: "security" }] } };
    const note = resolveConfirmNote(
      {
        confirmNote: (i) => {
          (i.body as { categories: unknown[] }).categories.length = 0;
          i.org_id = "other";
          return "Sets the gate of org acme.";
        },
      },
      input,
    );
    expect(note).toBe("Sets the gate of org acme.");
    expect(input).toEqual({ org_id: "acme", body: { categories: [{ category: "security" }] } });
  });

  it("a note that throws or comes back blank is dropped, never failing the call", () => {
    const boom = () => {
      throw new Error("boom");
    };
    expect(resolveConfirmNote({ confirmNote: boom }, {})).toBeUndefined();
    expect(resolveConfirmNote({ confirmNote: () => "  " }, {})).toBeUndefined();
    expect(resolveConfirmNote({ confirmNote: () => undefined }, {})).toBeUndefined();
    expect(resolveConfirmNote({ confirmNote: "" }, {})).toBeUndefined();
  });
});
