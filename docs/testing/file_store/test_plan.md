# Test Plan: File Store (`file_store`)

| Field | Value |
|-------|-------|
| **Resource Type** | `file_store` |
| **Display Name** | File Store |
| **Toolset** | file_store |
| **Scope** | project by default; supports account, org, and project via `resource_scope` |
| **Operations** | list, get, create, update, delete |
| **Execute Actions** | list_children |
| **Identifier Fields** | file_store_id |
| **Filter Fields** | identifiers |
| **Deep Link** | URL parsing supported for `/settings/file-store` paths |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-fs-001 | List | List File Store nodes with default project scope | `harness_list(resource_type="file_store")` | Returns paginated file/folder metadata |
| TC-fs-002 | List | List File Store nodes at account scope | `harness_list(resource_type="file_store", resource_scope="account")` | Dispatch omits org/project scope params and returns account-level nodes |
| TC-fs-003 | List | List with search term | `harness_list(resource_type="file_store", search_term="deploy")` | Sends `searchTerm=deploy` and returns matching nodes |
| TC-fs-004 | List | List by identifiers | `harness_list(resource_type="file_store", filters={identifiers: ["deploy_script", "scripts_folder"]})` | Sends repeated `identifiers=` query params and returns matching nodes |
| TC-fs-005 | Get | Get node metadata by generic resource id | `harness_get(resource_type="file_store", resource_id="deploy_script")` | Calls `/ng/api/file-store/deploy_script` and returns node metadata |
| TC-fs-006 | Get | Get node metadata from a File Store URL | `harness_get(url="https://app.harness.io/ng/account/acct/all/settings/file-store/deploy_script")` | Derives `resource_type`, `resource_id`, and account scope from the URL |
| TC-fs-007 | Create | Create a folder at scope root | `harness_create(resource_type="file_store", body={name: "scripts", type: "FOLDER", parent_identifier: "Root"})` | Converts body to multipart form data without content and creates a folder |
| TC-fs-008 | Create | Create a text file | `harness_create(resource_type="file_store", body={name: "deploy.sh", type: "FILE", parent_identifier: "Root", content: "#!/usr/bin/env bash\n./deploy", file_usage: "SCRIPT", mime_type: "text/x-shellscript"})` | Converts body to multipart form data with a file content part |
| TC-fs-009 | Create | Create a binary file from base64 | `harness_create(resource_type="file_store", body={name: "config.bin", type: "FILE", parent_identifier: "Root", content_base64: "<valid_base64>", filename: "config.bin", file_usage: "CONFIG"})` | Decodes valid base64 and uploads it as the multipart content part |
| TC-fs-010 | Create | Reject file create without content | `harness_create(resource_type="file_store", body={name: "empty.txt", type: "FILE", parent_identifier: "Root"})` | Returns preflight error because `FILE` create requires `content` or `content_base64` |
| TC-fs-011 | Create | Reject folder with content | `harness_create(resource_type="file_store", body={name: "scripts", type: "FOLDER", parent_identifier: "Root", content: "unexpected"})` | Returns preflight error because folders must omit content fields |
| TC-fs-012 | Create | Reject invalid file usage | `harness_create(resource_type="file_store", body={name: "bad.txt", type: "FILE", parent_identifier: "Root", content: "hello", file_usage: "OTHER"})` | Returns preflight error; allowed values are `MANIFEST_FILE`, `CONFIG`, and `SCRIPT` |
| TC-fs-013 | Create | Reject conflicting content inputs | `harness_create(resource_type="file_store", body={name: "bad.txt", type: "FILE", parent_identifier: "Root", content: "hello", content_base64: "aGVsbG8="})` | Returns preflight error because only one content source is allowed |
| TC-fs-014 | Update | Update folder metadata | `harness_update(resource_type="file_store", resource_id="scripts_folder", body={name: "scripts-prod", type: "FOLDER", parent_identifier: "Root"})` | Calls `/ng/api/file-store/scripts_folder` with multipart form data |
| TC-fs-015 | Update | Update file metadata without replacing content | `harness_update(resource_type="file_store", resource_id="deploy_script", body={name: "deploy-prod.sh", type: "FILE", parent_identifier: "Root"})` | Updates metadata and does not require a content field |
| TC-fs-016 | Update | Replace file content | `harness_update(resource_type="file_store", resource_id="deploy_script", body={name: "deploy.sh", type: "FILE", parent_identifier: "Root", content: "new contents"})` | Uploads replacement content in multipart form data |
| TC-fs-017 | Update | Reject conflicting update identifiers | `harness_update(resource_type="file_store", resource_id="deploy_script", body={identifier: "other_id", name: "deploy.sh", type: "FILE", parent_identifier: "Root"})` | Returns preflight error because body identifier must match the path id |
| TC-fs-018 | Delete | Delete a File Store node | `harness_delete(resource_type="file_store", resource_id="old_script")` | Requires destructive confirmation and deletes `/ng/api/file-store/old_script` |
| TC-fs-019 | Delete | Force delete a File Store node | `harness_delete(resource_type="file_store", resource_id="old_script", params={force_delete: true})` | Sends `forceDelete=true` and requires destructive confirmation |
| TC-fs-020 | Execute | List folder children with shorthand | `harness_execute(resource_type="file_store", action="list_children", resource_id="scripts_folder", params={folder_name: "scripts"})` | Sends a FileStoreNode body with `type: "FOLDER"` and returns first-level children |
| TC-fs-021 | Execute | List folder children with full FileStoreNode body | `harness_execute(resource_type="file_store", action="list_children", body={identifier: "scripts_folder", name: "scripts", type: "FOLDER", parentIdentifier: "Root"})` | Sends the provided body to `/ng/api/file-store/folder` |
| TC-fs-022 | Execute | Filter child listing by file usage | `harness_execute(resource_type="file_store", action="list_children", resource_id="scripts_folder", params={folder_name: "scripts", file_usage: "SCRIPT"})` | Sends `fileUsage=SCRIPT` query and returns matching child nodes |
| TC-fs-023 | Execute | Reject child listing for a file node | `harness_execute(resource_type="file_store", action="list_children", body={identifier: "deploy_script", name: "deploy.sh", type: "FILE"})` | Returns preflight error because `list_children` requires `type: "FOLDER"` |
| TC-fs-024 | Execute | Reject full body with snake_case parent field | `harness_execute(resource_type="file_store", action="list_children", body={identifier: "scripts_folder", name: "scripts", type: "FOLDER", parent_identifier: "Root"})` | Returns preflight error; full FileStoreNode body uses `parentIdentifier` |
| TC-fs-025 | Safety | Redact upload content from create confirmation | `harness_create(resource_type="file_store", body={name: "secret.sh", type: "FILE", parent_identifier: "Root", content: "sensitive"})` | Confirmation prompt contains a redacted byte count, not raw content |
| TC-fs-026 | Safety | Redact upload content from update confirmation | `harness_update(resource_type="file_store", resource_id="secret_script", body={name: "secret.sh", type: "FILE", parent_identifier: "Root", content_base64: "<valid_base64>"})` | Confirmation prompt contains a redacted byte count, not raw base64 |
| TC-fs-027 | Read-only | Allow `list_children` in read-only mode | `HARNESS_READ_ONLY=true harness_execute(resource_type="file_store", action="list_children", resource_id="scripts_folder", params={folder_name: "scripts"})` | Execute action is allowed because its operation policy is read-risk |
| TC-fs-028 | Describe | Verify body and params metadata | `harness_describe(resource_type="file_store")` | Describes supported scopes, create/update body schemas, and `list_children` shorthand parameters |

## Notes

- File Store list/get use `/ng/api/file-store`; create/update convert caller JSON into `multipart/form-data` for the same API family.
- `filters.identifiers` must be an array so the client emits repeated `identifiers=` query params. `search_term` and pagination (`page`, `size`, `page_token`) are generic `harness_list` inputs, not File Store-specific filter metadata.
- Create and update require `body.name`, `body.type`, and `body.parent_identifier`. Use the literal `"Root"` only for the root of the selected account/org/project scope.
- `FILE` create requires exactly one of `body.content` or `body.content_base64`. `FILE` update can omit content for metadata-only updates; if replacing content, provide exactly one content field.
- `FOLDER` create/update must not include `body.content` or `body.content_base64`.
- `body.content` must be a UTF-8 string. `body.content_base64` must be valid non-empty base64. Upload content is capped at 100 MB.
- Optional `file_usage` accepts only `MANIFEST_FILE`, `CONFIG`, or `SCRIPT`.
- `list_children` is a read-risk execute action and is allowed in read-only mode. It accepts shorthand folder identifiers plus `params.folder_name`, or a full FileStoreNode body with `identifier`, `name`, `type: "FOLDER"`, and optional `parentIdentifier`.
- Full `list_children` bodies use Harness camelCase `parentIdentifier`; shorthand accepts `params.parent_identifier` for expansion.
- Create/update/delete require confirmation unless the caller explicitly confirms or the deployment auto-approval policy permits the operation. Confirmation previews redact upload content fields (`content`, `content_base64`, `contentBase64`) before elicitation.
