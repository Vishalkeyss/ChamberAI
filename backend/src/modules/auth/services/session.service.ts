import type { AppContext } from '../../../core/context';
import { generateSessionToken, generatePrefixedId } from '../../../core/shared/crypto';
import { isLocalDevRequest } from '../../../core/shared/dev-guard';

export type PlatformRole =
  | 'super_admin'
  | 'full_admin'
  | 'billing_admin'
  | 'chapter_admin'
  | 'group_admin'
  | 'member';

export interface CachedSessionRole {
  roleId: string;
  scopeType: 'chamber' | 'chapter' | 'group';
  scopeId: string;
}

export interface CachedSessionUser {
  id: string;
  email: string;
  phone?: string | null;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  highestRole: PlatformRole;
  pointsBalance: number;
}

export interface CachedSessionChamber {
  id: string;
  name: string;
}

export interface CachedSession {
  userId: string;
  chamberId: string | null;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  highestRole: PlatformRole;
  roles: CachedSessionRole[];
  pointsBalance: number;
  chamber: CachedSessionChamber | null;
  portal?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
  lastActiveAt: string;
}

export interface CreateSessionParams {
  userId: string;
  chamberId: string | null;
  chamberName?: string | null;
  email: string;
  phone?: string | null;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  highestRole: PlatformRole;
  roles: CachedSessionRole[];
  pointsBalance?: number;
  portal?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface SessionResponseData {
  user: {
    id: string;
    email: string;
    phone?: string | null;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    highestRole: PlatformRole;
    pointsBalance: number;
  };
  roles: CachedSessionRole[];
  chamber: CachedSessionChamber | null;
}

const SESSION_TTL_SECONDS = 86400; // 24 hours in KV (sliding window + client idle timeout controls auto-logout)
const SLIDING_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

export class SessionService {
  /**
   * Generates a high-entropy bearer token and persists CachedSession into Cloudflare Workers KV
   */
  static async createSession(
    c: AppContext,
    params: CreateSessionParams
  ): Promise<{ token: string; expiresAt: string; session: CachedSession }> {
    const token = generateSessionToken();
    const now = new Date();
    const nowIso = now.toISOString();
    const expiresAt = new Date(now.getTime() + SESSION_TTL_SECONDS * 1000).toISOString();

    const chamber: CachedSessionChamber | null = params.chamberId
      ? {
          id: params.chamberId,
          name: params.chamberName || 'Chamber',
        }
      : null;

    const session: CachedSession = {
      userId: params.userId,
      chamberId: params.chamberId,
      email: params.email,
      firstName: params.firstName,
      lastName: params.lastName,
      avatarUrl: params.avatarUrl || null,
      highestRole: params.highestRole,
      roles: params.roles || [],
      pointsBalance: params.pointsBalance ?? 0,
      chamber,
      portal: params.portal,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      createdAt: nowIso,
      lastActiveAt: nowIso,
    };

    if (c.env.KV) {
      await c.env.KV.put(`session:${token}`, JSON.stringify(session), {
        expirationTtl: SESSION_TTL_SECONDS,
      });
    }

    return { token, expiresAt, session };
  }

  /**
   * Retrieves active session from Cloudflare KV
   */
  static async getSession(c: AppContext, token: string): Promise<CachedSession | null> {
    if (!token) {
      return null;
    }

    // Local development super admin fallback
    if (token === 'dev_super_admin_token' && isLocalDevRequest(c)) {
      return {
        userId: 'usr_super_root',
        chamberId: 'plat_root',
        email: 'superadmin@121meet.ai',
        firstName: 'Root',
        lastName: 'Administrator',
        avatarUrl: null,
        highestRole: 'super_admin',
        roles: [{ roleId: 'super_admin', scopeType: 'chamber', scopeId: 'plat_root' }],
        pointsBalance: 0,
        chamber: { id: 'plat_root', name: '121 Meet Platform Engine' },
        createdAt: '2026-01-01T00:00:00Z',
        lastActiveAt: new Date().toISOString(),
      };
    }

    // Local development member fallback
    if (token === 'dev_member_token' && isLocalDevRequest(c)) {
      return {
        userId: 'usr_member00000001',
        chamberId: 'cham_test0000000001',
        email: 'member@metrodev.com',
        firstName: 'Sarah',
        lastName: 'Jenkins',
        avatarUrl: null,
        highestRole: 'member',
        roles: [{ roleId: 'member', scopeType: 'chamber', scopeId: 'cham_test0000000001' }],
        pointsBalance: 500,
        chamber: { id: 'cham_test0000000001', name: 'Metro Dev Chamber of Commerce' },
        createdAt: '2026-01-01T00:00:00Z',
        lastActiveAt: new Date().toISOString(),
      };
    }

    // Local development full_admin fallback
    if (token === 'dev_admin_token' && isLocalDevRequest(c)) {
      return {
        userId: 'usr_admin000000001',
        chamberId: 'cham_test0000000001',
        email: 'admin@metrodev.com',
        firstName: 'Marcus',
        lastName: 'Vance',
        avatarUrl: null,
        highestRole: 'full_admin',
        roles: [{ roleId: 'full_admin', scopeType: 'chamber', scopeId: 'cham_test0000000001' }],
        pointsBalance: 0,
        chamber: { id: 'cham_test0000000001', name: 'Metro Dev Chamber of Commerce' },
        createdAt: '2026-01-01T00:00:00Z',
        lastActiveAt: new Date().toISOString(),
      };
    }

    if (!c.env.KV) {
      return null;
    }

    try {
      const data = await c.env.KV.get(`session:${token}`, 'json');
      return (data as CachedSession) || null;
    } catch (err) {
      console.error('[KV_SESSION_READ_ERROR]', err);
      return null;
    }
  }

  /**
   * Sliding session extension: resets TTL if >5 mins elapsed or if force is true
   */
  static async touchSession(c: AppContext, token: string, session: CachedSession, force = false): Promise<void> {
    const lastActive = new Date(session.lastActiveAt).getTime();
    const now = Date.now();

    if ((force || now - lastActive > SLIDING_THRESHOLD_MS) && c.env.KV) {
      session.lastActiveAt = new Date(now).toISOString();
      try {
        await c.env.KV.put(`session:${token}`, JSON.stringify(session), {
          expirationTtl: SESSION_TTL_SECONDS,
        });
      } catch (err) {
        console.warn('[KV_SESSION_TOUCH_WARNING]', err);
      }
    }
  }

  /**
   * Deletes session from KV and logs logout audit trail in platform_audit_logs
   */
  static async invalidateSession(
    c: AppContext,
    token: string,
    session?: CachedSession | null
  ): Promise<boolean> {
    if (!token) return false;

    // Resolve session if not provided to record audit log
    const resolvedSession = session || (await this.getSession(c, token));

    if (c.env.KV) {
      await c.env.KV.delete(`session:${token}`);
    }

    // Write audit log entry (non-fatal)
    if (resolvedSession && c.env.DB) {
      try {
        const auditId = generatePrefixedId('aud');
        const ip =
          c.req.header('cf-connecting-ip') ||
          c.req.header('x-forwarded-for') ||
          resolvedSession.ipAddress ||
          '127.0.0.1';
        const userAgent =
          c.req.header('user-agent') || resolvedSession.userAgent || 'Unknown';
        const actorName = `${resolvedSession.firstName} ${resolvedSession.lastName}`.trim();

        await c.env.DB.prepare(
          `INSERT INTO platform_audit_logs (
             id, chamber_id, actor_id, actor_role, actor_name, action, target_type, target_id, ip_address, user_agent, created_at
           ) VALUES (?, ?, ?, ?, ?, 'user.logged_out', 'user', ?, ?, ?, datetime('now'))`
        )
          .bind(
            auditId,
            resolvedSession.chamberId,
            resolvedSession.userId,
            resolvedSession.highestRole,
            actorName || resolvedSession.email,
            resolvedSession.userId,
            ip,
            userAgent
          )
          .run();
      } catch (err) {
        console.warn('[LOGOUT_AUDIT_LOG_WARNING]', err);
      }
    }

    return true;
  }

  /**
   * Formats CachedSession into canonical SessionResponseData
   */
  static toResponseData(session: CachedSession): SessionResponseData {
    return {
      user: {
        id: session.userId,
        email: session.email,
        firstName: session.firstName,
        lastName: session.lastName,
        avatarUrl: session.avatarUrl,
        highestRole: session.highestRole,
        pointsBalance: session.pointsBalance ?? 0,
      },
      roles: session.roles,
      chamber: session.chamber,
    };
  }
}
