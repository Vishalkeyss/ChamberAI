import type { MiddlewareHandler } from 'hono';
import type { Env } from '../env';
import type { AppVariables, ChamberContextData } from '../context';
import { AppError, ErrorCodes } from '../shared/errors';
import { SessionService } from '../../modules/auth/services/session.service';

export function extractSubdomain(host: string, rootDomain = '121meet.ai'): string | null {
  const cleanHost = (host || '').split(':')[0].toLowerCase();
  if (cleanHost.endsWith(`.${rootDomain}`)) {
    const subdomain = cleanHost.slice(0, -(rootDomain.length + 1));
    return subdomain.includes('.') ? null : subdomain;
  }
  return null;
}

export const resolveChamberMiddleware: MiddlewareHandler<{
  Bindings: Env;
  Variables: AppVariables;
}> = async (c, next) => {
  const host = c.req.header('Host') || '';
  const rootDomain = c.env.PLATFORM_DOMAIN || '121meet.ai';
  const explicitChamberId = c.req.header('X-Chamber-ID');
  const explicitChamberSlug = c.req.header('X-Chamber-Slug');

  const cleanHost = host.split(':')[0].toLowerCase();
  const isPlatformHost =
    !cleanHost ||
    cleanHost === rootDomain ||
    cleanHost === `app.${rootDomain}` ||
    cleanHost === `superadmin.${rootDomain}` ||
    cleanHost === 'localhost' ||
    cleanHost === '127.0.0.1';

  let chamber: ChamberContextData | null = null;

  // 1. Try explicit ID or Slug if provided
  if (explicitChamberId) {
    chamber = await c.env.DB.prepare(
      'SELECT id, name, subdomain, custom_domain, status FROM platform_chambers WHERE (id = ? OR subdomain = ?) AND status != "suspended" LIMIT 1'
    )
      .bind(explicitChamberId, explicitChamberId)
      .first<ChamberContextData>();
  }

  const subdomain = explicitChamberSlug || extractSubdomain(host, rootDomain);
  if (!chamber && subdomain) {
    chamber = await c.env.DB.prepare(
      'SELECT id, name, subdomain, custom_domain, status FROM platform_chambers WHERE (subdomain = ? OR id = ?) AND status != "suspended" LIMIT 1'
    )
      .bind(subdomain, subdomain)
      .first<ChamberContextData>();
  }

  // 2. Try host custom domain
  if (!chamber && host && !isPlatformHost) {
    chamber = await c.env.DB.prepare(
      'SELECT id, name, subdomain, custom_domain, status FROM platform_chambers WHERE custom_domain = ? AND status != "suspended" LIMIT 1'
    )
      .bind(cleanHost)
      .first<ChamberContextData>();
  }

  // 3. Fallback: If on platform host or localhost and authenticated via Bearer token, resolve from session
  if (!chamber && isPlatformHost) {
    const authHeader = c.req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      const session = await SessionService.getSession(c, token);
      if (session?.chamberId) {
        chamber = await c.env.DB.prepare(
          'SELECT id, name, subdomain, custom_domain, status FROM platform_chambers WHERE id = ? AND status != "suspended" LIMIT 1'
        )
          .bind(session.chamberId)
          .first<ChamberContextData>();
      }
    }
  }

  if (chamber) {
    c.set('chamberId', chamber.id);
    c.set('chamber', chamber);
    return await next();
  }

  // Check if platform scope without tenant parameters
  if (isPlatformHost && !explicitChamberId && !explicitChamberSlug) {
    c.set('isPlatformScope', true);
    return await next();
  }

  // If endpoint is a generic platform health check or public chambers directory, allow through
  if (
    c.req.path === '/api/v1/health' ||
    c.req.path === '/health' ||
    c.req.path.startsWith('/api/v1/public/chambers')
  ) {
    return await next();
  }

  // If no match found, throw CHAMBER_NOT_FOUND
  throw new AppError(
    ErrorCodes.CHAMBER_NOT_FOUND,
    'No active chamber matches the requested domain host',
    404,
    { host, subdomain }
  );
};
