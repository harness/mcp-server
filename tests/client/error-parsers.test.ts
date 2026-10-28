import { describe, it, expect } from "vitest";
import {
  ERROR_PARSERS,
  fmeUnprocessableEntityParser,
  runErrorParsers,
  type ErrorParser,
} from "../../src/client/error-parsers.js";

const fme422 = { path: "/fme/api/v4/feature-flags", status: 422 };

describe("fmeUnprocessableEntityParser.match", () => {
  it("matches 422 on /fme/ paths", () => {
    expect(fmeUnprocessableEntityParser.match(fme422)).toBe(true);
  });
  it.each([400, 401, 403, 404, 409, 429, 500, 503])("does not match status %i", (status) => {
    expect(fmeUnprocessableEntityParser.match({ path: "/fme/api/v4/feature-flags", status })).toBe(false);
  });
  it.each(["/ng/api/connectors", "/pipeline/api/pipelines", "/gateway/fme", "fme/api"])(
    "does not match path %s",
    (path) => {
      expect(fmeUnprocessableEntityParser.match({ path, status: 422 })).toBe(false);
    },
  );
});

describe("fmeUnprocessableEntityParser.parse", () => {
  const parse = (body: Record<string, unknown>) => fmeUnprocessableEntityParser.parse(body, fme422);

  it("returns message from detail and policy lines from errors[]", () => {
    expect(parse({
      title: "Governance Policy Violation",
      detail: "Governance error",
      errors: [{ title: "Policy", detail: "denied" }],
    })).toEqual({ message: "Governance error", detail: "Policy: denied" });
  });

  it("joins multiple entries with '; '", () => {
    expect(parse({ detail: "d", errors: [{ title: "A", detail: "a" }, { title: "B", detail: "b" }] })?.detail)
      .toBe("A: a; B: b");
  });

  it("prefers message, then detail, then title", () => {
    expect(parse({ message: "m", detail: "d", title: "t" })?.message).toBe("m");
    expect(parse({ detail: "d", title: "t" })?.message).toBe("d");
    expect(parse({ detail: " ", title: "t" })?.message).toBe("t");
  });

  it("handles title-only, detail-only, message-field and string entries", () => {
    expect(parse({ detail: "d", errors: [{ title: "T" }, { detail: "D" }, { message: "M" }, "S"] })?.detail)
      .toBe("T; D; M; S");
  });

  it("collapses entries whose title equals detail", () => {
    expect(parse({ detail: "d", errors: [{ title: "Same", detail: "Same" }] })?.detail).toBe("Same");
  });

  it("skips blank, empty and non-object entries", () => {
    expect(parse({ detail: "d", errors: [{}, { title: " " }, "  ", null, 7] })).toEqual({
      message: "d",
      detail: undefined,
    });
  });

  it("ignores errors when not an array", () => {
    expect(parse({ detail: "d", errors: { title: "x" } })).toEqual({ message: "d", detail: undefined });
  });

  it("returns undefined when there is nothing usable", () => {
    expect(parse({})).toBeUndefined();
    expect(parse({ errors: [] })).toBeUndefined();
    expect(parse({ detail: 5, title: null })).toBeUndefined();
  });

  it("returns only detail when there is no message-like field but errors exist", () => {
    expect(parse({ errors: [{ title: "P", detail: "D" }] })).toEqual({ message: undefined, detail: "P: D" });
  });

  it("caps oversized policy text at 2000 chars plus an ellipsis", () => {
    const detail = parse({ detail: "d", errors: [{ title: "P", detail: "y".repeat(5000) }] })?.detail ?? "";
    expect(detail.length).toBe(2001);
    expect(detail.endsWith("…")).toBe(true);
  });
});

describe("runErrorParsers", () => {
  const body = { detail: "d", errors: [{ title: "P", detail: "D" }] };

  it("uses the FME parser from the default registry", () => {
    expect(ERROR_PARSERS).toContain(fmeUnprocessableEntityParser);
    expect(runErrorParsers(body, fme422)).toEqual({ message: "d", detail: "P: D" });
  });

  it("returns undefined when no parser matches", () => {
    expect(runErrorParsers(body, { path: "/ng/api/x", status: 422 })).toBeUndefined();
    expect(runErrorParsers(body, { path: "/fme/api/x", status: 400 })).toBeUndefined();
  });

  it("returns undefined when the matching parser yields nothing", () => {
    expect(runErrorParsers({}, fme422)).toBeUndefined();
  });

  it("picks the first matching parser that returns a result", () => {
    const skip: ErrorParser = { name: "skip", match: () => true, parse: () => undefined };
    const first: ErrorParser = { name: "first", match: () => true, parse: () => ({ message: "first" }) };
    const second: ErrorParser = { name: "second", match: () => true, parse: () => ({ message: "second" }) };
    expect(runErrorParsers({}, fme422, [skip, first, second])).toEqual({ message: "first" });
  });

  it("does not call parse on parsers that do not match", () => {
    let called = false;
    const p: ErrorParser = { name: "p", match: () => false, parse: () => { called = true; return { message: "x" }; } };
    runErrorParsers({}, fme422, [p]);
    expect(called).toBe(false);
  });
});
