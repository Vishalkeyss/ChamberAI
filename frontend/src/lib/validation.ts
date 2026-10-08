/**
 * Shared validation utilities for email and phone numbers.
 * Enforces USA (+1) country code and standard NANP formatting.
 */

/**
 * Validates whether a given string is a valid USA phone number.
 * - Requires USA country code (+1) or standard 10-digit USA number
 * - Allows standard formatting characters: spaces, hyphens, parentheses, dots
 * - Rejects non-USA country codes (e.g. +91, +44)
 * - Digits: 10 digits (national) or 11 digits starting with 1 (+1 country code)
 * - Area code cannot start with 0 or 1 (NANP standard: [2-9]XX)
 */
export function isValidPhoneNumber(phone: string): boolean {
  if (!phone || typeof phone !== 'string') return false;
  const trimmed = phone.trim();
  if (!trimmed) return false;

  // Ensure only valid characters: digits, leading +, spaces, -, (, ), .
  if (!/^\+?[0-9\s\-().]{10,25}$/.test(trimmed)) {
    return false;
  }

  // If a leading + is present, it MUST be followed by 1 (USA country code)
  if (trimmed.startsWith('+')) {
    if (!trimmed.startsWith('+1') && !trimmed.startsWith('+ 1')) {
      return false; // Non-USA country code
    }
  }

  // Extract raw digits
  const digits = trimmed.replace(/\D/g, '');

  if (digits.length === 10) {
    // 10 digits: area code must start with 2-9
    return /^[2-9]\d{9}$/.test(digits);
  }

  if (digits.length === 11) {
    // 11 digits: must start with 1 (USA), and area code must start with 2-9
    return /^1[2-9]\d{9}$/.test(digits);
  }

  return false;
}

/**
 * Normalizes a phone number to standard E.164 USA format (+1XXXXXXXXXX):
 * Prepends +1 if 10 digits are provided, or formats 11 digits as +1XXXXXXXXXX.
 */
export function normalizePhoneNumber(phone: string): string {
  if (!phone) return '';
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, '');

  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  return digits ? `+${digits}` : '';
}

/**
 * Formats a phone string as a user-friendly USA formatted string:
 * e.g., "+1 (555) 019-2834"
 */
export function formatUSPhoneNumber(phone: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  let nationalDigits = digits;

  if (digits.length === 11 && digits.startsWith('1')) {
    nationalDigits = digits.slice(1);
  }

  if (nationalDigits.length === 0) return '';
  if (nationalDigits.length <= 3) {
    return `+1 (${nationalDigits}`;
  }
  if (nationalDigits.length <= 6) {
    return `+1 (${nationalDigits.slice(0, 3)}) ${nationalDigits.slice(3)}`;
  }
  return `+1 (${nationalDigits.slice(0, 3)}) ${nationalDigits.slice(3, 6)}-${nationalDigits.slice(6, 10)}`;
}

/**
 * Validates standard email address format.
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

