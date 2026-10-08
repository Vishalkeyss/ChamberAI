import { apiUrl } from '@/core/api/base';
/**
 * Member & Public Business Directory API Service
 * Supports public search & filtering and authenticated member directory with representative connect details.
 */

export interface DirectoryRepresentative {
  id: string;
  name: string | null;
  avatarUrl: string | null;
  email?: string | null;
  phone?: string | null;
  jobTitle?: string | null;
}

export interface DirectoryBusiness {
  id: string;
  name: string;
  dbaName?: string | null;
  logoUrl: string | null;
  tagline: string | null;
  description: string | null;
  industry: string | null;
  city: string | null;
  state: string | null;
  website: string | null;
  phone: string | null;
  isVerified: boolean;
  chapterName: string | null;
  chapterId?: string | null;
  planName?: string | null;
  membershipStatus?: string | null;
  chamberCity?: string | null;
  primaryContact: DirectoryRepresentative | null;
}

export interface DirectoryMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface DirectoryResponse {
  businesses: DirectoryBusiness[];
  meta: DirectoryMeta;
}

export interface DirectoryFilters {
  industries: string[];
  cities: string[];
  chapters: { id: string; name: string }[];
}

export interface DirectoryQueryParams {
  q?: string;
  industry?: string;
  chapter_id?: string;
  city?: string;
  verified?: boolean;
  page?: number;
  limit?: number;
}

/**
 * Resolves chamber headers for tenant context.
 */
function getChamberHeaders(chamberSlugOrId?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  let chamberIdentifier = chamberSlugOrId;
  if (!chamberIdentifier && typeof window !== 'undefined') {
    const searchParams = new URLSearchParams(window.location.search);
    chamberIdentifier =
      searchParams.get('chamber') ||
      sessionStorage.getItem('active_chamber_slug') ||
      sessionStorage.getItem('active_chamber_id') ||
      undefined;

    if (!chamberIdentifier) {
      try {
        const storedChamber = localStorage.getItem('auth_chamber');
        if (storedChamber) {
          const parsed = JSON.parse(storedChamber);
          chamberIdentifier = parsed.slug || parsed.id;
        }
      } catch {}
    }

    if (!chamberIdentifier) {
      try {
        const storedUser = localStorage.getItem('auth_user');
        if (storedUser) {
          const parsedUser = JSON.parse(storedUser);
          chamberIdentifier = parsedUser.chamber_id;
        }
      } catch {}
    }
  }

  if (chamberIdentifier) {
    if (chamberIdentifier.startsWith('cham_') || chamberIdentifier.startsWith('ch_')) {
      headers['x-chamber-id'] = chamberIdentifier;
    } else {
      headers['x-chamber-slug'] = chamberIdentifier;
    }
  }

  return headers;
}

/**
 * Normalizes asset URLs (e.g. data URLs, local mocks, or R2 URLs).
 */
export function resolveAssetUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('https://r2.121meet.ai/')) {
    // If backend or mock, check if valid or local
    return url;
  }
  return url;
}

/**
 * Fetches directory listings from either the public or member endpoint.
 */
export async function fetchDirectoryListings(
  params: DirectoryQueryParams = {},
  chamberSlug?: string,
  isMember: boolean = false
): Promise<DirectoryResponse> {
  try {
    const searchParams = new URLSearchParams();
    if (params.q) searchParams.set('q', params.q);
    if (params.industry) searchParams.set('industry', params.industry);
    if (params.chapter_id) searchParams.set('chapter_id', params.chapter_id);
    if (params.city) searchParams.set('city', params.city);
    if (params.verified) searchParams.set('verified', 'true');
    if (params.page) searchParams.set('page', String(params.page));
    if (params.limit) searchParams.set('limit', String(params.limit));

    const qs = searchParams.toString();
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    const useMemberRoute = isMember && !!token;

    const url = useMemberRoute
      ? `/api/v1/directory${qs ? `?${qs}` : ''}`
      : `/api/v1/public/directory${qs ? `?${qs}` : ''}`;

    const headers: Record<string, string> = {
      ...getChamberHeaders(chamberSlug),
    };

    if (useMemberRoute && token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(apiUrl(url), { headers });

    if (!res.ok) {
      // If member endpoint fails due to 401/403, fallback to public endpoint gracefully
      if (useMemberRoute && (res.status === 401 || res.status === 403)) {
        return fetchDirectoryListings(params, chamberSlug, false);
      }
      throw new Error(`Failed to fetch directory: ${res.statusText}`);
    }

    const data = await res.json();
    const rawList = Array.isArray(data?.data) ? data.data : (data?.data?.businesses || []);
    const rawMeta = data?.meta?.meta || (data?.meta?.page ? data.meta : null) || data?.data?.meta || {
      page: 1,
      limit: 12,
      total: rawList.length,
      totalPages: Math.ceil(rawList.length / 12) || 1,
    };

    return {
      businesses: rawList,
      meta: {
        page: Number(rawMeta.page) || 1,
        limit: Number(rawMeta.limit) || 12,
        total: Number(rawMeta.total) || rawList.length,
        totalPages: Number(rawMeta.totalPages) || Math.ceil(rawList.length / 12) || 1,
      },
    };
  } catch (err) {
    // Propagate so the page can show an error state instead of a misleading empty result.
    throw err;
  }
}

/**
 * Fetches dynamic filter options (industries, cities, chapters) for the current chamber.
 */
export async function fetchDirectoryFilters(chamberSlug?: string): Promise<DirectoryFilters> {
  try {
    const res = await fetch(apiUrl('/api/v1/public/directory/filters'), {
      headers: getChamberHeaders(chamberSlug),
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch directory filters: ${res.statusText}`);
    }

    const data = await res.json();
    return {
      industries: data?.data?.industries || [],
      cities: data?.data?.cities || [],
      chapters: data?.data?.chapters || [],
    };
  } catch (err) {
    console.error('Error fetching directory filters:', err);
    return { industries: [], cities: [], chapters: [] };
  }
}
