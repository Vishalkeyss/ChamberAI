import { Hono } from 'hono';
import type { Env } from '../../core/env';
import type { AppVariables } from '../../core/context';
import { successResponse } from '../../core/shared/response';
import { AppError, ErrorCodes } from '../../core/shared/errors';

export const publicDirectoryRouter = new Hono<{ Bindings: Env; Variables: AppVariables }>();

/**
 * Escapes SQL LIKE wildcard characters to prevent injection.
 * Per Prompt 03.2 Section 8 spec.
 */
function sanitizeSearchQuery(query: string): string {
  return query.trim().replace(/[%_]/g, '\\$&');
}

/**
 * GET /api/v1/public/directory
 * Public business directory with search, multi-facet filtering, and pagination.
 * Auth: Public / Anonymous (uses tenant resolver middleware).
 * Tenant Isolation: WHERE bp.chamber_id = :chamberId
 */
publicDirectoryRouter.get('/public/directory', async (c) => {
  const chamberId = c.get('chamberId');
  const requestId = c.get('requestId');

  if (!chamberId) {
    throw new AppError(ErrorCodes.CHAMBER_NOT_FOUND, 'No chamber context bound to request', 404);
  }

  // Parse and validate query params
  const url = new URL(c.req.url);
  const q = url.searchParams.get('q')?.trim() || null;
  const industry = url.searchParams.get('industry')?.trim() || null;
  const chapterId = url.searchParams.get('chapter_id')?.trim() || null;
  const city = url.searchParams.get('city')?.trim() || null;
  const verifiedParam = url.searchParams.get('verified');
  const verifiedOnly = verifiedParam === 'true' || verifiedParam === '1' ? 1 : 0;
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '12', 10) || 12));
  const offset = (page - 1) * limit;

  // Build WHERE conditions dynamically
  const conditions: string[] = ['bp.chamber_id = ?1'];
  const bindings: any[] = [chamberId];
  let paramIdx = 2;

  // Active membership guard: only businesses with active chamber_memberships
  conditions.push(`cm.status = 'active'`);

  if (verifiedOnly) {
    conditions.push('bp.is_verified = 1');
  }

  if (industry) {
    conditions.push(`bp.industry = ?${paramIdx}`);
    bindings.push(industry);
    paramIdx++;
  }

  if (city) {
    conditions.push(`bp.city = ?${paramIdx}`);
    bindings.push(city);
    paramIdx++;
  }

  if (q) {
    const sanitized = sanitizeSearchQuery(q);
    const searchLike = `%${sanitized}%`;
    conditions.push(`(bp.business_name LIKE ?${paramIdx} OR bp.tagline LIKE ?${paramIdx} OR bp.description LIKE ?${paramIdx} OR bp.skills_json LIKE ?${paramIdx})`);
    bindings.push(searchLike);
    paramIdx++;
  }

  const whereClause = conditions.join(' AND ');

  // Count query for pagination
  const countSql = `
    SELECT COUNT(DISTINCT bp.id) as total
    FROM business_profiles bp
    JOIN chamber_memberships cm ON cm.business_id = bp.id AND cm.chamber_id = bp.chamber_id
    WHERE ${whereClause}
  `;

  // Main directory query
  const dataSql = `
    SELECT 
      bp.id,
      bp.business_name,
      bp.business_logo_url as logoUrl,
      bp.tagline,
      bp.description,
      bp.industry,
      bp.city,
      bp.state,
      bp.website,
      bp.business_phone,
      bp.is_verified as isVerified,
      u.id AS primaryContactId,
      u.name AS primaryContactName,
      u.avatar_url AS primaryContactAvatar,
      bm.access_level
    FROM business_profiles bp
    JOIN chamber_memberships cm ON cm.business_id = bp.id AND cm.chamber_id = bp.chamber_id
    LEFT JOIN business_members bm ON bm.business_id = bp.id AND bm.is_primary_contact = 1
    LEFT JOIN users u ON u.id = bm.user_id
    WHERE ${whereClause}
    GROUP BY bp.id
    ORDER BY bp.is_verified DESC, bp.business_name ASC
    LIMIT ?${paramIdx} OFFSET ?${paramIdx + 1}
  `;

  bindings.push(limit, offset);

  // Execute both queries
  const [countResult, dataResult] = await Promise.all([
    c.env.DB.prepare(countSql).bind(...bindings.slice(0, paramIdx - 1)).first<{ total: number }>(),
    c.env.DB.prepare(dataSql).bind(...bindings).all<any>(),
  ]);

  const total = countResult?.total || 0;
  const businesses = (dataResult.results || []).map((row: any) => ({
    id: row.id,
    name: row.business_name,
    logoUrl: row.logoUrl || null,
    tagline: row.tagline || null,
    description: row.description || null,
    industry: row.industry || null,
    city: row.city || null,
    state: row.state || null,
    website: row.website || null,
    phone: row.business_phone || null,
    isVerified: row.isVerified === 1,
    chapterName: row.chapterName || null,
    primaryContact: row.primaryContactId
      ? {
          id: row.primaryContactId,
          name: row.primaryContactName || null,
          avatarUrl: row.primaryContactAvatar || null,
        }
      : null,
  }));

  return c.json(
    successResponse(
      {
        businesses,
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
      { requestId }
    )
  );
});

/**
 * GET /api/v1/public/directory/filters
 * Returns available filter options (industries, chapters, cities) for the directory.
 * Used to populate filter dropdowns dynamically from actual data.
 */
publicDirectoryRouter.get('/public/directory/filters', async (c) => {
  const chamberId = c.get('chamberId');
  const requestId = c.get('requestId');

  if (!chamberId) {
    throw new AppError(ErrorCodes.CHAMBER_NOT_FOUND, 'No chamber context bound to request', 404);
  }

  // Get distinct industries, cities, and active chapters
  const [industriesResult, citiesResult, chaptersResult] = await Promise.all([
    c.env.DB.prepare(`
      SELECT DISTINCT bp.industry 
      FROM business_profiles bp
      JOIN chamber_memberships cm ON cm.business_id = bp.id AND cm.chamber_id = bp.chamber_id AND cm.status = 'active'
      WHERE bp.chamber_id = ? AND bp.industry IS NOT NULL AND bp.industry != ''
      ORDER BY bp.industry ASC
    `).bind(chamberId).all<{ industry: string }>(),

    c.env.DB.prepare(`
      SELECT DISTINCT bp.city 
      FROM business_profiles bp
      JOIN chamber_memberships cm ON cm.business_id = bp.id AND cm.chamber_id = bp.chamber_id AND cm.status = 'active'
      WHERE bp.chamber_id = ? AND bp.city IS NOT NULL AND bp.city != ''
      ORDER BY bp.city ASC
    `).bind(chamberId).all<{ city: string }>(),

    c.env.DB.prepare(`
      SELECT id, name 
      FROM chapters 
      WHERE chamber_id = ? AND status = 'active'
      ORDER BY name ASC
    `).bind(chamberId).all<{ id: string; name: string }>(),
  ]);

  return c.json(
    successResponse(
      {
        industries: (industriesResult.results || []).map((r) => r.industry),
        cities: (citiesResult.results || []).map((r) => r.city),
        chapters: (chaptersResult.results || []).map((r) => ({ id: r.id, name: r.name })),
      },
      { requestId }
    )
  );
});
