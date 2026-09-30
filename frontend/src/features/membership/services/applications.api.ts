const API_BASE = import.meta.env.VITE_API_URL || '';

function getHeaders(chamberSlugOrId?: string): HeadersInit {
  const token = localStorage.getItem('auth_token') || localStorage.getItem('session_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Resolve dynamic tenant chamber context
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

export interface ApplicationSubmitPayload {
  applicantName: string;
  businessEmail: string;
  businessPhone?: string;
  businessName: string;
  planId: string;
  chapterId?: string | null;
  businessDetails?: {
    dbaName?: string;
    website?: string;
    landingPage?: string;
    industry?: string;
    address?: {
      street: string;
      city: string;
      state: string;
      zip: string;
    };
    employeeCount?: number;
    annualRevenue?: number;
    description?: string;
    jobTitle?: string;
    preferredLanguage?: string;
    socials?: Record<string, any>;
    staff?: any[];
  };
}

export interface ApplicationResubmitPayload {
  applicantName?: string;
  businessPhone?: string;
  businessName?: string;
  chapterId?: string | null;
  businessDetails?: {
    dbaName?: string;
    website?: string;
    industry?: string;
    address?: {
      street: string;
      city: string;
      state: string;
      zip: string;
    };
    employeeCount?: number;
    annualRevenue?: number;
    description?: string;
    jobTitle?: string;
    preferredLanguage?: string;
  };
}

export interface ApplicationTrackingData {
  id: string;
  trackingCode: string;
  status: 'pending' | 'approved' | 'rejected' | 'changes_requested';
  applicantName: string;
  businessEmail: string;
  businessPhone?: string | null;
  businessName: string;
  planId: string;
  planName: string;
  planAccentColor: string;
  planPrice: number;
  planPricingBasis: string;
  chapterId?: string | null;
  chapterName?: string | null;
  adminNotes?: string | null;
  submittedAt: string;
  updatedAt?: string | null;
  businessDetails: {
    dbaName?: string;
    website?: string;
    industry?: string;
    address?: {
      street: string;
      city: string;
      state: string;
      zip: string;
    };
    employeeCount?: number;
    annualRevenue?: number;
    description?: string;
    jobTitle?: string;
    preferredLanguage?: string;
  };
}

/**
 * Submits a new guest membership application
 */
export async function submitApplication(
  payload: ApplicationSubmitPayload,
  chamberSlugOrId?: string
): Promise<{ id: string; trackingCode: string; status: string; message: string }> {
  const res = await fetch(`${API_BASE}/api/v1/public/applications`, {
    method: 'POST',
    headers: getHeaders(chamberSlugOrId),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody?.error?.message || `Failed to submit application (${res.status})`);
  }

  const json = await res.json();
  return json.data;
}

/**
 * Tracks an application status by tracking code
 */
export async function trackApplication(
  trackingCode: string,
  chamberSlugOrId?: string
): Promise<ApplicationTrackingData> {
  const res = await fetch(`${API_BASE}/api/v1/public/applications/track/${encodeURIComponent(trackingCode.trim().toUpperCase())}`, {
    method: 'GET',
    headers: getHeaders(chamberSlugOrId),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody?.error?.message || `Failed to look up application (${res.status})`);
  }

  const json = await res.json();
  return json.data;
}

/**
 * Resubmits application when in changes_requested status
 */
export async function resubmitApplication(
  trackingCode: string,
  payload: ApplicationResubmitPayload,
  chamberSlugOrId?: string
): Promise<{ trackingCode: string; status: string; message: string }> {
  const res = await fetch(`${API_BASE}/api/v1/public/applications/track/${encodeURIComponent(trackingCode.trim().toUpperCase())}`, {
    method: 'PUT',
    headers: getHeaders(chamberSlugOrId),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody?.error?.message || `Failed to resubmit application (${res.status})`);
  }

  const json = await res.json();
  return json.data;
}
