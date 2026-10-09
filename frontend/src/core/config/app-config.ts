/**
 * Central frontend configuration. Environment values are read here only.
 *
 * - `VITE_PLATFORM_DOMAIN`: root domain; chamber sites live at `<subdomain>.<domain>`.
 * - `VITE_API_URL`: API origin; empty = same origin (`/api/...`, recommended).
 * - `VITE_TENANT_ROUTING`: `subdomain` (default, production) or `path` (staging on workers.dev:
 *   chamber opened at `/c/<slug>`, tenant sent as `X-Chamber-Slug`).
 *
 * No domain / URL defaults in code (AGENTS.md §9). Local dev uses `*.localhost`.
 */

export interface ChamberHostInput {
  slug?: string | null;
  subdomain?: string | null;
  customDomain?: string | null;
}

export type TenantRouting = 'subdomain' | 'path';

const RESERVED_SUBDOMAINS = new Set(['app', 'superadmin', 'www', 'api']);

/** sessionStorage key already read by the API clients for the X-Chamber-Slug header. */
const ACTIVE_CHAMBER_KEY = 'active_chamber_slug';

function normalizeDomain(value: string | undefined): string | null {
  const v = (value || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '');
  return v || null;
}

export const appConfig = {
  platformDomain: normalizeDomain(import.meta.env.VITE_PLATFORM_DOMAIN),
  apiBaseUrl: (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, ''),
  tenantRouting: (import.meta.env.VITE_TENANT_ROUTING === 'path' ? 'path' : 'subdomain') as TenantRouting,
} as const;

function currentHostname(): string {
  return typeof window === 'undefined' ? '' : window.location.hostname.toLowerCase();
}

export function isPathTenantRouting(): boolean {
  return appConfig.tenantRouting === 'path';
}

export function isLocalHostname(hostname = currentHostname()): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.localhost');
}

/**
 * Root domain used to build chamber hosts: `localhost` while running locally,
 * otherwise `VITE_PLATFORM_DOMAIN` (null when not configured).
 */
export function getPlatformDomain(hostname = currentHostname()): string | null {
  return isLocalHostname(hostname) ? 'localhost' : appConfig.platformDomain;
}

/** Chamber slug from `<slug>.<platform domain>` / `<slug>.localhost`; null for platform hosts. */
export function detectChamberSlugFromHost(hostname = currentHostname()): string | null {
  if (isPathTenantRouting() && !isLocalHostname(hostname)) return null;
  const root = getPlatformDomain(hostname);
  if (!root || !hostname.endsWith(`.${root}`)) return null;
  const sub = hostname.slice(0, -(root.length + 1));
  if (!sub || sub.includes('.') || RESERVED_SUBDOMAINS.has(sub)) return null;
  return sub;
}

/** Slug from `/c/<slug>` (path routing). */
export function detectChamberSlugFromPath(
  pathname = typeof window === 'undefined' ? '' : window.location.pathname
): string | null {
  const m = /^\/c\/([a-z0-9-]+)/i.exec(pathname);
  return m ? m[1].toLowerCase() : null;
}

export function getActiveChamberSlug(): string | null {
  try {
    return sessionStorage.getItem(ACTIVE_CHAMBER_KEY);
  } catch {
    return null;
  }
}

export function setActiveChamberSlug(slug: string | null) {
  try {
    if (slug) sessionStorage.setItem(ACTIVE_CHAMBER_KEY, slug);
    else sessionStorage.removeItem(ACTIVE_CHAMBER_KEY);
  } catch {
    /* storage unavailable */
  }
}

/** Display host of a chamber site: verified custom domain, else `<subdomain>.<platform domain>`. */
export function buildChamberHost(chamber: ChamberHostInput): string | null {
  if (chamber.customDomain) return chamber.customDomain;
  const sub = chamber.subdomain || chamber.slug;
  if (isPathTenantRouting() && typeof window !== 'undefined') {
    return sub ? `${window.location.host}/c/${sub}` : null;
  }
  const root = getPlatformDomain();
  return sub && root ? `${sub}.${root}` : null;
}

function originParts(): { protocol: string; port: string } {
  if (typeof window === 'undefined') return { protocol: 'https:', port: '' };
  return { protocol: window.location.protocol, port: window.location.port ? `:${window.location.port}` : '' };
}

/** Absolute URL of a chamber site, keeping the current protocol / port (local dev). */
export function buildChamberSiteUrl(chamber: ChamberHostInput, path = '/'): string | null {
  if (isPathTenantRouting() && typeof window !== 'undefined') {
    const sub = chamber.subdomain || chamber.slug;
    return sub ? `${window.location.origin}/c/${sub}${path}` : null;
  }
  const host = buildChamberHost(chamber);
  if (!host) return null;
  const { protocol, port } = originParts();
  return `${protocol}//${host}${chamber.customDomain ? '' : port}${path}`;
}

/** Absolute URL of the platform root (chamber picker). */
export function buildPlatformRootUrl(path = '/'): string | null {
  if (isPathTenantRouting() && typeof window !== 'undefined') return `${window.location.origin}${path}`;
  const root = getPlatformDomain();
  if (!root) return null;
  const { protocol, port } = originParts();
  return `${protocol}//${root}${port}${path}`;
}

/** True for a host that is neither local nor the platform domain / one of its subdomains. */
export function isCustomDomainHost(hostname = currentHostname()): boolean {
  if (!hostname || isLocalHostname(hostname) || isPathTenantRouting()) return false;
  const root = appConfig.platformDomain;
  return !root || (hostname !== root && !hostname.endsWith(`.${root}`));
}

/**
 * Path routing only: every same-origin `/api/` request carries the active chamber as
 * `X-Chamber-Slug` (clients that already set one are left alone). Installed once in main.tsx.
 */
export function installTenantHeaderFetch() {
  if (!isPathTenantRouting() || typeof window === 'undefined') return;
  const original = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const slug = getActiveChamberSlug();
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const target = new URL(url, window.location.href);
    if (!slug || target.origin !== window.location.origin || !target.pathname.startsWith('/api/')) {
      return original(input, init);
    }
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    if (!headers.has('X-Chamber-Slug') && !headers.has('X-Chamber-ID')) headers.set('X-Chamber-Slug', slug);
    return original(input, { ...init, headers });
  };
}
