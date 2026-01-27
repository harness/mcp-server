# MCP Tool Review Checklist

## Discoverability
- Name follows `{module}_{verb}_{noun}` pattern (e.g., `ccm_list_perspectives`, `cd_get_pipeline`, `chaos_run_experiment`)
- Name is 1-64 characters, using only `A-Za-z0-9_` (per SEP-986)
- Name does not conflict with existing tools
- Description explains what the tool does AND when to use it vs alternatives
- Harness-specific terms are defined inline

## Parameters
- Use `mcp.Enum` for constrained string values (not free-form strings)
- Required params: describe AND explain how to obtain values (e.g., "use list_pipelines to get IDs")
- Optional params: document default behavior when omitted
- Complex types (arrays/objects): provide structure or examples
- Document parameter dependencies ("X requires Y")

## Completeness
- Description mentions what the tool returns
- Reference related tools for discovery (e.g., "See also: list_X to find IDs")
- Verify referenced tool names in description actually exist

## Annotations
- Set `readOnlyHint: true` for query-only tools (list_*, get_*)
- Set `destructiveHint: true` for delete/dangerous operations

## Avoid
- Embedded LLM directives (e.g., "Return this format to the user")
- Unexplained IDs or jargon
- Mutating actions (create/delete/run) without clear consequences 
