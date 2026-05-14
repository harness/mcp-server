import { Buffer } from "node:buffer";
import type { BodySchema, ToolsetDefinition, PreflightContext } from "../types.js";
import { fileStoreContentExtract, ngExtract, pageExtract } from "../extractors.js";

const fileStoreCreateSchema: BodySchema = {
  description: "File Store file or folder definition. parent_identifier defaults to Root when omitted.",
  fields: [
    { name: "name", type: "string", required: true, description: "Display name for the file or folder" },
    { name: "type", type: "string", required: true, description: "Item type: FILE or FOLDER" },
    { name: "parent_identifier", type: "string", required: false, description: "Parent folder identifier. Defaults to Root." },
    { name: "identifier", type: "string", required: false, description: "Optional explicit identifier for the file or folder" },
    { name: "content", type: "string", required: false, description: "Text content for FILE items" },
    { name: "content_base64", type: "string", required: false, description: "Base64-encoded content for binary FILE items" },
    { name: "file_name", type: "string", required: false, description: "Multipart filename to use for uploaded content" },
    { name: "description", type: "string", required: false, description: "Optional description" },
    { name: "tags", type: "object", required: false, description: "Tags as an object or Harness-supported tag string" },
    { name: "mime_type", type: "string", required: false, description: "MIME type for FILE content" },
    { name: "file_usage", type: "string", required: false, description: "Harness file usage value" },
    { name: "path", type: "string", required: false, description: "Optional path for the file or folder" },
  ],
};

const fileStoreUpdateSchema: BodySchema = {
  description: "File Store file or folder update. Missing name/type/parent_identifier are hydrated from existing metadata when possible.",
  fields: fileStoreCreateSchema.fields,
};

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function stringField(body: Record<string, unknown>, snakeKey: string, camelKey?: string): string | undefined {
  const value = body[snakeKey] ?? (camelKey ? body[camelKey] : undefined);
  return typeof value === "string" && value !== "" ? value : undefined;
}

function appendIfPresent(form: FormData, field: string, value: unknown): void {
  if (value === undefined || value === null || value === "") return;
  if (typeof value === "string") {
    form.append(field, value);
    return;
  }
  form.append(field, JSON.stringify(value));
}

function buildFileStoreFormData(input: Record<string, unknown>): FormData {
  const body = asRecord(input.body);
  if (!body) {
    throw new Error("File Store create/update requires body to be an object.");
  }

  const name = stringField(body, "name");
  const type = stringField(body, "type")?.toUpperCase();
  if (!name) throw new Error("File Store body.name is required.");
  if (type !== "FILE" && type !== "FOLDER") {
    throw new Error("File Store body.type is required and must be FILE or FOLDER.");
  }

  const mimeType = stringField(body, "mime_type", "mimeType") ?? "text/plain";
  const parentIdentifier = stringField(body, "parent_identifier", "parentIdentifier") ?? "Root";
  const form = new FormData();

  form.append("name", name);
  form.append("type", type);
  form.append("parentIdentifier", parentIdentifier);

  appendIfPresent(form, "identifier", stringField(body, "identifier"));
  appendIfPresent(form, "description", stringField(body, "description"));
  appendIfPresent(form, "fileUsage", stringField(body, "file_usage", "fileUsage"));
  appendIfPresent(form, "mimeType", mimeType);
  appendIfPresent(form, "path", stringField(body, "path"));
  appendIfPresent(form, "tags", body.tags);

  const content = body.content;
  const contentBase64 = stringField(body, "content_base64", "contentBase64");
  if (type === "FILE" && (typeof content === "string" || contentBase64)) {
    const fileName = stringField(body, "file_name", "fileName") ?? name;
    const blob = contentBase64
      ? new Blob([Buffer.from(contentBase64, "base64")], { type: mimeType })
      : new Blob([content as string], { type: mimeType });
    form.append("content", blob, fileName);
  }

  return form;
}

async function hydrateFileStoreUpdate(ctx: PreflightContext): Promise<void> {
  const body = asRecord(ctx.input.body);
  if (!body || !ctx.input.file_id) return;
  const needsMetadata = !stringField(body, "name")
    || !stringField(body, "type")
    || !stringField(body, "parent_identifier", "parentIdentifier");
  if (!needsMetadata) return;

  const metadata = await ctx.registry.dispatch(
    ctx.client,
    "file_store_item",
    "get",
    { ...ctx.input },
    ctx.signal,
  );
  const item = asRecord(metadata);
  if (!item) return;

  if (!stringField(body, "name") && typeof item.name === "string") body.name = item.name;
  if (!stringField(body, "type") && typeof item.type === "string") body.type = item.type;
  if (!stringField(body, "parent_identifier", "parentIdentifier") && typeof item.parentIdentifier === "string") {
    body.parent_identifier = item.parentIdentifier;
  }
}

export const fileStoreToolset: ToolsetDefinition = {
  name: "file-store",
  displayName: "File Store",
  description: "Harness File Store files and folders",
  resources: [
    {
      resourceType: "file_store_item",
      displayName: "File Store Item",
      description: "Harness File Store file or folder metadata. Supports listing, metadata lookup, create, and update.",
      toolset: "file-store",
      scope: "project",
      supportedScopes: ["account", "org", "project"],
      identifierFields: ["file_id"],
      listFilterFields: [
        { name: "search_term", description: "Filter files or folders by name or identifier" },
        { name: "identifiers", description: "Specific File Store identifiers to fetch (array or repeated query values)" },
        { name: "sort_orders", description: "Sort criteria for File Store results" },
        { name: "page_token", description: "Page token for fetching the next page" },
      ],
      operations: {
        list: {
          method: "GET",
          path: "/ng/api/file-store",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            identifiers: "identifiers",
            search_term: "searchTerm",
            page: "pageIndex",
            size: "pageSize",
            sort_orders: "sortOrders",
            page_token: "pageToken",
          },
          responseExtractor: pageExtract,
          description: "List File Store files and folders metadata",
        },
        get: {
          method: "GET",
          path: "/ng/api/file-store/{identifier}",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { file_id: "identifier" },
          responseExtractor: ngExtract,
          description: "Get File Store file or folder metadata",
        },
        create: {
          method: "POST",
          path: "/ng/api/file-store",
          operationPolicy: { risk: "medium_write", retryPolicy: "do_not_retry" },
          bodyBuilder: buildFileStoreFormData,
          responseExtractor: ngExtract,
          description: "Create a File Store folder or file. For files, pass body.content or body.content_base64.",
          bodySchema: fileStoreCreateSchema,
        },
        update: {
          method: "PUT",
          path: "/ng/api/file-store/{identifier}",
          operationPolicy: { risk: "medium_write", retryPolicy: "do_not_retry" },
          pathParams: { file_id: "identifier" },
          preflight: hydrateFileStoreUpdate,
          bodyBuilder: buildFileStoreFormData,
          responseExtractor: ngExtract,
          description: "Update an existing File Store folder or file, including file content.",
          bodySchema: fileStoreUpdateSchema,
        },
      },
    },
    {
      resourceType: "file_store_content",
      displayName: "File Store Content",
      description: "Download and read content for an existing Harness File Store file.",
      toolset: "file-store",
      scope: "project",
      supportedScopes: ["account", "org", "project"],
      identifierFields: ["file_id"],
      operations: {
        get: {
          method: "GET",
          path: "/ng/api/file-store/files/{identifier}/download",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { file_id: "identifier" },
          responseType: "buffer",
          responseExtractor: fileStoreContentExtract,
          description: "Read File Store file content by identifier. Text is returned inline; binary or large content is guarded.",
        },
      },
    },
  ],
};
