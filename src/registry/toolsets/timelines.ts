import type { ToolsetDefinition, BodySchema } from "../types.js";
import { buildBodyNormalized } from "../../utils/body-normalizer.js";
import { MC_SCOPE } from "./scopes.js";
import { isRecord } from "../../utils/type-guards.js";

/** GET and POST share this path; the activity prettyId is the only path param. */
const TIMELINE_PATH = "/gateway/ir/tp/api/v1/mc/activities/{activityId}/timeline";

/**
 * The named `TimelineEventGroup` values. Membership is deliberately lossy on the
 * backend — PAGE_SENT, ROOT_CAUSE_INVESTIGATION_STARTED, POSTMORTEM_GENERATED,
 * AI_CHANGE_AGENT_REASONING and the ACTION_* / WEBHOOK_LOG script noise belong
 * to no group — so omitting the filter means "all named groups", not "all events".
 */
const EVENT_GROUPS = [
  "USER_MESSAGES",
  "LIFECYCLE",
  "PAGING",
  "RUNBOOKS",
  "AI",
  "TASKS",
  "KEY_EVENTS",
  "STATUS_UPDATES",
] as const;

/**
 * Normalize `event_groups` into the repeated-query-param form the backend needs.
 *
 * JAX-RS binds `List<TimelineEventGroup>` from repeated `eventGroups` params and
 * matches enum names case-sensitively, so two agent-plausible inputs 400 without
 * this hook:
 *   - `"user_messages,ai"` — the registry passes a string query value through
 *     verbatim (`index.ts` query-param mapping), yielding one unparseable value
 *     `eventGroups=USER_MESSAGES%2CAI`.
 *   - `["user_messages"]` — arrays are repeated correctly by the client, but
 *     `canonicalizeListFilterEnums` only rewrites strings, so lowercase survives.
 *
 * Accepts either shape and emits a trimmed, UPPERCASE array; deletes the key when
 * nothing is left so an empty filter reads as "all named groups" rather than an
 * empty repeated param. Runs after enum canonicalization and before query-param
 * mapping, so the mutation reaches the wire.
 */
function normalizeEventGroups(input: Record<string, unknown>): void {
  const raw = input.event_groups;
  if (raw === undefined || raw === null) return;
  const parts = (Array.isArray(raw) ? raw : String(raw).split(","))
    .map((v) => String(v).trim().toUpperCase())
    .filter((v) => v.length > 0);
  if (parts.length === 0) {
    delete input.event_groups;
    return;
  }
  input.event_groups = parts;
}

/**
 * Project a `TimelineEventResponse` to its five documented fields, dropping the
 * empty `actor` the backend emits for system-generated events.
 *
 * `message` is never truncated: there is no per-event get endpoint, so a trimmed
 * message is unrecoverable (unlike an incident summary, which `harness_get`
 * restores). Agents bound volume with `event_groups` and `size` instead.
 */
function projectTimelineEvent(e: unknown): unknown {
  if (!isRecord(e)) return e;
  const out: Record<string, unknown> = {};
  if (typeof e.eventId === "string") out.eventId = e.eventId;
  if (typeof e.eventType === "string") out.eventType = e.eventType;
  if (typeof e.timestamp === "number") out.timestamp = e.timestamp;
  if (typeof e.actor === "string" && e.actor.length > 0) out.actor = e.actor;
  if (typeof e.message === "string") out.message = e.message;
  return out;
}

/**
 * Map `CursorPaginatedResult<String, TimelineEventResponse>` onto the canonical
 * list envelope.
 *
 * `total` can only be the page length — this endpoint builds the result with the
 * 3-arg constructor, so `totalCount` is always null. `has_more` is therefore the
 * only correct stop signal: the backend drops unrenderable events *after* the
 * underlying query paged, so a page shorter than `pageSize` with more results
 * pending is normal.
 *
 * Paired with `skipCompact: true` — the generic key whitelist keeps only
 * `eventId` and `message`, dropping `eventType`, `actor`, and `timestamp` (which
 * misses the case-sensitive timestamp-suffix pattern). Projecting here instead of
 * via `compactItem` also makes compact and non-compact responses identical, which
 * is right when there is nothing verbose to withhold.
 */
function timelineListExtract(raw: unknown, input?: Record<string, unknown>): unknown {
  if (!isRecord(raw)) return raw;
  const items = Array.isArray(raw.results) ? raw.results.map(projectTimelineEvent) : [];
  const hasMore = raw.hasMoreResults === true;
  return {
    items,
    total: items.length,
    pagination: {
      cursor: typeof input?.cursor === "string" ? input.cursor : undefined,
      // Suppressed on the terminal page: the backend echoes the last event's
      // cursor even when hasMoreResults is false, so surfacing it unconditionally
      // makes an agent's `while (next_cursor)` loop re-request the final page
      // forever. Only ever emit a cursor that has a page behind it.
      next_cursor: hasMore && typeof raw.nextPageCursor === "string" ? raw.nextPageCursor : undefined,
      has_more: hasMore,
    },
  };
}

/**
 * `PostTimelineMessageRequest` is a single-field record with no @JsonProperty
 * overrides, so the wire name is the field name verbatim.
 */
const postMessageSchema: BodySchema = {
  description: "Markdown note to append to the activity's timeline (PostTimelineMessageRequest)",
  fields: [
    {
      name: "message",
      type: "string",
      required: true,
      description: "Markdown note to post. Blank or whitespace-only messages are rejected with a 400.",
    },
  ],
};

export const timelinesToolset: ToolsetDefinition = {
  name: "timelines",
  displayName: "AI-SRE Activity Timelines",
  description: "Harness AI-SRE activity timelines — read an incident, alert, or deploy timeline and post markdown notes to it",
  resources: [
    {
      resourceType: "activity_timeline",
      displayName: "Activity Timeline",
      description:
        "The chronological event stream for one AI-SRE activity (incident, alert, or deploy). "
        + "Read with harness_list and a required activity_id filter; append a note with "
        + "harness_execute action='post_message'. There is no get operation — a timeline is a collection, not an entity. "
        + "Events are append-only and permanent: there is no update or delete, by design, because the timeline is an "
        + "audit trail. In list responses `total` is this page's size, not the timeline length — page with "
        + "pagination.has_more, never by comparing item count to the requested size.",
      toolset: "timelines",
      scope: "project",
      scopeParams: MC_SCOPE,
      identifierFields: ["activity_id"],
      searchAliases: [
        "timeline",
        "activity timeline",
        "incident timeline",
        "alert timeline",
        "activity events",
        "event log",
      ],
      diagnosticHint:
        "Read timelines with harness_list(resource_type='activity_timeline', filters={activity_id:'INC-123'}) — "
        + "harness_get is not supported. Narrow noisy timelines with the event_groups filter rather than paging further. "
        + "Page with pagination.has_more and pagination.next_cursor: never stop on a short page, because unrenderable "
        + "events are dropped after the backend has already paged. `total` is this page's size, not the timeline length.",
      executeHint:
        "Append a note with harness_execute(resource_type='activity_timeline', action='post_message', "
        + "resource_id='INC-123', body={message:'...'}). There is no delete endpoint — a posted note cannot be removed via API.",
      relatedResources: [
        { resourceType: "incident", relationship: "parent", description: "The incident this timeline belongs to; its prettyId is the activity_id" },
        { resourceType: "alert", relationship: "parent", description: "The alert this timeline belongs to; its prettyId is the activity_id" },
        { resourceType: "deploy", relationship: "parent", description: "The deploy this timeline belongs to; its id is the activity_id" },
      ],
      listFilterFields: [
        {
          name: "activity_id",
          required: true,
          description: "Activity prettyId whose timeline to read — an incident (INC-123), alert (ALERT-456), or deploy (DEPLU65-8065)",
        },
        {
          name: "event_groups",
          description:
            "Event groups to include (multi-value, OR-combined). Omit for all named groups — which is not every event: "
            + "raw action and webhook logs (ACTION_LOG, ACTION_EXECUTE, ACTION_END, ACTION_DEBUG_LOG, WEBHOOK_LOG) and "
            + "intermediate AI reasoning traces belong to no group and stay excluded either way. Runbook execution is "
            + "still visible: SCRIPTED_ACTION_START/DONE are in RUNBOOKS.",
          enum: [...EVENT_GROUPS],
        },
        {
          name: "cursor",
          description: "Cursor for the next page, taken from the previous response's pagination.next_cursor",
        },
        {
          name: "sort_direction",
          description: "Sort direction on event time. Defaults to DESC (newest first) when omitted.",
          enum: ["ASC", "DESC"],
        },
      ],
      operations: {
        list: {
          method: "GET",
          path: TIMELINE_PATH,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { activity_id: "activityId" },
          queryParams: {
            event_groups: "eventGroups",
            cursor: "cursor",
            sort_direction: "sortDirection",
            // pageSize is clamped server-side to a dynamic config (default 100),
            // and 0/omitted falls back to the same value — so asking for 500
            // quietly returns ≤100. No defaultQueryParams here on purpose: an
            // unparameterized call should inherit the backend default.
            size: "pageSize",
          },
          preflight: async ({ input }) => {
            normalizeEventGroups(input);
          },
          responseExtractor: timelineListExtract,
          skipCompact: true,
          description: "List an activity's timeline events (requires activity_id), newest first by default",
        },
      },
      executeActions: {
        post_message: {
          method: "POST",
          path: TIMELINE_PATH,
          // low_write: appending a note is additive and does not change activity
          // state, and an elicitation on every post would break the autonomous
          // post-findings loop. Same level as incident.close and pr_comment.create.
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          pathParams: { activity_id: "activityId" },
          bodyBuilder: buildBodyNormalized(),
          bodySchema: postMessageSchema,
          responseExtractor: projectTimelineEvent,
          actionDescription:
            "Post a markdown note to an activity's timeline. The response is an echo of the write, not a read-back: "
            + "`actor` is empty, `message` is the raw markdown as submitted (a later list returns it rendered with "
            + "author attribution), and `timestamp` is when the write was accepted. The write is enqueued "
            + "asynchronously, so an immediate list may not show the note yet — that is not a failure, do not retry.",
        },
      },
    },
  ],
};
