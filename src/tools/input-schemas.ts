import * as z from "zod/v4";

/** Shared scope selector for create/update/delete/list/get tools. */
export const resourceScopeSchema = z
  .enum(["account", "org", "project"])
  .optional()
  .describe(
    "Scope for the operation. account: omit org/project (e.g. /v1/templates). org: org only. project: org+project. Auto-detected from url when present.",
  );

export function resourceTypeSchema(resourceTypes: string[]) {
  if (resourceTypes.length === 0) {
    return z.string().refine(() => false, { error: "No enabled resource types support this operation" });
  }

  return z.enum(resourceTypes as [string, ...string[]]);
}
