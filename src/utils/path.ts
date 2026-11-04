/** Encode one URL path segment without allowing WHATWG URL dot-segment normalization. */
export function encodePathSegment(value: string): string {
  if (value === "." || value === "..") {
    throw new Error("Path segment must not be '.' or '..'.");
  }
  return encodeURIComponent(value);
}
