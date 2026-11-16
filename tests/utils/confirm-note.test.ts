import { describe, it, expect, vi } from "vitest";
import { resolveConfirmNote, withConfirmNote, withConfirmNoteFirst, resolveConfirmNoteAsync } from "../../src/utils/confirm-note.js";

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

describe("withConfirmNoteFirst", () => {
  it("puts the note between the title and the body, so a folded prompt still shows it", () => {
    expect(withConfirmNoteFirst("Create x?", "{\n}", "Note.")).toBe("Create x?\n\nNote.\n\n{\n}");
  });
  it("no note: title, blank line, body, as before", () => {
    expect(withConfirmNoteFirst("Create x?", "{\n}", undefined)).toBe("Create x?\n\n{\n}");
  });
});

describe("resolveConfirmNoteAsync", () => {
  const deps = { client: {} as never, registry: {} as never };
  const note = (i: Record<string, unknown>) => (i.name ? `For ${String(i.name)}` : "For it");

  it("no prefetch: same as resolveConfirmNote", async () => {
    expect(await resolveConfirmNoteAsync({ confirmNote: note }, { name: "a" }, deps)).toBe("For a");
    expect(await resolveConfirmNoteAsync(undefined, {}, deps)).toBeUndefined();
  });

  it("the prefetch fills a copy of the input; the caller's input is left alone", async () => {
    const input: Record<string, unknown> = {};
    const confirmPrefetch = async (ctx: { input: Record<string, unknown> }) => {
      ctx.input.name = "found";
    };
    expect(await resolveConfirmNoteAsync({ confirmNote: note, confirmPrefetch }, input, deps)).toBe("For found");
    expect(input).toEqual({});
  });

  it("a failing prefetch only drops what it would have added", async () => {
    const confirmPrefetch = async () => {
      throw new Error("boom");
    };
    expect(await resolveConfirmNoteAsync({ confirmNote: note, confirmPrefetch }, {}, deps)).toBe("For it");
  });

  it("a prefetch that hangs is dropped after 3s", async () => {
    vi.useFakeTimers();
    try {
      const confirmPrefetch = () => new Promise<void>(() => {});
      const pending = resolveConfirmNoteAsync({ confirmNote: note, confirmPrefetch }, {}, deps);
      await vi.advanceTimersByTimeAsync(3_000);
      expect(await pending).toBe("For it");
    } finally {
      vi.useRealTimers();
    }
  });
});
