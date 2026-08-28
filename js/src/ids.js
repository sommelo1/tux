/**
 * Deterministic identifiers and timestamps.
 *
 * IDs are ULIDs (Crockford base32, 26 chars): 48-bit millisecond timestamp
 * plus 80-bit entropy. For cross-runtime byte-identical output the
 * timestamp comes from `TUX_TIME_OVERRIDE` (ISO 8601; naive values are
 * treated as UTC) and the entropy is the first 10 bytes of
 * `SHA-256("<project_id>|<session_id>|<seq>|<kind>")` where `seq` is the
 * 1-based next sequence number in the target store.
 *
 * @module ids
 */
import { createHash } from 'node:crypto';
import { CliError } from './errors.js';

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** Resolve the effective "now" in epoch milliseconds. */
export function nowMs() {
  const override = process.env.TUX_TIME_OVERRIDE;
  if (override === undefined) return Date.now();
  let s = override.trim();
  if (!/(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(s)) s += 'Z';
  const t = Date.parse(s);
  if (Number.isNaN(t)) throw new CliError(3, `invalid TUX_TIME_OVERRIDE: ${override}`);
  return t;
}

/** Canonical UTC timestamp with millisecond precision. */
export function canonicalTimestamp(ms) {
  return new Date(ms).toISOString();
}

/** 80-bit entropy bytes derived deterministically from context. */
export function deterministicEntropy(projectId, sessionId, seq, kind) {
  const material = `${projectId}|${sessionId}|${seq}|${kind}`;
  return createHash('sha256').update(material, 'utf8').digest().subarray(0, 10);
}

/** Encode 16 bytes (6 time + 10 entropy) as a 26-char Crockford ULID. */
export function ulid(timeMs, entropy) {
  const buf = Buffer.alloc(16);
  buf.writeUIntBE(Number(timeMs), 0, 6);
  entropy.copy(buf, 6);
  let n = BigInt('0x' + buf.toString('hex'));
  let out = '';
  for (let i = 0; i < 26; i++) {
    out = CROCKFORD[Number(n % 32n)] + out;
    n /= 32n;
  }
  return out;
}

/** Deterministic prefixed ID (`fb_…`, `batch_…`). */
export function newId(prefix, projectId, sessionId, seq, kind, timeMs) {
  return `${prefix}_${ulid(timeMs, deterministicEntropy(projectId, sessionId, seq, kind))}`;
}
