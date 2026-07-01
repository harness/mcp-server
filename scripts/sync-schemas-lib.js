/**
 * Pure helpers used by scripts/sync-schemas.js and unit tests.
 */

/**
 * Rewrite a v1 schema's `definitions` keys and all `$ref` pointers so the
 * harness_schema tool can navigate via `definitions[schemaKey]`.
 */
export function rewriteDefinitionKeys(json, originalNamespace, targetNamespace) {
  if (!originalNamespace || originalNamespace === targetNamespace) return json;

  const text = JSON.stringify(json);
  const rewritten = text
    .replaceAll(
      `"#/definitions/${originalNamespace}/`,
      `"#/definitions/${targetNamespace}/`,
    )
    .replaceAll(
      `"#/definitions/${originalNamespace}"`,
      `"#/definitions/${targetNamespace}"`,
    );

  const parsed = JSON.parse(rewritten);

  if (parsed.definitions?.[originalNamespace]) {
    parsed.definitions[targetNamespace] = parsed.definitions[originalNamespace];
    delete parsed.definitions[originalNamespace];
  }

  return parsed;
}

export function schemaKey(version, name) {
  return version === "v0" ? name : `${name}_v1`;
}
