import { createApp } from './app';
import type { Env } from './core/env';

const app = createApp();

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    // When the Worker also serves the frontend (ASSETS binding), existing files are returned by
    // Cloudflare before the Worker runs; every other non-API path is an SPA route → the app shell ("/"; asking for /index.html is redirected by the assets service).
    const url = new URL(request.url);
    if (env.ASSETS && !url.pathname.startsWith('/api/') && url.pathname !== '/api' && url.pathname !== '/health') {
      return env.ASSETS.fetch(new Request(new URL('/', url), request));
    }
    return app.fetch(request, env, ctx);
  },
};
