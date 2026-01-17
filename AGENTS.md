# Harness MCP Server

Refer to [README.md](README.md) for project introduction, toolset documentation, and IDE integration guides.

## General Guidance

- This is a Go 1.25+ codebase using the [mcp-go](https://github.com/mark3labs/mcp-go) library
- The server exposes MCP tools organized into toolsets (pipelines, ccm, chaos, scs, sto, idp, sei, etc.)
- All tools must handle both `org_id` and `project_id` scope parameters appropriately
- **Tool names are public API** - renaming tools or adding required parameters breaks external clients
- Prefer adding optional parameters with sensible defaults over required ones

## Repository Layout

```
cmd/harness-mcp-server/    # Main binary entry point
common/
├── config.go              # Server configuration struct
├── client/                # API clients for Harness services
│   └── dto/               # Data transfer objects
└── pkg/
    ├── tools/             # Individual tool implementations
    ├── toolsets/          # Toolset grouping and registration
    └── modules/           # Harness module definitions (CCM, CD, Chaos, CI, Code, FME, IDP, SEI, STO, SSCA)
pkg/                       # Additional tools and middleware
```

## Build & Test Commands

### Full Suite
```bash
make build                 # Build binary with version info
make format                # Format code (goimports + gci)
make test                  # Run all tests with coverage
```

### File-Scoped (Fast Feedback)
```bash
go test ./common/pkg/tools/... -v           # Test tools package
go test ./common/pkg/toolsets/... -v        # Test toolsets package
go build ./cmd/harness-mcp-server           # Build only (no version info)
```

## Adding New Tools

Follow the pattern in [common/pkg/tools/pipelines.go](common/pkg/tools/pipelines.go). Key helpers:

- `RequiredParam[T]` / `OptionalParam[T]` - Extract parameters from request
- `common.WithScope(config, required)` - Add org_id/project_id parameters
- `common.FetchScope(ctx, config, request, required)` - Validate and extract scope

## Code Style & Conventions

See [.harness/rules/review.md](.harness/rules/review.md) for review checklist:

1. **Tool names**: Must be unambiguous and not conflict with existing names
2. **Descriptions**: Must be clear and suggest what action the tool performs
3. **Parameters**: Use `mcp.Enum` for string parameters with defined values
4. **Errors**: Use `mcp.NewToolResultError` for validation errors, `fmt.Errorf` for API/system errors (see Common Pitfalls)

### Formatting
```bash
make format   # Runs goimports and gci - run before committing
```

## Common Pitfalls

### Error Handling - Two Patterns

- **Validation errors** (params, scope): `return mcp.NewToolResultError(err.Error()), nil`
- **API/system errors** (client calls, marshaling): `return nil, fmt.Errorf("failed to X: %w", err)`

See `GetPipelineTool` in [common/pkg/tools/pipelines.go](common/pkg/tools/pipelines.go) for reference.

### Key Rules

- **Use `OptionalParam[T]` for optional fields** - Reserve `RequiredParam[T]` only for mandatory parameters
- **Always validate scope** - Call `common.FetchScope()` before using org/project IDs
- **Respect read-only mode** - `AddWriteTools()` is automatically filtered when server is read-only
