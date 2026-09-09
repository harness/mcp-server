## Status update (2026-09-08): fixed in mcp-server, and the same bug found+fixed in the CLI

Fixed in this session, in `mcp-server`:
- `src/registry/toolsets/access-control.ts`: `service_account` create now sets
  `injectAccountInBody: true` (NG's API 400'd on an empty `accountIdentifier`
  in the body — it's only auto-injected into query params by default).
- `src/registry/toolsets/autonomous_work.ts`: `teamBodySchema` corrected to
  the real JSON shape `{id, name}`. Added a shared `yamlAskBodyBuilder`
  helper that unwraps a `{yaml: "<doc>"}` body to the raw YAML string for the
  7 genuine YAML ask-body resources (`work_class`, `work_trigger`,
  `capability`, `risk_evaluator`, `member`, `member_template`,
  `software_component`) — the HTTP client picks Content-Type from the JS
  `typeof` of the body (string -> `application/yaml`, object ->
  `application/json`), so passing the documented `{yaml: ...}` shape
  literally was serializing as JSON and getting rejected. Full test suite
  (146 files / 3300 tests) + `tsc --noEmit` pass after the fix.

The exact same root-cause bug exists in `../cli` (`harness` CLI),
independently, in `pkg/spec/autonomous_work.spec.yaml`. None of the 7
YAML-ask-body create/update commands declared `content_type:
application/yaml` on their `endpoint:` block. Per
`pkg/cmdctx/flagutil.go` (`NormalizeFileBody`), an endpoint's effective
content type defaults to `application/json` when unset — so for a `.yaml`
input file, the CLI parsed it as YAML and then **re-encoded it as JSON**
before sending, with `Content-Type: application/json`, against server
routes that only accept `application/yaml`. Fixed by adding `content_type:
application/yaml` next to each `file_body: required` for `work_class`,
`work_trigger`, `capability`, `risk_evaluator`, `member`, `member_template`,
`software_component` (14 lines, create+update). `team` and
`content_source_connector` were left alone — their real APIs are plain JSON,
and the default `application/json` content type was already correct for
them; only their `short` descriptions wrongly said "YAML ask-body" /
"YAML body", which were corrected to say JSON. Verified live: built the CLI,
logged in with a real PAT against `PROD/Data_Platform`, ran `create
capability -f <yaml file>` (failed before the fix with the same
Content-Type mismatch pattern, succeeds after) and `create team -f <file>`
(worked before and after — JSON path was already correct), then deleted the
smoke-test resources. `go build ./...` and `go test
./pkg/specloader/... ./pkg/registry/... ./pkg/spec/...` pass.

---

# Known issue: `autonomous_work` toolset exposes no real field-level body schemas

**Found:** 2026-09-08, while setting up a live WorkClass/Team/Trigger chain in
`adlc-service` (`PROD/Data_Platform`) via the `harness0` MCP server.

## Problem

For every write operation in `src/registry/toolsets/autonomous_work.ts`
(`team`, `work_class`, `work_trigger`, `capability`, `risk_evaluator`,
`member`, `member_template`, `software_component`), the declared `bodySchema`
is a one-field placeholder:

```ts
const workClassBodySchema: BodySchema = {
  description: "WorkClass YAML definition (ask-body). See contracts/schemas/v1/ in adlc-service for the JSON Schema.",
  fields: [
    { name: "yaml", type: "yaml", required: true, description: "Full WorkClass YAML document." },
  ],
};
```

`harness_describe(resource_type=...)` therefore tells a caller only that the
body is "a YAML document" — never the actual required/optional fields,
`$defs`, enums, or unions inside it. To build a valid body an agent (or a CLI
user) has to go read `contracts/schemas/v1/*.schema.json` and
`examples/config/v1/*.yaml` directly in the `adlc-service` source tree. That
source isn't reachable from a bare MCP/CLI session with no repo checkout.

`harness_schema` (the tool meant to solve exactly this, per AIPLAT-409 for
platform entities like `connector`/`environment`/`service`) does not cover
`autonomous_work` resource types at all.

## Compounding bug: `team` isn't YAML at all

`teamBodySchema` claims a `yaml` field, but `adlc-service`'s actual route
(`POST/PUT /api/teams`, see `api/spec/components/schemas/members.yaml` →
`TeamCreateRequest` / `TeamUpdateRequest`) takes a **plain JSON body**
`{ id, name }` — no YAML envelope. Passing YAML to `harness_create`/
`harness_update` for `team` will not match what the server expects.

## Suggested fix

- Short term: correct `teamBodySchema` to the real JSON shape (`id` required
  string, `name` optional string).
- Longer term: either vendor the `contracts/schemas/v1/*.schema.json` files
  from `adlc-service` (same pattern as the bundled entity snapshots from
  AIPLAT-409) and surface them through `harness_schema(resource_type=
  'work_class' | 'trigger' | 'capability' | 'risk_evaluator' | 'member' |
  'member_template' | 'software_component')`, or fetch them live from
  `adlc-service` if it exposes the schemas at runtime (`internal/configschema`
  loads the same embedded files — check whether there's already an HTTP route
  for schema introspection before duplicating the JSON).
- Whatever fixes this for MCP should also be checked against the Harness CLI,
  which likely hits the same `/adlc/api/*` routes with the same "here's a YAML
  blob, good luck" body description — same underlying gap, different client.

## Live repro (2026-09-08, `PROD/Data_Platform`)

Confirmed this is not just a docs/metadata gap — `team` create is actually
broken end-to-end through the MCP tool:

1. `harness_create(resource_type='team', body={"id": "adlc_pilot_team", "name": "ADLC Pilot Team"})`
   → client-side rejection: `"Missing required fields for team: yaml. Use
   harness_describe(resource_type=\"team\") to see the schema."` — the tool
   refuses a correct JSON body because its declared schema insists on a
   `yaml` field.
2. `harness_create(resource_type='team', body={"yaml": "id: adlc_pilot_team\nname: ADLC Pilot Team\n"})`
   → passes client-side validation, hits the real server, and the server
   rejects it: `"request body has an error: doesn't match schema
   #/components/schemas/TeamCreateRequest: Error at \"/id\": property \"id\"
   is missing"` — confirming the server really does want plain JSON
   `{id, name}`, and whatever `team`'s `bodyBuilder` sends instead does not
   produce that shape.

Net effect: **`team` cannot currently be created through this MCP toolset at
all.** There is no client-side body shape that satisfies both the tool's own
validation and the real server schema.

## Repro / context

Session that surfaced this: adlc-service repo, branch `feat/st-token-authn`,
attempting to create a minimal Team → Capability → Member → WorkClass →
WorkTrigger chain in `Data_Platform` to prove out autonomous-work execution
end-to-end. Had to `Read` `adlc-service/contracts/schemas/v1/workclass.schema.json`,
`trigger.schema.json`, and `examples/config/v1/*.yaml` by hand to construct
valid bodies.
