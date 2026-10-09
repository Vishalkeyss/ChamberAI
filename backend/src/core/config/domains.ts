import type { RuntimeConfig } from './runtime-config';

/** Hostname without port, lower-cased. */
export function cleanHostname(host: string): string {
  return (host || '').split(':')[0].trim().toLowerCase();
}

/**
 * Chamber slug from `<slug>.<platformDomain>` (or `<slug>.localhost` for local dev).
 * Nested subdomains are rejected.
 */
export function extractSubdomain(host: string, platformDomain: string | null, allowLocalhost = true): string | null {
  const clean = cleanHostname(host);
  const pick = (suffix: string) => {
    const sub = clean.slice(0, -suffix.length);
    return sub && !sub.includes('.') ? sub : null;
  };
  if (platformDomain && clean.endsWith(`.${platformDomain}`)) return pick(`.${platformDomain}`);
  if (allowLocalhost && clean.endsWith('.localhost')) return pick('.localhost');
  return null;
}

/** Platform-level hosts (no chamber): root domain, `app.` / `superadmin.`, and local hosts in dev. */
export function isPlatformHost(host: string, config: RuntimeConfig): boolean {
  const clean = cleanHostname(host);
  if (!clean) return true;
  if (config.isLocal && (clean === 'localhost' || clean === '127.0.0.1')) return true;
  const root = config.platformDomain;
  return !!root && (clean === root || clean === `app.${root}` || clean === `superadmin.${root}`);
}

/**
 * CORS allowlist: the platform domain and its chamber subdomains over https, exact
 * `ALLOWED_ORIGINS`, and localhost only for local development. Same-origin requests
 * (frontend and API on one host, incl. custom domains) do not need CORS at all.
 */
export function isAllowedFrontendOrigin(origin: string, config: RuntimeConfig): boolean {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  const normalized = `${url.protocol}//${url.host}`.toLowerCase();
  if (config.extraAllowedOrigins.includes(normalized)) return true;

  const host = url.hostname.toLowerCase();
  if (config.isLocal && (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.localhost'))) {
    return true;
  }
  const root = config.platformDomain;
  if (!root || url.protocol !== 'https:') return false;
  return host === root || (host.endsWith(`.${root}`) && !host.slice(0, -(root.length + 1)).includes('.'));
}
