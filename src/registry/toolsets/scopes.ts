/**
 * Shared scope-param override for Harness APIs that route through
 * `/api/v1/mc/` behind the @HarnessAuth filter (STO, deploys, incidents).
 *
 * These services use accountId / orgId / projectId query params instead of the
 * standard NG accountIdentifier / orgIdentifier / projectIdentifier. The client
 * still appends its default `accountIdentifier`; the Java side ignores unknown
 * params. Defined once so a future platform-side rename only changes one place.
 */
export const MC_SCOPE = { account: "accountId", org: "orgId", project: "projectId" } as const;
