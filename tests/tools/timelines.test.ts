/**
 * Tests for the `activity_timeline` resource type (timelines toolset).
 *
 * Focused on the four contract details that would silently break this endpoint:
 * the `event_groups` repeated-param normalization (JAX-RS neither splits commas
 * nor matches enum names case-insensitively), the hand-rolled cursor extractor
 * (whose fields the generic compaction whitelist would otherwise strip), the
 * required `activity_id` filter, and the exact POST body shape. All with a
 * mocked client.request so no real API is hit.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import type { ToolResult } from "../../src/utils/response-formatter.js";
import { Registry } from "../../src/registry/index.js";

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
    HARNESS_AUTO_APPROVE_RISK: "none",
    HARNESS_TOOLSETS: "timelines",
    ...overrides,
  } as Config;
}

function makeClient(requestFn?: (...args: unknown[]) => unknown): HarnessClient {
  return {
    request: requestFn ?? vi.fn().mockResolvedValue({}),
    account: "test-account",
  } as unknown as HarnessClient;
}

function makeMcpServer(elicitAction: "accept" | "decline" | "cancel" = "accept") {
  const tools = new Map<string, { handler: (...args: unknown[]) => Promise<ToolResult> }>();
  return {
    server: {
      getClientCapabilities: () => ({ elicitation: { form: {} } }),
      elicitInput: vi.fn().mockResolvedValue({ action: elicitAction }),
    },
    registerTool: vi.fn((name: string, _schema: unknown, handler: (...args: unknown[]) => Promise<ToolResult>) => {
      tools.set(name, { handler });
    }),
    async call(name: string, args: Record<string, unknown>, extra?: Record<string, unknown>): Promise<ToolResult> {
      const tool = tools.get(name);
      if (!tool) throw new Error(`Tool "${name}" not registered`);
      const defaultExtra = { signal: new AbortController().signal, sendNotification: vi.fn(), _meta: {} };
      return tool.handler(args, { ...defaultExtra, ...extra }) as Promise<ToolResult>;
    },
  } as any;
}

function parseResult(result: ToolResult): unknown {
  const item = result.content[0]!;
  if (item.type !== "text") throw new Error(`Expected text content, got "${item.type}"`);
  return JSON.parse(item.text);
}

/** One event of each shape the extractor has to handle. */
const RAW_TIMELINE = {
  results: [
    { eventId: "e1", eventType: "ONCALL_PAGED", timestamp: 1_700_000_000_000, actor: "Ada", message: "Paged on-call" },
    { eventId: "e2", eventType: "ACTIVITY_CREATED", timestamp: 1_700_000_001_000, actor: "", message: "Incident opened" },
  ],
  nextPageCursor: "cursor-2",
  hasMoreResults: true,
  totalCount: null,
};

describe("activity_timeline resource definition", () => {
  const registry = new Registry(makeConfig());
  const def = registry.getResource("activity_timeline");

  it("requires the activity_id filter and offers no get operation", () => {
    const activityId = def.listFilterFields?.find((f) => f.name === "activity_id");
    expect(activityId?.required).toBe(true);
    expect(def.operations.get).toBeUndefined();
    expect(Object.keys(def.operations)).toEqual(["list"]);
  });

  it("declares the eight named event groups in UPPERCASE", () => {
    const eventGroups = def.listFilterFields?.find((f) => f.name === "event_groups");
    expect(eventGroups?.enum).toEqual([
      "USER_MESSAGES", "LIFECYCLE", "PAGING", "RUNBOOKS", "AI", "TASKS", "KEY_EVENTS", "STATUS_UPDATES",
    ]);
  });

  // The POST response is a write echo, not a read-back. Without this spelled out,
  // agents poll a list that has not caught up yet and conclude the post failed.
  it("warns in post_message's description that the response is an echo and the write is async", () => {
    const desc = def.executeActions?.post_message?.actionDescription ?? "";
    expect(desc).toMatch(/echo/i);
    expect(desc).toMatch(/asynchronous|async/i);
  });
});

describe("activity_timeline — harness_list", () => {
  let server: ReturnType<typeof makeMcpServer>;
  let client: HarnessClient;
  let mockRequest: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    server = makeMcpServer();
    mockRequest = vi.fn().mockResolvedValue(RAW_TIMELINE);
    client = makeClient(mockRequest);
    const { registerListTool } = await import("../../src/tools/harness-list.js");
    registerListTool(server, new Registry(makeConfig()), client);
  });

  it("substitutes activity_id into the path and sends MC scope params", async () => {
    const result = await server.call("harness_list", {
      resource_type: "activity_timeline",
      filters: { activity_id: "INC-123" },
    });
    expect(result.isError).toBeUndefined();
    const callArgs = mockRequest.mock.calls[0]![0] as { path: string; params: Record<string, unknown> };
    expect(callArgs.path).toBe("/gateway/ir/tp/api/v1/mc/activities/INC-123/timeline");
    expect(callArgs.params.accountId).toBe("test-account");
    expect(callArgs.params.orgId).toBe("default");
    expect(callArgs.params.projectId).toBe("test-project");
  });

  it.each(["incidents/INC-1924", "alerts/ALERT-7"])("fills activity_id from a UI URL (%s)", async (tail) => {
    const id = tail.split("/")[1];
    const result = await server.call("harness_list", {
      resource_type: "activity_timeline",
      url: `https://harness0.harness.io/ng/account/acc/module/ir/orgs/PROD/projects/AI_SRE/${tail}`,
    });
    expect(result.isError).toBeUndefined();
    const callArgs = mockRequest.mock.calls[0]![0] as { path: string };
    expect(callArgs.path).toBe(`/gateway/ir/tp/api/v1/mc/activities/${id}/timeline`);
  });

  it("errors when activity_id is omitted instead of calling the API", async () => {
    const result = await server.call("harness_list", { resource_type: "activity_timeline" });
    expect(result.isError).toBe(true);
    const data = parseResult(result) as { error: string };
    expect(data.error).toContain("activity_id");
    expect(mockRequest).not.toHaveBeenCalled();
  });

  // Both shapes previously produced a 400: a comma string reached the API as one
  // unparseable enum value, and an array skipped enum canonicalization so its
  // lowercase members never matched the case-sensitive Java enum.
  it.each([
    ["array", ["user_messages", "ai"]],
    ["comma-separated string", "user_messages,ai"],
    ["single string", "user_messages"],
  ] as const)("normalizes event_groups given as %s into a repeated UPPERCASE param", async (_label, value) => {
    await server.call("harness_list", {
      resource_type: "activity_timeline",
      filters: { activity_id: "INC-123", event_groups: value },
    });
    const callArgs = mockRequest.mock.calls[0]![0] as { params: Record<string, unknown> };
    const expected = typeof value === "string" && !value.includes(",")
      ? ["USER_MESSAGES"]
      : ["USER_MESSAGES", "AI"];
    expect(callArgs.params.eventGroups).toEqual(expected);
  });

  it("drops an empty event_groups filter rather than sending a blank param", async () => {
    await server.call("harness_list", {
      resource_type: "activity_timeline",
      filters: { activity_id: "INC-123", event_groups: "  " },
    });
    const callArgs = mockRequest.mock.calls[0]![0] as { params: Record<string, unknown> };
    expect(callArgs.params).not.toHaveProperty("eventGroups");
  });

  it("maps the remaining snake_case filters to their query param names", async () => {
    await server.call("harness_list", {
      resource_type: "activity_timeline",
      size: 50,
      filters: { activity_id: "INC-123", cursor: "cursor-1", sort_direction: "asc" },
    });
    const callArgs = mockRequest.mock.calls[0]![0] as { params: Record<string, unknown> };
    expect(callArgs.params.cursor).toBe("cursor-1");
    expect(callArgs.params.sortDirection).toBe("ASC");
    expect(callArgs.params.pageSize).toBe(50);
  });

  // The generic compaction whitelist keeps only eventId and message: eventType and
  // actor are not whitelisted names, and `timestamp` misses the case-sensitive
  // /(?:At|Ts|Time|Date)$/ pattern. skipCompact + extractor projection is what
  // keeps all five fields, so compact and non-compact must agree.
  it.each([true, false])("preserves eventType, timestamp, and actor with compact=%s", async (compact) => {
    const result = await server.call("harness_list", {
      resource_type: "activity_timeline",
      compact,
      filters: { activity_id: "INC-123" },
    });
    const data = parseResult(result) as { items: Array<Record<string, unknown>> };
    expect(data.items[0]).toEqual({
      eventId: "e1",
      eventType: "ONCALL_PAGED",
      timestamp: 1_700_000_000_000,
      actor: "Ada",
      message: "Paged on-call",
    });
  });

  it("drops the empty actor the backend emits for system events", async () => {
    const result = await server.call("harness_list", {
      resource_type: "activity_timeline",
      filters: { activity_id: "INC-123" },
    });
    const data = parseResult(result) as { items: Array<Record<string, unknown>> };
    expect(data.items[1]).not.toHaveProperty("actor");
    expect(data.items[1]!.eventType).toBe("ACTIVITY_CREATED");
  });

  it("maps hasMoreResults/nextPageCursor onto pagination.has_more/next_cursor", async () => {
    const result = await server.call("harness_list", {
      resource_type: "activity_timeline",
      filters: { activity_id: "INC-123", cursor: "cursor-1" },
    });
    const data = parseResult(result) as {
      total: number;
      pagination: { cursor?: string; next_cursor?: string; has_more: boolean };
    };
    expect(data.pagination).toEqual({ cursor: "cursor-1", next_cursor: "cursor-2", has_more: true });
    // totalCount is always null on this endpoint (3-arg CursorPaginatedResult
    // constructor), so `total` can only ever be this page's length.
    expect(data.total).toBe(2);
  });

  // A short page with more results pending is normal — unrenderable events are
  // dropped after the underlying query already paged. has_more is the stop signal.
  it("reports has_more=true on a page shorter than the requested size", async () => {
    mockRequest.mockResolvedValueOnce({
      results: [RAW_TIMELINE.results[0]],
      nextPageCursor: "cursor-2",
      hasMoreResults: true,
    });
    const result = await server.call("harness_list", {
      resource_type: "activity_timeline",
      size: 100,
      filters: { activity_id: "INC-123" },
    });
    const data = parseResult(result) as { items: unknown[]; pagination: { has_more: boolean } };
    expect(data.items).toHaveLength(1);
    expect(data.pagination.has_more).toBe(true);
  });

  // The live endpoint echoes the last event's cursor on the terminal page rather
  // than omitting it, so nextPageCursor is set here even though hasMoreResults is
  // false. Suppressing it is what stops a `while (next_cursor)` loop from
  // re-requesting the final page forever.
  it("suppresses next_cursor on the last page even when the backend still sends one", async () => {
    mockRequest.mockResolvedValueOnce({
      results: [RAW_TIMELINE.results[0]],
      nextPageCursor: "cursor-2",
      hasMoreResults: false,
    });
    const result = await server.call("harness_list", {
      resource_type: "activity_timeline",
      filters: { activity_id: "INC-123" },
    });
    const data = parseResult(result) as { pagination: { next_cursor?: string; has_more: boolean } };
    expect(data.pagination.has_more).toBe(false);
    expect(data.pagination.next_cursor).toBeUndefined();
  });
});

describe("activity_timeline — harness_execute (post_message)", () => {
  let server: ReturnType<typeof makeMcpServer>;
  let client: HarnessClient;
  let mockRequest: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    server = makeMcpServer("accept");
    mockRequest = vi.fn().mockResolvedValue({
      eventId: "e9",
      eventType: "TRANSPOSIT_POST",
      timestamp: 1_700_000_002_000,
      actor: "",
      message: "**Findings:** db saturation",
    });
    client = makeClient(mockRequest);
    const { registerExecuteTool } = await import("../../src/tools/harness-execute.js");
    registerExecuteTool(server, new Registry(makeConfig()), client, makeConfig());
  });

  // resource_id lands on activity_id through the generic execute-action remap
  // (identifierFields[0]), so no per-resource aliasing is needed here.
  it("POSTs to the timeline path built from resource_id, with MC scope params", async () => {
    const result = await server.call("harness_execute", {
      resource_type: "activity_timeline",
      action: "post_message",
      resource_id: "ALERT-456",
      body: { message: "**Findings:** db saturation" },
    });
    expect(result.isError).toBeUndefined();
    const callArgs = mockRequest.mock.calls[0]![0] as {
      method: string; path: string; params: Record<string, unknown>;
    };
    expect(callArgs.method).toBe("POST");
    expect(callArgs.path).toBe("/gateway/ir/tp/api/v1/mc/activities/ALERT-456/timeline");
    expect(callArgs.params.accountId).toBe("test-account");
    expect(callArgs.params.orgId).toBe("default");
    expect(callArgs.params.projectId).toBe("test-project");
  });

  // PostTimelineMessageRequest is a 1-field record. The dispatcher injects
  // orgIdentifier/projectIdentifier into POST bodies, but MC_SCOPE renames the
  // scope params to orgId/projectId so nothing is there to inject — pinned here
  // rather than trusted, since a leaked field would be a 400 in production.
  it("sends a body of exactly {message} with no scope fields injected", async () => {
    await server.call("harness_execute", {
      resource_type: "activity_timeline",
      action: "post_message",
      resource_id: "INC-123",
      body: { message: "note" },
    });
    const callArgs = mockRequest.mock.calls[0]![0] as { body: Record<string, unknown> };
    expect(callArgs.body).toEqual({ message: "note" });
  });

  it("errors when message is missing instead of calling the API", async () => {
    const result = await server.call("harness_execute", {
      resource_type: "activity_timeline",
      action: "post_message",
      resource_id: "INC-123",
      body: {},
    });
    expect(result.isError).toBe(true);
    const data = parseResult(result) as { error: string };
    expect(data.error).toContain("message");
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("projects the echoed event and drops its empty actor", async () => {
    const result = await server.call("harness_execute", {
      resource_type: "activity_timeline",
      action: "post_message",
      resource_id: "INC-123",
      body: { message: "**Findings:** db saturation" },
    });
    const data = parseResult(result) as Record<string, unknown>;
    expect(data.eventId).toBe("e9");
    expect(data.eventType).toBe("TRANSPOSIT_POST");
    expect(data.message).toBe("**Findings:** db saturation");
    expect(data).not.toHaveProperty("actor");
  });

  // low_write keeps the autonomous post-findings loop unprompted; medium_write and
  // above would elicit on every note.
  it("is low_write so posting never blocks on a confirmation prompt", async () => {
    const def = new Registry(makeConfig()).getResource("activity_timeline");
    expect(def.executeActions?.post_message?.operationPolicy).toEqual({
      risk: "low_write",
      retryPolicy: "do_not_retry",
    });
  });
});
