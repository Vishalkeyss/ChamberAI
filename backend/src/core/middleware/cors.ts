import { cors } from 'hono/cors';

export const corsMiddleware = cors({
  origin: (origin) => {
    // In local dev, allow localhost and standard vite ports
    if (!origin || origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return origin || '*';
    }
    // Allow 121meet.ai and its subdomains
    if (origin.endsWith('.121meet.ai') || origin === 'https://121meet.ai') {
      return origin;
    }
    // Custom domains are permitted dynamically
    return origin;
  },
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Chamber-ID', 'X-Request-ID'],
  exposeHeaders: ['X-Request-ID', 'Content-Range'],
  maxAge: 86400,
  credentials: true,
});
