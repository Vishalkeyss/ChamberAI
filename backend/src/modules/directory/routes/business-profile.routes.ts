import { Hono } from 'hono';
import type { Env } from '../../../core/env';
import type { AppVariables } from '../../../core/context';
import { requireAuth, requireRole } from '../../../core/middleware/auth.middleware';
import { BusinessProfileService } from '../services/business-profile.service';
import {
  updateBusinessProfileSchema,
  inviteRepresentativeSchema,
  updateRepresentativeSchema,
} from '../validation/business-profile.validation';
import { successResponse } from '../../../core/shared/response';
import { AppError, ErrorCodes } from '../../../core/shared/errors';

export const businessProfileRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>();

// All routes require authentication
businessProfileRoutes.use('/member/*', requireAuth);

const allowedRoles = ['member', 'full_admin', 'billing_admin', 'chapter_admin', 'group_admin'];

/**
 * GET /api/v1/member/business-profile
 * Retrieves authenticated user's business profile and team.
 */
businessProfileRoutes.get('/member/business-profile', requireRole(allowedRoles), async (c) => {
  const user = c.get('user');
  const chamberId = c.get('chamberId');
  if (!user || !chamberId) {
    throw new AppError(ErrorCodes.BAD_REQUEST, 'Authentication and chamber context required', 400);
  }

  const data = await BusinessProfileService.getBusinessProfile(c, chamberId, user.id);
  const requestId = c.get('requestId');
  return c.json(successResponse(data, { requestId }));
});

/**
 * PUT /api/v1/member/business-profile
 * Updates business profile details. Requires full_access representative or full_admin.
 */
businessProfileRoutes.put('/member/business-profile', requireRole(allowedRoles), async (c) => {
  const user = c.get('user');
  const chamberId = c.get('chamberId');
  if (!user || !chamberId) {
    throw new AppError(ErrorCodes.BAD_REQUEST, 'Authentication and chamber context required', 400);
  }

  const body = await c.req.json().catch(() => ({}));
  const parsed = updateBusinessProfileSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError(
      ErrorCodes.VALIDATION_ERROR,
      parsed.error.errors[0]?.message || 'Invalid business profile payload',
      422
    );
  }

  const result = await BusinessProfileService.updateBusinessProfile(c, chamberId, user.id, parsed.data);
  const requestId = c.get('requestId');
  return c.json(successResponse(result, { requestId }));
});

/**
 * POST /api/v1/member/business-profile/logo
 * Uploads business logo image to Cloudflare R2.
 */
businessProfileRoutes.post('/member/business-profile/logo', requireRole(allowedRoles), async (c) => {
  const user = c.get('user');
  const chamberId = c.get('chamberId');
  if (!user || !chamberId) {
    throw new AppError(ErrorCodes.BAD_REQUEST, 'Authentication and chamber context required', 400);
  }

  const contentType = c.req.header('content-type') || '';
  let fileBuffer: ArrayBuffer | Uint8Array;
  let mimeType = 'image/png';
  let ext = 'png';

  if (contentType.includes('multipart/form-data')) {
    const formData = await c.req.formData();
    const file = formData.get('file') || formData.get('logo');
    if (!file || !(file instanceof File)) {
      throw new AppError(ErrorCodes.BAD_REQUEST, 'A valid image file is required', 400);
    }
    // Limit 5MB as per §5.1
    if (file.size > 5 * 1024 * 1024) {
      throw new AppError(ErrorCodes.BAD_REQUEST, 'File size exceeds 5MB limit', 400);
    }
    mimeType = file.type || 'image/png';
    ext = mimeType.includes('jpeg') || mimeType.includes('jpg') ? 'jpg' : mimeType.includes('webp') ? 'webp' : 'png';
    fileBuffer = await file.arrayBuffer();
  } else {
    // Direct binary or JSON base64
    const body = await c.req.json().catch(() => ({}));
    // Reject oversized base64 before decoding (~4/3 of the 8MB max decoded size).
    if (typeof body.dataUrl === 'string' && body.dataUrl.length > 11 * 1024 * 1024) {
      throw new AppError(ErrorCodes.BAD_REQUEST, 'File too large', 400);
    }
    if (body.dataUrl) {
      const parts = body.dataUrl.split(';base64,');
      mimeType = parts[0]?.replace('data:', '') || 'image/png';
      ext = mimeType.includes('jpeg') ? 'jpg' : mimeType.includes('webp') ? 'webp' : 'png';
      fileBuffer = Buffer.from(parts[1] || '', 'base64');
    } else {
      fileBuffer = await c.req.arrayBuffer();
    }
  }

  const result = await BusinessProfileService.uploadLogo(c, chamberId, user.id, fileBuffer, mimeType, ext);
  const requestId = c.get('requestId');
  return c.json(successResponse(result, { requestId }));
});

/**
 * DELETE /api/v1/member/business-profile/logo
 * Removes business logo image.
 */
businessProfileRoutes.delete('/member/business-profile/logo', requireRole(allowedRoles), async (c) => {
  const user = c.get('user');
  const chamberId = c.get('chamberId');
  if (!user || !chamberId) {
    throw new AppError(ErrorCodes.BAD_REQUEST, 'Authentication and chamber context required', 400);
  }

  const result = await BusinessProfileService.removeLogo(c, chamberId, user.id);
  const requestId = c.get('requestId');
  return c.json(successResponse(result, { requestId }));
});

/**
 * POST /api/v1/member/business-profile/banner
 * Uploads business banner image.
 */
businessProfileRoutes.post('/member/business-profile/banner', requireRole(allowedRoles), async (c) => {
  const user = c.get('user');
  const chamberId = c.get('chamberId');
  if (!user || !chamberId) {
    throw new AppError(ErrorCodes.BAD_REQUEST, 'Authentication and chamber context required', 400);
  }

  const contentType = c.req.header('content-type') || '';
  let fileBuffer: ArrayBuffer | Uint8Array;
  let mimeType = 'image/png';
  let ext = 'png';

  if (contentType.includes('multipart/form-data')) {
    const formData = await c.req.formData();
    const file = formData.get('file') || formData.get('banner');
    if (!file || !(file instanceof File)) {
      throw new AppError(ErrorCodes.BAD_REQUEST, 'A valid banner image file is required', 400);
    }
    if (file.size > 8 * 1024 * 1024) {
      throw new AppError(ErrorCodes.BAD_REQUEST, 'Banner file size exceeds 8MB limit', 400);
    }
    mimeType = file.type || 'image/png';
    ext = mimeType.includes('jpeg') || mimeType.includes('jpg') ? 'jpg' : mimeType.includes('webp') ? 'webp' : 'png';
    fileBuffer = await file.arrayBuffer();
  } else {
    const body = await c.req.json().catch(() => ({}));
    if (body.dataUrl) {
      const parts = body.dataUrl.split(';base64,');
      mimeType = parts[0]?.replace('data:', '') || 'image/png';
      ext = mimeType.includes('jpeg') ? 'jpg' : mimeType.includes('webp') ? 'webp' : 'png';
      fileBuffer = Buffer.from(parts[1] || '', 'base64');
    } else {
      fileBuffer = await c.req.arrayBuffer();
    }
  }

  const result = await BusinessProfileService.uploadBanner(c, chamberId, user.id, fileBuffer, mimeType, ext);
  const requestId = c.get('requestId');
  return c.json(successResponse(result, { requestId }));
});

/**
 * GET /api/v1/member/team
 * Retrieves team representatives linked to the business profile.
 */
businessProfileRoutes.get('/member/team', requireRole(allowedRoles), async (c) => {
  const user = c.get('user');
  const chamberId = c.get('chamberId');
  if (!user || !chamberId) {
    throw new AppError(ErrorCodes.BAD_REQUEST, 'Authentication and chamber context required', 400);
  }

  const reps = await BusinessProfileService.getTeam(c, chamberId, user.id);
  const requestId = c.get('requestId');
  return c.json(successResponse(reps, { requestId }));
});

/**
 * POST /api/v1/member/team/invite
 * Invites a new team representative. Requires full_access.
 */
businessProfileRoutes.post('/member/team/invite', requireRole(allowedRoles), async (c) => {
  const user = c.get('user');
  const chamberId = c.get('chamberId');
  if (!user || !chamberId) {
    throw new AppError(ErrorCodes.BAD_REQUEST, 'Authentication and chamber context required', 400);
  }

  const body = await c.req.json().catch(() => ({}));
  const parsed = inviteRepresentativeSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError(
      ErrorCodes.VALIDATION_ERROR,
      parsed.error.errors[0]?.message || 'Invalid team member invitation payload',
      422
    );
  }

  const rep = await BusinessProfileService.inviteRepresentative(c, chamberId, user.id, parsed.data);
  const requestId = c.get('requestId');
  return c.json(successResponse(rep, { requestId }), 201);
});

/**
 * DELETE /api/v1/member/team/:id
 * Removes a representative from the business profile.
 */
businessProfileRoutes.delete('/member/team/:id', requireRole(allowedRoles), async (c) => {
  const user = c.get('user');
  const chamberId = c.get('chamberId');
  const memberRecordId = c.req.param('id');
  if (!user || !chamberId || !memberRecordId) {
    throw new AppError(ErrorCodes.BAD_REQUEST, 'Authentication, chamber, and representative ID required', 400);
  }

  const result = await BusinessProfileService.removeRepresentative(c, chamberId, user.id, memberRecordId);
  const requestId = c.get('requestId');
  return c.json(successResponse(result, { requestId }));
});

/**
 * PATCH /api/v1/member/team/:id
 * Updates representative contact details, title, and access level.
 */
businessProfileRoutes.patch('/member/team/:id', requireRole(allowedRoles), async (c) => {
  const user = c.get('user');
  const chamberId = c.get('chamberId');
  const memberRecordId = c.req.param('id');
  if (!user || !chamberId || !memberRecordId) {
    throw new AppError(ErrorCodes.BAD_REQUEST, 'Authentication, chamber, and representative ID required', 400);
  }

  const body = await c.req.json().catch(() => ({}));
  const parsed = updateRepresentativeSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError(
      ErrorCodes.VALIDATION_ERROR,
      parsed.error.issues[0]?.message || 'Invalid representative data',
      400
    );
  }
  const result = await BusinessProfileService.updateRepresentative(c, chamberId, user.id, memberRecordId, parsed.data);
  const requestId = c.get('requestId');
  return c.json(successResponse(result, { requestId }));
});

/**
 * PATCH /api/v1/member/team/:id/primary
 * Designates a representative as the Primary Contact (atomic transfer).
 */
businessProfileRoutes.patch('/member/team/:id/primary', requireRole(allowedRoles), async (c) => {
  const user = c.get('user');
  const chamberId = c.get('chamberId');
  const memberRecordId = c.req.param('id');
  if (!user || !chamberId || !memberRecordId) {
    throw new AppError(ErrorCodes.BAD_REQUEST, 'Authentication, chamber, and representative ID required', 400);
  }

  const result = await BusinessProfileService.setPrimaryContact(c, chamberId, user.id, memberRecordId);
  const requestId = c.get('requestId');
  return c.json(successResponse(result, { requestId }));
});

/**
 * GET /api/v1/member/business-profile/network-search
 * Searches member businesses in the chamber for Related Organizations linking.
 */
businessProfileRoutes.get(
  '/member/business-profile/network-search',
  requireRole(allowedRoles),
  async (c) => {
    const user = c.get('user');
    const chamberId = c.get('chamberId');
    if (!user || !chamberId) {
      throw new AppError(ErrorCodes.BAD_REQUEST, 'Authentication and chamber context required', 400);
    }

    const query = c.req.query('q') || '';
    const results = await BusinessProfileService.searchRelatedOrganizations(c, chamberId, user.id, query);
    const requestId = c.get('requestId');
    return c.json(successResponse(results, { requestId }));
  }
);
