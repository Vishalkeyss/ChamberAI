import { Hono } from 'hono';
import type { Env } from '../../../core/env';
import type { AppVariables } from '../../../core/context';
import { requireAuth, requireRole } from '../../../core/middleware/auth.middleware';
import { MemberBillingService } from '../services/member-billing.service';
import { PayInvoiceSchema, AddPaymentMethodSchema } from '../validation/billing.validation';
import { successResponse } from '../../../core/shared/response';
import { AppError, ErrorCodes } from '../../../core/shared/errors';

export const memberBillingRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>();

// All member billing routes require authentication
memberBillingRoutes.use('/member/*', requireAuth);

const allowedRoles = ['member', 'full_admin', 'billing_admin', 'chapter_admin', 'group_admin'];

/**
 * GET /api/v1/member/invoices
 * Returns member invoices and outstanding total balance.
 */
memberBillingRoutes.get('/member/invoices', requireRole(allowedRoles), async (c) => {
  const user = c.get('user');
  const chamberId = c.get('chamberId');
  if (!user || !chamberId) {
    throw new AppError(ErrorCodes.BAD_REQUEST, 'Authentication and chamber context required', 400);
  }

  const status = c.req.query('status');
  const page = parseInt(c.req.query('page') || '1', 10);
  const limit = parseInt(c.req.query('limit') || '20', 10);

  const data = await MemberBillingService.getMemberInvoices(c, user.id, chamberId, {
    status,
    page,
    limit,
  });

  const requestId = c.get('requestId');
  return c.json(successResponse(data, { requestId }));
});

/**
 * POST /api/v1/member/invoices/:id/pay
 * Settles an invoice via saved payment method or tokenized gateway checkout.
 */
memberBillingRoutes.post('/member/invoices/:id/pay', requireRole(allowedRoles), async (c) => {
  const user = c.get('user');
  const chamberId = c.get('chamberId');
  if (!user || !chamberId) {
    throw new AppError(ErrorCodes.BAD_REQUEST, 'Authentication and chamber context required', 400);
  }

  const invoiceId = c.req.param('id');
  if (!invoiceId) {
    throw new AppError(ErrorCodes.BAD_REQUEST, 'Invoice ID is required', 400);
  }
  const body = await c.req.json().catch(() => ({}));
  const parsed = PayInvoiceSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError(
      ErrorCodes.VALIDATION_ERROR,
      parsed.error.errors[0]?.message || 'Invalid payment parameters',
      422
    );
  }

  const result = await MemberBillingService.payInvoice(
    c,
    user.id,
    chamberId,
    invoiceId,
    parsed.data
  );

  const requestId = c.get('requestId');
  return c.json(successResponse(result, { requestId }));
});

/**
 * GET /api/v1/member/invoices/:id/download
 * Renders printable HTML receipt for download.
 */
memberBillingRoutes.get('/member/invoices/:id/download', requireRole(allowedRoles), async (c) => {
  const user = c.get('user');
  const chamberId = c.get('chamberId');
  if (!user || !chamberId) {
    throw new AppError(ErrorCodes.BAD_REQUEST, 'Authentication and chamber context required', 400);
  }

  const invoiceId = c.req.param('id');
  if (!invoiceId) {
    throw new AppError(ErrorCodes.BAD_REQUEST, 'Invoice ID is required', 400);
  }
  const html = await MemberBillingService.getInvoiceReceipt(c, user.id, chamberId, invoiceId);

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `inline; filename="invoice-${invoiceId}.html"`,
    },
  });
});

/**
 * GET /api/v1/member/payment-methods
 * Lists saved cards and payment instruments.
 */
memberBillingRoutes.get('/member/payment-methods', requireRole(allowedRoles), async (c) => {
  const user = c.get('user');
  const chamberId = c.get('chamberId');
  if (!user || !chamberId) {
    throw new AppError(ErrorCodes.BAD_REQUEST, 'Authentication and chamber context required', 400);
  }

  const methods = await MemberBillingService.getPaymentMethods(c, user.id, chamberId);
  const requestId = c.get('requestId');
  return c.json(successResponse(methods, { requestId }));
});

/**
 * POST /api/v1/member/payment-methods
 * Adds a new payment method into the member's wallet.
 */
memberBillingRoutes.post('/member/payment-methods', requireRole(allowedRoles), async (c) => {
  const user = c.get('user');
  const chamberId = c.get('chamberId');
  if (!user || !chamberId) {
    throw new AppError(ErrorCodes.BAD_REQUEST, 'Authentication and chamber context required', 400);
  }

  const body = await c.req.json().catch(() => ({}));
  const parsed = AddPaymentMethodSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError(
      ErrorCodes.VALIDATION_ERROR,
      parsed.error.errors[0]?.message || 'Invalid card information',
      422
    );
  }

  const newMethod = await MemberBillingService.addPaymentMethod(
    c,
    user.id,
    chamberId,
    parsed.data
  );

  const requestId = c.get('requestId');
  return c.json(successResponse(newMethod, { requestId }), 201);
});

/**
 * DELETE /api/v1/member/payment-methods/:id
 * Removes a saved payment method.
 */
memberBillingRoutes.delete('/member/payment-methods/:id', requireRole(allowedRoles), async (c) => {
  const user = c.get('user');
  const chamberId = c.get('chamberId');
  if (!user || !chamberId) {
    throw new AppError(ErrorCodes.BAD_REQUEST, 'Authentication and chamber context required', 400);
  }

  const methodId = c.req.param('id');
  if (!methodId) {
    throw new AppError(ErrorCodes.BAD_REQUEST, 'Payment method ID is required', 400);
  }
  await MemberBillingService.deletePaymentMethod(c, user.id, chamberId, methodId);

  const requestId = c.get('requestId');
  return c.json(successResponse({ success: true, deleted_id: methodId }, { requestId }));
});

/**
 * PATCH /api/v1/member/payment-methods/:id/default
 * Sets a payment method as default.
 */
memberBillingRoutes.patch('/member/payment-methods/:id/default', requireRole(allowedRoles), async (c) => {
  const user = c.get('user');
  const chamberId = c.get('chamberId');
  if (!user || !chamberId) {
    throw new AppError(ErrorCodes.BAD_REQUEST, 'Authentication and chamber context required', 400);
  }

  const methodId = c.req.param('id');
  if (!methodId) {
    throw new AppError(ErrorCodes.BAD_REQUEST, 'Payment method ID is required', 400);
  }
  await MemberBillingService.setDefaultPaymentMethod(c, user.id, chamberId, methodId);

  const requestId = c.get('requestId');
  return c.json(successResponse({ success: true, default_id: methodId }, { requestId }));
});

/**
 * GET /api/v1/member/membership/benefits
 * Returns real-time visual tracking of membership plan benefits consumed vs limit.
 */
memberBillingRoutes.get('/member/membership/benefits', requireRole(allowedRoles), async (c) => {
  const user = c.get('user');
  const chamberId = c.get('chamberId');
  if (!user || !chamberId) {
    throw new AppError(ErrorCodes.BAD_REQUEST, 'Authentication and chamber context required', 400);
  }

  const benefits = await MemberBillingService.getBenefitUsage(c, user.id, chamberId);
  const requestId = c.get('requestId');
  return c.json(successResponse(benefits, { requestId }));
});

/**
 * POST /api/v1/member/membership/change-plan
 * Upgrades, downgrades, or switches the member's current membership plan.
 */
memberBillingRoutes.post('/member/membership/change-plan', requireRole(allowedRoles), async (c) => {
  const user = c.get('user');
  const chamberId = c.get('chamberId');
  if (!user || !chamberId) {
    throw new AppError(ErrorCodes.BAD_REQUEST, 'Authentication and chamber context required', 400);
  }

  const body = await c.req.json().catch(() => ({}));
  const planId = body?.planId || body?.plan_id;
  if (!planId || typeof planId !== 'string') {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, 'planId is required', 422);
  }

  const result = await MemberBillingService.changePlan(c, user.id, chamberId, planId.trim());
  const requestId = c.get('requestId');
  return c.json(successResponse(result, { requestId }));
});
