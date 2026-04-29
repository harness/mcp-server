import * as z from "zod/v4";

export function resourceTypeSchema(resourceTypes: string[]) {
  if (resourceTypes.length === 0) {
    return z.string().refine(() => false, { error: "No enabled resource types support this operation" });
  }

  return z.enum(resourceTypes as [string, ...string[]]);
}
