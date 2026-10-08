/**
 * Frontend Admin Events API Service for Prompt 04.2
 */
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

export interface AdminEventOverviewData {
  event: {
    id: string;
    title: string;
    description: string | null;
    category: string | null;
    visibility: string | null;
    status: string;
    eventDate: string;
    eventEndDate: string | null;
    isAllDay: number;
    venue: string | null;
    city: string | null;
    chapterId: string | null;
    groupId: string | null;
    maxCapacity: number | null;
    registeredCount: number;
    registrationFee: number;
    isPaid: number;
  };
  metrics: {
    totalRevenue: number;
    confirmedAttendees: number;
    waitlistedCount: number;
    checkedInCount: number;
    avgFeedbackRating: number;
    totalFeedbackCount: number;
  };
  ticketTypes: Array<{
    id: string;
    name: string;
    price: number;
    sold: number;
    available: number | null;
    allowPayLater: number;
  }>;
}

export interface AttendeeListItem {
  id: string;
  guestName: string;
  guestEmail: string;
  companyName: string | null;
  registrationType: string;
  ticketTypeId: string | null;
  ticketTypeName: string | null;
  amountPaid: number;
  discountAmount: number;
  paymentStatus: string;
  checkInStatus: string;
  isCheckedIn: boolean;
  checkedInAt: string | null;
  isWaitlisted: boolean;
  waitlistPosition: number | null;
  createdAt: string;
}

export interface WaitlistListItem {
  id: string;
  guestName: string;
  guestEmail: string;
  companyName: string | null;
  ticketTypeId: string | null;
  ticketTypeName: string | null;
  waitlistPosition: number | null;
  createdAt: string;
}

export interface EventFeedbackItem {
  id: string;
  userId: string;
  userName?: string;
  starRating: number;
  likedMost: string | null;
  wouldAttendAgain: boolean;
  suggestions: string | null;
  createdAt: string;
}

export interface EventSponsorItem {
  id: string;
  sponsorName: string;
  tierId: string | null;
  tierName?: string | null;
  amount: number;
  status: string;
  paymentDate: string | null;
}

/**
 * Fetch 9-tab overview metrics for an event
 */
export async function fetchAdminEventOverview(
  eventId: string,
  chamberSlug?: string
): Promise<AdminEventOverviewData> {
  const url = `${API_BASE}/api/v1/admin/events/${eventId}/overview`;
  const headers = getAuthHeaders(chamberSlug);
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`Failed to load event details (${res.status})`);
  }
  const json = await res.json();
  return json.data;
}

/**
 * Fetch attendees roster
 */
export async function fetchAdminAttendees(
  eventId: string,
  params: { q?: string; ticketTypeId?: string; checkInStatus?: string; page?: number; limit?: number } = {},
  chamberSlug?: string
): Promise<{ attendees: AttendeeListItem[]; total: number }> {
  const query = new URLSearchParams();
  if (params.q) query.set('q', params.q);
  if (params.ticketTypeId) query.set('ticketTypeId', params.ticketTypeId);
  if (params.checkInStatus) query.set('checkInStatus', params.checkInStatus);
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));

  const qs = query.toString();
  const url = `${API_BASE}/api/v1/admin/events/${eventId}/attendees${qs ? `?${qs}` : ''}`;
  const headers = getAuthHeaders(chamberSlug);
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`Failed to load attendees (${res.status})`);
  }
  const json = await res.json();
  return {
    attendees: json.data || [],
    total: json.meta?.total || 0,
  };
}

/**
 * Fetch waitlist roster
 */
export async function fetchAdminWaitlist(
  eventId: string,
  chamberSlug?: string
): Promise<WaitlistListItem[]> {
  const url = `${API_BASE}/api/v1/admin/events/${eventId}/waitlist`;
  const headers = getAuthHeaders(chamberSlug);
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`Failed to load waitlist (${res.status})`);
  }
  const json = await res.json();
  return json.data || [];
}

/**
 * Toggle check-in status
 */
export async function toggleAttendeeCheckIn(
  eventId: string,
  registrationId: string,
  isCheckedIn: boolean,
  chamberSlug?: string
): Promise<{ isCheckedIn: boolean; checkedInAt: string | null }> {
  const url = `${API_BASE}/api/v1/admin/events/${eventId}/attendees/${registrationId}/check-in`;
  const headers = getAuthHeaders(chamberSlug);
  const res = await fetch(url, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ isCheckedIn }),
  });
  if (!res.ok) {
    throw new Error(`Failed to update check-in status (${res.status})`);
  }
  const json = await res.json();
  return json.data;
}

/**
 * Promote waitlisted attendee
 */
export async function promoteWaitlistAttendee(
  eventId: string,
  registrationId: string,
  chamberSlug?: string
): Promise<{ registrationId: string; status: string }> {
  const url = `${API_BASE}/api/v1/admin/events/${eventId}/waitlist/${registrationId}/promote`;
  const headers = getAuthHeaders(chamberSlug);
  const res = await fetch(url, {
    method: 'POST',
    headers,
  });
  if (!res.ok) {
    throw new Error(`Failed to promote waitlisted attendee (${res.status})`);
  }
  const json = await res.json();
  return json.data;
}

/**
 * Remove/delete attendee or waitlist registration
 */
export async function deleteRegistration(
  eventId: string,
  registrationId: string,
  chamberSlug?: string
): Promise<{ registrationId: string; deleted: boolean }> {
  const url = `${API_BASE}/api/v1/admin/events/${eventId}/attendees/${registrationId}`;
  const headers = getAuthHeaders(chamberSlug);
  const res = await fetch(url, {
    method: 'DELETE',
    headers,
  });
  if (!res.ok) {
    throw new Error(`Failed to remove attendee (${res.status})`);
  }
  const json = await res.json();
  return json.data;
}

/**
 * Fetch event feedback
 */
export async function fetchAdminEventFeedback(
  eventId: string,
  chamberSlug?: string
): Promise<EventFeedbackItem[]> {
  const url = `${API_BASE}/api/v1/admin/events/${eventId}/feedback`;
  const headers = getAuthHeaders(chamberSlug);
  const res = await fetch(url, { headers });
  if (!res.ok) {
    return [];
  }
  const json = await res.json();
  return json.data || [];
}

/**
 * Fetch event sponsors
 */
export async function fetchAdminEventSponsors(
  eventId: string,
  chamberSlug?: string
): Promise<EventSponsorItem[]> {
  const url = `${API_BASE}/api/v1/admin/events/${eventId}/sponsors`;
  const headers = getAuthHeaders(chamberSlug);
  const res = await fetch(url, { headers });
  if (!res.ok) {
    return [];
  }
  const json = await res.json();
  return json.data || [];
}

// ---------------------------------------------------------------------------
// Prompt 04.6 — Admin Event Creation Wizard
// ---------------------------------------------------------------------------

export interface EventTicketTypeForm {
  id?: string;
  name: string;
  price: number;
  description: string | null;
  allowPayLater: boolean;
  qtyLimit: number | null;
  /** read-only, returned when editing */
  qtySold?: number;
}

export interface EventSponsorshipTierForm {
  id?: string;
  tierName: string;
  amount: number;
  benefits: string[];
  /** read-only, returned when editing */
  sponsorCount?: number;
}

export interface EventPromoCodeForm {
  id?: string;
  code: string;
  discountType: 'percentage' | 'flat';
  discountValue: number;
  maxUses: number | null;
  isActive: boolean;
  /** read-only, returned when editing */
  usedCount?: number;
}

export interface EventRecurrenceForm {
  freq: 'daily' | 'weekly' | 'monthly';
  interval: number;
  weekdays: number[];
  endType: 'after' | 'on';
  count?: number;
  until?: string;
  tzOffsetMinutes: number;
}

export interface AdminEventFormPayload {
  title: string;
  category: string;
  visibility: 'public' | 'staff_only';
  eventDate: string;
  eventEndDate: string | null;
  city: string | null;
  venue: string;
  chapterId: string | null;
  groupId: string | null;
  tableArrangement: string | null;
  numTables: number | null;
  maxCapacity: number | null;
  isPaid: boolean;
  registrationFee: number;
  allowNonMemberRegistration: boolean;
  nonMemberFee: number | null;
  description: string | null;
  videoUrl: string | null;
  photos: string[];
  promoteFacebook: boolean;
  promoteMeetup: boolean;
  promoteEventbrite: boolean;
  ticketTypes: EventTicketTypeForm[];
  sponsorshipTiers: EventSponsorshipTierForm[];
  promoCodes: EventPromoCodeForm[];
  recurrence?: EventRecurrenceForm | null;
  applyToSeries?: boolean;
}

export interface AdminEventEditData extends AdminEventFormPayload {
  id: string;
  status: string;
  registeredCount: number;
  series: { total: number; recurrenceLabel: string | null } | null;
}

export interface EventFormOptions {
  chapters: { id: string; name: string }[];
  groups: { id: string; name: string }[];
  categories: string[];
  cities: string[];
  defaultCity: string | null;
  lockedChapterId: string | null;
}

async function adminRequest<T>(path: string, init: RequestInit = {}, chamberSlug?: string): Promise<T> {
  const headers = getAuthHeaders(chamberSlug);
  if (init.body instanceof FormData) delete headers['Content-Type'];
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers: { ...headers, ...(init.headers || {}) } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error?.message || json.message || `Request failed (${res.status})`);
  }
  return json.data as T;
}

export function fetchEventFormOptions(chamberSlug?: string): Promise<EventFormOptions> {
  return adminRequest('/api/v1/admin/events/form-options', {}, chamberSlug);
}

export function fetchAdminEventForEdit(eventId: string, chamberSlug?: string): Promise<AdminEventEditData> {
  return adminRequest(`/api/v1/admin/events/${eventId}`, {}, chamberSlug);
}

export function createAdminEvent(
  payload: AdminEventFormPayload,
  chamberSlug?: string
): Promise<{ id: string; title: string; status: string; occurrenceIds: string[]; recurrenceLabel: string | null }> {
  return adminRequest('/api/v1/admin/events', { method: 'POST', body: JSON.stringify(payload) }, chamberSlug);
}

export function updateAdminEvent(
  eventId: string,
  payload: AdminEventFormPayload,
  chamberSlug?: string
): Promise<{ id: string; updatedAt: string; updatedOccurrences: number }> {
  return adminRequest(`/api/v1/admin/events/${eventId}`, { method: 'PUT', body: JSON.stringify(payload) }, chamberSlug);
}

export function deleteAdminEvent(
  eventId: string,
  chamberSlug?: string
): Promise<{ id: string; deleted: boolean; status: string }> {
  return adminRequest(`/api/v1/admin/events/${eventId}`, { method: 'DELETE' }, chamberSlug);
}

export function uploadEventPhoto(file: File, chamberSlug?: string): Promise<{ url: string }> {
  const form = new FormData();
  form.append('file', file);
  return adminRequest('/api/v1/admin/events/photos', { method: 'POST', body: form }, chamberSlug);
}
