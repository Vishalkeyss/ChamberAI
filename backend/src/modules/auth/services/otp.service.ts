import { AppContext } from '../../../core/context';
import { AppError, ErrorCodes } from '../../../core/shared/errors';
import { generateSecureOtp, hashOtp, generateSessionToken, generatePrefixedId } from '../../../core/shared/crypto';
import {
  RequestOtpInput,
  VerifyOtpInput,
  normalizePortal,
  detectIdentifierType,
  normalizePhone,
} from '../validation/otp.validation';
import { sendOtpEmail } from './email-delivery.service';
import { sendOtpSms } from './sms-delivery.service';
import { SessionService, type CachedSessionRole } from './session.service';

function splitName(fullName?: string | null): { firstName: string; lastName: string } {
  if (!fullName) return { firstName: '', lastName: '' };
  const parts = fullName.trim().split(/\s+/);
  const firstName = parts[0] || '';
  const lastName = parts.slice(1).join(' ') || '';
  return { firstName, lastName };
}

export interface UserSessionPayload {
  sessionId: string;
  userId: string;
  chamberId: string | null;
  highestRole: string;
  assignedScopes: Record<string, string[]>;
  portal: string;
  createdAt: string;
  expiresAt: string;
}

export class OtpService {
  /**
   * Request a 6-digit passwordless OTP via email or phone
   */
  static async requestOtp(c: AppContext, input: RequestOtpInput) {
    const chamberId = c.get('chamberId') || null;
    const portal = normalizePortal(input.portal);

    // Resolve identifier type and normalize
    const identifierType = detectIdentifierType(input.identifier);
    const isPhone = identifierType === 'phone';
    const normalizedIdentifier = isPhone
      ? normalizePhone(input.identifier)
      : input.identifier; // already lowercased by schema

    // Build WHERE clause for identifier-type-aware lookup
    const identifierClause = isPhone
      ? 'phone = ?'
      : 'email = ?';

    // 1. Rate-Limiting via D1 otp_codes table (1 request per 30s cooldown per identifier per portal)
    try {
      const recentOtp = await c.env.DB.prepare(
        `SELECT created_at FROM otp_codes
         WHERE ${identifierClause} AND portal = ?
         ORDER BY created_at DESC LIMIT 1`
      )
        .bind(normalizedIdentifier, portal)
        .first<{ created_at: string }>();

      if (recentOtp?.created_at) {
        const dateStr = recentOtp.created_at.includes('T') || recentOtp.created_at.endsWith('Z')
          ? recentOtp.created_at
          : recentOtp.created_at.replace(' ', 'T') + 'Z';
        const createdAtMs = new Date(dateStr).getTime();
        const elapsed = (Date.now() - createdAtMs) / 1000;

        // 30s cooldown with 1s network/timer jitter tolerance (29s)
        if (elapsed < 29) {
          const remaining = Math.max(1, Math.ceil(30 - elapsed));
          throw new AppError(
            ErrorCodes.RATE_LIMITED,
            `Please wait ${remaining} second${remaining === 1 ? '' : 's'} before requesting a new verification code`,
            400
          );
        }
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      console.warn('[D1_RATE_LIMIT_WARNING]', err);
    }

    // 2. Resolve chamber name for display
    let chamberName = 'Chamber of Commerce';
    if (chamberId) {
      const chamberRecord = await c.env.DB.prepare(
        'SELECT name FROM platform_chambers WHERE id = ? LIMIT 1'
      )
        .bind(chamberId)
        .first<{ name: string }>();
      if (chamberRecord) chamberName = chamberRecord.name;
    }

    // 3. Identity Verification & Role Authorization Pre-checks
    if (portal === 'member') {
      // Check if identifier belongs to a platform super admin
      const superAdmin = await c.env.DB.prepare(
        `SELECT id FROM platform_super_admins WHERE ${identifierClause} LIMIT 1`
      )
        .bind(normalizedIdentifier)
        .first();

      if (superAdmin) {
        throw new AppError(
          ErrorCodes.FORBIDDEN,
          'This sign-in form is for chamber members only. Administrator accounts must sign in via the designated Admin Portal.',
          403
        );
      }

      let user = await c.env.DB.prepare(
        `SELECT id, email, phone, status, highest_role, chamber_id FROM users
         WHERE ${identifierClause} AND (chamber_id = ? OR ? IS NULL) LIMIT 1`
      )
        .bind(normalizedIdentifier, chamberId, chamberId)
        .first<{ id: string; email: string; phone: string | null; status: string; highest_role: string; chamber_id: string }>();

      // Fallback 1: If not found under current chamber, look up active member across the platform
      if (!user) {
        user = await c.env.DB.prepare(
          `SELECT id, email, phone, status, highest_role, chamber_id FROM users
           WHERE ${identifierClause} AND status = 'active' LIMIT 1`
        )
          .bind(normalizedIdentifier)
          .first<{ id: string; email: string; phone: string | null; status: string; highest_role: string; chamber_id: string }>();
      }

      // Fallback 2: Check if there is an approved application whose user account has not yet been provisioned
      if (!user) {
        const approvedApp = await c.env.DB.prepare(
          `SELECT id, chamber_id, applicant_name, business_email, business_phone, business_name, plan_id
           FROM applications
           WHERE ${isPhone ? 'business_phone = ?' : 'business_email = ?'} AND status = 'approved'
           LIMIT 1`
        )
          .bind(normalizedIdentifier)
          .first<any>();

        if (approvedApp) {
          const now = new Date().toISOString();
          const newUserId = generatePrefixedId('usr');
          const token = generateSessionToken();

          await c.env.DB.batch([
            c.env.DB.prepare(
              `INSERT OR IGNORE INTO users (
                id, chamber_id, member_verification_token, email, phone, name,
                highest_role, status, onboarding_complete, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, 'member', 'active', 1, ?, ?)`
            ).bind(
              newUserId,
              approvedApp.chamber_id,
              token,
              approvedApp.business_email.toLowerCase(),
              approvedApp.business_phone || null,
              approvedApp.applicant_name,
              now,
              now
            ),
            c.env.DB.prepare(
              `INSERT OR IGNORE INTO user_role_assignments (
                id, chamber_id, user_id, role_id, scope_type, scope_id, granted_by, granted_at, is_active
              ) VALUES (?, ?, ?, 'member', 'chamber', ?, ?, ?, 1)`
            ).bind(
              generatePrefixedId('ura'),
              approvedApp.chamber_id,
              newUserId,
              approvedApp.chamber_id,
              newUserId,
              now
            ),
            c.env.DB.prepare(
              `UPDATE applications SET converted_user_id = ?, updated_at = ? WHERE id = ?`
            ).bind(newUserId, now, approvedApp.id),
          ]);

          user = {
            id: newUserId,
            email: approvedApp.business_email,
            phone: approvedApp.business_phone,
            status: 'active',
            highest_role: 'member',
            chamber_id: approvedApp.chamber_id,
          };
        }
      }

      if (!user) {
        throw new AppError(
          ErrorCodes.NOT_FOUND,
          `No member account found with this ${isPhone ? 'phone number' : 'email address'}`,
          404
        );
      }

      if (user.chamber_id) {
        const regChamber = await c.env.DB.prepare(
          'SELECT name FROM platform_chambers WHERE id = ? LIMIT 1'
        )
          .bind(user.chamber_id)
          .first<{ name: string }>();
        if (regChamber?.name) {
          chamberName = regChamber.name;
        }
      }

      // Strictly restrict to members only: reject admins, super_admins, chapter_admins, group_admins, billing_admins
      const adminRoles = ['full_admin', 'billing_admin', 'chapter_admin', 'group_admin', 'super_admin'];
      if (adminRoles.includes(user.highest_role)) {
        throw new AppError(
          ErrorCodes.FORBIDDEN,
          'This sign-in form is for chamber members only. Administrator accounts must sign in via the designated Admin Portal.',
          403
        );
      }

      const adminRole = await c.env.DB.prepare(
        `SELECT role_id FROM user_role_assignments
         WHERE user_id = ? AND role_id IN ('full_admin', 'billing_admin', 'chapter_admin', 'group_admin', 'super_admin') AND is_active = 1
         LIMIT 1`
      )
        .bind(user.id)
        .first();

      if (adminRole) {
        throw new AppError(
          ErrorCodes.FORBIDDEN,
          'This sign-in form is for chamber members only. Administrator accounts must sign in via the designated Admin Portal.',
          403
        );
      }

      if (user.status !== 'active') {
        throw new AppError(
          ErrorCodes.FORBIDDEN,
          'Your account is currently inactive. Please contact your chamber administrator.',
          403
        );
      }
    } else if (portal === 'chamber_admin') {
      const adminUser = await c.env.DB.prepare(
        `SELECT u.id, u.status, ura.role_id
         FROM users u
         JOIN user_role_assignments ura ON u.id = ura.user_id
         WHERE u.${identifierClause}
           AND (u.chamber_id = ? OR ura.chamber_id = ? OR ? IS NULL)
           AND ura.role_id IN ('full_admin', 'chapter_admin', 'group_admin', 'billing_admin')
           AND ura.is_active = 1
         LIMIT 1`
      )
        .bind(normalizedIdentifier, chamberId, chamberId, chamberId)
        .first<{ id: string; status: string; role_id: string }>();

      if (!adminUser) {
        throw new AppError(
          ErrorCodes.FORBIDDEN,
          `No administrative account found for this ${isPhone ? 'phone number' : 'email address'}`,
          403
        );
      }
      if (adminUser.status !== 'active') {
        throw new AppError(ErrorCodes.FORBIDDEN, 'Administrative account is currently inactive', 403);
      }
    } else if (portal === 'super_admin') {
      const superAdmin = await c.env.DB.prepare(
        `SELECT id, email, phone, is_active FROM platform_super_admins
         WHERE ${identifierClause} LIMIT 1`
      )
        .bind(normalizedIdentifier)
        .first<{ id: string; email: string; phone: string | null; is_active: number }>();

      if (!superAdmin) {
        throw new AppError(
          ErrorCodes.FORBIDDEN,
          `No platform super admin account found with this ${isPhone ? 'phone number' : 'email address'}`,
          403
        );
      }
      if (superAdmin.is_active !== 1) {
        throw new AppError(ErrorCodes.FORBIDDEN, 'Super admin account is currently inactive', 403);
      }
    }

    // 4. Generate Secure 6-Digit OTP and Hash
    const code = generateSecureOtp();
    const otpHash = await hashOtp(code);
    const otpId = generatePrefixedId('otp');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

    // 5. Delete all previous OTPs for this identifier+portal — one active code at a time
    if (isPhone) {
      await c.env.DB.prepare(`DELETE FROM otp_codes WHERE phone = ? AND portal = ?`)
        .bind(normalizedIdentifier, portal)
        .run();
    } else {
      await c.env.DB.prepare(`DELETE FROM otp_codes WHERE email = ? AND portal = ?`)
        .bind(normalizedIdentifier, portal)
        .run();
    }

    // 6. Store new OTP in D1 Authoritative Table
    await c.env.DB.prepare(
      `INSERT INTO otp_codes (
         id, chamber_id, email, phone, portal, otp_hash, attempts, max_attempts, is_verified, expires_at, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, 0, 3, 0, ?, datetime('now'))`
    )
      .bind(
        otpId,
        chamberId,
        isPhone ? null : normalizedIdentifier,
        isPhone ? normalizedIdentifier : null,
        portal,
        otpHash,
        expiresAt
      )
      .run();


    // 8. Dispatch OTP via the appropriate channel
    if (isPhone) {
      await sendOtpSms({
        to: normalizedIdentifier,
        code,
        portal,
        chamberName,
        twilioAccountSid: c.env.TWILIO_ACCOUNT_SID,
        twilioAuthToken: c.env.TWILIO_AUTH_TOKEN,
        twilioFromNumber: c.env.TWILIO_FROM_NUMBER,
      });
    } else {
      await sendOtpEmail({
        to: normalizedIdentifier,
        code,
        portal,
        chamberName,
        sendgridApiKey: c.env.SENDGRID_API_KEY,
      });
    }

    return {
      message: 'Verification code dispatched',
      channel: isPhone ? 'sms' : 'email',
      expiresIn: 600,
      resendAvailableIn: 60,
    };
  }

  /**
   * Verify a 6-digit OTP, atomically increment attempts, and issue session token
   */
  static async verifyOtp(c: AppContext, input: VerifyOtpInput) {
    const chamberId = c.get('chamberId') || null;
    const portal = normalizePortal(input.portal);
    const incomingCode = input.code.trim();

    // Resolve identifier type
    const identifierType = detectIdentifierType(input.identifier);
    const isPhone = identifierType === 'phone';
    const normalizedIdentifier = isPhone
      ? normalizePhone(input.identifier)
      : input.identifier;

    // 1. Fetch the active OTP record from D1
    const otpWhereClause = isPhone
      ? 'phone = ? AND portal = ? AND is_verified = 0'
      : 'email = ? AND portal = ? AND is_verified = 0';

    const record = await c.env.DB.prepare(
      `SELECT id, otp_hash, attempts, max_attempts, expires_at, chamber_id, email, phone
       FROM otp_codes
       WHERE ${otpWhereClause}
       ORDER BY created_at DESC
       LIMIT 1`
    )
      .bind(normalizedIdentifier, portal)
      .first<{
        id: string;
        otp_hash: string;
        attempts: number;
        max_attempts: number;
        expires_at: string;
        chamber_id: string | null;
        email: string | null;
        phone: string | null;
      }>();

    if (!record) {
      throw new AppError(
        ErrorCodes.INVALID_CREDENTIALS,
        'No active verification request found. Please request a new code.',
        400
      );
    }

    // 2. Check Expiration
    if (new Date() > new Date(record.expires_at)) {
      throw new AppError(
        ErrorCodes.TOKEN_EXPIRED,
        'Verification code has expired. Please request a new one.',
        410
      );
    }

    // 3. Atomically increment attempts
    const newAttempts = record.attempts + 1;
    await c.env.DB.prepare('UPDATE otp_codes SET attempts = attempts + 1 WHERE id = ?')
      .bind(record.id)
      .run();

    // 4. Guard against max attempts
    if (newAttempts > record.max_attempts) {
      await c.env.DB.prepare(`DELETE FROM otp_codes WHERE id = ?`)
        .bind(record.id)
        .run();
      throw new AppError(
        ErrorCodes.TOO_MANY_ATTEMPTS,
        'Maximum verification attempts exceeded. Code has been invalidated. Please request a new one.',
        410
      );
    }

    // 5. Compare cryptographic hash (with local dev DX convenience fallback 123456)
    const isDevBypass = c.env.ENVIRONMENT === 'development' && incomingCode === '123456';
    const computedHash = await hashOtp(incomingCode);
    if (!isDevBypass && computedHash !== record.otp_hash) {
      const remaining = record.max_attempts - newAttempts;
      if (remaining <= 0) {
        await c.env.DB.prepare(`DELETE FROM otp_codes WHERE id = ?`)
          .bind(record.id)
          .run();
        throw new AppError(
          ErrorCodes.TOO_MANY_ATTEMPTS,
          'Incorrect code. Verification limit reached. Please request a new code.',
          410
        );
      }
      throw new AppError(
        ErrorCodes.INVALID_CREDENTIALS,
        `Incorrect verification code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`,
        400
      );
    }

    // 6. Mark verified then delete (session is the source of truth from now on)
    await c.env.DB.prepare('UPDATE otp_codes SET is_verified = 1 WHERE id = ?')
      .bind(record.id)
      .run();

    // 7. Resolve User Entity & Role Scopes based on portal
    let userResponse: {
      id: string;
      email: string | null;
      phone: string | null;
      name: string;
      firstName?: string;
      lastName?: string;
      avatarUrl?: string | null;
      highestRole: string;
      assignedScopes?: Record<string, string[]>;
      roles?: CachedSessionRole[];
      pointsBalance?: number;
    };
    let effectiveChamberId: string | null = null;

    // Build lookup clause for users/super_admins
    const userWhereClause = isPhone ? 'phone = ?' : 'email = ?';

    if (portal === 'super_admin') {
      const superAdmin = await c.env.DB.prepare(
        `SELECT id, email, phone, name FROM platform_super_admins
         WHERE ${userWhereClause} LIMIT 1`
      )
        .bind(normalizedIdentifier)
        .first<{ id: string; email: string; phone: string | null; name: string }>();

      if (!superAdmin) {
        throw new AppError(ErrorCodes.NOT_FOUND, 'Super admin account not found', 404);
      }

      const nameParts = splitName(superAdmin.name);

      userResponse = {
        id: superAdmin.id,
        email: superAdmin.email,
        phone: superAdmin.phone,
        name: superAdmin.name,
        firstName: nameParts.firstName,
        lastName: nameParts.lastName,
        avatarUrl: null,
        highestRole: 'super_admin',
        assignedScopes: { platform: ['*'] },
        roles: [{ roleId: 'super_admin', scopeType: 'chamber', scopeId: '*' }],
        pointsBalance: 0,
      };
    } else {
      let user = await c.env.DB.prepare(
        `SELECT id, email, phone, name, avatar_url, chamber_id, points_balance
         FROM users
         WHERE ${userWhereClause} AND (chamber_id = ? OR ? IS NULL)
         LIMIT 1`
      )
        .bind(normalizedIdentifier, chamberId, chamberId)
        .first<{
          id: string;
          email: string;
          phone: string | null;
          name: string;
          avatar_url?: string;
          chamber_id: string;
          points_balance?: number;
        }>();

      if (!user) {
        user = await c.env.DB.prepare(
          `SELECT id, email, phone, name, avatar_url, chamber_id, points_balance
           FROM users
           WHERE ${userWhereClause} AND status = 'active'
           LIMIT 1`
        )
          .bind(normalizedIdentifier)
          .first<{
            id: string;
            email: string;
            phone: string | null;
            name: string;
            avatar_url?: string;
            chamber_id: string;
            points_balance?: number;
          }>();
      }

      if (!user) {
        throw new AppError(ErrorCodes.NOT_FOUND, 'User account not found', 404);
      }

      effectiveChamberId = user.chamber_id || record.chamber_id || chamberId;

      // Fetch active role assignments
      const roleAssignments = await c.env.DB.prepare(
        `SELECT role_id, scope_type, scope_id
         FROM user_role_assignments
         WHERE user_id = ? AND (chamber_id = ? OR ? IS NULL) AND is_active = 1`
      )
        .bind(user.id, effectiveChamberId, effectiveChamberId)
        .all<{ role_id: string; scope_type: string; scope_id: string }>();

      const scopes: Record<string, string[]> = {};
      const rolesList: CachedSessionRole[] = [];
      let highestRole = portal === 'chamber_admin' ? 'full_admin' : 'member';

      if (roleAssignments.results && roleAssignments.results.length > 0) {
        for (const ra of roleAssignments.results) {
          rolesList.push({
            roleId: ra.role_id,
            scopeType: ra.scope_type as 'chamber' | 'chapter' | 'group',
            scopeId: ra.scope_id,
          });
          if (!scopes[ra.scope_type]) scopes[ra.scope_type] = [];
          if (ra.scope_id && !scopes[ra.scope_type].includes(ra.scope_id)) {
            scopes[ra.scope_type].push(ra.scope_id);
          }
        }
        highestRole = roleAssignments.results[0].role_id;
      } else {
        rolesList.push({
          roleId: 'member',
          scopeType: 'chamber',
          scopeId: record.chamber_id || chamberId || '',
        });
      }

      if (portal === 'member') {
        const adminRoles = ['full_admin', 'billing_admin', 'chapter_admin', 'group_admin', 'super_admin'];
        if (adminRoles.includes(highestRole)) {
          throw new AppError(
            ErrorCodes.FORBIDDEN,
            'This sign-in form is for chamber members only. Administrator accounts must sign in via the designated Admin Portal.',
            403
          );
        }
      }

      const nameParts = splitName(user.name);

      userResponse = {
        id: user.id,
        email: user.email,
        phone: user.phone,
        name: user.name,
        firstName: nameParts.firstName,
        lastName: nameParts.lastName,
        avatarUrl: user.avatar_url,
        highestRole,
        assignedScopes: scopes,
        roles: rolesList,
        pointsBalance: user.points_balance ?? 0,
      };

      // Update last login timestamp
      await c.env.DB.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?")
        .bind(user.id)
        .run();
    }

    // 8. Generate & store session in Cloudflare KV via SessionService
    const nameParts = {
      firstName: userResponse.firstName || '',
      lastName: userResponse.lastName || '',
    };

    const roles: CachedSessionRole[] =
      portal === 'super_admin'
        ? [{ roleId: 'super_admin', scopeType: 'chamber', scopeId: '*' }]
        : userResponse.roles || [
            {
              roleId: userResponse.highestRole,
              scopeType: 'chamber',
              scopeId: record.chamber_id || chamberId || '',
            },
          ];

    const ipAddress =
      c.req.header('cf-connecting-ip') ||
      c.req.header('x-forwarded-for') ||
      undefined;
    const userAgent = c.req.header('user-agent') || undefined;
    const finalChamberId = portal === 'super_admin' ? null : (effectiveChamberId || record.chamber_id || chamberId);
    let chamberName = c.get('chamber')?.name || null;
    if (finalChamberId) {
      const ch = await c.env.DB.prepare('SELECT name FROM platform_chambers WHERE id = ? LIMIT 1')
        .bind(finalChamberId)
        .first<{ name: string }>();
      if (ch?.name) chamberName = ch.name;
    }

    const { token: sessionToken, expiresAt: sessionExpiresAt } =
      await SessionService.createSession(c, {
        userId: userResponse.id,
        chamberId: finalChamberId,
        chamberName,
        email: userResponse.email || '',
        phone: userResponse.phone,
        firstName: nameParts.firstName,
        lastName: nameParts.lastName,
        avatarUrl: userResponse.avatarUrl,
        highestRole: userResponse.highestRole as any,
        roles,
        pointsBalance: userResponse.pointsBalance ?? 0,
        portal,
        ipAddress,
        userAgent,
      });

    // 9. Audit log entry for login (non-fatal)
    try {
      const auditId = generatePrefixedId('aud');
      await c.env.DB.prepare(
        `INSERT INTO platform_audit_logs (
           id, chamber_id, actor_id, actor_role, actor_name, action, target_type, target_id, ip_address, user_agent, created_at
         ) VALUES (?, ?, ?, ?, ?, 'user.logged_in', 'user', ?, ?, ?, datetime('now'))`
      )
        .bind(
          auditId,
          record.chamber_id || chamberId,
          userResponse.id,
          userResponse.highestRole,
          userResponse.name || userResponse.email,
          userResponse.id,
          ipAddress || null,
          userAgent || null
        )
        .run();
    } catch (err) {
      console.warn('[AUDIT_LOG_WARNING]', err);
    }

    return {
      token: sessionToken,
      user: {
        ...userResponse,
        firstName: nameParts.firstName || '',
        lastName: nameParts.lastName || '',
      },
      expiresAt: sessionExpiresAt,
    };
  }
}
