/**
 * Prompt 03.1: Business Profile Management, Media Uploads & Team Representatives
 * Frontend API Service
 */

export interface RelatedOrganization {
  businessId: string;
  businessName: string;
  relationshipType: 'Parent Company' | 'Branch Office' | 'Sister Company' | 'Subsidiary' | 'Affiliate';
  reciprocalType?: string;
}

export interface TeamRepresentative {
  id: string;
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  jobTitle?: string | null;
  phones?: string[];
  socials?: {
    linkedin?: string;
    other?: string;
  };
  isPrimaryContact: boolean;
  accessLevel: 'full_access' | 'billing_only' | 'events_networking' | 'business_development';
  status: 'active' | 'invited' | 'inactive';
  createdAt: string;
}

export interface BusinessProfileData {
  id: string;
  chamberId: string;
  name: string;
  dbaName: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  tagline: string | null;
  description: string | null;
  industry: string;
  businessPhone: string | null;
  businessEmail: string | null;
  website: string | null;
  streetAddress: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  socialLinks: {
    linkedin?: string;
    twitter?: string;
    facebook?: string;
    instagram?: string;
    youtube?: string;
    [key: string]: string | undefined;
  };
  skills: string[];
  interests: string[];
  locations: string[];
  relatedOrganizations: RelatedOrganization[];
  isVerified: boolean;
  myAccessLevel: 'full_access' | 'billing_only' | 'events_networking';
  isPrimaryContact: boolean;
  representatives: TeamRepresentative[];
  createdAt: string;
  updatedAt: string | null;
}

export interface UpdateBusinessProfilePayload {
  name: string;
  dbaName?: string;
  logoUrl?: string | null;
  tagline?: string;
  description?: string;
  industry: string;
  businessPhone?: string;
  businessEmail?: string;
  website?: string;
  streetAddress?: string;
  city?: string;
  state?: string;
  zip?: string;
  socialLinks?: Record<string, string>;
  skills?: string[];
  locations?: string[];
  relatedOrganizations?: RelatedOrganization[];
}

export interface InviteRepresentativePayload {
  firstName: string;
  lastName: string;
  email: string;
  jobTitle?: string;
  accessLevel: 'full_access' | 'billing_only' | 'events_networking';
}

export interface RelatedOrgSearchResult {
  id: string;
  name: string;
  industry?: string;
  city?: string;
  logoUrl?: string | null;
}

function getAuthHeaders(hasBody = true): HeadersInit {
  const token = localStorage.getItem('auth_token');
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (hasBody) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export function resolveAssetUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('https://r2.121meet.ai/')) {
    return url.replace('https://r2.121meet.ai/', '/api/v1/public/assets/');
  }
  return url;
}

/**
 * GET /api/v1/member/business-profile
 */
export async function fetchBusinessProfile(): Promise<BusinessProfileData> {
  const res = await fetch('/api/v1/member/business-profile', {
    method: 'GET',
    headers: getAuthHeaders(false),
  });

  if (!res.ok) {
    if (res.status === 401) {
      window.dispatchEvent(new Event('auth:session_expired'));
    }
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to fetch business profile');
  }

  const json = await res.json();
  const data = json.data;
  if (data) {
    if (data.logoUrl) data.logoUrl = resolveAssetUrl(data.logoUrl);
    if (data.bannerUrl) data.bannerUrl = resolveAssetUrl(data.bannerUrl);
  }
  return data;
}

/**
 * PUT /api/v1/member/business-profile
 */
export async function updateBusinessProfile(
  payload: UpdateBusinessProfilePayload
): Promise<{ id: string; updatedAt: string }> {
  const res = await fetch('/api/v1/member/business-profile', {
    method: 'PUT',
    headers: getAuthHeaders(true),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    if (res.status === 401) {
      window.dispatchEvent(new Event('auth:session_expired'));
    }
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to update business profile');
  }

  const json = await res.json();
  return json.data;
}

/**
 * POST /api/v1/member/business-profile/logo
 */
export async function uploadBusinessLogo(fileOrDataUrl: File | string): Promise<{ logoUrl: string }> {
  const token = localStorage.getItem('auth_token');
  let res: Response;

  if (typeof fileOrDataUrl === 'string') {
    res = await fetch('/api/v1/member/business-profile/logo', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ dataUrl: fileOrDataUrl }),
    });
  } else {
    const formData = new FormData();
    formData.append('file', fileOrDataUrl);
    res = await fetch('/api/v1/member/business-profile/logo', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });
  }

  if (!res.ok) {
    if (res.status === 401) {
      window.dispatchEvent(new Event('auth:session_expired'));
    }
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to upload business logo');
  }

  const json = await res.json();
  const data = json.data;
  return {
    logoUrl: resolveAssetUrl(data?.logoUrl) || data?.logoUrl || '',
  };
}

/**
 * DELETE /api/v1/member/business-profile/logo
 */
export async function deleteBusinessLogo(): Promise<void> {
  const res = await fetch('/api/v1/member/business-profile/logo', {
    method: 'DELETE',
    headers: getAuthHeaders(false),
  });

  if (!res.ok) {
    if (res.status === 401) {
      window.dispatchEvent(new Event('auth:session_expired'));
    }
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to remove business logo');
  }
}

/**
 * POST /api/v1/member/business-profile/banner
 */
export async function uploadBusinessBanner(fileOrDataUrl: File | string): Promise<{ bannerUrl: string }> {
  const token = localStorage.getItem('auth_token');
  let res: Response;

  if (typeof fileOrDataUrl === 'string') {
    res = await fetch('/api/v1/member/business-profile/banner', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ dataUrl: fileOrDataUrl }),
    });
  } else {
    const formData = new FormData();
    formData.append('file', fileOrDataUrl);
    res = await fetch('/api/v1/member/business-profile/banner', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });
  }

  if (!res.ok) {
    if (res.status === 401) {
      window.dispatchEvent(new Event('auth:session_expired'));
    }
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to upload business banner');
  }

  const json = await res.json();
  const data = json.data;
  return {
    bannerUrl: resolveAssetUrl(data?.bannerUrl) || data?.bannerUrl || '',
  };
}

/**
 * GET /api/v1/member/team
 */
export async function fetchTeamRepresentatives(): Promise<TeamRepresentative[]> {
  const res = await fetch('/api/v1/member/team', {
    method: 'GET',
    headers: getAuthHeaders(false),
  });

  if (!res.ok) {
    if (res.status === 401) {
      window.dispatchEvent(new Event('auth:session_expired'));
    }
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to fetch team representatives');
  }

  const json = await res.json();
  return json.data;
}

/**
 * POST /api/v1/member/team/invite
 */
export async function inviteRepresentative(payload: InviteRepresentativePayload): Promise<TeamRepresentative> {
  const res = await fetch('/api/v1/member/team/invite', {
    method: 'POST',
    headers: getAuthHeaders(true),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    if (res.status === 401) {
      window.dispatchEvent(new Event('auth:session_expired'));
    }
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to invite team representative');
  }

  const json = await res.json();
  return json.data;
}

/**
 * DELETE /api/v1/member/team/:id
 */
export async function removeRepresentative(id: string): Promise<void> {
  const res = await fetch(`/api/v1/member/team/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(false),
  });

  if (!res.ok) {
    if (res.status === 401) {
      window.dispatchEvent(new Event('auth:session_expired'));
    }
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to remove representative');
  }
}

/**
 * PATCH /api/v1/member/team/:id/primary
 */
export async function setPrimaryContact(id: string): Promise<void> {
  const res = await fetch(`/api/v1/member/team/${id}/primary`, {
    method: 'PATCH',
    headers: getAuthHeaders(false),
  });

  if (!res.ok) {
    if (res.status === 401) {
      window.dispatchEvent(new Event('auth:session_expired'));
    }
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to set primary contact');
  }
}

/**
 * PATCH /api/v1/member/team/:id
 */
export async function updateRepresentative(
  id: string,
  payload: {
    name?: string;
    jobTitle?: string;
    email?: string;
    phones?: string[];
    socials?: {
      linkedin?: string;
      other?: string;
    };
    accessLevel?: TeamRepresentative['accessLevel'];
  }
): Promise<void> {
  const res = await fetch(`/api/v1/member/team/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: getAuthHeaders(true),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    if (res.status === 401) {
      window.dispatchEvent(new Event('auth:session_expired'));
    }
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to update team member');
  }
}

/**
 * GET /api/v1/member/business-profile/network-search
 */
export async function searchRelatedOrganizations(query: string): Promise<RelatedOrgSearchResult[]> {
  const res = await fetch(`/api/v1/member/business-profile/network-search?q=${encodeURIComponent(query)}`, {
    method: 'GET',
    headers: getAuthHeaders(false),
  });

  if (!res.ok) {
    if (res.status === 401) {
      window.dispatchEvent(new Event('auth:session_expired'));
    }
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to search organizations');
  }

  const json = await res.json();
  return json.data;
}
