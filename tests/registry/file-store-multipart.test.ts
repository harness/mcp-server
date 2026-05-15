import { describe, it, expect } from "vitest";
import { buildFileStoreMultipartBody } from "../../src/registry/toolsets/file-store.js";

describe("buildFileStoreMultipartBody", () => {
  it("builds FOLDER multipart without content", () => {
    const fd = buildFileStoreMultipartBody(
      {
        body: {
          name: "scripts",
          type: "FOLDER",
          parent_identifier: "Root",
        },
      },
      "create",
    );
    expect(fd.get("name")).toBe("scripts");
    expect(fd.get("type")).toBe("FOLDER");
    expect(fd.get("parentIdentifier")).toBe("Root");
  });

  it("throws when FILE create has no content", () => {
    expect(() =>
      buildFileStoreMultipartBody(
        {
          body: {
            name: "a.sh",
            type: "FILE",
            parent_identifier: "Root",
          },
        },
        "create",
      ),
    ).toThrow(/content/);
  });

  it("appends base64 file content for FILE create", () => {
    const fd = buildFileStoreMultipartBody(
      {
        body: {
          name: "hi.txt",
          type: "FILE",
          parent_identifier: "Root",
          content_base64: Buffer.from("hello").toString("base64"),
          mime_type: "text/plain",
          filename: "hi.txt",
        },
      },
      "create",
    );
    expect(fd.get("name")).toBe("hi.txt");
    expect(fd.get("type")).toBe("FILE");
    expect(fd.get("content")).toBeInstanceOf(Blob);
  });

  it("uses file_store_id from input for update identifier", () => {
    const fd = buildFileStoreMultipartBody(
      {
        file_store_id: "node123",
        body: {
          name: "renamed",
          type: "FOLDER",
          parent_identifier: "Root",
        },
      },
      "update",
    );
    expect(fd.get("identifier")).toBe("node123");
  });
});
