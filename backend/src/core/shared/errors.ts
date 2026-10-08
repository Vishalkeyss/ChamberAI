/**
 * Standard Application Error Definitions & Error Codes
 * Strictly aligns with MASTER_IMPLEMENTATION_PLAYBOOK.md (Prompt 00.3)
 */

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number = 400,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const ErrorCodes = {
  // 400 Bad Request
  BAD_REQUEST: 'BAD_REQUEST',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  INVALID_OTP: 'INVALID_OTP',

  // 401 Unauthorized
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  OTP_EXPIRED: 'OTP_EXPIRED',
  TOO_MANY_ATTEMPTS: 'TOO_MANY_ATTEMPTS',

  // 403 Forbidden
  FORBIDDEN: 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  OUT_OF_SCOPE: 'OUT_OF_SCOPE',

  // 404 Not Found
  NOT_FOUND: 'NOT_FOUND',
  CHAMBER_NOT_FOUND: 'CHAMBER_NOT_FOUND',
  USER_NOT_FOUND: 'USER_NOT_FOUND',

  // 409 Conflict
  CONFLICT: 'CONFLICT',

  // 429 Too Many Requests
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  RATE_LIMITED: 'RATE_LIMITED',

  // 500 Internal Error
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  MIGRATION_FAILED: 'MIGRATION_FAILED',

  // 503 Service Unavailable
  PAYMENT_UNAVAILABLE: 'PAYMENT_UNAVAILABLE',
} as const;
