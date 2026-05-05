import type { ResourceExample } from "./types.js";

const ALL_EXAMPLES: ResourceExample[] = [];

/** Register examples from a module. Called by each example file. */
export function registerExamples(examples: ResourceExample[]): void {
  ALL_EXAMPLES.push(...examples);
}

/** Fetch a single example by exact name. */
export function getExample(name: string): ResourceExample | undefined {
  return ALL_EXAMPLES.find((e) => e.name === name);
}

/** Search examples by keyword. Matches against name, description, tags, and resourceType. */
export function searchExamples(query: string, resourceType?: string): ResourceExample[] {
  const q = query.toLowerCase();
  return ALL_EXAMPLES.filter((e) => {
    if (resourceType && e.resourceType !== resourceType) return false;
    return (
      e.name.toLowerCase().includes(q) ||
      e.description.toLowerCase().includes(q) ||
      e.resourceType.toLowerCase().includes(q) ||
      e.tags.some((t) => t.toLowerCase().includes(q))
    );
  });
}

/** Get all example names for a specific resource type. */
export function getExamplesForResource(resourceType: string): ResourceExample[] {
  return ALL_EXAMPLES.filter((e) => e.resourceType === resourceType);
}

/** Get all unique resource types that have examples. */
export function getResourceTypesWithExamples(): string[] {
  return [...new Set(ALL_EXAMPLES.map((e) => e.resourceType))];
}
