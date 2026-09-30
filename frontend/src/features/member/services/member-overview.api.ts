export interface OnboardingSteps {
  profile: boolean;
  card: boolean;
  network: boolean;
  team: boolean;
}

export interface MemberOverviewData {
  membership: {
    tierName: string;
    status: string;
    memberIdDisplay: string;
    renewalDate: string | null;
  };
  kpis: {
    referralsGiven: number;
    referralsReceived: number;
    eventsAttended: number;
    pointsBalance: number;
  };
  onboarding: {
    isComplete: boolean;
    completionPct: number;
    steps: OnboardingSteps;
  };
}

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('auth_token');
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/**
 * GET /api/v1/member/overview
 * Fetches personal dashboard KPI metrics and onboarding state.
 */
export async function fetchMemberOverview(): Promise<MemberOverviewData> {
  const res = await fetch('/api/v1/member/overview', {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    if (res.status === 401) {
      window.dispatchEvent(new Event('auth:session_expired'));
    }
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Failed to fetch member overview');
  }

  const json = await res.json();
  return json.data;
}

/**
 * POST /api/v1/member/onboarding/complete-step
 * Marks a single onboarding step as complete.
 */
export async function completeOnboardingStep(
  stepKey: keyof OnboardingSteps
): Promise<{ completionPct: number; isComplete: boolean }> {
  const res = await fetch('/api/v1/member/onboarding/complete-step', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ stepKey }),
  });

  if (!res.ok) {
    if (res.status === 401) {
      window.dispatchEvent(new Event('auth:session_expired'));
    }
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Failed to complete onboarding step');
  }

  const json = await res.json();
  return json.data;
}
