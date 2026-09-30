/**
 * Cloudflare Worker Environment Interface
 * Strictly aligns with MASTER_IMPLEMENTATION_PLAYBOOK.md (Prompt 00.3)
 *
 * How to set secrets (never commit real values):
 *   Production/Staging : npx wrangler secret put <KEY_NAME>
 *   Local dev          : add to backend/.dev.vars  (git-ignored)
 */

export interface Env {
  // ── Cloudflare Bindings ──────────────────────────────────────────────────
  /** D1 relational database — primary multi-tenant data store */
  DB: D1Database;

  /** KV namespace — session tokens, OTP rate-limits, public-settings cache */
  KV: KVNamespace;

  /** R2 bucket — file/media storage (avatars, documents, chamber assets) */
  STORAGE?: R2Bucket;

  // ── Non-Secret Vars ([vars] in wrangler.toml) ────────────────────────────
  /** "development" | "staging" | "production" */
  ENVIRONMENT: string;

  /** Root platform domain used by tenant-resolver (e.g. "121meet.com") */
  PLATFORM_DOMAIN: string;

  // ── Secrets (set via `wrangler secret put` or .dev.vars) ────────────────

  // Email Delivery
  /** [REQUIRED for production] SendGrid API key for OTP & transactional email */
  SENDGRID_API_KEY?: string;

  // SMS Delivery
  /** [REQUIRED for phone OTP] Twilio Account SID */
  TWILIO_ACCOUNT_SID?: string;
  /** [REQUIRED for phone OTP] Twilio Auth Token */
  TWILIO_AUTH_TOKEN?: string;
  /** [REQUIRED for phone OTP] Twilio sender number in E.164 format (e.g. +14155552671) */
  TWILIO_FROM_NUMBER?: string;

  // Encryption
  /**
   * [REQUIRED] 256-bit hex master key for AES-GCM encryption of:
   * - payment_gateway_config credentials
   * - chamber_integrations API keys
   * - users.personal_api_key_encrypted
   * Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   */
  CHAMBER_ENCRYPTION_KEY?: string;

  // Session Security
  /** [REQUIRED if JWT mode enabled] HMAC secret for signing session tokens (min 64 chars) */
  JWT_SECRET?: string;

  // Payment Gateways (platform-level fallback; chamber keys stored encrypted in D1)
  /** [OPTIONAL] Platform default Stripe secret key */
  STRIPE_SECRET_KEY?: string;
  /** [OPTIONAL] Stripe webhook signing secret for payload verification */
  STRIPE_WEBHOOK_SECRET?: string;
  /** [OPTIONAL] Platform default Razorpay key ID */
  RAZORPAY_KEY_ID?: string;
  /** [OPTIONAL] Platform default Razorpay key secret */
  RAZORPAY_KEY_SECRET?: string;

  // AI / LLM Providers (platform-level fallback; member/chamber keys stored encrypted in D1)
  /** [OPTIONAL] OpenAI API key for GPT-4 AI features */
  OPENAI_API_KEY?: string;
  /** [OPTIONAL] Anthropic API key for Claude AI features */
  ANTHROPIC_API_KEY?: string;
  /** [OPTIONAL] Google AI API key for Gemini AI features */
  GOOGLE_AI_API_KEY?: string;
  /** [OPTIONAL] Cloudflare Account ID for Workers AI binding */
  WORKERS_AI_ACCOUNT_ID?: string;
}
