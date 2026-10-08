import type { Context } from 'hono';
import type { Env } from '../../../core/env';
import type { AppVariables } from '../../../core/context';
import { BusinessProfilesRepository } from '../repositories/business-profiles.repository';
import type {
  BusinessProfileData,
  UpdateBusinessProfileInput,
  InviteRepresentativeInput,
  TeamRepresentative,
} from '../types';
import { AppError, ErrorCodes } from '../../../core/shared/errors';
import { newId } from '../../../core/shared/ids';
import { MAX_IMAGE_UPLOAD_BYTES, validateImageUpload } from '../../../core/shared/image-upload';

export function getBusinessLogoStorageKey(chamberId: string, businessId: string, ext = 'png'): string {
  return `tenants/${chamberId}/businesses/${businessId}/logo_${Date.now()}.${ext}`;
}

export function getBusinessBannerStorageKey(chamberId: string, businessId: string, ext = 'png'): string {
  return `tenants/${chamberId}/businesses/${businessId}/banner_${Date.now()}.${ext}`;
}

export function normalizeAssetUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  // Legacy rows may hold an absolute R2 URL; serve every stored tenant object through the
  // relative assets route instead of a hardcoded host.
  const legacy = url.match(/^https?:\/\/[^/]+\/(tenants\/.+)$/);
  if (legacy) return `/api/v1/public/assets/${legacy[1]}`;
  return url;
}

export { MAX_IMAGE_UPLOAD_BYTES, detectImageType } from '../../../core/shared/image-upload';

type AppContext = Context<{ Bindings: Env; Variables: AppVariables }>;

function checkIsFullAdmin(c: AppContext): boolean {
  const user = c.get('user');
  const roles = c.get('roles') || [];
  return (
    user?.highest_role === 'full_admin' ||
    user?.highest_role === 'super_admin' ||
    roles.includes('full_admin') ||
    roles.includes('super_admin')
  );
}

export class BusinessProfileService {
  /**
   * Retrieves the authenticated user's business profile and team.
   */
  static async getBusinessProfile(
    c: AppContext,
    chamberId: string,
    userId: string
  ): Promise<BusinessProfileData> {
    const d1 = c.env.DB;
    const userBusiness = await BusinessProfilesRepository.getBusinessByUserId(d1, chamberId, userId);

    if (!userBusiness) {
      throw new AppError(
        ErrorCodes.NOT_FOUND,
        'No business profile found for this member account',
        404
      );
    }

    const { business, membership } = userBusiness;
    const representatives = await BusinessProfilesRepository.getTeamRepresentatives(
      d1,
      chamberId,
      business.id
    );

    let socialLinks: Record<string, string> = {};
    let skills: string[] = [];
    let interests: string[] = [];
    let locations: string[] = [];
    let relatedOrganizations: any[] = [];

    try {
      socialLinks = JSON.parse(business.socialLinksJson || '{}');
    } catch {
      socialLinks = {};
    }

    try {
      skills = JSON.parse(business.skillsJson || '[]');
    } catch {
      skills = [];
    }

    try {
      interests = JSON.parse(business.interestsJson || '[]');
    } catch {
      interests = [];
    }

    try {
      locations = JSON.parse(business.locationsJson || '[]');
    } catch {
      locations = [];
    }

    try {
      relatedOrganizations = JSON.parse(business.relatedOrganizationsJson || '[]');
    } catch {
      relatedOrganizations = [];
    }

    const bannerUrl = (socialLinks as any).bannerUrl || null;
    const dbaName = (socialLinks as any).dbaName || null;

    return {
      id: business.id,
      chamberId: business.chamberId,
      name: business.businessName,
      dbaName,
      logoUrl: normalizeAssetUrl(business.businessLogoUrl),
      bannerUrl: normalizeAssetUrl(bannerUrl),
      tagline: business.tagline,
      description: business.description,
      industry: business.industry || 'General Business',
      businessPhone: business.businessPhone,
      businessEmail: business.businessEmail,
      website: business.website,
      streetAddress: business.streetAddress,
      city: business.city,
      state: business.state,
      zip: business.zip,
      socialLinks,
      skills,
      interests,
      locations: locations.length > 0 ? locations : business.city ? [business.city] : [],
      relatedOrganizations,
      isVerified: Boolean(business.isVerified),
      myAccessLevel: membership.accessLevel as any,
      isPrimaryContact: Boolean(membership.isPrimaryContact),
      representatives,
      createdAt: business.createdAt,
      updatedAt: business.updatedAt,
    };
  }

  /**
   * Updates business profile details.
   * Enforces: Member with 'billing_only' or 'events_networking' is blocked with 403 Forbidden.
   */
  static async updateBusinessProfile(
    c: AppContext,
    chamberId: string,
    userId: string,
    payload: UpdateBusinessProfileInput
  ): Promise<{ id: string; updatedAt: string }> {
    const d1 = c.env.DB;
    const userBusiness = await BusinessProfilesRepository.getBusinessByUserId(d1, chamberId, userId);

    if (!userBusiness) {
      throw new AppError(
        ErrorCodes.NOT_FOUND,
        'No business profile found for this member account',
        404
      );
    }

    const { business, membership } = userBusiness;

    // RBAC check: full_admin can update any profile; members must have full_access or be primary contact
    const isFullAdmin = checkIsFullAdmin(c);
    const hasFullAccess =
      membership.isPrimaryContact === 1 || membership.accessLevel === 'full_access';

    if (!isFullAdmin && !hasFullAccess) {
      throw new AppError(
        ErrorCodes.FORBIDDEN,
        'Only primary contacts or representatives with Full Access can edit the business profile',
        403
      );
    }

    const updated = await BusinessProfilesRepository.updateBusinessProfile(
      d1,
      chamberId,
      business.id,
      payload
    );

    // Audit log
    await this.logAudit(
      d1,
      chamberId,
      userId,
      'update',
      'business_profile',
      business.id,
      `Updated profile for business ${payload.name}`
    );

    return {
      id: updated.id,
      updatedAt: updated.updatedAt || new Date().toISOString(),
    };
  }

  /**
   * Uploads business logo image to Cloudflare R2 and updates the profile.
   */
  static async uploadLogo(
    c: AppContext,
    chamberId: string,
    userId: string,
    fileBuffer: ArrayBuffer | Uint8Array,
    contentType: string,
    fileExtension = 'png'
  ): Promise<{ logoUrl: string }> {
    const d1 = c.env.DB;
    const userBusiness = await BusinessProfilesRepository.getBusinessByUserId(d1, chamberId, userId);

    if (!userBusiness) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Business profile not found', 404);
    }

    const { business, membership } = userBusiness;
    const isFullAdmin = checkIsFullAdmin(c);
    const hasFullAccess =
      membership.isPrimaryContact === 1 || membership.accessLevel === 'full_access';

    if (!isFullAdmin && !hasFullAccess) {
      throw new AppError(
        ErrorCodes.FORBIDDEN,
        'Only representatives with Full Access can update the business logo',
        403
      );
    }

    // Content type & extension come from the file bytes; the client-sent values are ignored.
    const image = validateImageUpload(fileBuffer, MAX_IMAGE_UPLOAD_BYTES);

    if (!c.env.STORAGE) {
      throw new AppError(ErrorCodes.INTERNAL_ERROR, 'File storage is not configured', 500);
    }

    // Storage Key Generator as per §8
    const storageKey = getBusinessLogoStorageKey(chamberId, business.id, image.ext);
    const logoUrl = `/api/v1/public/assets/${storageKey}`;
    await c.env.STORAGE.put(storageKey, fileBuffer, {
      httpMetadata: { contentType: image.mime },
    });

    await BusinessProfilesRepository.updateLogoUrl(d1, chamberId, business.id, logoUrl);

    // Also synchronize user's personal avatar with the business logo
    await d1
      .prepare('UPDATE users SET avatar_url = ? WHERE id = ? AND chamber_id = ?')
      .bind(logoUrl, userId, chamberId)
      .run()
      .catch(() => {});

    const token = c.get('sessionToken') as string;
    const session = c.get('session') as any;
    if (token && session && c.env.KV) {
      session.avatarUrl = logoUrl;
      await c.env.KV.put(`session:${token}`, JSON.stringify(session), {
        expirationTtl: 86400,
      }).catch(() => {});
    }

    await this.logAudit(
      d1,
      chamberId,
      userId,
      'upload_logo',
      'business_profile',
      business.id,
      `Uploaded new logo for business ${business.businessName}`
    );

    return { logoUrl };
  }

  /**
   * Removes business logo image and updates the profile and user avatar.
   */
  static async removeLogo(
    c: AppContext,
    chamberId: string,
    userId: string
  ): Promise<{ success: boolean }> {
    const d1 = c.env.DB;
    const userBusiness = await BusinessProfilesRepository.getBusinessByUserId(d1, chamberId, userId);

    if (!userBusiness) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Business profile not found', 404);
    }

    const { business, membership } = userBusiness;
    const isFullAdmin = checkIsFullAdmin(c);
    const hasFullAccess =
      membership.isPrimaryContact === 1 || membership.accessLevel === 'full_access';

    if (!isFullAdmin && !hasFullAccess) {
      throw new AppError(
        ErrorCodes.FORBIDDEN,
        'Only representatives with Full Access can remove the business logo',
        403
      );
    }

    await BusinessProfilesRepository.updateLogoUrl(d1, chamberId, business.id, null);

    // Also clear user's avatar_url
    await d1
      .prepare('UPDATE users SET avatar_url = NULL WHERE id = ? AND chamber_id = ?')
      .bind(userId, chamberId)
      .run()
      .catch(() => {});

    const token = c.get('sessionToken') as string;
    const session = c.get('session') as any;
    if (token && session && c.env.KV) {
      session.avatarUrl = null;
      await c.env.KV.put(`session:${token}`, JSON.stringify(session), {
        expirationTtl: 86400,
      }).catch(() => {});
    }

    await this.logAudit(
      d1,
      chamberId,
      userId,
      'remove_logo',
      'business_profile',
      business.id,
      `Removed logo for business ${business.businessName}`
    );

    return { success: true };
  }

  /**
   * Uploads business banner image.
   */
  static async uploadBanner(
    c: AppContext,
    chamberId: string,
    userId: string,
    fileBuffer: ArrayBuffer | Uint8Array,
    contentType: string,
    fileExtension = 'png'
  ): Promise<{ bannerUrl: string }> {
    const d1 = c.env.DB;
    const userBusiness = await BusinessProfilesRepository.getBusinessByUserId(d1, chamberId, userId);

    if (!userBusiness) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Business profile not found', 404);
    }

    const { business, membership } = userBusiness;
    const isFullAdmin = checkIsFullAdmin(c);
    const hasFullAccess =
      membership.isPrimaryContact === 1 || membership.accessLevel === 'full_access';

    if (!isFullAdmin && !hasFullAccess) {
      throw new AppError(
        ErrorCodes.FORBIDDEN,
        'Only representatives with Full Access can update the business banner',
        403
      );
    }

    // Banner limit stays at the existing 8MB (OPEN DECISION OD-013: spec does not state one).
    const image = validateImageUpload(fileBuffer, 8 * 1024 * 1024);

    if (!c.env.STORAGE) {
      throw new AppError(ErrorCodes.INTERNAL_ERROR, 'File storage is not configured', 500);
    }

    const storageKey = getBusinessBannerStorageKey(chamberId, business.id, image.ext);
    const bannerUrl = `/api/v1/public/assets/${storageKey}`;
    await c.env.STORAGE.put(storageKey, fileBuffer, {
      httpMetadata: { contentType: image.mime },
    });

    await BusinessProfilesRepository.updateBannerUrl(d1, chamberId, business.id, bannerUrl);

    await this.logAudit(
      d1,
      chamberId,
      userId,
      'upload_banner',
      'business_profile',
      business.id,
      `Uploaded new banner for business ${business.businessName}`
    );

    return { bannerUrl };
  }

  /**
   * Retrieves team representatives.
   */
  static async getTeam(
    c: AppContext,
    chamberId: string,
    userId: string
  ): Promise<TeamRepresentative[]> {
    const d1 = c.env.DB;
    const userBusiness = await BusinessProfilesRepository.getBusinessByUserId(d1, chamberId, userId);

    if (!userBusiness) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Business profile not found', 404);
    }

    return BusinessProfilesRepository.getTeamRepresentatives(d1, chamberId, userBusiness.business.id);
  }

  /**
   * Invites a new team representative.
   */
  static async inviteRepresentative(
    c: AppContext,
    chamberId: string,
    userId: string,
    input: InviteRepresentativeInput
  ): Promise<TeamRepresentative> {
    const d1 = c.env.DB;
    const userBusiness = await BusinessProfilesRepository.getBusinessByUserId(d1, chamberId, userId);

    if (!userBusiness) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Business profile not found', 404);
    }

    const { business, membership } = userBusiness;
    const isFullAdmin = checkIsFullAdmin(c);
    const hasFullAccess =
      membership.isPrimaryContact === 1 || membership.accessLevel === 'full_access';

    if (!isFullAdmin && !hasFullAccess) {
      throw new AppError(
        ErrorCodes.FORBIDDEN,
        'Only representatives with Full Access can invite team members',
        403
      );
    }

    const rep = await BusinessProfilesRepository.addTeamRepresentative(
      d1,
      chamberId,
      business.id,
      input
    );

    await this.logAudit(
      d1,
      chamberId,
      userId,
      'invite_representative',
      'business_member',
      rep.id,
      `Invited ${input.firstName} ${input.lastName} (${input.email}) as ${input.accessLevel}`
    );

    return rep;
  }

  /**
   * Removes a team representative.
   */
  static async removeRepresentative(
    c: AppContext,
    chamberId: string,
    userId: string,
    memberRecordId: string
  ): Promise<{ success: boolean }> {
    const d1 = c.env.DB;
    const userBusiness = await BusinessProfilesRepository.getBusinessByUserId(d1, chamberId, userId);

    if (!userBusiness) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Business profile not found', 404);
    }

    const { business, membership } = userBusiness;
    const isFullAdmin = checkIsFullAdmin(c);
    const hasFullAccess =
      membership.isPrimaryContact === 1 || membership.accessLevel === 'full_access';

    if (!isFullAdmin && !hasFullAccess) {
      throw new AppError(
        ErrorCodes.FORBIDDEN,
        'Only representatives with Full Access can remove team members',
        403
      );
    }

    try {
      const removed = await BusinessProfilesRepository.removeTeamRepresentative(
        d1,
        chamberId,
        business.id,
        memberRecordId
      );

      if (!removed) {
        throw new AppError(ErrorCodes.NOT_FOUND, 'Team member not found', 404);
      }

      await this.logAudit(
        d1,
        chamberId,
        userId,
        'remove_representative',
        'business_member',
        memberRecordId,
        `Removed representative ${memberRecordId} from business`
      );

      return { success: true };
    } catch (err: any) {
      if (err.message?.includes('Cannot remove primary contact')) {
        throw new AppError(ErrorCodes.BAD_REQUEST, err.message, 400);
      }
      throw err;
    }
  }

  /**
   * Updates an existing team representative.
   */
  static async updateRepresentative(
    c: AppContext,
    chamberId: string,
    userId: string,
    memberRecordId: string,
    payload: any
  ): Promise<{ success: boolean }> {
    const d1 = c.env.DB;
    const userBusiness = await BusinessProfilesRepository.getBusinessByUserId(d1, chamberId, userId);

    if (!userBusiness) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Business profile not found', 404);
    }

    const { business, membership } = userBusiness;
    const isFullAdmin = checkIsFullAdmin(c);
    const hasFullAccess =
      membership.isPrimaryContact === 1 || membership.accessLevel === 'full_access';

    if (!isFullAdmin && !hasFullAccess) {
      throw new AppError(
        ErrorCodes.FORBIDDEN,
        'Only representatives with Full Access can update team members',
        403
      );
    }

    let updated: boolean;
    try {
      updated = await BusinessProfilesRepository.updateTeamRepresentative(
        d1,
        chamberId,
        business.id,
        memberRecordId,
        payload
      );
    } catch (err: any) {
      if (err.message?.includes('primary contact must keep full access')) {
        throw new AppError(ErrorCodes.BAD_REQUEST, err.message, 400);
      }
      throw err;
    }

    if (!updated) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Team representative not found', 404);
    }

    await this.logAudit(
      d1,
      chamberId,
      userId,
      'update_representative',
      'business_member',
      memberRecordId,
      `Updated representative ${memberRecordId} details`
    );

    return { success: true };
  }

  /**
   * Sets primary contact.
   */
  static async setPrimaryContact(
    c: AppContext,
    chamberId: string,
    userId: string,
    targetMemberRecordId: string
  ): Promise<{ success: boolean }> {
    const d1 = c.env.DB;
    const userBusiness = await BusinessProfilesRepository.getBusinessByUserId(d1, chamberId, userId);

    if (!userBusiness) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Business profile not found', 404);
    }

    const { business, membership } = userBusiness;
    const isFullAdmin = checkIsFullAdmin(c);
    const hasFullAccess =
      membership.isPrimaryContact === 1 || membership.accessLevel === 'full_access';

    if (!isFullAdmin && !hasFullAccess) {
      throw new AppError(
        ErrorCodes.FORBIDDEN,
        'Only representatives with Full Access can assign the primary contact',
        403
      );
    }

    try {
      await BusinessProfilesRepository.setPrimaryContact(
        d1,
        chamberId,
        business.id,
        targetMemberRecordId
      );
    } catch (err: any) {
      if (err.message?.includes('Target representative not found')) {
        throw new AppError(ErrorCodes.NOT_FOUND, 'Team representative not found', 404);
      }
      throw err;
    }

    await this.logAudit(
      d1,
      chamberId,
      userId,
      'set_primary_contact',
      'business_member',
      targetMemberRecordId,
      `Designated member ${targetMemberRecordId} as the primary business contact`
    );

    return { success: true };
  }

  /**
   * Searches other chamber businesses for the Related Organizations network editor.
   */
  static async searchRelatedOrganizations(
    c: AppContext,
    chamberId: string,
    userId: string,
    query: string
  ): Promise<Array<{ id: string; name: string; industry: string }>> {
    const d1 = c.env.DB;
    const userBusiness = await BusinessProfilesRepository.getBusinessByUserId(d1, chamberId, userId);
    const excludeId = userBusiness ? userBusiness.business.id : '';

    return BusinessProfilesRepository.searchChamberBusinesses(d1, chamberId, excludeId, query);
  }

  /**
   * Internal helper for logging activity.
   */
  private static async logAudit(
    d1: D1Database,
    chamberId: string,
    userId: string,
    action: string,
    entityType: string,
    entityId: string,
    details: string
  ): Promise<void> {
    try {
      await d1
        .prepare(
          `INSERT INTO activity_logs (
            id, chamber_id, user_id, action, target_type, target_id, details_json, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
        )
        .bind(
          await newId(d1, 'activity_logs', 'ACT', { chamberId, suffixLength: 6, skipUniqueCheck: true }),
          chamberId,
          userId,
          action,
          entityType,
          entityId,
          JSON.stringify({ message: details })
        )
        .run();
    } catch (err) {
      // Non-blocking, but never silent
      console.error('[AUDIT_LOG_WRITE_FAILED]', action, err);
    }
  }
}
