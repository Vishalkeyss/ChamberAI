/**
 * Prompt 05.4 §8 — vCard 3.0 generator (RFC 6350 value escaping, CRLF line endings).
 */
export interface VCardInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  title?: string | null;
  company?: string | null;
  website?: string | null;
}

/** Escapes `\`, `,`, `;` and newlines so user data cannot inject extra vCard properties. */
export function escapeVCardValue(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

/** Splits a display name into first / last for the structured N property. */
export function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { firstName: parts[0] || '', lastName: '' };
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1] };
}

/** Adds a scheme to bare domains ("example.com" → "https://example.com"); drops non-http(s) values. */
export function normalizeWebsite(url: string | null | undefined): string | null {
  const v = (url || '').trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return null;
  return `https://${v}`;
}

export function generateVCard(user: VCardInput): string {
  const e = escapeVCardValue;
  const fullName = `${user.firstName} ${user.lastName}`.trim();
  return [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${e(user.lastName)};${e(user.firstName)};;;`,
    `FN:${e(fullName)}`,
    user.company ? `ORG:${e(user.company)}` : '',
    user.title ? `TITLE:${e(user.title)}` : '',
    user.phone ? `TEL;TYPE=CELL,VOICE:${e(user.phone)}` : '',
    `EMAIL;TYPE=WORK,INTERNET:${e(user.email)}`,
    user.website ? `URL:${e(user.website)}` : '',
    'END:VCARD',
  ]
    .filter(Boolean)
    .join('\r\n');
}

/** Safe download name: "Sarah-Jenkins.vcf". */
export function vcardFileName(fullName: string): string {
  const base = fullName
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60);
  return `${base || 'contact'}.vcf`;
}
