import type { AppContext } from '../../../core/context';
import { AppError, ErrorCodes } from '../../../core/shared/errors';
import { generatePrefixedId, encryptData } from '../../../core/shared/crypto';
import { NotificationPreferencesRepository, type CanonicalPreferenceItem } from '../repositories/notification-preferences.repository';
import type { UpdateProfileInput, SavePersonalApiKeyInput } from '../validation/account-settings.validation';
import type { CachedSession } from '../../auth/services/session.service';

export interface UserAccountSettingsProfile {
  id: string;
  chamber_id: string;
  email: string;
  name: string;
  title: string | null;
  phone: string | null;
  avatar_url: string | null;
  ai_credits_used: number;
  ai_credits_limit: number;
  personal_api_provider: string | null;
  has_personal_api_key: boolean;
}

export interface ActiveSessionView {
  sessionId: string;
  isCurrent: boolean;
  ipAddress: string;
  userAgent: string;
  lastActiveAt: string;
  createdAt: string;
}

export class AccountSettingsService {
  /**
   * Retrieves user profile, canonical 15-item notification matrix, active sessions, and AI credit status
   */
  static async getSettings(c: AppContext, userId: string, chamberId: string) {
    const userRow = await c.env.DB.prepare(
      `SELECT id, chamber_id, email, name, avatar_url, phone,
              ai_credits_used, ai_credits_limit, personal_api_provider,
              personal_api_key_encrypted
       FROM users
       WHERE id = ? AND chamber_id = ?
       LIMIT 1`
    )
      .bind(userId, chamberId)
      .first<{
        id: string;
        chamber_id: string;
        email: string;
        name: string;
        avatar_url: string | null;
        phone: string | null;
        ai_credits_used: number;
        ai_credits_limit: number;
        personal_api_provider: string | null;
        personal_api_key_encrypted: string | null;
      }>();

    if (!userRow) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'User profile not found', 404);
    }

    // Check optional admin_profiles for job_title
    const adminRow = await c.env.DB.prepare(
      `SELECT job_title FROM admin_profiles WHERE user_id = ? AND chamber_id = ? LIMIT 1`
    )
      .bind(userId, chamberId)
      .first<{ job_title: string }>();

    const preferences = await NotificationPreferencesRepository.getPreferences(
      c.env.DB,
      chamberId,
      userId
    );

    // Active sessions presentation
    const currentToken = c.get('sessionToken') || '';
    const currentSession = c.get('session') as CachedSession | undefined;

    const activeSessions: ActiveSessionView[] = [];
    if (currentToken) {
      activeSessions.push({
        sessionId: currentToken,
        isCurrent: true,
        ipAddress:
          currentSession?.ipAddress ||
          c.req.header('cf-connecting-ip') ||
          c.req.header('x-forwarded-for') ||
          '127.0.0.1',
        userAgent:
          currentSession?.userAgent || c.req.header('user-agent') || 'Current Browser',
        lastActiveAt: currentSession?.lastActiveAt || new Date().toISOString(),
        createdAt: currentSession?.createdAt || new Date().toISOString(),
      });
    }

    const profile: UserAccountSettingsProfile = {
      id: userRow.id,
      chamber_id: userRow.chamber_id,
      email: userRow.email,
      name: userRow.name || '',
      title: adminRow?.job_title || null,
      phone: userRow.phone,
      avatar_url: userRow.avatar_url,
      ai_credits_used: userRow.ai_credits_used ?? 0,
      ai_credits_limit: userRow.ai_credits_limit ?? 5,
      personal_api_provider: userRow.personal_api_provider,
      has_personal_api_key: Boolean(userRow.personal_api_key_encrypted),
    };

    return {
      profile,
      preferences,
      activeSessions,
    };
  }

  /**
   * Updates user name, phone, and optional title
   */
  static async updateProfile(
    c: AppContext,
    userId: string,
    chamberId: string,
    input: UpdateProfileInput
  ) {
    await c.env.DB.prepare(
      `UPDATE users
       SET name = ?, phone = ?, updated_at = datetime('now')
       WHERE id = ? AND chamber_id = ?`
    )
      .bind(input.name, input.phone || null, userId, chamberId)
      .run();

    // If title is passed, update or create record in admin_profiles
    if (input.title !== undefined) {
      const existingAdmin = await c.env.DB.prepare(
        'SELECT id FROM admin_profiles WHERE user_id = ? AND chamber_id = ? LIMIT 1'
      )
        .bind(userId, chamberId)
        .first<{ id: string }>();

      if (existingAdmin) {
        await c.env.DB.prepare(
          `UPDATE admin_profiles
           SET job_title = ?, updated_at = datetime('now')
           WHERE id = ?`
        )
          .bind(input.title, existingAdmin.id)
          .run();
      } else if (input.title) {
        const adminId = generatePrefixedId('adm_prof');
        await c.env.DB.prepare(
          `INSERT INTO admin_profiles (
             id, chamber_id, user_id, job_title, created_at, updated_at
           ) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`
        )
          .bind(adminId, chamberId, userId, input.title)
          .run();
      }
    }

    // Refresh active session in KV with updated name
    const currentToken = c.get('sessionToken');
    if (currentToken && c.env.KV) {
      try {
        const sessionData = await c.env.KV.get(`session:${currentToken}`, 'json');
        if (sessionData) {
          const s = sessionData as any;
          const [first, ...rest] = input.name.trim().split(/\s+/);
          s.firstName = first || '';
          s.lastName = rest.join(' ') || '';
          if (s.user) {
            s.user.firstName = s.firstName;
            s.user.lastName = s.lastName;
          }
          await c.env.KV.put(`session:${currentToken}`, JSON.stringify(s), {
            expirationTtl: 1800,
          });
        }
      } catch (err) {
        console.warn('[KV_SESSION_NAME_REFRESH_WARNING]', err);
      }
    }

    // Audit log
    await this.logAudit(c, chamberId, userId, 'ACCOUNT_SETTINGS_UPDATED', {
      name: input.name,
      phone: input.phone,
      title: input.title,
    });

    return {
      message: 'Profile updated successfully.',
      updated_at: new Date().toISOString(),
    };
  }

  /**
   * Updates notification matrix in D1
   */
  static async updateNotifications(
    c: AppContext,
    userId: string,
    chamberId: string,
    preferences: CanonicalPreferenceItem[]
  ) {
    const updatedCount = await NotificationPreferencesRepository.updatePreferences(
      c.env.DB,
      chamberId,
      userId,
      preferences
    );

    await this.logAudit(c, chamberId, userId, 'NOTIFICATION_PREFERENCES_UPDATED', {
      updatedCount,
    });

    return {
      updated_count: updatedCount,
      message: 'Notification preferences saved.',
    };
  }

  /**
   * Revokes remote session from Cloudflare KV
   */
  static async revokeSession(
    c: AppContext,
    userId: string,
    chamberId: string,
    targetSessionId: string
  ) {
    if (c.env.KV) {
      await c.env.KV.delete(`session:${targetSessionId}`);
    }

    await this.logAudit(c, chamberId, userId, 'SECURITY_SESSION_REVOKED', {
      revokedSessionId: targetSessionId,
    });

    return {
      revoked: true,
      session_id: targetSessionId,
    };
  }

  /**
   * Encrypts personal API key using AES-GCM and persists to users table
   */
  static async savePersonalApiKey(
    c: AppContext,
    userId: string,
    chamberId: string,
    input: SavePersonalApiKeyInput
  ) {
    const masterSecret =
      c.env.CHAMBER_ENCRYPTION_KEY ||
      'ch_sec_default_256bit_master_key_121meet';

    const encryptedKey = await encryptData(input.api_key, masterSecret);

    await c.env.DB.prepare(
      `UPDATE users
       SET personal_api_key_encrypted = ?,
           personal_api_provider = ?,
           updated_at = datetime('now')
       WHERE id = ? AND chamber_id = ?`
    )
      .bind(encryptedKey, input.provider, userId, chamberId)
      .run();

    await this.logAudit(c, chamberId, userId, 'BYO_API_KEY_CONFIGURED', {
      provider: input.provider,
    });

    return {
      message: 'Personal API key configured successfully.',
      provider: input.provider,
    };
  }

  private static async logAudit(
    c: AppContext,
    chamberId: string,
    userId: string,
    action: string,
    details: any
  ) {
    try {
      const auditId = generatePrefixedId('aud');
      const ip =
        c.req.header('cf-connecting-ip') ||
        c.req.header('x-forwarded-for') ||
        '127.0.0.1';
      const userAgent = c.req.header('user-agent') || 'Unknown';
      const user = c.get('user');

      await c.env.DB.prepare(
        `INSERT INTO platform_audit_logs (
           id, chamber_id, actor_id, actor_role, actor_name, action, target_type, target_id, details_json, ip_address, user_agent, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, 'users', ?, ?, ?, ?, datetime('now'))`
      )
        .bind(
          auditId,
          chamberId,
          userId,
          user?.highest_role || 'member',
          user?.email || 'User',
          action,
          userId,
          JSON.stringify(details),
          ip,
          userAgent
        )
        .run();
    } catch (err) {
      console.warn('[AUDIT_LOG_ERROR]', err);
    }
  }
}
