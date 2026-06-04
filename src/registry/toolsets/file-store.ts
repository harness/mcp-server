import { Buffer } from "node:buffer";
import type { ToolsetDefinition, BodySchema, ParamsSchema } from "../types.js";
import { ngExtract, pageExtract } from "../extractors.js";

// Matches server-side FileUploadLimit.fileStoreFileLimit (100 MB)
const MAX_FILE_BYTES = 100_000_000;

function appendPart(fd: FormData, key: string, value: unknown): void {
  if (value === undefined || value === null || value === "") return;
  if (typeof value === "boolean") {
    fd.append(key, value ? "true" : "false");
    return;
  }
  if (typeof value === "number" && !Number.isNaN(value)) {
    fd.append(key, String(value));
    return;
  }
  if (typeof value === "string") {
    fd.append(key, value);
    return;
  }
  fd.append(key, JSON.stringify(value));
}

function normalizeBase64Content(value: string): string {
  const normalized = value.replace(/\s+/g, "");
  if (normalized.length === 0) {
    throw new Error("body.content_base64 must not be empty.");
  }
  return normalized;
}

function isBase64Char(charCode: number): boolean {
  return (
    (charCode >= 65 && charCode <= 90) ||
    (charCode >= 97 && charCode <= 122) ||
    (charCode >= 48 && charCode <= 57) ||
    charCode === 43 ||
    charCode === 47
  );
}

function assertValidBase64Content(normalizedBase64: string): void {
  if (normalizedBase64.length % 4 !== 0) {
    throw new Error("body.content_base64 must be valid base64.");
  }

  let paddingStart = normalizedBase64.length;
  for (let i = 0; i < normalizedBase64.length; i += 1) {
    const charCode = normalizedBase64.charCodeAt(i);
    if (charCode === 61) {
      paddingStart = i;
      break;
    }
    if (!isBase64Char(charCode)) {
      throw new Error("body.content_base64 must be valid base64.");
    }
  }

  const paddingLength = normalizedBase64.length - paddingStart;
  if (paddingLength > 2) {
    throw new Error("body.content_base64 must be valid base64.");
  }
  for (let i = paddingStart; i < normalizedBase64.length; i += 1) {
    if (normalizedBase64.charCodeAt(i) !== 61) {
      throw new Error("body.content_base64 must be valid base64.");
    }
  }
}

function estimateBase64DecodedBytes(normalizedBase64: string): number {
  const paddingBytes = normalizedBase64.endsWith("==")
    ? 2
    : normalizedBase64.endsWith("=")
      ? 1
      : 0;
  return (normalizedBase64.length / 4) * 3 - paddingBytes;
}

/**
 * Harness POST/PUT /ng/api/file-store expects multipart/form-data (see API docs).
 * Pass a JSON `body` from harness_create / harness_update; this builder converts it to FormData.
 *
 * Required: name, type (FILE | FOLDER), parent_identifier (use "Root" for the scope root).
 * For FILE: pass content (UTF-8 string) and/or content_base64 (raw bytes), plus optional filename.
 */
export function buildFileStoreMultipartBody(
  input: Record<string, unknown>,
  mode: "create" | "update",
): FormData {
  const raw = input.body;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(
      mode === "create"
        ? "file_store create requires body as JSON: { name, type: 'FILE'|'FOLDER', parent_identifier (use 'Root' for root), optional identifier, file_usage, description, mime_type, path, tags; for FILE add content or content_base64 (+ optional filename)."
        : "file_store update requires body as JSON with the same shape as create (identifier comes from resource_id / file_store_id in the path).",
    );
  }
  const b = raw as Record<string, unknown>;
  const name = (b.name ?? b.Name) as unknown;
  const nodeType = (b.type ?? b.node_type ?? b.nodeType) as unknown;
  if (typeof name !== "string" || name === "") {
    throw new Error("body.name is required (string).");
  }
  if (nodeType !== "FILE" && nodeType !== "FOLDER") {
    throw new Error("body.type must be 'FILE' or 'FOLDER'.");
  }

  const parentIdentifier = (b.parent_identifier ?? b.parentIdentifier) as unknown;
  if (typeof parentIdentifier !== "string" || parentIdentifier === "") {
    throw new Error(
      mode === "update"
        ? "file_store update requires body.parent_identifier (use the existing parent node id; use 'Root' only when the current parent is the root)."
        : "body.parent_identifier is required (use 'Root' for the account/org/project root folder).",
    );
  }

  const fd = new FormData();
  appendPart(fd, "name", name);
  appendPart(fd, "type", nodeType);
  appendPart(fd, "parentIdentifier", parentIdentifier);

  const pathId =
    mode === "update"
      ? ((input.file_store_id as string | undefined) ?? (b.identifier as string | undefined) ?? (b.file_store_id as string | undefined))
      : ((b.identifier as string | undefined) ?? (b.file_store_id as string | undefined));

  if (mode === "update") {
    if (typeof pathId !== "string" || pathId === "") {
      throw new Error("file_store update requires resource_id (or body.identifier) as the existing node id.");
    }
    appendPart(fd, "identifier", pathId);
  } else if (typeof pathId === "string" && pathId !== "") {
    appendPart(fd, "identifier", pathId);
  }

  appendPart(fd, "fileUsage", b.file_usage ?? b.fileUsage);
  appendPart(fd, "description", b.description);
  appendPart(fd, "mimeType", b.mime_type ?? b.mimeType);
  appendPart(fd, "path", b.path);
  if (b.tags !== undefined && b.tags !== null && b.tags !== "") {
    appendPart(fd, "tags", typeof b.tags === "string" ? b.tags : JSON.stringify(b.tags));
  }

  if (nodeType === "FILE") {
    const mime =
      (typeof b.mime_type === "string" && b.mime_type) ||
      (typeof b.mimeType === "string" && b.mimeType) ||
      "application/octet-stream";
    const filename =
      (typeof b.filename === "string" && b.filename) ||
      (typeof b.file_name === "string" && b.file_name) ||
      name;
    if (typeof b.content_base64 === "string" && b.content_base64 !== "") {
      const normalizedBase64 = normalizeBase64Content(b.content_base64);
      const estimatedBytes = estimateBase64DecodedBytes(normalizedBase64);
      if (estimatedBytes > MAX_FILE_BYTES) {
        throw new Error(`File content exceeds maximum size of ${MAX_FILE_BYTES} bytes (estimated ${estimatedBytes} bytes from base64).`);
      }
      assertValidBase64Content(normalizedBase64);
      const buf = Buffer.from(normalizedBase64, "base64");
      if (buf.byteLength > MAX_FILE_BYTES) {
        throw new Error(`File content exceeds maximum size of ${MAX_FILE_BYTES} bytes.`);
      }
      fd.append("content", new Blob([buf], { type: mime }), filename);
    } else if (b.content !== undefined && b.content !== null) {
      const text = typeof b.content === "string" ? b.content : JSON.stringify(b.content);
      if (Buffer.byteLength(text) > MAX_FILE_BYTES) {
        throw new Error(`File content exceeds maximum size of ${MAX_FILE_BYTES} bytes.`);
      }
      fd.append("content", new Blob([text], { type: mime }), filename);
    } else if (mode === "create") {
      throw new Error(
        "body.type is FILE but neither body.content nor body.content_base64 was provided. Folders omit both.",
      );
    }
  }

  return fd;
}

function buildFileStoreCreateBody(input: Record<string, unknown>): unknown {
  return buildFileStoreMultipartBody(input, "create");
}

function buildFileStoreUpdateBody(input: Record<string, unknown>): unknown {
  return buildFileStoreMultipartBody(input, "update");
}

/**
 * POST /ng/api/file-store/folder expects a FileStoreNode-shaped JSON body.
 * Accept full `body` from the user, or shorthand folder id + folder_name.
 */
export function buildFolderNodesBody(input: Record<string, unknown>): unknown {
  const rawBody = input.body;
  if (rawBody !== undefined && typeof rawBody === "object" && rawBody !== null && !Array.isArray(rawBody)) {
    return rawBody;
  }
  const id = input.folder_identifier ?? input.identifier ?? input.file_store_id ?? input.resource_id;
  const name = input.folder_name ?? input.name;
  const nodeType = (input.node_type as string) || "FOLDER";
  if (typeof id !== "string" || id === "" || typeof name !== "string" || name === "") {
    throw new Error(
      "file_store.list_children requires `body` (FileStoreNode JSON per Harness API) or `resource_id`/`file_store_id`/`folder_identifier` plus `folder_name` (and optional `parent_identifier`, `node_type` FILE|FOLDER).",
    );
  }
  const node: Record<string, unknown> = {
    identifier: id,
    name,
    type: nodeType,
  };
  if (typeof input.parent_identifier === "string" && input.parent_identifier !== "") {
    node.parentIdentifier = input.parent_identifier;
  }
  return node;
}

const fileStoreWriteBodySchema: BodySchema = {
  description:
    "JSON consumed by the server and converted to multipart/form-data for Harness. Required: name, type (FILE|FOLDER), parent_identifier (string 'Root' for root). "
    + "For FILE: content (UTF-8 text) or content_base64; optional filename, mime_type, file_usage (MANIFEST_FILE|CONFIG|SCRIPT), description, path, tags. "
    + "For FOLDER: omit content fields. Optional identifier on create if you assign the id.",
  fields: [
    { name: "name", type: "string", required: true, description: "Display name of the file or folder" },
    { name: "type", type: "string", required: true, description: "FILE or FOLDER" },
    { name: "parent_identifier", type: "string", required: true, description: "Parent node id, or 'Root' for the root of the current scope" },
    { name: "identifier", type: "string", required: false, description: "Optional stable id on create" },
    { name: "content", type: "string", required: false, description: "File contents as UTF-8 text (FILE only)" },
    { name: "content_base64", type: "string", required: false, description: "File contents as base64 (FILE only)" },
    { name: "filename", type: "string", required: false, description: "Upload filename for the content part" },
    { name: "mime_type", type: "string", required: false, description: "MIME type (e.g. text/plain)" },
    { name: "file_usage", type: "string", required: false, description: "MANIFEST_FILE | CONFIG | SCRIPT" },
    { name: "description", type: "string", required: false, description: "Description" },
    { name: "path", type: "string", required: false, description: "Logical path if applicable" },
    { name: "tags", type: "string", required: false, description: "Tags string or JSON per Harness expectations" },
  ],
};

const folderListChildrenBodySchema: BodySchema = {
  description:
    "Full Harness FileStoreNode JSON sent directly to POST /ng/api/file-store/folder. Use top-level resource_id or params.file_store_id/folder_identifier plus params.folder_name instead when using shorthand.",
  fields: [
    { name: "identifier", type: "string", required: true, description: "Folder node identifier" },
    { name: "name", type: "string", required: true, description: "Folder node display name" },
    { name: "type", type: "string", required: true, description: "FILE or FOLDER" },
    { name: "parentIdentifier", type: "string", required: false, description: "Parent File Store node identifier" },
  ],
};

const folderListChildrenParamsSchema: ParamsSchema = {
  fields: [
    { name: "file_store_id", required: false, description: "Folder node identifier supplied by generic resource_id mapping. `harness_execute.resource_id` is also mapped here." },
    { name: "folder_identifier", required: false, description: "Folder node identifier when not using resource_id/file_store_id or a full body" },
    { name: "folder_name", required: false, description: "Folder node display name. Required with resource_id/file_store_id/folder_identifier shorthand." },
    { name: "parent_identifier", required: false, description: "Parent File Store node identifier for shorthand expansion" },
    { name: "node_type", required: false, description: "FILE or FOLDER for shorthand expansion (default FOLDER)" },
    { name: "file_usage", required: false, description: "Optional fileUsage query: MANIFEST_FILE, CONFIG, or SCRIPT" },
  ],
};

export const fileStoreToolset: ToolsetDefinition = {
  name: "file_store",
  displayName: "File Store",
  description:
    "Harness File Store — list/get metadata, upload files and create folders (multipart), update, delete, and list first-level folder children.",
  resources: [
    {
      resourceType: "file_store",
      displayName: "File Store",
      description:
        "File Store files and folders. List returns paginated metadata (type FILE|FOLDER per row). Create/update use multipart/form-data via harness_create / harness_update with a JSON body describing fields. "
        + "Use resource_scope=account|org|project to match where the store lives. Root folder parent is the literal string 'Root'. "
        + "Execute action list_children for POST /ng/api/file-store/folder (immediate children of a folder node).",
      toolset: "file_store",
      scope: "project",
      supportedScopes: ["account", "org", "project"],
      identifierFields: ["file_store_id"],
      searchAliases: ["harness file store", "filestore", "config file store", "manifest file store", "upload file store"],
      listFilterFields: [
        {
          name: "identifiers",
          description: "Optional list of File Store identifiers to fetch details for (repeatable query param)",
        },
      ],
      operations: {
        list: {
          method: "GET",
          path: "/ng/api/file-store",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            page: "pageIndex",
            size: "pageSize",
            search_term: "searchTerm",
            page_token: "pageToken",
            identifiers: "identifiers",
          },
          responseExtractor: pageExtract,
          description:
            "List File Store files and folders with pagination. Optional search_term and identifiers[] in filters.",
        },
        get: {
          method: "GET",
          path: "/ng/api/file-store/{identifier}",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { file_store_id: "identifier" },
          responseExtractor: ngExtract,
          description: "Get file or folder metadata by identifier",
        },
        create: {
          method: "POST",
          path: "/ng/api/file-store",
          operationPolicy: { risk: "medium_write", retryPolicy: "do_not_retry" },
          bodyBuilder: buildFileStoreCreateBody,
          skipScopeBodyInjection: true,
          responseExtractor: ngExtract,
          description:
            "Create a file (with content or content_base64) or an empty folder. JSON body is converted to multipart/form-data per Harness File Store API.",
          bodySchema: fileStoreWriteBodySchema,
        },
        update: {
          method: "PUT",
          path: "/ng/api/file-store/{identifier}",
          operationPolicy: { risk: "medium_write", retryPolicy: "do_not_retry" },
          pathParams: { file_store_id: "identifier" },
          bodyBuilder: buildFileStoreUpdateBody,
          skipScopeBodyInjection: true,
          responseExtractor: ngExtract,
          description:
            "Update file or folder metadata and optionally replace file content (multipart). Pass resource_id as the node identifier.",
          bodySchema: fileStoreWriteBodySchema,
        },
        delete: {
          method: "DELETE",
          path: "/ng/api/file-store/{identifier}",
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          pathParams: { file_store_id: "identifier" },
          queryParams: {
            force_delete: "forceDelete",
          },
          skipScopeBodyInjection: true,
          responseExtractor: ngExtract,
          description:
            "Delete a file or folder by identifier. Optional params.force_delete (boolean) to force delete without usage checks.",
        },
      },
      executeActions: {
        list_children: {
          method: "POST",
          path: "/ng/api/file-store/folder",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            file_usage: "fileUsage",
          },
          bodyBuilder: buildFolderNodesBody,
          skipScopeBodyInjection: true,
          responseExtractor: ngExtract,
          actionDescription:
            "First-level child nodes under a folder (POST /ng/api/file-store/folder). Pass resource_id plus folder_name, body as FileStoreNode, or folder_identifier + folder_name. Optional file_usage query: MANIFEST_FILE | CONFIG | SCRIPT.",
          paramsSchema: folderListChildrenParamsSchema,
          bodySchema: folderListChildrenBodySchema,
        },
      },
    },
  ],
};
