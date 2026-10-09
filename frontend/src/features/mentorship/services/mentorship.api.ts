/**
 * Mentorship API — Prompt 05.6. Field names follow the spec (snake_case).
 */
import { apiUrl } from '@/core/api/base';
import type { NetworkMember } from '@/features/networking/services/networking.api';

function authHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  return { 'Content-Type': 'application/json', Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

async function request<T>(path: string, init: RequestInit = {}, fallback = 'Request failed'): Promise<{ data: T; meta: any }> {
  const res = await fetch(apiUrl(path), { ...init, headers: authHeaders() });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) throw new Error(json.error?.message || json.message || `${fallback} (${res.status})`);
  return { data: json.data as T, meta: json.meta || {} };
}

export type MentorshipStatus = 'pending' | 'accepted' | 'declined' | 'completed' | 'cancelled';

export const STATUS_LABELS: Record<MentorshipStatus, string> = {
  pending: 'Pending',
  accepted: 'Active',
  declined: 'Declined',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export interface Mentor {
  user_id: string;
  name: string;
  title: string | null;
  business_name: string | null;
  industry: string | null;
  avatar_url: string | null;
  expertise_areas: string[];
  years_of_experience: number;
  bio: string | null;
  active_mentees_count: number;
  max_mentees: number;
  is_available: boolean;
  rating: number | null;
  rating_count: number;
  my_request: { id: string; status: MentorshipStatus } | null;
}

export interface MentorFilters {
  expertise: string[];
  industries: string[];
}

export interface MentorProfile {
  id: string | null;
  is_mentor: boolean;
  is_mentee: boolean;
  expertise_areas: string[];
  years_of_experience: number;
  bio: string | null;
  max_mentees: number;
  active_mentees_count: number;
  is_available: boolean;
  rating: number | null;
  rating_count: number;
}

export interface MentorshipConnection {
  id: string;
  role: 'mentor' | 'mentee';
  mentor_id: string;
  mentor_name?: string;
  mentee_id: string;
  mentee_name?: string;
  partner: NetworkMember | null;
  status: MentorshipStatus;
  request_message: string | null;
  decline_reason: string | null;
  notes: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}

export interface ConnectionStats {
  pending_incoming: number;
  pending_outgoing: number;
  active: number;
  completed: number;
}

export async function fetchMentors(params: { search?: string; expertise?: string; industry?: string; available?: boolean } = {}) {
  const qs = new URLSearchParams();
  if (params.search) qs.set('search', params.search);
  if (params.expertise) qs.set('expertise', params.expertise);
  if (params.industry) qs.set('industry', params.industry);
  if (params.available) qs.set('available', 'true');
  const { data, meta } = await request<Mentor[]>(`/api/v1/mentorship/mentors${qs.toString() ? `?${qs}` : ''}`, {}, 'Failed to load mentors');
  return { mentors: data, filters: (meta.filters || { expertise: [], industries: [] }) as MentorFilters };
}

export async function fetchMentorProfile() {
  return (await request<MentorProfile>('/api/v1/mentorship/profile', {}, 'Failed to load your mentor profile')).data;
}

export async function saveMentorProfile(input: {
  is_mentor: boolean;
  expertise_areas: string[];
  years_of_experience: number;
  bio: string | null;
  max_mentees: number;
  is_available: boolean;
}) {
  return (await request<MentorProfile>('/api/v1/mentorship/profile', { method: 'PUT', body: JSON.stringify({ ...input, is_mentee: true }) }, 'Failed to save profile')).data;
}

export async function fetchConnections() {
  return (await request<{ connections: MentorshipConnection[]; stats: ConnectionStats }>('/api/v1/mentorship/connections', {}, 'Failed to load mentorships')).data;
}

export async function requestMentorship(mentorId: string, message: string) {
  return (await request<{ id: string; status: MentorshipStatus }>(
    '/api/v1/mentorship/requests',
    { method: 'POST', body: JSON.stringify({ mentor_id: mentorId, request_message: message }) },
    'Failed to send request'
  )).data;
}

export async function reviewMentorship(id: string, action: 'accept' | 'decline' | 'cancel' | 'complete', extra: { decline_reason?: string | null; rating?: number | null } = {}) {
  return (await request<{ id: string; status: MentorshipStatus }>(
    `/api/v1/mentorship/requests/${encodeURIComponent(id)}`,
    { method: 'PATCH', body: JSON.stringify({ action, ...extra }) },
    'Failed to update mentorship'
  )).data;
}

export async function saveMentorshipNotes(id: string, notes: string | null) {
  return (await request<{ id: string; notes: string | null }>(
    `/api/v1/mentorship/connections/${encodeURIComponent(id)}/notes`,
    { method: 'PATCH', body: JSON.stringify({ notes }) },
    'Failed to save notes'
  )).data;
}

/* ── Admin (OD-098) ───────────────────────────────────────────── */

export interface AdminMentorshipOverview {
  scope: 'chamber' | 'chapter';
  kpis: { mentors: number; available_mentors: number; pending_requests: number; active_pairs: number; completed: number; declined: number };
  mentors: {
    user_id: string;
    name: string;
    status: 'active' | 'paused';
    expertise_areas: string[];
    active_mentees_count: number;
    max_mentees: number;
    rating: number | null;
    rating_count: number;
  }[];
  pairs: {
    id: string;
    mentor: NetworkMember | null;
    mentee: NetworkMember | null;
    status: MentorshipStatus;
    requested_at: string;
    start_date: string | null;
    end_date: string | null;
  }[];
}

export async function fetchAdminMentorshipOverview() {
  return (await request<AdminMentorshipOverview>('/api/v1/admin/mentorship/overview', {}, 'Failed to load mentorship overview')).data;
}

export async function setAdminMentorStatus(userId: string, status: 'active' | 'paused') {
  return (await request<{ user_id: string; status: string }>(
    `/api/v1/admin/mentorship/mentors/${encodeURIComponent(userId)}`,
    { method: 'PATCH', body: JSON.stringify({ status }) },
    'Failed to update mentor'
  )).data;
}

export function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const d = new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}
