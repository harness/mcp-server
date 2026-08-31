import { isRecord } from "../../utils/type-guards.js";

/**
 * Project a single related-activity entry to the four fields an agent can act
 * on, identically in the list and detail views.
 *
 * Shared by every Mission Control toolset that surfaces `relatedActivities`
 * (incidents, alerts, deploys): the backend returns the same RelatedActivity
 * DTO on all of them, and an edge means the same thing whichever end you
 * fetched it from, so the projection is defined once here.
 *
 *   - `name` is the relationship verb; without it a link is meaningless, since
 *     "causes", "duplicates", and "is correlated with" are not interchangeable.
 *   - `templateTypeName` is the resource_type to pass to harness_get to follow
 *     the link. It cannot be inferred from the prettyId prefix — alerts arrive
 *     as both ALRTHET-* and PAGE_ALERT_<project>-* — so it belongs in the
 *     compact view too, at ~20 bytes per edge. It is omitted rather than
 *     emitted as null when the backend does not classify the edge.
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
  if (typeof a.templateTypeName === "string") out.templateTypeName = a.templateTypeName;
  if (typeof a.title === "string") out.title = a.title;
  if (typeof a.name === "string") out.name = a.name;
  return out;
}
