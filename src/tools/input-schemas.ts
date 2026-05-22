import * as z from "zod/v4";

export const resourceScopeSchema = z
  .enum(["account", "org", "project"])
  .optional()
  .describe("Scope for resources that support account/org/project operations. account omits org/project; org uses org only; project uses org and project.");

export function resourceTypeSchema(resourceTypes: string[]) {
  if (resourceTypes.length === 0) {
    return z.string().refine(() => false, { error: "No enabled resource types support this operation" });
  }

  return z.enum(resourceTypes as [string, ...string[]]);
}
