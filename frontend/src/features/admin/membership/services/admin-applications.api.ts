export interface AdminApplicationItem {
  id: string;
  trackingCode: string;
  applicantName: string;
  businessName: string;
  businessEmail: string;
  businessPhone?: string | null;
  planId: string;
  planName: string;
  planPrice: number;
  planPricingBasis: string;
  chapterId?: string | null;
  chapterName?: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'changes_requested';
  adminNotes?: string | null;
  submittedAt: string;
  updatedAt?: string | null;
  businessDetails?: any;
}

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
 * Fetch all applications for chamber admin review
 */
export async function fetchAdminApplications(
  chamberSlugOrId?: string,
  filters?: { status?: string; search?: string; chapterId?: string }
): Promise<AdminApplicationItem[]> {
  const params = new URLSearchParams();
  if (filters?.status && filters.status !== 'All') {
    params.set('status', filters.status);
  }
  if (filters?.search) {
    params.set('search', filters.search);
  }
  if (filters?.chapterId) {
    params.set('chapter_id', filters.chapterId);
  }

  const query = params.toString() ? `?${params.toString()}` : '';
  const res = await fetch(`${API_BASE}/api/v1/admin/applications${query}`, {
    method: 'GET',
    headers: getHeaders(chamberSlugOrId),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to fetch applications (${res.status})`);
  }

  const json = await res.json();
  return json.data || [];
}

export interface ApproveApplicationResponse {
  id: string;
  status: string;
  message: string;
  charge?: {
    charged: boolean;
    amount: number;
    cardLastFour: string | null;
    transactionId: string | null;
    invoiceId: string | null;
  };
}

/**
 * Fetch application approval mode setting (manual review vs auto-approve)
 */
export async function fetchApprovalMode(
  chamberSlugOrId?: string
): Promise<{ autoApprove: boolean }> {
  const res = await fetch(`${API_BASE}/api/v1/admin/applications/approval-mode`, {
    method: 'GET',
    headers: getHeaders(chamberSlugOrId),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to fetch approval mode (${res.status})`);
  }

  const json = await res.json();
  return json.data;
}

/**
 * Update application approval mode setting (manual review vs auto-approve)
 */
export async function updateApprovalMode(
  autoApprove: boolean,
  chamberSlugOrId?: string
): Promise<{ autoApprove: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/api/v1/admin/applications/approval-mode`, {
    method: 'PATCH',
    headers: getHeaders(chamberSlugOrId),
    body: JSON.stringify({ autoApprove }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to update approval mode (${res.status})`);
  }

  const json = await res.json();
  return json.data;
}

/**
 * Approve an application
 */
export async function approveApplication(
  id: string,
  chamberSlugOrId?: string
): Promise<ApproveApplicationResponse> {
  const res = await fetch(`${API_BASE}/api/v1/admin/applications/${id}/approve`, {
    method: 'PATCH',
    headers: getHeaders(chamberSlugOrId),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to approve application (${res.status})`);
  }

  const json = await res.json();
  return json.data;
}

/**
 * Request changes from the applicant
 */
export async function requestChangesApplication(
  id: string,
  notes: string,
  chamberSlugOrId?: string
): Promise<{ id: string; status: string; message: string }> {
  const res = await fetch(`${API_BASE}/api/v1/admin/applications/${id}/request-changes`, {
    method: 'PATCH',
    headers: getHeaders(chamberSlugOrId),
    body: JSON.stringify({ notes }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to request changes (${res.status})`);
  }

  const json = await res.json();
  return json.data;
}

/**
 * Reject an application
 */
export async function rejectApplication(
  id: string,
  reason?: string,
  chamberSlugOrId?: string
): Promise<{ id: string; status: string; message: string }> {
  const res = await fetch(`${API_BASE}/api/v1/admin/applications/${id}/reject`, {
    method: 'PATCH',
    headers: getHeaders(chamberSlugOrId),
    body: JSON.stringify({ reason }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to reject application (${res.status})`);
  }

  const json = await res.json();
  return json.data;
}
