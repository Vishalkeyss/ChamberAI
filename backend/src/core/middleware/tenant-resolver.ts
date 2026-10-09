import type { MiddlewareHandler } from 'hono';
import type { Env } from '../env';
import type { AppVariables, ChamberContextData } from '../context';
import { AppError, ErrorCodes } from '../shared/errors';
import { SessionService } from '../../modules/auth/services/session.service';
import { getRuntimeConfig, extractSubdomain, isPlatformHost as isPlatformHostFor } from '../config';

export { extractSubdomain };

export const resolveChamberMiddleware: MiddlewareHandler<{
  Bindings: Env;
  Variables: AppVariables;
}> = async (c, next) => {
  const host = c.req.header('Host') || '';
  const config = getRuntimeConfig(c.env);
  // Client tenant headers only where allowed by core/config (local, staging); production uses the Host.
  const explicitChamberId = config.allowTenantHeader ? c.req.header('X-Chamber-ID') : undefined;
  const explicitChamberSlug = config.allowTenantHeader ? c.req.header('X-Chamber-Slug') : undefined;

  const cleanHost = host.split(':')[0].toLowerCase();
  const isPlatformHost = isPlatformHostFor(host, config);

  let chamber: ChamberContextData | null = null;

  // 1. Try explicit ID or Slug if provided
  if (explicitChamberId) {
    chamber = await c.env.DB.prepare(
      "SELECT id, name, subdomain, custom_domain, status FROM platform_chambers WHERE (id = ? OR subdomain = ?) AND status != 'suspended' LIMIT 1"
    )
      .bind(explicitChamberId, explicitChamberId)
      .first<ChamberContextData>();
  }

  const subdomain = explicitChamberSlug || extractSubdomain(host, config.platformDomain, config.isLocal);
  if (!chamber && subdomain) {
    chamber = await c.env.DB.prepare(
      "SELECT id, name, subdomain, custom_domain, status FROM platform_chambers WHERE (subdomain = ? OR id = ?) AND status != 'suspended' LIMIT 1"
    )
      .bind(subdomain, subdomain)
      .first<ChamberContextData>();
  }

  // 2. Try host custom domain
  if (!chamber && host && !isPlatformHost) {
    chamber = await c.env.DB.prepare(
      "SELECT id, name, subdomain, custom_domain, status FROM platform_chambers WHERE custom_domain = ? AND status != 'suspended' LIMIT 1"
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
          "SELECT id, name, subdomain, custom_domain, status FROM platform_chambers WHERE id = ? AND status != 'suspended' LIMIT 1"
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
