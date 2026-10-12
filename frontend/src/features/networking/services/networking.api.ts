/**
 * Networking API — Prompt 05.2 (Direct Messaging) & Prompt 05.3 (B2B Referrals).
 * Tenant comes from the host / authenticated session; nothing chamber-specific is sent from here.
 */
import { apiUrl } from '@/core/api/base';

function authHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function request<T>(path: string, init: RequestInit = {}, fallback = 'Request failed'): Promise<{ data: T; meta?: any }> {
  const res = await fetch(apiUrl(path), { ...init, headers: authHeaders() });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    throw new Error(json.error?.message || json.message || `${fallback} (${res.status})`);
  }
  return { data: json.data as T, meta: json.meta };
}

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

export interface NetworkMember {
  id: string;
  name: string;
  avatarUrl: string | null;
  businessId: string | null;
  companyName: string | null;
  industry: string | null;
}

export function initials(name: string | null | undefined): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  return (parts.slice(0, 2).map((p) => p[0]).join('') || '?').toUpperCase();
}

// ---------------------------------------------------------------------------
// Prompt 05.2 — Messages
// ---------------------------------------------------------------------------

export interface Conversation {
  partner: NetworkMember;
  lastMessage: { text: string; createdAt: string; isSender: boolean };
  unreadCount: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  message: string;
  isRead: number;
  readAt: string | null;
  createdAt: string;
}

/** Fired after messages are sent/read so badges refresh immediately. */
export const MESSAGES_CHANGED_EVENT = 'networking:messages-changed';

export function notifyMessagesChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(MESSAGES_CHANGED_EVENT));
}

export async function fetchConversations(): Promise<Conversation[]> {
  return (await request<Conversation[]>('/api/v1/messages/conversations', {}, 'Failed to load conversations')).data;
}

export async function fetchThread(otherUserId: string): Promise<{ messages: ChatMessage[]; partner: NetworkMember | null }> {
  const { data, meta } = await request<ChatMessage[]>(
    `/api/v1/messages/threads/${encodeURIComponent(otherUserId)}`,
    {},
    'Failed to load conversation'
  );
  return { messages: data, partner: meta?.partner || null };
}

export async function sendMessage(recipientId: string, message: string): Promise<{ id: string; createdAt: string }> {
  return (
    await request<{ id: string; createdAt: string }>(
      '/api/v1/messages',
      { method: 'POST', body: JSON.stringify({ recipientId, message }) },
      'Failed to send message'
    )
  ).data;
}

export async function fetchUnreadCount(): Promise<number> {
  return (await request<{ unreadCount: number }>('/api/v1/messages/unread-count', {}, 'Failed to load unread count')).data
    .unreadCount;
}

export async function searchMessageContacts(q: string): Promise<NetworkMember[]> {
  return (await request<NetworkMember[]>(`/api/v1/messages/contacts?q=${encodeURIComponent(q)}`, {}, 'Search failed')).data;
}

// ---------------------------------------------------------------------------
// Prompt 05.3 — Referrals
// ---------------------------------------------------------------------------

export type ReferralStatus = 'pending' | 'contacted' | 'converted' | 'declined';

/** OD-062: DB values from the spec, labels from the spec's status pills. */
export const REFERRAL_STATUS_LABELS: Record<ReferralStatus, string> = {
  pending: 'Pending Review',
  contacted: 'Contacted',
  converted: 'Won / Converted',
  declined: 'Declined',
};

export interface ReferralContact {
  id?: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  profession: string | null;
  referredBusinessId?: string | null;
}

export interface ReferralBusinessRef {
  id: string;
  name: string;
  logoUrl: string | null;
}

export interface Referral {
  id: string;
  fromBusiness: ReferralBusinessRef;
  toBusiness: ReferralBusinessRef;
  createdBy: { id: string; name: string; avatarUrl: string | null } | null;
  message: string | null;
  status: ReferralStatus;
  convertedValue: number | null;
  contacts: ReferralContact[];
  canUpdateStatus: boolean;
  allowedNextStatuses: ReferralStatus[];
  createdAt: string;
  updatedAt: string | null;
}

export interface ReferralsResponse {
  received: Referral[];
  given: Referral[];
  stats: { givenCount: number; receivedCount: number; convertedCount: number; convertedValue: number };
  myBusinessIds: string[];
  rewardPoints: number;
}

export interface ReferralBusinessOption {
  id: string;
  name: string;
  logoUrl: string | null;
  industry: string | null;
  contactName: string | null;
}

export interface CreateReferralInput {
  toBusinessId: string;
  message: string;
  contacts: { fullName: string; email?: string; phone?: string; profession: string; referredBusinessId?: string }[];
}

export async function fetchReferrals(): Promise<ReferralsResponse> {
  return (await request<ReferralsResponse>('/api/v1/referrals', {}, 'Failed to load referrals')).data;
}

export async function searchReferralBusinesses(q: string): Promise<ReferralBusinessOption[]> {
  return (await request<ReferralBusinessOption[]>(`/api/v1/referrals/businesses?q=${encodeURIComponent(q)}`, {}, 'Search failed')).data;
}

export async function searchReferralMembers(q: string): Promise<NetworkMember[]> {
  return (await request<NetworkMember[]>(`/api/v1/referrals/members?q=${encodeURIComponent(q)}`, {}, 'Search failed')).data;
}

export async function createReferral(input: CreateReferralInput): Promise<{ id: string; pointsAwarded: number }> {
  return (
    await request<{ id: string; pointsAwarded: number }>(
      '/api/v1/referrals',
      { method: 'POST', body: JSON.stringify(input) },
      'Failed to submit referral'
    )
  ).data;
}

export async function updateReferralStatus(
  id: string,
  status: Exclude<ReferralStatus, 'pending'>,
  convertedValue?: number
): Promise<{ id: string; status: ReferralStatus; convertedValue: number | null }> {
  return (
    await request<{ id: string; status: ReferralStatus; convertedValue: number | null }>(
      `/api/v1/referrals/${encodeURIComponent(id)}/status`,
      { method: 'PATCH', body: JSON.stringify(convertedValue === undefined ? { status } : { status, convertedValue }) },
      'Failed to update referral'
    )
  ).data;
}

// ---------------------------------------------------------------------------
// Prompt 05.4 — Digital business card
// ---------------------------------------------------------------------------

export interface CardProfile {
  name: string;
  title: string | null;
  company: string | null;
  tagline: string | null;
  industry: string | null;
  email: string;
  phone: string | null;
  website: string | null;
  address: string | null;
  logoUrl: string | null;
  avatarUrl: string | null;
  isVerified: boolean;
  socialLinks: { network: string; url: string }[];
}

export interface CardData {
  cardToken: string;
  themeColor: string | null;
  chamber: { name: string; logoUrl: string | null };
  profile: CardProfile;
}

export interface MyCard extends CardData {
  customThemeColor: string | null;
  viewsCount: number;
  publicCardAvailable: boolean;
}

export interface PublicCard extends CardData {
  isOwner: boolean;
}

/** OD-074: the share link is built from the chamber origin the member is browsing (no hardcoded domain). */
export function cardShareUrl(token: string): string {
  return `${window.location.origin}/card/${encodeURIComponent(token)}`;
}

export async function fetchMyCard(): Promise<MyCard> {
  return (await request<MyCard>('/api/v1/member/business-card', {}, 'Failed to load your card')).data;
}

export async function updateCardTheme(themeColor: string): Promise<MyCard> {
  return (
    await request<MyCard>('/api/v1/member/business-card', { method: 'PUT', body: JSON.stringify({ themeColor }) }, 'Failed to update card')
  ).data;
}

/**
 * Public card calls are anonymous. Like the other public APIs, the chamber slug resolved by the app is
 * sent as a header because the local dev proxy does not forward the subdomain (OD-002 tracks this).
 */
function publicHeaders(chamberSlug?: string): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  return {
    Accept: 'application/json',
    ...(chamberSlug ? { 'X-Chamber-Slug': chamberSlug } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function fetchPublicCard(token: string, chamberSlug?: string): Promise<PublicCard> {
  const res = await fetch(apiUrl(`/api/v1/public/card/${encodeURIComponent(token)}`), { headers: publicHeaders(chamberSlug) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) throw new Error(json.error?.message || `Card not found (${res.status})`);
  return json.data as PublicCard;
}

/** §9.3 — downloads the .vcf through the API (keeps the tenant header) and saves it. */
export async function downloadCardVCard(token: string, chamberSlug?: string): Promise<void> {
  const res = await fetch(apiUrl(`/api/v1/public/card/${encodeURIComponent(token)}/vcard`), { headers: publicHeaders(chamberSlug) });
  if (!res.ok) throw new Error(`Could not download contact (${res.status})`);
  const disposition = res.headers.get('content-disposition') || '';
  const fileName = /filename="([^"]+)"/.exec(disposition)?.[1] || 'contact.vcf';
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
