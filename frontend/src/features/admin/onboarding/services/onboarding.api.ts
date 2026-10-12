const API_BASE = import.meta.env.VITE_API_URL || '';

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('auth_token') || localStorage.getItem('session_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}

export interface OnboardingState {
  is_completed: boolean;
  chamber_id: string;
  profile: {
    org_name: string;
    city: string;
    admin_contact: string;
    support_email: string;
    default_currency: string | null;
    timezone: string | null;
  };
  branding: {
    primary_color: string | null;
    text_color: string | null;
    background_color: string | null;
    logo_url: string | null;
    hero_headline: string | null;
    hero_tagline: string | null;
  };
  /** Keys are never returned (BUG-060); only whether they are stored. */
  payment_gateway?: {
    provider: 'stripe' | 'razorpay' | 'paypal' | 'none';
    status: string;
    has_keys: boolean;
  } | null;
  plans: Array<{
    id?: string;
    name: string;
    price: number;
    billing_frequency: 'annual' | 'monthly';
    pricing_basis: 'flat' | 'by_employee_count' | 'by_annual_revenue';
    features: string[];
    is_popular?: boolean;
    accent_color?: string;
    is_active?: boolean;
  }>;
}

export interface OnboardingFinishPayload {
  profile: {
    org_name: string;
    city: string;
    support_email?: string;
    default_currency?: string;
    timezone?: string;
  };
  branding: {
    primary_color: string;
    text_color?: string;
    background_color?: string;
    logo_url?: string | null;
    hero_headline?: string;
    hero_tagline?: string;
  };
  payment_gateway?: {
    provider: 'stripe' | 'razorpay' | 'paypal';
    publishable_key: string;
    secret_key: string;
  };
  plans?: Array<{
    id?: string;
    name: string;
    price: number;
    billing_frequency?: 'annual' | 'monthly';
    pricing_basis?: 'flat' | 'by_employee_count' | 'by_annual_revenue';
    features: string[];
    is_popular?: boolean;
    accent_color?: string;
  }>;
}

export async function fetchOnboardingState(): Promise<OnboardingState> {
  const res = await fetch(`${API_BASE}/api/v1/admin/onboarding/state`, {
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody?.error?.message || `Failed to fetch onboarding state (${res.status})`);
  }

  const json = await res.json();
  return json.data;
}

export class OnboardingAlreadyCompletedError extends Error {}

export async function submitFinishOnboarding(payload: OnboardingFinishPayload): Promise<any> {
  const res = await fetch(`${API_BASE}/api/v1/admin/onboarding/finish`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    const message = errorBody?.error?.message || `Failed to complete onboarding (${res.status})`;
    if (res.status === 409) throw new OnboardingAlreadyCompletedError(message);
    throw new Error(message);
  }

  const json = await res.json();
  return json.data;
}
