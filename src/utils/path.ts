function containsDotSegment(value: string): boolean {
  return value.replaceAll("\\", "/").split("/").some((segment) => segment === "." || segment === "..");
}

/**
 * True when a segment is `.` or `..`, or a single decode reveals those segments
 * beside a separator. `../x` encodes as `..%2Fx` because `.` is left intact;
 * a server that decodes `%2F` again would traverse. Literal `%2e%2e` text has
 * no separator, so it stays data and is encoded once more.
 */
export function hasTraversableSegment(value: string): boolean {
  if (containsDotSegment(value)) return true;
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return false;
  }
  if (decoded === value || !decoded.replaceAll("\\", "/").includes("/")) return false;
  return containsDotSegment(decoded);
}

/** Encode one URL path segment without allowing WHATWG URL dot-segment normalization. */
export function encodePathSegment(value: string): string {
  if (hasTraversableSegment(value)) {
    throw new Error("Path segment must not be '.' or '..'.");
  }
  return encodeURIComponent(value);
}
