import type { SubmitApplicationInput, ResubmitApplicationInput } from '../validation/applications.validation';
import { ApplicationsRepository, type ApplicationDetails } from '../repositories/applications.repository';
import { MembershipPlansRepository } from '../repositories/membership-plans.repository';
import { AppError, ErrorCodes } from '../../../core/shared/errors';

export class ApplicationsService {
  /**
   * Submits a prospective membership application
   */
  static async submit(
    db: D1Database,
    chamberId: string,
    input: SubmitApplicationInput
  ): Promise<{ id: string; trackingCode: string; status: 'pending' | 'approved'; message: string }> {
    // 1. Inactive Plan Guard (Prompt 02.2 Section 7.2)
    const plan = await MembershipPlansRepository.findActivePlanById(db, chamberId, input.planId);
    if (!plan || plan.isActive === 0) {
      throw new AppError(
        ErrorCodes.BAD_REQUEST,
        'Selected plan is no longer available',
        400
      );
    }

    // 2. Check Auto-Approval Setting (Prompt 02.2 Section 7.3)
    const settings = await db
      .prepare('SELECT auto_approve_applications FROM chamber_settings WHERE chamber_id = ?')
      .bind(chamberId)
      .first<{ auto_approve_applications: number }>();

    const autoApprove = settings?.auto_approve_applications === 1;

    // 3. Persist Application & Audit Log
    const result = await ApplicationsRepository.create(db, chamberId, input, autoApprove);

    let message = 'Application submitted successfully';
    if (autoApprove) {
      if (result.chargeResult?.charged) {
        message = `Application approved automatically! Card ending in ${result.chargeResult.cardLastFour} charged $${result.chargeResult.chargedAmount.toFixed(2)}.`;
      } else {
        message = 'Application approved automatically';
      }
    }

    return {
      id: result.id,
      trackingCode: result.trackingCode,
      status: result.status,
      message,
    };
  }

  /**
   * Retrieves application status and details for public tracking
   */
  static async track(
    db: D1Database,
    chamberId: string,
    trackingCode: string
  ): Promise<any> {
    const app = await ApplicationsRepository.findByTrackingCode(db, chamberId, trackingCode.trim().toUpperCase());
    if (!app) {
      throw new AppError(
        ErrorCodes.NOT_FOUND,
        'Application not found with the provided tracking code',
        404
      );
    }

    let parsedDetails = {};
    try {
      parsedDetails = app.business_details_json ? JSON.parse(app.business_details_json) : {};
    } catch {}

    return {
      id: app.id,
      trackingCode: app.tracking_code,
      status: app.status,
      applicantName: app.applicant_name,
      businessEmail: app.business_email,
      businessPhone: app.business_phone,
      businessName: app.business_name,
      planId: app.plan_id,
      planName: app.plan_name || 'Standard Plan',
      planAccentColor: app.plan_accent_color || '#0B2447',
      planPrice: app.plan_price ?? 0,
      planPricingBasis: app.plan_pricing_basis || 'flat',
      chapterId: app.chapter_id,
      chapterName: app.chapter_name || null,
      adminNotes: app.admin_notes,
      submittedAt: app.created_at,
      updatedAt: app.updated_at,
      businessDetails: parsedDetails,
    };
  }

  /**
   * Resubmits application when in 'changes_requested' status
   */
  static async resubmit(
    db: D1Database,
    chamberId: string,
    trackingCode: string,
    input: ResubmitApplicationInput
  ): Promise<{ trackingCode: string; status: 'pending'; message: string }> {
    const normalizedCode = trackingCode.trim().toUpperCase();
    const existing = await ApplicationsRepository.findByTrackingCode(db, chamberId, normalizedCode);

    if (!existing) {
      throw new AppError(
        ErrorCodes.NOT_FOUND,
        'Application not found with the provided tracking code',
        404
      );
    }

    if (existing.status !== 'changes_requested') {
      throw new AppError(
        ErrorCodes.BAD_REQUEST,
        'Application is not currently awaiting additional information',
        400
      );
    }

    const success = await ApplicationsRepository.resubmit(db, chamberId, normalizedCode, input);
    if (!success) {
      throw new AppError(
        ErrorCodes.BAD_REQUEST,
        'Failed to resubmit application updates',
        400
      );
    }

    return {
      trackingCode: normalizedCode,
      status: 'pending',
      message: 'Application resubmitted successfully',
    };
  }
}
