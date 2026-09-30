import { Hono } from 'hono';
import { AppEnv, AppVariables } from '../../../core/context';
import { successResponse } from '../../../core/shared/response';
import { requestOtpSchema, verifyOtpSchema } from '../validation/otp.validation';
import { OtpService } from '../services/otp.service';

export const authRoutes = new Hono<{ Bindings: AppEnv; Variables: AppVariables }>();

/**
 * Common handler for requesting an OTP
 */
async function handleRequestOtp(c: any, portalOverride?: string) {
  const body = await c.req.json();
  if (portalOverride) {
    body.portal = portalOverride;
  }
  const validated = requestOtpSchema.parse(body);
  const result = await OtpService.requestOtp(c, validated);
  return c.json(successResponse(result, c.get('requestId')));
}

/**
 * Common handler for verifying an OTP
 */
async function handleVerifyOtp(c: any, portalOverride?: string) {
  const body = await c.req.json();
  if (portalOverride) {
    body.portal = portalOverride;
  }
  const validated = verifyOtpSchema.parse(body);
  const result = await OtpService.verifyOtp(c, validated);

  // Set Authorization header in response as specified in Prompt 01.1
  c.header('Authorization', `Bearer ${result.token}`);

  return c.json(successResponse(result, c.get('requestId')));
}

// Generic / Aliased OTP Routes
authRoutes.post('/otp/request', (c) => handleRequestOtp(c));
authRoutes.post('/otp/verify', (c) => handleVerifyOtp(c));

// Member Portal Specific Routes
authRoutes.post('/member/request-otp', (c) => handleRequestOtp(c, 'member'));
authRoutes.post('/member/verify-otp', (c) => handleVerifyOtp(c, 'member'));

// Chamber Admin Portal Specific Routes
authRoutes.post('/admin/request-otp', (c) => handleRequestOtp(c, 'chamber_admin'));
authRoutes.post('/admin/verify-otp', (c) => handleVerifyOtp(c, 'chamber_admin'));

// Platform Super Admin Specific Routes
authRoutes.post('/super-admin/request-otp', (c) => handleRequestOtp(c, 'super_admin'));
authRoutes.post('/super-admin/verify-otp', (c) => handleVerifyOtp(c, 'super_admin'));
