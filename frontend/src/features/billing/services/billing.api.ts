import { apiUrl } from '@/core/api/base';
import type {
  InvoicesResponse,
  SavedPaymentMethod,
  BenefitUsageItem,
  PayInvoicePayload,
  AddPaymentMethodPayload,
} from '../types';

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('auth_token');
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/**
 * GET /api/v1/member/invoices
 * Retrieves member invoice ledger and total outstanding balance.
 */
export async function fetchMemberInvoices(params: {
  status?: string;
  page?: number;
  limit?: number;
} = {}): Promise<InvoicesResponse> {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.page) query.set('page', params.page.toString());
  if (params.limit) query.set('limit', params.limit.toString());

  const queryString = query.toString() ? `?${query.toString()}` : '';
  const res = await fetch(apiUrl(`/api/v1/member/invoices${queryString}`), {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    if (res.status === 401) window.dispatchEvent(new Event('auth:session_expired'));
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to fetch invoices');
  }

  const json = await res.json();
  return json.data;
}

/**
 * POST /api/v1/member/invoices/:id/pay
 * Pays an invoice online.
 */
export async function payMemberInvoice(
  invoiceId: string,
  payload: PayInvoicePayload
): Promise<{ invoice_id: string; status: string; transaction_id: string; paid_at: string }> {
  const res = await fetch(apiUrl(`/api/v1/member/invoices/${encodeURIComponent(invoiceId)}/pay`), {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    if (res.status === 401) window.dispatchEvent(new Event('auth:session_expired'));
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Payment processing failed');
  }

  const json = await res.json();
  return json.data;
}

/**
 * GET /api/v1/member/payment-methods
 * Retrieves saved cards and payment instruments.
 */
export async function fetchPaymentMethods(): Promise<SavedPaymentMethod[]> {
  const res = await fetch(apiUrl('/api/v1/member/payment-methods'), {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    if (res.status === 401) window.dispatchEvent(new Event('auth:session_expired'));
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to load payment methods');
  }

  const json = await res.json();
  return json.data;
}

/**
 * POST /api/v1/member/payment-methods
 * Adds a new payment method.
 */
export async function addPaymentMethod(
  payload: AddPaymentMethodPayload
): Promise<SavedPaymentMethod> {
  const res = await fetch(apiUrl('/api/v1/member/payment-methods'), {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    if (res.status === 401) window.dispatchEvent(new Event('auth:session_expired'));
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to add card');
  }

  const json = await res.json();
  return json.data;
}

/**
 * DELETE /api/v1/member/payment-methods/:id
 * Removes a saved payment method.
 */
export async function deletePaymentMethod(methodId: string): Promise<void> {
  const res = await fetch(apiUrl(`/api/v1/member/payment-methods/${encodeURIComponent(methodId)}`), {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    if (res.status === 401) window.dispatchEvent(new Event('auth:session_expired'));
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to remove payment method');
  }
}

/**
 * PATCH /api/v1/member/payment-methods/:id/default
 * Sets a payment method as default.
 */
export async function setDefaultPaymentMethod(methodId: string): Promise<void> {
  const res = await fetch(apiUrl(`/api/v1/member/payment-methods/${encodeURIComponent(methodId)}/default`), {
    method: 'PATCH',
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    if (res.status === 401) window.dispatchEvent(new Event('auth:session_expired'));
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to update default card');
  }
}

/**
 * GET /api/v1/member/membership/benefits
 * Retrieves quota and consumption tracking for plan benefits.
 */
export async function fetchMemberBenefits(): Promise<BenefitUsageItem[]> {
  const res = await fetch(apiUrl('/api/v1/member/membership/benefits'), {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    if (res.status === 401) window.dispatchEvent(new Event('auth:session_expired'));
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to load membership benefits');
  }

  const json = await res.json();
  return json.data;
}

/**
 * POST /api/v1/member/membership/change-plan
 * Upgrades, downgrades, or switches the member's current membership plan.
 */
export async function changeMemberPlan(planId: string): Promise<{
  membershipId: string;
  previousPlanId: string | null;
  newPlanId: string;
  newPlanName: string;
  newPlanPrice: number;
}> {
  const res = await fetch(apiUrl('/api/v1/member/membership/change-plan'), {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ planId }),
  });

  if (!res.ok) {
    if (res.status === 401) window.dispatchEvent(new Event('auth:session_expired'));
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to switch membership plan');
  }

  const json = await res.json();
  return json.data;
}

