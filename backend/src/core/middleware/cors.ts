import { cors } from 'hono/cors';
import type { Env } from '../env';
import { getRuntimeConfig, isAllowedFrontendOrigin } from '../config';

/**
 * CORS allowlist from core/config (BUG-064): platform domain + chamber subdomains, ALLOWED_ORIGINS,
 * localhost only in local development. Unknown origins get no CORS headers.
 */
export const corsMiddleware = cors({
  origin: (origin, c) => {
    if (!origin) return null;
    return isAllowedFrontendOrigin(origin, getRuntimeConfig(c.env as Env)) ? origin : null;
  },
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  // X-Chamber-Slug is sent by the frontend API clients (BUG-065).
  allowHeaders: ['Content-Type', 'Authorization', 'X-Chamber-ID', 'X-Chamber-Slug', 'X-Request-ID'],
  exposeHeaders: ['X-Request-ID', 'Content-Range'],
  maxAge: 86400,
  credentials: true,
});
