import { z } from 'zod';
import type { Env } from '../env';

/**
 * Central runtime configuration for the Worker.
 *
 * All environment-dependent values (domain, origins, sender address, provider ids) are read
 * here and nowhere else. There are no code defaults for domains / URLs / secrets
 * (AGENTS.md §9): staging and production fail closed when a required value is missing.
 */

export type AppEnvironment = 'development' | 'test' | 'staging' | 'production';

const environmentSchema = z.enum(['development', 'test', 'staging', 'production']);

const hostnameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/, 'must be a bare hostname, e.g. example.com');

/** Values that must be present before a staging / production Worker serves traffic. */
const deployedEnvSchema = z.object({
  PLATFORM_DOMAIN: hostnameSchema,
  CHAMBER_ENCRYPTION_KEY: z.string().min(32, 'must be at least 32 characters'),
  EMAIL_FROM_ADDRESS: z.string().trim().email(),
  SENDGRID_API_KEY: z.string().min(10),
  SENDGRID_OTP_TEMPLATE_ID: z.string().trim().min(3),
});

export interface RuntimeConfig {
  environment: AppEnvironment;
  /** Local `wrangler dev` or unit tests: console OTP fallback and localhost origins allowed. */
  isLocal: boolean;
  /** Root domain whose subdomains are chamber sites (e.g. `rockwell.<platformDomain>`). */
  platformDomain: string | null;
  /**
   * Accept the tenant from the `X-Chamber-Slug` / `X-Chamber-ID` request header. Always on locally
   * (the Vite proxy hides the subdomain); on a deployed Worker only with `ALLOW_TENANT_HEADER=true`
   * (staging on workers.dev, which has no wildcard subdomains). Production uses the Host only.
   */
  allowTenantHeader: boolean;
  /** Extra exact origins allowed by CORS (comma separated `ALLOWED_ORIGINS`). */
  extraAllowedOrigins: string[];
  emailFromAddress: string | null;
  sendgridOtpTemplateId: string | null;
}

export class ConfigError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Invalid Worker configuration: ${problems.join('; ')}`);
    this.name = 'ConfigError';
  }
}

function parseEnvironment(value: string | undefined): AppEnvironment {
  const parsed = environmentSchema.safeParse((value || '').trim().toLowerCase());
  // Unknown / missing ENVIRONMENT is treated as production (fail closed, no dev shortcuts).
  return parsed.success ? parsed.data : 'production';
}

function parseOrigins(value: string | undefined): string[] {
  return (value || '')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, '').toLowerCase())
    .filter((o) => /^https?:\/\/[^/]+$/.test(o));
}

/** Reads configuration from Worker bindings. Never throws; see `validateDeployedConfig`. */
export function getRuntimeConfig(env: Partial<Env>): RuntimeConfig {
  const environment = parseEnvironment(env.ENVIRONMENT);
  const domain = hostnameSchema.safeParse(env.PLATFORM_DOMAIN || '');
  return {
    environment,
    isLocal: environment === 'development' || environment === 'test',
    allowTenantHeader:
      environment === 'development' || environment === 'test' || (env.ALLOW_TENANT_HEADER || '').trim().toLowerCase() === 'true',
    platformDomain: domain.success ? domain.data : null,
    extraAllowedOrigins: parseOrigins(env.ALLOWED_ORIGINS),
    emailFromAddress: env.EMAIL_FROM_ADDRESS?.trim() || null,
    sendgridOtpTemplateId: env.SENDGRID_OTP_TEMPLATE_ID?.trim() || null,
  };
}

/** Returns the list of problems for a staging / production Worker (empty when valid or local). */
export function validateDeployedConfig(env: Partial<Env>): string[] {
  if (getRuntimeConfig(env).isLocal) return [];
  const parsed = deployedEnvSchema.safeParse(env);
  if (parsed.success) return [];
  return parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
}

/** Server-side master key for AES-GCM. Throws instead of falling back to a built-in key (BUG-062). */
export function requireEncryptionKey(env: Partial<Env>): string {
  const key = env.CHAMBER_ENCRYPTION_KEY;
  if (!key || key.length < 32) {
    throw new ConfigError(['CHAMBER_ENCRYPTION_KEY: not configured (min 32 characters)']);
  }
  return key;
}
