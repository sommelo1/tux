/**
 * Canonical feedback schema v1.0 (SPC sections 14–20).
 *
 * @module schema
 */
import { sortedObject } from './canonical.js';

export const SCHEMA_VERSION = '1.0';

export const FEEDBACK_TYPES = ['change', 'issue', 'question', 'approval'];
export const FEEDBACK_STATUSES = ['open', 'incorporated', 'resolved', 'rejected'];
export const ORIGIN_MODES = ['design', 'review'];

/**
 * Validate a feedback item. Returns a list of problems; empty means valid.
 * @param {object} item
 * @returns {string[]}
 */
export function validateFeedback(item) {
  const problems = [];
  if (item.schema_version !== SCHEMA_VERSION) problems.push('schema_version must be "1.0"');
  if (typeof item.id !== 'string' || !/^fb_[0-9A-HJKMNP-TV-Z]{26}$/.test(item.id)) {
    problems.push('id must match fb_<26 Crockford chars>');
  }
  if (typeof item.project_id !== 'string' || item.project_id === '') problems.push('project_id must be a non-empty string');
  if (typeof item.session_id !== 'string' || item.session_id === '') problems.push('session_id must be a non-empty string');
  if (!item.author || typeof item.author.user_id !== 'string' || item.author.user_id === '') problems.push('author.user_id must be a non-empty string');
  if (!item.origin || !ORIGIN_MODES.includes(item.origin.mode)) problems.push(`origin.mode must be one of ${ORIGIN_MODES.join(', ')}`);
  if (!item.feedback || !FEEDBACK_TYPES.includes(item.feedback.type)) problems.push(`feedback.type must be one of ${FEEDBACK_TYPES.join(', ')}`);
  if (!item.feedback || typeof item.feedback.text !== 'string' || item.feedback.text === '') problems.push('feedback.text must be a non-empty string');
  if (!FEEDBACK_STATUSES.includes(item.status)) problems.push(`status must be one of ${FEEDBACK_STATUSES.join(', ')}`);
  return problems;
}

/** Construct a canonical feedback item (fields in schema order). */
export function makeFeedback(fields) {
  const uiState = sortedObject(fields.ui_state ?? {});
  const item = {
    schema_version: SCHEMA_VERSION,
    id: fields.id,
    project_id: fields.project_id,
    session_id: fields.session_id,
    author: { user_id: fields.author.user_id, display_name: fields.author.display_name },
    origin: { mode: fields.origin },
  };
  if (fields.location) item.location = orderedLocation(fields.location);
  item.target = orderedTarget(fields.target ?? {});
  item.ui_state = uiState;
  item.feedback = { type: fields.type, text: fields.text };
  item.status = fields.status ?? 'open';
  item.created_at = fields.created_at;
  item.updated_at = fields.updated_at ?? fields.created_at;
  if (fields.incorporation) item.incorporation = { ...fields.incorporation };
  if (fields.validation) item.validation = { ...fields.validation };
  return item;
}

function orderedLocation(loc) {
  const out = {};
  for (const k of ['route', 'page', 'component', 'component_instance']) {
    if (loc[k] !== undefined) out[k] = loc[k];
  }
  return out;
}

function orderedTarget(target) {
  const out = {};
  for (const k of ['tux_id', 'test_id', 'component', 'role', 'accessible_name', 'text', 'css_selector', 'dom_path', 'bounding_box']) {
    if (target[k] !== undefined) out[k] = target[k];
  }
  return out;
}

/** Normalized text for duplicate detection: trimmed, whitespace-collapsed, case-folded. */
export function normalizedText(text) {
  return text.trim().replace(/\s+/g, ' ').toLowerCase();
}
