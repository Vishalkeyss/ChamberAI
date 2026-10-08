import type { AppContext } from '../context';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * True only for local development: ENVIRONMENT must be exactly 'development'
 * AND the request must target a local host. Guards dev-only auth shortcuts so
 * they can never activate on a deployed (staging/production) worker.
 */
export function isLocalDevRequest(c: AppContext): boolean {
  if (c.env.ENVIRONMENT !== 'development') return false;
  try {
    const host = new URL(c.req.url).hostname;
    return LOCAL_HOSTS.has(host) || host.endsWith('.localhost');
  } catch {
    return false;
  }
}
