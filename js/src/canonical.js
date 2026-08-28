/**
 * Canonical JSON serialization.
 *
 * Canonical JSON is UTF-8, 2-space indented, `\n` line endings, keys in
 * the fixed schema order (objects are built in that order by the
 * constructors; free-form `ui_state` keys are sorted alphabetically) with
 * a single trailing newline when written as a document. Both reference
 * implementations (Node, Python) must emit byte-identical bytes.
 *
 * @module canonical
 */

/** Serialize a value as canonical JSON text (no trailing newline). */
export function canonicalJson(value) {
  return JSON.stringify(value, null, 2);
}

/** Serialize a value as a compact single-line JSON text (no newline). */
export function compactJson(value) {
  return JSON.stringify(value);
}

/** Sort the keys of a free-form object alphabetically (one level). */
export function sortedObject(obj) {
  const out = {};
  for (const k of Object.keys(obj).sort()) out[k] = obj[k];
  return out;
}
