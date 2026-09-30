/**
 * Cryptographic Utilities for Edge Runtime (Cloudflare Workers Web Crypto)
 * Strictly zero hardcoding - pure cryptographic primitives.
 */

/**
 * Generates a cryptographically secure 6-digit numeric OTP
 * Range: 100000 - 999999
 */
export function generateSecureOtp(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  const code = (array[0] % 900000) + 100000;
  return code.toString();
}

/**
 * Computes SHA-256 hash of an OTP string for secure D1 storage
 */
export async function hashOtp(code: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(code);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generates a high-entropy 256-bit cryptographic session token (64 hex characters)
 */
export function generateSessionToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return 'sess_' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generates a prefixed unique ID (e.g. otp_..., usr_..., sess_...)
 */
export function generatePrefixedId(prefix: string): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `${prefix}_${hex}`;
}

/**
 * Encrypts a string using AES-GCM 256-bit with Web Crypto
 */
export async function encryptData(plainText: string, secretKey: string): Promise<string> {
  const enc = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(secretKey.padEnd(32, '0').slice(0, 32)),
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );
  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    keyMaterial,
    enc.encode(plainText)
  );
  const cipherArray = Array.from(new Uint8Array(cipherBuffer));
  const ivArray = Array.from(iv);
  const combined = {
    iv: ivArray.map((b) => b.toString(16).padStart(2, '0')).join(''),
    data: cipherArray.map((b) => b.toString(16).padStart(2, '0')).join(''),
  };
  return JSON.stringify(combined);
}

/**
 * Decrypts an AES-GCM encrypted payload
 */
export async function decryptData(encryptedPayload: string, secretKey: string): Promise<string> {
  const enc = new TextEncoder();
  const parsed = JSON.parse(encryptedPayload);
  const iv = new Uint8Array(parsed.iv.match(/.{1,2}/g)!.map((byte: string) => parseInt(byte, 16)));
  const data = new Uint8Array(parsed.data.match(/.{1,2}/g)!.map((byte: string) => parseInt(byte, 16)));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(secretKey.padEnd(32, '0').slice(0, 32)),
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    keyMaterial,
    data
  );
  return new TextDecoder().decode(decrypted);
}

/**
 * Generates an application tracking code matching format ^APP-\d{4}-\d{5}$
 * Example: APP-2026-89412
 */
export function generateTrackingCode(): string {
  const year = new Date().getFullYear();
  const randomSuffix = Math.floor(10000 + Math.random() * 90000);
  return `APP-${year}-${randomSuffix}`;
}
