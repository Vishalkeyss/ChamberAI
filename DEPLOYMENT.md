# Deployment — 121Meet Chamber

Configuration lives in one place per app:

| App | Config module | Values from |
|---|---|---|
| Backend (Worker) | `backend/src/core/config/` (`runtime-config.ts`, `domains.ts`) | `wrangler.toml` `[vars]` + Worker secrets (`.dev.vars` locally) |
| Frontend (Vite) | `frontend/src/core/config/app-config.ts` | `VITE_*` build variables (`frontend/.env.example`) |

No domain, URL or secret has a default in code. Staging / production Workers return **503** for
every API call (except `/api/v1/health`) until the required values below are set; the reason is
written to the Worker log as `[CONFIG_INVALID]`.

## 1. Decisions still open

- **OD-006** decided in the architecture meeting: chamber sites = `<slug>.121meet.app` (`ARCHITECTURE_DOMAIN_WORKFLOW.md`); staging domain still open.
- **OD-110** routing — recommended: one Worker on `*.<domain>/api/*`, frontend on the same hosts
  (same origin, `VITE_API_URL` empty, tenant from the Host header).
- **OD-111** frontend hosting (Cloudflare Pages or Workers static assets).
- **OD-001** payment gateway — until then card payments return 503.

## 2. Staging on your own Cloudflare account (workers.dev, no domain)

One Worker (`chamber-staging`) serves the built frontend and the API on
`https://chamber-staging.<account>.workers.dev`. workers.dev has no wildcard subdomains, so a
chamber is opened at `/c/<chamber-slug>` and the frontend sends `X-Chamber-Slug`
(`VITE_TENANT_ROUTING=path` in `frontend/.env.staging`, `ALLOW_TENANT_HEADER=true` in wrangler.toml —
staging only).

**A. SendGrid (OTP email, Single Sender — no domain needed)**
1. Create a free SendGrid account → Settings → Sender Authentication → *Verify a Single Sender*
   with your own email; confirm the link SendGrid emails you.
2. Email API → Dynamic Templates → create a template; in the HTML use
   `{{code}}`, `{{chamber_name}}`, `{{portal}}`, `{{expires_in}}`. Copy the template id (`d-…`).
3. Settings → API Keys → create a key with *Mail Send* permission.

**B. Cloudflare (run from `backend/`)**
```bash
npx wrangler login
npx wrangler d1 create chamber-d1-staging
npx wrangler kv namespace create KV --env staging
npx wrangler r2 bucket create chamber-assets-staging
```
Put the D1 `database_id` and KV `id` into `[env.staging]` of `backend/wrangler.toml`.

**C. Secrets**
```bash
npx wrangler secret put CHAMBER_ENCRYPTION_KEY --env staging
npx wrangler secret put SENDGRID_API_KEY --env staging
npx wrangler secret put EMAIL_FROM_ADDRESS --env staging
npx wrangler secret put SENDGRID_OTP_TEMPLATE_ID --env staging
```
`CHAMBER_ENCRYPTION_KEY`: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
`EMAIL_FROM_ADDRESS` = the verified single sender. (`wrangler secret put` on a Worker that
does not exist yet creates it — fine.)

**D. Database, deploy, first super admin**
```bash
npm run d1:migrate:staging
npm run deploy:staging
```
The deploy prints the URL (`chamber-staging.<account>.workers.dev`). Put that host into
`PLATFORM_DOMAIN` under `[env.staging.vars]` and deploy once more. Then:
```bash
npm run bootstrap:super-admin -- --env staging --email <your email> --name "<your name>"
```
Log in to the Super Admin portal with that email (OTP arrives by email), create a chamber, open it
at `/c/<slug>`.

**E. Check**: `GET /api/v1/health` → 200; `npx wrangler tail --env staging` shows no
`[CONFIG_INVALID]`. A missing secret makes every API call return 503 until it is set.

## 3. Production (later)

### Cloudflare resources

```bash
npx wrangler d1 create chamber-d1-staging
npx wrangler kv namespace create KV --env staging
npx wrangler r2 bucket create chamber-assets-staging
```

Put the returned ids into `backend/wrangler.toml` (`REPLACE_WITH_*`), set `PLATFORM_DOMAIN`,
and uncomment the `routes` block. Same for `production`.

DNS: wildcard `*.<domain>` + apex proxied through Cloudflare (SSL: Full strict).

### Secrets (per environment)

| Name | Required | Notes |
|---|---|---|
| `CHAMBER_ENCRYPTION_KEY` | yes | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` — never change after data is encrypted |
| `SENDGRID_API_KEY` | yes | email OTP |
| `EMAIL_FROM_ADDRESS` | yes | verified sender in SendGrid |
| `SENDGRID_OTP_TEMPLATE_ID` | yes | dynamic template with `code`, `portal`, `chamber_name`, `expires_in` |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER` | for phone login | without them phone OTP returns 503 |
| `ALLOWED_ORIGINS` | optional | extra exact CORS origins |
| `STRIPE_*`, `RAZORPAY_*`, AI keys | optional | not used until their features are built |

```bash
npx wrangler secret put CHAMBER_ENCRYPTION_KEY --env staging
```

### Database

```bash
npm --prefix backend run d1:migrate:staging
npm --prefix backend run d1:migrate:production
```

### Build & deploy

```bash
npm --prefix backend test
npm --prefix backend run typecheck
npm --prefix backend run deploy:staging
```

Frontend: create `frontend/.env.staging` from `.env.example`, then `npx vite build --mode staging`
and publish `frontend/dist` with SPA fallback (all non-file paths → `index.html`).

## 4. Smoke test

1. `GET /api/v1/health` → 200, and no `[CONFIG_INVALID]` in `wrangler tail`.
2. `https://<chamber>.<domain>` loads; OTP email arrives (not printed in logs).
3. Admin login → onboarding wizard for a new chamber.

## 5. Known blockers before go-live

See `PENDING_BUGS.md` → "Production readiness review": first super-admin bootstrap (BUG-067),
demo data on unbuilt modules (BUG-069), plaintext gateway keys in old rows (BUG-063),
tenant header fallback (BUG-010 / OD-002), token in localStorage (BUG-015).
