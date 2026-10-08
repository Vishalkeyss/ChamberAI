import { apiUrl } from '@/core/api/base';
import type {
  AccountSettingsData,
  NotificationPreferenceItem,
  UserAccountSettingsProfile,
} from '../types';

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('auth_token');
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function fetchAccountSettings(): Promise<AccountSettingsData> {
  const res = await fetch(apiUrl('/api/v1/member/settings'), {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Failed to fetch account settings');
  }

  const json = await res.json();
  return json.data;
}

export async function updateProfile(data: {
  name: string;
  title?: string | null;
  phone?: string | null;
}): Promise<{ message: string; user: Partial<UserAccountSettingsProfile> }> {
  const res = await fetch(apiUrl('/api/v1/member/settings/profile'), {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Failed to update profile');
  }

  const json = await res.json();
  return json.data;
}

export async function updateNotificationPreferences(
  preferences: NotificationPreferenceItem[]
): Promise<{ message: string; updated_count: number }> {
  const res = await fetch(apiUrl('/api/v1/member/settings/notifications'), {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({ preferences }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Failed to update notification preferences');
  }

  const json = await res.json();
  return json.data;
}

export async function revokeActiveSession(sessionId: string): Promise<{ revoked: boolean }> {
  const res = await fetch(apiUrl(`/api/v1/member/settings/sessions/${encodeURIComponent(sessionId)}`), {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Failed to revoke session');
  }

  const json = await res.json();
  return json.data;
}

export async function savePersonalApiKey(data: {
  provider: 'openai' | 'anthropic' | 'google';
  api_key: string;
}): Promise<{ message: string; provider: string }> {
  const res = await fetch(apiUrl('/api/v1/member/settings/api-key'), {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Failed to configure API key');
  }

  const json = await res.json();
  return json.data;
}
