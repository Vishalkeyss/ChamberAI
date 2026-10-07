/**
 * Events API Service (Public & Member)
 * Supports Prompt 04.1 Events Listing, Filters, and Interactive Calendar
 */

export interface EventItem {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  visibility: string | null;
  eventDate: string;
  eventEndDate: string | null;
  isAllDay: number;
  city: string | null;
  venue: string | null;
  isVirtual: number;
  virtualMeetingUrl?: string | null;
  chapterId: string | null;
  chapterName?: string | null;
  coverImageUrl: string | null;
  registrationFee: number;
  nonMemberFee?: number | null;
  isPaid: number;
  registeredCount: number;
  maxCapacity: number | null;
  status: string | null;
  isSoldOut: boolean;
  spotsRemaining: number | null;
}

export interface EventsMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface EventsResponse {
  events: EventItem[];
  meta: EventsMeta;
}

export interface EventsFilters {
  categories: string[];
  cities: string[];
  chapters: { id: string; name: string }[];
}

export interface EventsQueryParams {
  timeframe?: 'upcoming' | 'past';
  category?: string;
  chapter_id?: string;
  chapterId?: string;
  city?: string;
  isVirtual?: boolean | number;
  is_virtual?: boolean | number;
  isPaid?: boolean | number;
  is_paid?: boolean | number;
  q?: string;
  page?: number;
  limit?: number;
}

const API_BASE = import.meta.env.VITE_API_URL || '';

function getAuthHeaders(chamberSlugOrId?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
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

  const token =
    typeof window !== 'undefined'
      ? localStorage.getItem('auth_token') ||
        localStorage.getItem('session_token') ||
        sessionStorage.getItem('auth_token') ||
        sessionStorage.getItem('session_token')
      : null;

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}

/**
 * Fetch events listings (public or member-scoped)
 */
export async function fetchEvents(
  params: EventsQueryParams = {},
  chamberSlug?: string,
  isMember: boolean = false
): Promise<EventsResponse> {
  const query = new URLSearchParams();

  if (params.timeframe) query.set('timeframe', params.timeframe);
  if (params.category) query.set('category', params.category);
  if (params.chapter_id || params.chapterId) query.set('chapter_id', (params.chapter_id || params.chapterId)!);
  if (params.city) query.set('city', params.city);
  if (params.isVirtual !== undefined) query.set('is_virtual', String(params.isVirtual));
  if (params.is_virtual !== undefined) query.set('is_virtual', String(params.is_virtual));
  if (params.isPaid !== undefined) query.set('is_paid', String(params.isPaid));
  if (params.is_paid !== undefined) query.set('is_paid', String(params.is_paid));
  if (params.q) query.set('q', params.q);
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));

  const qs = query.toString();
  const token =
    typeof window !== 'undefined'
      ? localStorage.getItem('auth_token') || localStorage.getItem('session_token')
      : null;
  const useMemberRoute = isMember && !!token;

  const endpoint = useMemberRoute ? '/api/v1/events' : '/api/v1/public/events';
  const url = `${API_BASE}${endpoint}${qs ? `?${qs}` : ''}`;
  const headers = getAuthHeaders(chamberSlug);

  const res = await fetch(url, { headers });
  if (!res.ok) {
    // If member endpoint fails due to 401/403, fallback to public endpoint gracefully
    if (useMemberRoute && (res.status === 401 || res.status === 403)) {
      return fetchEvents(params, chamberSlug, false);
    }
    throw new Error(`Failed to load events (${res.status})`);
  }

  const json = await res.json();
  return {
    events: json.data || [],
    meta: json.meta?.meta || json.meta || { total: 0, page: 1, limit: 12, totalPages: 0 },
  };
}

/**
 * Fetch dynamic filter options for events
 */
export async function fetchEventsFilters(
  chamberSlug?: string,
  isMember: boolean = false
): Promise<EventsFilters> {
  const token =
    typeof window !== 'undefined'
      ? localStorage.getItem('auth_token') || localStorage.getItem('session_token')
      : null;
  const useMemberRoute = isMember && !!token;

  const endpoint = useMemberRoute ? '/api/v1/events/filters' : '/api/v1/public/events/filters';
  const url = `${API_BASE}${endpoint}`;
  const headers = getAuthHeaders(chamberSlug);

  const res = await fetch(url, { headers });
  if (!res.ok) {
    if (useMemberRoute && (res.status === 401 || res.status === 403)) {
      return fetchEventsFilters(chamberSlug, false);
    }
    return { categories: [], cities: [], chapters: [] };
  }

  const json = await res.json();
  return json.data || { categories: [], cities: [], chapters: [] };
}

export interface RegisterEventInput {
  ticketTypeId?: string;
  promoCode?: string;
  redeemPoints?: number;
  paymentMethodId?: string;
  guestDetails?: {
    name: string;
    email: string;
    phone?: string;
    company?: string;
  };
}

export interface RegistrationResult {
  registrationId: string;
  status: 'confirmed' | 'waitlisted';
  isWaitlisted: boolean;
  waitlistPosition: number | null;
  guestName: string;
  guestEmail: string;
}

/**
 * Register member or guest for an event dynamically via API
 */
export async function registerForEvent(
  eventId: string,
  input: RegisterEventInput,
  chamberSlug?: string,
  isMember: boolean = false
): Promise<RegistrationResult> {
  const token =
    typeof window !== 'undefined'
      ? localStorage.getItem('auth_token') || localStorage.getItem('session_token')
      : null;
  const useMemberRoute = isMember && !!token;

  const endpoint = useMemberRoute
    ? `/api/v1/events/${eventId}/register`
    : `/api/v1/public/events/${eventId}/register`;
  const url = `${API_BASE}${endpoint}`;
  const headers = getAuthHeaders(chamberSlug);

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error?.message || json.message || `Failed to register (${res.status})`);
  }

  return json.data;
}

