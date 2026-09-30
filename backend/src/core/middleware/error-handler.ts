import type { ErrorHandler } from 'hono';
import { AppError, ErrorCodes } from '../shared/errors';
import { errorResponse } from '../shared/response';
import type { Env } from '../env';
import type { AppVariables } from '../context';

export const globalErrorHandler: ErrorHandler<{ Bindings: Env; Variables: AppVariables }> = (
  err,
  c
) => {
  const requestId = c.get('requestId') || 'unknown';

  if (err instanceof AppError) {
    return c.json(
      errorResponse(err.code, err.message, err.details, { requestId }),
      err.status as any
    );
  }

  // Handle Zod schema validation errors
  if (err.name === 'ZodError' || (err as any).issues) {
    const issues = (err as any).issues || [];
    const formatted = issues.map((i: any) => ({
      field: i.path?.join('.') || 'root',
      message: i.message,
    }));
    return c.json(
      errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        formatted[0]?.message || 'Input validation failed',
        formatted,
        { requestId }
      ),
      400
    );
  }

  // Handle generic / unhandled exceptions
  console.error(`[UNHANDLED_EXCEPTION] Request ${requestId}:`, err.message || err);

  return c.json(
    errorResponse(
      ErrorCodes.INTERNAL_ERROR,
      err.message || 'An unexpected internal error occurred',
      undefined,
      { requestId }
    ),
    500
  );
};
