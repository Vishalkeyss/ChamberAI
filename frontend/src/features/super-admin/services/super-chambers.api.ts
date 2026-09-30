import type {
  PlatformChamber,
  ProvisionChamberPayload,
  SuperChambersPagination,
  UpdateChamberStatusPayload,
} from '../types';

const API_BASE = import.meta.env.VITE_API_URL || '';

function getAuthHeaders(): HeadersInit {
  const token =
    localStorage.getItem('auth_token') ||
    localStorage.getItem('session_token') ||
    'dev_super_admin_token';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
  };

  return headers;
}

export async function fetchSuperChambers(params?: {
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
}): Promise<{ data: PlatformChamber[]; pagination: SuperChambersPagination }> {
  const query = new URLSearchParams();
  if (params?.search) query.set('search', params.search);
  if (params?.status && params.status !== 'all') query.set('status', params.status);
  if (params?.page) query.set('page', params.page.toString());
  if (params?.limit) query.set('limit', params.limit.toString());

  const queryString = query.toString() ? `?${query.toString()}` : '';
  const res = await fetch(`${API_BASE}/api/v1/super/chambers${queryString}`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody?.error?.message || `Failed to fetch chambers (${res.status})`);
  }

  const json = await res.json();
  return {
    data: json.data || [],
    pagination: json.pagination || { page: 1, limit: 25, total: 0, totalPages: 1 },
  };
}

export async function provisionChamber(payload: ProvisionChamberPayload): Promise<any> {
  const res = await fetch(`${API_BASE}/api/v1/super/chambers`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody?.error?.message || `Failed to provision chamber (${res.status})`);
  }

  const json = await res.json();
  return json.data;
}

export async function updateChamberStatus(
  chamberId: string,
  payload: UpdateChamberStatusPayload
): Promise<PlatformChamber> {
  const res = await fetch(`${API_BASE}/api/v1/super/chambers/${encodeURIComponent(chamberId)}/status`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody?.error?.message || `Failed to update chamber status (${res.status})`);
  }

  const json = await res.json();
  return json.data;
}
