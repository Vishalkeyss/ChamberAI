import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../../../core/env';
import type { AppVariables } from '../../../core/context';
import { optionalAuth, requireAuth, requireRole } from '../../../core/middleware/auth.middleware';
import { successResponse } from '../../../core/shared/response';
import { AppError, ErrorCodes } from '../../../core/shared/errors';
import { BusinessCardService } from '../services/business-card.service';

/**
 * Prompt 05.4 — QR Digital Business Card & vCard.
 * Member routes: member / group / chapter / full admin (OD-079). Public card routes are anonymous.
 */
export const businessCardRouter = new Hono<{ Bindings: Env; Variables: AppVariables }>();

const cardRoles = ['member', 'group_admin', 'chapter_admin', 'full_admin'];

/** §10 */
export const updateCardThemeSchema = z.object({
  themeColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Theme colour must be a hex colour like #2563EB'),
});

function chamberOf(c: any): string {
  const chamberId = c.get('chamberId');
  if (!chamberId) throw new AppError(ErrorCodes.BAD_REQUEST, 'Chamber context required', 400);
  return chamberId;
}

/** §9.1 */
businessCardRouter.get('/member/business-card', requireAuth, requireRole(cardRoles), async (c) => {
  const data = await BusinessCardService.getMyCard(c.env.DB, chamberOf(c), c.get('user')!.id);
  return c.json(successResponse(data, { requestId: c.get('requestId') }));
});

businessCardRouter.put('/member/business-card', requireAuth, requireRole(cardRoles), async (c) => {
  const parsed = updateCardThemeSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, parsed.error.errors[0]?.message || 'Invalid theme colour', 422);
  }
  const data = await BusinessCardService.updateTheme(c.env.DB, chamberOf(c), c.get('user')!.id, parsed.data.themeColor);
  return c.json(successResponse(data, { requestId: c.get('requestId') }));
});

/** §9.2 — anonymous; an optional session only tells us whether the owner is previewing (OD-078). */
businessCardRouter.get('/public/card/:token', optionalAuth, async (c) => {
  const chamberId = chamberOf(c);
  const viewer = c.get('user');
  const viewerId = viewer && viewer.chamber_id === chamberId ? viewer.id : null;
  const data = await BusinessCardService.publicCard(c.env.DB, chamberId, c.req.param('token') as string, viewerId);
  c.header('Cache-Control', 'no-store');
  return c.json(successResponse(data, { requestId: c.get('requestId') }));
});

/** §9.3 */
businessCardRouter.get('/public/card/:token/vcard', async (c) => {
  const { body, fileName } = await BusinessCardService.vcard(c.env.DB, chamberOf(c), c.req.param('token') as string);
  return c.body(body, 200, {
    'Content-Type': 'text/vcard; charset=utf-8',
    'Content-Disposition': `attachment; filename="${fileName}"`,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store',
  });
});
