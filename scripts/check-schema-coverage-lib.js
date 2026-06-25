/**
 * Pure coverage comparison used by scripts/check-schema-coverage.js and unit tests.
 */
export function compareSchemaCoverage(synced, excluded, upstream) {
  const missing = [];
  const stale = [];

  for (const name of upstream) {
    if (!synced.has(name) && !excluded.has(name)) {
      missing.push(name);
    }
  }

  for (const name of synced) {
    if (!upstream.includes(name)) {
      stale.push(name);
    }
  }

  return { missing, stale };
}
