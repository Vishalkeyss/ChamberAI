/**
 * Readable record IDs (OD-017 … OD-020, see ID_PATTERN_PROPOSAL.md).
 *
 *   <PREFIX>_<SCOPE>_<YYYYMMDD>_<SUFFIX>     e.g. USR_ROCKWELL_20261008_K7P2  (always UPPERCASE)
 *
 * - SCOPE  = chamber subdomain uppercased (immutable), or `PLATFORM` for platform-level rows.
 * - date   = UTC creation date.
 * - SUFFIX = random Crockford base32 (no I/L/O/U).
 * Never put names, roles, emails or other mutable/PII values in an ID.
 * Secrets (session/verification tokens) must NOT use this — they stay fully random.
 */

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // 32 chars → no modulo bias
const PLATFORM_SCOPE = 'PLATFORM';
const MAX_ATTEMPTS = 5;

/** Chamber subdomains never change, so the lookup is safe to cache per isolate. */
const scopeCache = new Map<string, string>();

export function randomSuffix(length = 4): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % 32]).join('');
}

export function utcDateStamp(date = new Date()): string {
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

/** Uppercase A-Z0-9 and single dashes only (IDs are fully uppercase). */
export function slugifyIdPart(value: string): string {
  return value
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30);
}

export function formatReadableId(prefix: string, scope: string, suffixLength = 4, date = new Date()): string {
  return `${prefix}_${slugifyIdPart(scope) || PLATFORM_SCOPE}_${utcDateStamp(date)}_${randomSuffix(suffixLength)}`;
}

/** Chamber ID is the immutable subdomain itself: CHAM_<subdomain>. */
export function formatChamberId(subdomain: string): string {
  return `CHAM_${slugifyIdPart(subdomain)}`;
}

export async function resolveChamberScope(d1: D1Database, chamberId: string | null | undefined): Promise<string> {
  if (!chamberId) return PLATFORM_SCOPE;
  const cached = scopeCache.get(chamberId);
  if (cached) return cached;

  let scope: string | null = null;
  try {
    const row = await d1
      .prepare('SELECT subdomain FROM platform_chambers WHERE id = ?')
      .bind(chamberId)
      .first<{ subdomain: string | null }>();
    scope = row?.subdomain ? slugifyIdPart(row.subdomain) : null;
  } catch {
    scope = null;
  }
  // Custom-domain-only chambers have no subdomain: fall back to the chamber id itself.
  const resolved = scope || slugifyIdPart(chamberId.replace(/^CHAM_/i, '')) || PLATFORM_SCOPE;
  scopeCache.set(chamberId, resolved);
  return resolved;
}

/**
 * Fixed key for rows that exist once per chamber (e.g. chamber_settings → CSET_rockwell),
 * optionally qualified by an immutable key (e.g. provider).
 */
export async function chamberKeyedId(
  d1: D1Database,
  prefix: string,
  chamberId: string,
  key?: string
): Promise<string> {
  const scope = await resolveChamberScope(d1, chamberId);
  return key ? `${prefix}_${scope}_${slugifyIdPart(key)}` : `${prefix}_${scope}`;
}

export interface NewIdOptions {
  /** Chamber the row belongs to; omit/null for platform-level rows. */
  chamberId?: string | null;
  /** Default 4; use 6 for high-volume tables (logs, messages). */
  suffixLength?: number;
  /** Skip the DB existence check (only for high-volume rows with a 6+ char suffix). */
  skipUniqueCheck?: boolean;
}

/**
 * Generates a readable, collision-checked ID for `table`.
 * `table` must be a trusted constant (it is interpolated into SQL).
 */
export async function newId(
  d1: D1Database,
  table: string,
  prefix: string,
  options: NewIdOptions = {}
): Promise<string> {
  if (!/^[a-z_]+$/.test(table)) throw new Error(`Invalid table name for ID generation: ${table}`);
  const scope = await resolveChamberScope(d1, options.chamberId);
  const suffixLength = options.suffixLength ?? 4;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const id = formatReadableId(prefix, scope, suffixLength);
    if (options.skipUniqueCheck) return id;
    const existing = await d1.prepare(`SELECT 1 AS found FROM ${table} WHERE id = ?`).bind(id).first();
    if (!existing) return id;
  }
  throw new Error(`Could not generate a unique ${prefix} id for ${table}`);
}
