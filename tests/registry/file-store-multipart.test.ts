import { describe, it, expect } from "vitest";
import { buildFileStoreMultipartBody, buildFolderNodesBody } from "../../src/registry/toolsets/file-store.js";

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

  it("requires an explicit parent identifier on create", () => {
    expect(() =>
      buildFileStoreMultipartBody(
        {
          body: {
            name: "scripts",
            type: "FOLDER",
          },
        },
        "create",
      ),
    ).toThrow(/parent_identifier/);
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

  it("rejects malformed base64 content", () => {
    expect(() =>
      buildFileStoreMultipartBody(
        {
          body: {
            name: "bad.bin",
            type: "FILE",
            parent_identifier: "Root",
            content_base64: "not-base64",
          },
        },
        "create",
      ),
    ).toThrow(/valid base64/);
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

  it("requires an explicit parent identifier on update", () => {
    expect(() =>
      buildFileStoreMultipartBody(
        {
          file_store_id: "node123",
          body: {
            name: "renamed",
            type: "FOLDER",
          },
        },
        "update",
      ),
    ).toThrow(/parent_identifier/);
  });

  it("rejects oversized base64 content", () => {
    const hugeBase64 = "A".repeat(140_000_000);
    expect(() =>
      buildFileStoreMultipartBody(
        {
          body: {
            name: "big.bin",
            type: "FILE",
            parent_identifier: "Root",
            content_base64: hugeBase64,
          },
        },
        "create",
      ),
    ).toThrow(/exceeds maximum size/);
  });

  it("rejects oversized text content", () => {
    const hugeText = "x".repeat(101_000_000);
    expect(() =>
      buildFileStoreMultipartBody(
        {
          body: {
            name: "big.txt",
            type: "FILE",
            parent_identifier: "Root",
            content: hugeText,
          },
        },
        "create",
      ),
    ).toThrow(/exceeds maximum size/);
  });

  it("rejects non-string text content", () => {
    expect(() =>
      buildFileStoreMultipartBody(
        {
          body: {
            name: "bad.txt",
            type: "FILE",
            parent_identifier: "Root",
            content: { foo: "bar" },
          },
        },
        "create",
      ),
    ).toThrow(/body\.content must be a string/);
  });
});

describe("buildFolderNodesBody", () => {
  it("passes through a full body object", () => {
    const body = { identifier: "f1", name: "scripts", type: "FOLDER" };
    const result = buildFolderNodesBody({ body });
    expect(result).toBe(body);
  });

  it("rejects a full body with an invalid node type", () => {
    expect(() => buildFolderNodesBody({
      body: { identifier: "f1", name: "scripts", type: "BOGUS" },
    })).toThrow(/body\.type must be 'FILE' or 'FOLDER'/);
  });

  it("builds node from shorthand folder_identifier + folder_name", () => {
    const result = buildFolderNodesBody({ folder_identifier: "f1", folder_name: "scripts" }) as Record<string, unknown>;
    expect(result.identifier).toBe("f1");
    expect(result.name).toBe("scripts");
    expect(result.type).toBe("FOLDER");
  });

  it("builds node from generic file_store_id mapping + folder_name", () => {
    const result = buildFolderNodesBody({ file_store_id: "f1", folder_name: "scripts" }) as Record<string, unknown>;
    expect(result.identifier).toBe("f1");
    expect(result.name).toBe("scripts");
    expect(result.type).toBe("FOLDER");
  });

  it("builds node from resource_id fallback + folder_name", () => {
    const result = buildFolderNodesBody({ resource_id: "f1", folder_name: "scripts" }) as Record<string, unknown>;
    expect(result.identifier).toBe("f1");
    expect(result.name).toBe("scripts");
    expect(result.type).toBe("FOLDER");
  });

  it("includes parent_identifier when provided", () => {
    const result = buildFolderNodesBody({
      folder_identifier: "f1",
      folder_name: "scripts",
      parent_identifier: "Root",
    }) as Record<string, unknown>;
    expect(result.parentIdentifier).toBe("Root");
  });

  it("rejects shorthand with an invalid node_type", () => {
    expect(() => buildFolderNodesBody({
      folder_identifier: "f1",
      folder_name: "scripts",
      node_type: "BOGUS",
    })).toThrow(/node_type must be 'FILE' or 'FOLDER'/);
  });

  it("throws when required shorthand fields are missing", () => {
    expect(() => buildFolderNodesBody({ folder_identifier: "f1" })).toThrow(/folder_identifier/);
  });
});
