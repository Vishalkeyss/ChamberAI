import type { AppContext } from '../context';
import { AppError, ErrorCodes } from '../shared/errors';
import { SessionService } from '../../modules/auth/services/session.service';

/**
 * Authentication Middleware
 * Enforces valid Cloudflare KV session Bearer token and tenant isolation.
 */
export async function requireAuth(c: AppContext, next: () => Promise<void>) {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError(
      ErrorCodes.UNAUTHORIZED,
      'Invalid or expired session token',
      401
    );
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    throw new AppError(
      ErrorCodes.UNAUTHORIZED,
      'Invalid or expired session token',
      401
    );
  }

  // Sub-15ms edge resolution from Cloudflare KV
  const session = await SessionService.getSession(c, token);
  if (!session) {
    throw new AppError(
      ErrorCodes.UNAUTHORIZED,
      'Invalid or expired session token',
      401
    );
  }

  // Invariant 12: Tenant Isolation Check
  // session.chamberId must match the resolved request chamberId, unless super_admin
  const requestChamberId = c.get('chamberId');
  if (
    requestChamberId &&
    session.chamberId &&
    session.chamberId !== requestChamberId &&
    session.highestRole !== 'super_admin'
  ) {
    throw new AppError(
      ErrorCodes.UNAUTHORIZED,
      'Session token does not belong to this chamber',
      401
    );
  }

  // Sliding session TTL refresh (>5 mins elapsed since last activity)
  try {
    const hasExecutionCtx = 'executionCtx' in c && (c as any).executionCtx;
    if (hasExecutionCtx && typeof (c as any).executionCtx.waitUntil === 'function') {
      (c as any).executionCtx.waitUntil(SessionService.touchSession(c, token, session));
    } else {
      await SessionService.touchSession(c, token, session);
    }
  } catch {
    await SessionService.touchSession(c, token, session);
  }

  // Bind context variables
  c.set('sessionToken', token);
  c.set('session', session);
  if (!c.get('chamberId') && session.chamberId) {
    c.set('chamberId', session.chamberId);
  }
  c.set('user', {
    id: session.userId,
    email: session.email,
    highest_role: session.highestRole,
    chamber_id: session.chamberId || '',
  });
  c.set(
    'roles',
    session.roles.map((r) => r.roleId)
  );

  await next();
}

/**
 * Optional Authentication Middleware
 * Inspects Bearer token if provided without blocking anonymous requests.
 */
export async function optionalAuth(c: AppContext, next: () => Promise<void>) {
  const authHeader = c.req.header('Authorization');

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    if (token) {
      const session = await SessionService.getSession(c, token);
      if (session) {
        c.set('sessionToken', token);
        c.set('session', session);
        c.set('user', {
          id: session.userId,
          email: session.email,
          highest_role: session.highestRole,
          chamber_id: session.chamberId || '',
        });
        c.set(
          'roles',
          session.roles.map((r) => r.roleId)
        );
      }
    }
  }

  await next();
}

/**
 * Role-Based Access Control Middleware
 * Verifies authenticated user has at least one of the allowed roles.
 */
export function requireRole(allowedRoles: string[]) {
  return async (c: AppContext, next: () => Promise<void>) => {
    const user = c.get('user');
    const roles = c.get('roles') || [];

    if (!user) {
      throw new AppError(ErrorCodes.UNAUTHORIZED, 'Authentication required', 401);
    }

    if (user.highest_role === 'super_admin') {
      return await next();
    }

    const hasPermission = allowedRoles.some(
      (role) => user.highest_role === role || roles.includes(role)
    );

    if (!hasPermission) {
      throw new AppError(
        ErrorCodes.FORBIDDEN,
        'Insufficient permissions to access this resource',
        403
      );
    }

    await next();
  };
}
