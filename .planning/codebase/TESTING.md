# Testing Patterns

**Analysis Date:** 2026-04-03

## Test Framework

**Runner:**
- Vitest 3.0.6
- Config: `vitest.config.ts` at project root
- Node environment: `environment: "node"`

**Assertion Library:**
- Vitest built-in expect assertions
- Pattern: `expect(value).toBe(expected)`, `expect(array).toHaveLength(2)`, `expect(() => fn()).toThrow()`

**Run Commands:**
```bash
pnpm test              # Run all tests once (vitest run)
pnpm test:watch        # Watch mode for continuous testing (vitest)
pnpm typecheck         # TypeScript type checking (tsc --noEmit)
```

## Test File Organization

**Location:**
- Test files co-located in `tests/` directory at project root
- Pattern mirrors source structure: `tests/tools/`, `tests/client/`, `tests/registry/`, `tests/resources/`
- Integration tests in `tests/integration/`
- Diagnostic tool tests in `tests/tools/diagnose/`

**Naming:**
- Files named with `.test.ts` suffix: `config.test.ts`, `harness-client.test.ts`, `registry.test.ts`
- Some specialized tests: `scs-wave1-verification.test.ts`, `mock-harness-api.test.ts`
- Test locations discovered by vitest: `include: ["tests/**/*.test.ts"]`

**Structure:**
```
tests/
├── config.test.ts              # Config parsing and validation
├── client/
│   └── harness-client.test.ts  # HTTP client, auth, retry logic
├── integration/
│   ├── mock-harness-api.test.ts        # Full flow with mocked API
│   ├── elicitation-flow.test.ts        # User confirmation flows
│   └── http-transport.test.ts          # HTTP transport testing
├── registry/
│   ├── registry.test.ts        # Registry resource loading
│   ├── governance.test.ts      # Governance toolset specific
│   ├── chaos-experiment.test.ts
│   └── scs.test.ts
├── tools/
│   ├── tool-handlers.test.ts   # Generic tool handler tests
│   ├── scs-wave1-verification.test.ts
│   └── diagnose/
│       ├── connector.test.ts
│       ├── pipeline.test.ts
│       └── router.test.ts
├── prompts/
│   └── build-deploy-app.test.ts
└── resources/
    └── harness-schema.test.ts
```

## Test Structure

**Suite Organization:**
```typescript
// Import vitest functions
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Test suite
describe("Feature or Module Name", () => {
  // Setup fixtures
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Nested describe for logical grouping
  describe("specific operation", () => {
    it("does expected thing", () => {
      // Arrange
      const input = makeConfig();
      // Act
      const result = functionUnderTest(input);
      // Assert
      expect(result).toBe(expected);
    });
  });
});
```

**Patterns:**
- Setup fixtures with `beforeEach()` and cleanup with `afterEach()`
- Nested `describe()` blocks for logical grouping (e.g., "constructor and account getter")
- Each `it()` test has single responsibility
- Test names are descriptive sentences: `"returns error when resource_type is missing"`, `"sends correct URL, headers, and body for pipeline list"`
- AAA pattern: Arrange (setup), Act (call), Assert (verify)

## Mocking

**Framework:** Vitest's built-in `vi` module (no external mocking library)

**Patterns:**

### Spies and Mocks
```typescript
// Mock a global function
const fetchSpy = vi.spyOn(globalThis, "fetch");
fetchSpy.mockResolvedValue(new Response(JSON.stringify(data), { status: 200 }));

// Mock a module
vi.mock("../../src/utils/log-resolver.js", () => ({
  resolveLogContent: vi.fn().mockResolvedValue("[log content]"),
}));

// Create a mock client
function makeClient(requestFn?: (...args: unknown[]) => unknown): HarnessClient {
  return {
    request: requestFn ?? vi.fn().mockResolvedValue({}),
    account: "test-account",
  } as unknown as HarnessClient;
}
```

### Mocking Module Implementations
```typescript
// From tests/tools/tool-handlers.test.ts
vi.mock("../../src/utils/log-resolver.js", () => ({
  resolveLogContent: vi.fn().mockResolvedValue("[2026-03-09T17:01:23Z] info: mvn clean install"),
}));

// Module-level mocks must be declared BEFORE importing the module under test
```

### Mock Management
- Restore all mocks after each test: `afterEach(() => { vi.restoreAllMocks(); })`
- Per-test mock overrides: `mockRequest.mockRejectedValueOnce(new HarnessApiError("Not found", 404))`
- Mock implementations return resolved promises for async functions

**What to Mock:**
- Network calls (fetch, HTTP client)
- External dependencies (log-resolver, file system operations)
- System time (if needed)
- Module-level utilities that have side effects

**What NOT to Mock:**
- Actual business logic (registry dispatch, error mapping)
- Zod schema validation (test real behavior)
- Type guards and utility functions
- Internal modules without external dependencies

## Fixtures and Factories

**Test Data:**
```typescript
// From tests/config.test.ts — simple factory
function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_API_KEY: "pat.test.abc.xyz",
    HARNESS_ACCOUNT_ID: "test-account",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "default",
    HARNESS_PROJECT: "test-project",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 3,
    LOG_LEVEL: "info",
    ...overrides,
  };
}

// From tests/client/harness-client.test.ts — mock client factory
function makeClient(requestFn?: (...args: unknown[]) => unknown): HarnessClient {
  return {
    request: requestFn ?? vi.fn().mockResolvedValue({}),
    account: "test-account",
  } as unknown as HarnessClient;
}

// From tests/integration/mock-harness-api.test.ts — mock API response
function mockFetchResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// From tests/tools/tool-handlers.test.ts — MCP server stub
function makeMcpServer(elicitAction: "accept" | "decline" | "cancel" = "accept") {
  const tools = new Map<string, { handler: (...args: unknown[]) => Promise<ToolResult> }>();
  return {
    server: {
      getClientCapabilities: () => ({ elicitation: { form: {} } }),
      elicitInput: vi.fn().mockResolvedValue({ action: elicitAction }),
    },
    registerTool: vi.fn((name: string, _schema: unknown, handler) => {
      tools.set(name, { handler });
    }),
    _tools: tools,
    async call(name: string, args: Record<string, unknown>): Promise<ToolResult> {
      const tool = tools.get(name);
      if (!tool) throw new Error(`Tool "${name}" not registered`);
      return tool.handler(args, { signal: new AbortController().signal });
    },
  } as any;
}
```

**Location:**
- Factories defined at the top of each test file
- Commonly used factories (Config, Client) inlined in each test file
- Mock API response helper `mockFetchResponse()` shared pattern
- No separate `fixtures/` directory — factories kept in test files for clarity

## Coverage

**Requirements:** None enforced (no coverage threshold configured)

**View Coverage:**
- No coverage command in `package.json`
- Can run: `vitest run --coverage` (requires coverage package)

**Coverage Focus Areas:**
- `src/config.ts` has comprehensive test coverage in `tests/config.test.ts` (97+ test cases for validation)
- `src/client/harness-client.ts` tested in `tests/client/harness-client.test.ts` (URL building, auth headers, retries)
- Tool handlers tested in `tests/tools/tool-handlers.test.ts` (error paths, dispatch)
- Registry tested in `tests/registry/registry.test.ts` (toolset loading, resource resolution)

## Test Types

**Unit Tests:**
- Scope: Single function or class in isolation
- Approach: Mock all external dependencies, test logic and error paths
- Example: `tests/config.test.ts` tests `extractAccountIdFromToken()` and `ConfigSchema` validation
- Example: `tests/client/harness-client.test.ts` tests URL building with various base URLs and path formats

**Integration Tests:**
- Scope: Multiple layers together (Registry → HarnessClient → fetch)
- Approach: Mock fetch but test real registry dispatch, body building, response extraction
- Files: `tests/integration/mock-harness-api.test.ts`, `tests/integration/elicitation-flow.test.ts`
- Example: Pipeline list request validates full URL construction, auth headers, request body, and response extraction

**E2E Tests:**
- Framework: MCP Inspector (CLI tool from MCP SDK)
- Command: `pnpm inspect` runs MCP server in inspector mode for interactive testing
- Not automated in test suite — manual verification with real MCP clients
- Tests full JSON-RPC protocol, tool registration, streaming

## Common Patterns

**Async Testing:**
```typescript
// Async/await pattern with expect for promises
it("fetches pipeline successfully", async () => {
  fetchSpy.mockResolvedValueOnce(
    mockFetchResponse({ status: "SUCCESS", data: { identifier: "my-pipeline" } })
  );
  const result = await client.request(/* ... */);
  expect(result).toBeDefined();
});

// Testing rejection
it("throws on 500 error", async () => {
  fetchSpy.mockResolvedValueOnce(new Response("Server error", { status: 500 }));
  await expect(client.request({ path: "/test" })).rejects.toThrow();
});
```

**Error Testing:**
```typescript
// Testing error conditions
it("returns error when resource_type is missing", async () => {
  const result = await server.call("harness_list", {});
  expect(result.isError).toBe(true);
  expect(parseResult(result)).toMatchObject({ error: expect.stringContaining("resource_type is required") });
});

// Testing error classification
it("propagates user-fixable API errors as errorResult", async () => {
  mockRequest.mockRejectedValueOnce(new HarnessApiError("Not found", 404));
  const result = await server.call("harness_list", { resource_type: "pipeline" });
  expect(result.isError).toBe(true);
});

// Testing infrastructure errors that should throw
it("throws for infrastructure API errors", async () => {
  mockRequest.mockRejectedValueOnce(new HarnessApiError("Server error", 500));
  await expect(server.call("harness_list", { resource_type: "pipeline" })).rejects.toThrow();
});
```

**Environment Isolation:**
```typescript
// From tests/config.test.ts — environment variable isolation
const originalEnv = process.env;

function withEnv(env: Record<string, string>, fn: () => void) {
  const prev = { ...process.env };
  // Clear all env vars
  for (const key of Object.keys(process.env)) {
    delete process.env[key];
  }
  Object.assign(process.env, env);
  try {
    fn();
  } finally {
    // Restore
    for (const key of Object.keys(process.env)) {
      delete process.env[key];
    }
    Object.assign(process.env, prev);
  }
}

// Usage
it("extracts account ID from PAT when HARNESS_ACCOUNT_ID is not set", () => {
  withEnv({ HARNESS_API_KEY: "pat.extracted123.tok.sec" }, () => {
    const config = loadConfig();
    expect(config.HARNESS_ACCOUNT_ID).toBe("extracted123");
  });
});
```

**Result Parsing:**
```typescript
// From tests/tools/tool-handlers.test.ts — parse JSON result
function parseResult(result: ToolResult): unknown {
  return JSON.parse(result.content[0]!.text);
}

// Usage
const result = await server.call("harness_list", { resource_type: "pipeline" });
const data = parseResult(result) as { items: unknown[]; total: number };
expect(data.items).toBeDefined();
```

**Test Organization by Feature:**
```typescript
// Config tests: validation, defaults, deprecation handling
describe("ConfigSchema", () => { /* validation tests */ });
describe("ConfigSchema — HTTPS enforcement", () => { /* security tests */ });
describe("loadConfig — account ID extraction", () => { /* runtime behavior */ });

// Client tests: URL building, headers, auth, retries
describe("HarnessClient", () => {
  describe("constructor and account getter", () => { /* basic tests */ });
  describe("request — URL building", () => { /* URL construction */ });
  describe("request — headers and auth", () => { /* auth tests */ });
});
```

## Verification Before Done

- Run `pnpm test` to verify all tests pass
- Run `pnpm typecheck` to verify TypeScript compilation
- Run `pnpm inspect` to test with MCP Inspector if adding new tools
- Check no hardcoded paths, API keys, or secrets in test fixtures
- Verify test isolation: mock cleanup in `afterEach()`, env restoration

---

*Testing analysis: 2026-04-03*
