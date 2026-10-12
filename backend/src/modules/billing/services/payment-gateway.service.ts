import { AppError, ErrorCodes } from '../../../core/shared/errors';

export interface ChargeRequest {
  chamberId: string;
  userId: string | null;
  amount: number;
  currency: string;
  description: string;
  paymentMethodId?: string | null;
}

export interface ChargeResult {
  transactionId: string;
}

/**
 * Single integration point for online payments.
 *
 * No payment gateway is integrated yet (OD-001). Every caller must treat money as
 * collected ONLY when this returns a verified result — never mark anything "paid"
 * without it. When the gateway is chosen, implement it here (and nowhere else).
 */
export class PaymentGatewayService {
  static async charge(_request: ChargeRequest): Promise<ChargeResult> {
    throw new AppError(
      ErrorCodes.PAYMENT_UNAVAILABLE,
      'Online payment is not available yet. Please contact your chamber to complete this payment.',
      503
    );
  }
}
