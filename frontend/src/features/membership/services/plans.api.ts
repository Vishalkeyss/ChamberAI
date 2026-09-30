import type {
  CalculateDuesParams,
  CalculateDuesResult,
  ChapterOption,
  CreatePlanPayload,
  MembershipPlan,
  UpdatePlanPayload,
} from '../types';

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

/**
 * Public: Fetch all active membership plans for the current chamber
 */
export async function fetchPublicPlans(chamberSlug?: string): Promise<MembershipPlan[]> {
  const res = await fetch(`${API_BASE}/api/v1/public/plans`, {
    method: 'GET',
    headers: getHeaders(chamberSlug),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to load membership plans');
  }

  const json = await res.json();
  return json.data || [];
}

/**
 * Public: Calculate prospective dues dynamically
 */
export async function calculateDues(
  params: CalculateDuesParams,
  chamberSlug?: string
): Promise<CalculateDuesResult> {
  const res = await fetch(`${API_BASE}/api/v1/public/plans/calculate`, {
    method: 'POST',
    headers: getHeaders(chamberSlug),
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to calculate dues');
  }

  const json = await res.json();
  return json.data;
}

/**
 * Public: Fetch active chapters for chapter-specific pricing dropdown
 */
export async function fetchActiveChapters(chamberSlug?: string): Promise<ChapterOption[]> {
  const res = await fetch(`${API_BASE}/api/v1/public/chapters`, {
    method: 'GET',
    headers: getHeaders(chamberSlug),
  });

  if (!res.ok) {
    return [];
  }

  const json = await res.json();
  return json.data || [];
}

/**
 * Admin: Fetch all plans (active & inactive)
 */
export async function fetchAdminPlans(chamberSlug?: string): Promise<MembershipPlan[]> {
  const res = await fetch(`${API_BASE}/api/v1/admin/plans`, {
    method: 'GET',
    headers: getHeaders(chamberSlug),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to load administrative plans');
  }

  const json = await res.json();
  return json.data || [];
}

/**
 * Admin: Fetch a single plan by ID
 */
export async function fetchAdminPlanById(
  planId: string,
  chamberSlug?: string
): Promise<MembershipPlan> {
  const res = await fetch(`${API_BASE}/api/v1/admin/plans/${planId}`, {
    method: 'GET',
    headers: getHeaders(chamberSlug),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to load plan details');
  }

  const json = await res.json();
  return json.data;
}

/**
 * Admin: Create a new membership plan
 */
export async function createAdminPlan(
  payload: CreatePlanPayload,
  chamberSlug?: string
): Promise<MembershipPlan> {
  const res = await fetch(`${API_BASE}/api/v1/admin/plans`, {
    method: 'POST',
    headers: getHeaders(chamberSlug),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to create membership plan');
  }

  const json = await res.json();
  return json.data;
}

/**
 * Admin: Update an existing plan
 */
export async function updateAdminPlan(
  planId: string,
  payload: UpdatePlanPayload,
  chamberSlug?: string
): Promise<MembershipPlan> {
  const res = await fetch(`${API_BASE}/api/v1/admin/plans/${planId}`, {
    method: 'PUT',
    headers: getHeaders(chamberSlug),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to update membership plan');
  }

  const json = await res.json();
  return json.data;
}

/**
 * Admin: Toggle active/disabled status
 */
export async function toggleAdminPlanStatus(
  planId: string,
  isActive: number,
  chamberSlug?: string
): Promise<{ id: string; isActive: number }> {
  const res = await fetch(`${API_BASE}/api/v1/admin/plans/${planId}/toggle-status`, {
    method: 'PATCH',
    headers: getHeaders(chamberSlug),
    body: JSON.stringify({ isActive }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to toggle plan status');
  }

  const json = await res.json();
  return json.data;
}

/**
 * Admin: Delete a plan
 */
export async function deleteAdminPlan(
  planId: string,
  chamberSlug?: string
): Promise<{ id: string; deleted: boolean }> {
  const res = await fetch(`${API_BASE}/api/v1/admin/plans/${planId}`, {
    method: 'DELETE',
    headers: getHeaders(chamberSlug),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to delete membership plan');
  }

  const json = await res.json();
  return json.data;
}
