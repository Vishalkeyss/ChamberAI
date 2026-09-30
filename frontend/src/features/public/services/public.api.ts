import type { RegisteredChamber } from '../data/chambers';

export interface ChambersResponse {
  chambers: RegisteredChamber[];
  total: number;
}

export async function fetchPublicChambers(): Promise<RegisteredChamber[]> {
  try {
    const res = await fetch('/api/v1/public/chambers', {
      headers: {
        'Accept': 'application/json',
      },
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch chambers: ${res.statusText}`);
    }
    const data = await res.json();
    return data?.data?.chambers || [];
  } catch (err) {
    console.error('Error fetching public chambers from D1:', err);
    return [];
  }
}

export async function fetchChamberBySlug(slug: string): Promise<RegisteredChamber | null> {
  try {
    const res = await fetch(`/api/v1/public/chambers/${encodeURIComponent(slug)}`, {
      headers: {
        'Accept': 'application/json',
      },
    });
    if (!res.ok) {
      return null;
    }
    const data = await res.json();
    return data?.data || null;
  } catch (err) {
    console.error(`Error fetching chamber '${slug}' from D1:`, err);
    return null;
  }
}
