import { describe, it, expect } from "vitest";
import { buildFileStoreMultipartBody, buildFolderNodesBody, fileStoreToolset } from "../../src/registry/toolsets/file-store.js";

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

  it("rejects FOLDER multipart with text content", () => {
    expect(() =>
      buildFileStoreMultipartBody(
        {
          body: {
            name: "scripts",
            type: "FOLDER",
            parent_identifier: "Root",
            content: "unexpected",
          },
        },
        "create",
      ),
    ).toThrow(/FOLDER; omit body\.content and body\.content_base64/);
  });

  it("rejects FOLDER multipart with base64 content", () => {
    expect(() =>
      buildFileStoreMultipartBody(
        {
          body: {
            name: "scripts",
            type: "FOLDER",
            parent_identifier: "Root",
            content_base64: Buffer.from("unexpected").toString("base64"),
          },
        },
        "create",
      ),
    ).toThrow(/FOLDER; omit body\.content and body\.content_base64/);
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

  it("rejects update when file_store_id conflicts with body.identifier", () => {
    expect(() =>
      buildFileStoreMultipartBody(
        {
          file_store_id: "node123",
          body: {
            identifier: "node456",
            name: "renamed",
            type: "FOLDER",
            parent_identifier: "Root",
          },
        },
        "update",
      ),
    ).toThrow(/resource_id\/file_store_id must match body\.identifier/);
  });

  it("rejects conflicting body identifier aliases", () => {
    expect(() =>
      buildFileStoreMultipartBody(
        {
          body: {
            identifier: "node123",
            file_store_id: "node456",
            name: "renamed",
            type: "FOLDER",
            parent_identifier: "Root",
          },
        },
        "create",
      ),
    ).toThrow(/body\.identifier must match body\.file_store_id/);
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

  it("rejects non-string scalar metadata", () => {
    expect(() =>
      buildFileStoreMultipartBody(
        {
          body: {
            name: "bad.txt",
            type: "FILE",
            parent_identifier: "Root",
            content: "hello",
            description: { foo: "bar" },
          },
        },
        "create",
      ),
    ).toThrow(/body\.description must be a string/);
  });

  it("rejects invalid file_usage enum values", () => {
    expect(() =>
      buildFileStoreMultipartBody(
        {
          body: {
            name: "bad.txt",
            type: "FILE",
            parent_identifier: "Root",
            content: "hello",
            file_usage: "NOT_A_REAL_USAGE",
          },
        },
        "create",
      ),
    ).toThrow(/body\.file_usage must be MANIFEST_FILE, CONFIG, or SCRIPT/);
  });

  it("accepts documented file_usage enum values", () => {
    const fd = buildFileStoreMultipartBody(
      {
        body: {
          name: "ok.txt",
          type: "FILE",
          parent_identifier: "Root",
          content: "hello",
          file_usage: "SCRIPT",
        },
      },
      "create",
    );

    expect(fd.get("fileUsage")).toBe("SCRIPT");
  });

  it("rejects non-string tags instead of JSON-stringifying them", () => {
    expect(() =>
      buildFileStoreMultipartBody(
        {
          body: {
            name: "bad.txt",
            type: "FILE",
            parent_identifier: "Root",
            content: "hello",
            tags: { env: "dev" },
          },
        },
        "create",
      ),
    ).toThrow(/body\.tags must be a string/);
  });

  it("rejects dual file content inputs", () => {
    expect(() =>
      buildFileStoreMultipartBody(
        {
          body: {
            name: "bad.txt",
            type: "FILE",
            parent_identifier: "Root",
            content: "hello",
            content_base64: Buffer.from("hello").toString("base64"),
          },
        },
        "create",
      ),
    ).toThrow(/either body\.content or body\.content_base64/);
  });

  it("rejects non-string base64 content", () => {
    expect(() =>
      buildFileStoreMultipartBody(
        {
          body: {
            name: "bad.bin",
            type: "FILE",
            parent_identifier: "Root",
            content_base64: { encoded: true },
          },
        },
        "create",
      ),
    ).toThrow(/body\.content_base64 must be a string/);
  });
});

describe("buildFolderNodesBody", () => {
  it("passes through a full body object", () => {
    const body = { identifier: "f1", name: "scripts", type: "FOLDER" };
    const result = buildFolderNodesBody({ body });
    expect(result).toBe(body);
  });

  it("passes through a full body object when resource_id matches body.identifier", () => {
    const body = { identifier: "f1", name: "scripts", type: "FOLDER" };
    const result = buildFolderNodesBody({ resource_id: "f1", body });
    expect(result).toBe(body);
  });

  it("rejects a full body object when resource_id conflicts with body.identifier", () => {
    expect(() => buildFolderNodesBody({
      resource_id: "folder-a",
      body: { identifier: "folder-b", name: "scripts", type: "FOLDER" },
    })).toThrow(/resource_id\/file_store_id must match body\.identifier/);
  });

  it("rejects a full body object with a non-string identifier", () => {
    expect(() => buildFolderNodesBody({
      body: { identifier: 123, name: "scripts", type: "FOLDER" },
    })).toThrow(/body\.identifier must be a string/);
  });

  it("rejects a full body object with a non-string name", () => {
    expect(() => buildFolderNodesBody({
      body: { identifier: "f1", name: true, type: "FOLDER" },
    })).toThrow(/body\.name must be a string/);
  });

  it("rejects a full body with an invalid node type", () => {
    expect(() => buildFolderNodesBody({
      body: { identifier: "f1", name: "scripts", type: "BOGUS" },
    })).toThrow(/body\.type must be 'FOLDER'/);
  });

  it("rejects a full body with FILE node type", () => {
    expect(() => buildFolderNodesBody({
      body: { identifier: "f1", name: "scripts.sh", type: "FILE" },
    })).toThrow(/body\.type must be 'FOLDER'/);
  });

  it("rejects full body snake_case parent_identifier", () => {
    expect(() => buildFolderNodesBody({
      body: { identifier: "f1", name: "scripts", type: "FOLDER", parent_identifier: "Root" },
    })).toThrow(/use body\.parentIdentifier, not body\.parent_identifier/);
  });

  it("rejects full body non-string parentIdentifier", () => {
    expect(() => buildFolderNodesBody({
      body: { identifier: "f1", name: "scripts", type: "FOLDER", parentIdentifier: 123 },
    })).toThrow(/body\.parentIdentifier must be a string/);
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

  it("accepts matching generic and resource-specific folder identifiers", () => {
    const result = buildFolderNodesBody({
      resource_id: "f1",
      file_store_id: "f1",
      folder_identifier: "f1",
      folder_name: "scripts",
    }) as Record<string, unknown>;
    expect(result.identifier).toBe("f1");
  });

  it("rejects conflicting folder identifiers", () => {
    expect(() => buildFolderNodesBody({
      resource_id: "folder-a",
      file_store_id: "folder-a",
      folder_identifier: "folder-b",
      folder_name: "scripts",
    })).toThrow(/Conflicting folder identifiers/);
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
    })).toThrow(/node_type must be 'FOLDER'/);
  });

  it("rejects invalid file_usage query values before dispatch", () => {
    expect(() => buildFolderNodesBody({
      folder_identifier: "f1",
      folder_name: "scripts",
      file_usage: "NOT_A_REAL_USAGE",
    })).toThrow(/params\.file_usage must be MANIFEST_FILE, CONFIG, or SCRIPT/);
  });

  it("accepts documented file_usage query values", () => {
    const result = buildFolderNodesBody({
      folder_identifier: "f1",
      folder_name: "scripts",
      file_usage: "CONFIG",
    }) as Record<string, unknown>;

    expect(result.identifier).toBe("f1");
  });

  it("rejects shorthand with FILE node_type", () => {
    expect(() => buildFolderNodesBody({
      folder_identifier: "f1",
      folder_name: "scripts.sh",
      node_type: "FILE",
    })).toThrow(/node_type must be 'FOLDER'/);
  });

  it("throws when required shorthand fields are missing", () => {
    expect(() => buildFolderNodesBody({ folder_identifier: "f1" })).toThrow(/folder_identifier/);
  });
});

describe("file_store bodySchema metadata", () => {
  const fileStoreResource = fileStoreToolset.resources[0];

  it("documents the FILE create content one-of requirement", () => {
    const schema = fileStoreResource.operations.create?.bodySchema;
    expect(schema?.description).toContain("For FILE create: provide exactly one of content");
    expect(schema?.fields.find((field) => field.name === "content")?.description).toContain("Required for FILE create unless content_base64 is provided");
    expect(schema?.fields.find((field) => field.name === "content_base64")?.description).toContain("Required for FILE create unless content is provided");
  });

  it("documents metadata-only FILE updates separately from create", () => {
    const schema = fileStoreResource.operations.update?.bodySchema;
    expect(schema?.description).toContain("optional for metadata-only updates");
    expect(schema?.description).toContain("Pass top-level resource_id");
    const identifierDescription = schema?.fields.find((field) => field.name === "identifier")?.description ?? "";
    expect(identifierDescription).toContain("must match top-level resource_id");
    expect(identifierDescription).not.toContain("fallback");
  });
});
