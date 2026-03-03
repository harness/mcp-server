/**
 * Build Harness UI deep-link URLs.
 */
export function buildDeepLink(
  baseUrl: string,
  accountId: string,
  template: string,
  params: Record<string, string>,
): string {
  let url = template;
  url = url.replace("{accountId}", accountId);
  for (const [key, value] of Object.entries(params)) {
    url = url.replace(`{${key}}`, encodeURIComponent(value));
  }
  // Ensure base URL doesn't double-slash
  const base = baseUrl.replace(/\/$/, "");
  return `${base}${url}`;
}

/**
 * Append storeType query param to a deep link if the record has one.
 * Harness UI requires ?storeType=INLINE or ?storeType=REMOTE to resolve correctly.
 */
export function appendStoreType(link: string, record: Record<string, unknown>): string {
  const storeType = record.storeType;
  if (typeof storeType === "string" && storeType) {
    const separator = link.includes("?") ? "&" : "?";
    return `${link}${separator}storeType=${encodeURIComponent(storeType)}`;
  }
  return link;
}
