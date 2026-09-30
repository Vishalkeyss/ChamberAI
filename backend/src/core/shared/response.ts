/**
 * Standard API Response Envelope Helpers
 * Strictly aligns with MASTER_IMPLEMENTATION_PLAYBOOK.md (Prompt 00.3)
 */

export interface ApiResponseMeta {
  requestId: string;
  [key: string]: any;
}

export interface ApiSuccessResponse<T = any> {
  success: true;
  data: T;
  meta?: ApiResponseMeta;
}

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: any;
}

export interface ApiErrorResponse {
  success: false;
  error: ApiErrorPayload;
  meta?: ApiResponseMeta;
}

export function successResponse<T>(data: T, meta?: ApiResponseMeta): ApiSuccessResponse<T> {
  return {
    success: true,
    data,
    ...(meta ? { meta } : {}),
  };
}

export function errorResponse(
  code: string,
  message: string,
  details?: any,
  meta?: ApiResponseMeta
): ApiErrorResponse {
  return {
    success: false,
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    },
    ...(meta ? { meta } : {}),
  };
}
