/**
 * Single source for the API origin. Empty VITE_API_URL keeps requests relative
 * (same origin / Vite proxy); set it when the API is served from another origin.
 */
export const API_BASE: string = import.meta.env.VITE_API_URL || '';

export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}
