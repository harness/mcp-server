import { isRecord } from "../../utils/type-guards.js";

/**
 * Backend `templateTypeName` values mapped to the registry resource_type that
 * fetches them. The backend enum is INCIDENT | ALERT | DEPLOY | CHANGE, or null
 * when it cannot classify the linked activity's template. `CHANGE` has no
 * registered resource type here, so it is deliberately absent: an edge with no
 * mapping is emitted without a resource_type rather than with one that
 * harness_get would reject.
 */
const RESOURCE_TYPE_BY_TEMPLATE_TYPE: Record<string, string> = {
  INCIDENT: "incident",
  ALERT: "alert",
  DEPLOY: "deploy",
};

/**
 * Project a single related-activity entry to the fields an agent can act on,
 * identically in the list and detail views.
 *
 * Shared by every Mission Control toolset that surfaces `relatedActivities`
 * (incidents, alerts, deploys): the backend returns the same RelatedActivity
 * DTO on all of them, and an edge means the same thing whichever end you
 * fetched it from, so the projection is defined once here.
 *
 *   - `name` is the relationship verb; without it a link is meaningless, since
 *     "causes", "duplicates", and "is correlated with" are not interchangeable.
 *   - `resource_type` is the value to pass to harness_get to follow the link,
 *     translated from the backend's uppercase `templateTypeName` enum. The raw
 *     enum is not forwarded because it is not a registered resource_type. The
 *     type cannot be inferred from the prettyId prefix — alerts arrive as both
 *     ALRTHET-* and PAGE_ALERT_<project>-* — so it belongs in the compact view
 *     too, at ~20 bytes per edge. An edge the backend does not classify, or
 *     classifies as a type this server cannot fetch, is emitted without it.
 *   - `title` is omitted when empty: the backend substitutes the prettyId for a
 *     null title but passes an empty string straight through, and deploy
 *     activities always have one.
 *
 * The backend's `globalId` is dropped: no endpoint accepts it as a lookup key
 * (GET rejects a UUID with "Activity pretty IDs must consist of a
 * hyphen-separated activity template short ID and activity number"), so it is
 * a UUID per edge that no caller can act on.
 */
export function projectRelatedActivity(a: unknown): unknown {
  if (!isRecord(a)) return a;
  const out: Record<string, unknown> = {};
  if (typeof a.prettyId === "string") out.prettyId = a.prettyId;
  if (typeof a.templateTypeName === "string") {
    const resourceType = RESOURCE_TYPE_BY_TEMPLATE_TYPE[a.templateTypeName];
    if (resourceType !== undefined) out.resource_type = resourceType;
  }
  if (typeof a.title === "string" && a.title.length > 0) out.title = a.title;
  if (typeof a.name === "string") out.name = a.name;
  return out;
}
