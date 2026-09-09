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
  // Strip empty scope segments (e.g. "orgs//projects//" at account level,
  // or "projects//" at org level). Keep the `/all` module segment — NG routes
  // are `/ng/account/{id}/all/settings/...` (account),
  // `/ng/account/{id}/all/orgs/{org}/settings/...` (org), and
  // `/ng/account/{id}/all/orgs/{org}/projects/{project}/settings/...` (project).
  url = url.replace(/\/orgs\/\/projects\/\//, "/");
  url = url.replace(/\/projects\/\//, "/");
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

/**
 * Agent details URLs use ?type=custom|system. List/get include both roles;
 * only append when the extracted record has a known role.
 */
export function appendAgentTypeQuery(link: string, record: Record<string, unknown>): string {
  const role = record.role;
  if (role !== "custom" && role !== "system") {
    return link;
  }
  const separator = link.includes("?") ? "&" : "?";
  return `${link}${separator}type=${encodeURIComponent(role)}`;
}
