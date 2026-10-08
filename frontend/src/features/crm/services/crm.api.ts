/**
 * CRM API — Prompt 05.5 (private per-member pipeline). Field names follow the spec (snake_case).
 */
import { apiUrl } from '@/core/api/base';

function authHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  return { 'Content-Type': 'application/json', Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

export async function apiRequest<T>(path: string, init: RequestInit = {}, fallback = 'Request failed'): Promise<T> {
  const res = await fetch(apiUrl(path), { ...init, headers: authHeaders() });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) throw new Error(json.error?.message || json.message || `${fallback} (${res.status})`);
  return json.data as T;
}

export const CRM_STAGES = ['lead', 'contacted', 'qualified', 'proposal_sent', 'won', 'lost'] as const;
export type CrmStage = (typeof CRM_STAGES)[number];

export const CRM_STAGE_LABELS: Record<CrmStage, string> = {
  lead: 'Lead',
  contacted: 'Contacted',
  qualified: 'Qualified',
  proposal_sent: 'Proposal Sent',
  won: 'Won',
  lost: 'Lost',
};

export interface CrmContact {
  id: string;
  name: string;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  stage: CrmStage;
  deal_value: number;
  expected_close_date: string | null;
  follow_up_date: string | null;
  notes: string | null;
  linked_user: { id: string; name: string } | null;
  last_interaction_at: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface CrmActivity {
  id: string;
  type: 'note' | 'call' | 'meeting' | 'email' | 'stage';
  body: string;
  created_at: string;
}

export interface CrmContactDetail extends CrmContact {
  activities: CrmActivity[];
}

export interface CrmMetrics {
  total_pipeline_value: number;
  total_contacts: number;
  win_rate: number | null;
  stage_summaries: Record<CrmStage, { count: number; value: number }>;
}

export interface CrmContactInput {
  name: string;
  company_name?: string | null;
  email?: string | null;
  phone?: string | null;
  stage?: CrmStage;
  deal_value?: number;
  expected_close_date?: string | null;
  follow_up_date?: string | null;
  notes?: string | null;
  linked_user_id?: string | null;
}

export async function fetchCrmContacts(params: { stage?: string; search?: string } = {}) {
  const qs = new URLSearchParams();
  if (params.stage) qs.set('stage', params.stage);
  if (params.search) qs.set('search', params.search);
  const q = qs.toString();
  return apiRequest<{ metrics: CrmMetrics; contacts: CrmContact[] }>(`/api/v1/crm/contacts${q ? `?${q}` : ''}`, {}, 'Failed to load contacts');
}

export const fetchCrmContact = (id: string) =>
  apiRequest<CrmContactDetail>(`/api/v1/crm/contacts/${encodeURIComponent(id)}`, {}, 'Failed to load contact');

export const createCrmContact = (input: CrmContactInput) =>
  apiRequest<{ id: string }>('/api/v1/crm/contacts', { method: 'POST', body: JSON.stringify(input) }, 'Failed to add contact');

export const updateCrmContact = (id: string, input: Partial<CrmContactInput>) =>
  apiRequest<CrmContactDetail>(`/api/v1/crm/contacts/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(input) }, 'Failed to save contact');

export const updateCrmStage = (id: string, stage: CrmStage) =>
  apiRequest<{ id: string; stage: CrmStage }>(
    `/api/v1/crm/contacts/${encodeURIComponent(id)}/stage`,
    { method: 'PATCH', body: JSON.stringify({ stage }) },
    'Failed to move contact'
  );

export const deleteCrmContact = (id: string) =>
  apiRequest<{ id: string }>(`/api/v1/crm/contacts/${encodeURIComponent(id)}`, { method: 'DELETE' }, 'Failed to delete contact');

export const addCrmActivity = (id: string, type: CrmActivity['type'], body: string) =>
  apiRequest<CrmActivity>(
    `/api/v1/crm/contacts/${encodeURIComponent(id)}/activities`,
    { method: 'POST', body: JSON.stringify({ type, body }) },
    'Failed to log activity'
  );

/** Local YYYY-MM-DD for comparing date-only fields. */
export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** CSV cell: quoted, and neutralises spreadsheet formulas (=, +, -, @). */
export function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}
