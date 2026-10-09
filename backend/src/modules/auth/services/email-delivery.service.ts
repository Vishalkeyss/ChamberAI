export interface SendOtpEmailParams {
  to: string;
  code: string;
  portal: string;
  chamberName?: string;
  sendgridApiKey?: string;
  /** From core/config. */
  fromAddress?: string | null;
  templateId?: string | null;
  /** Only local dev / tests may print the code instead of sending it (BUG-049). */
  allowConsoleFallback: boolean;
}

export async function sendOtpEmail(params: SendOtpEmailParams): Promise<boolean> {
  const { to, code, portal, chamberName = 'Chamber of Commerce', sendgridApiKey, fromAddress, templateId, allowConsoleFallback } = params;

  // Local development only: print to the terminal when SendGrid is not configured.
  if (!sendgridApiKey || !fromAddress || !templateId) {
    if (!allowConsoleFallback) {
      console.error('[SENDGRID_NOT_CONFIGURED] OTP email not sent');
      return false;
    }
    console.log(
      `\n========================================\n` +
      `[DEV_OTP_DISPATCH]\n` +
      `To: ${to}\n` +
      `Portal: ${portal}\n` +
      `Chamber: ${chamberName}\n` +
      `Verification Code: ${code}\n` +
      `Valid For: 10 minutes\n` +
      `========================================\n`
    );
    return true;
  }

  // Production SendGrid API Dispatch
  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sendgridApiKey}`,
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: [{ email: to }],
            dynamic_template_data: {
              code,
              portal,
              chamber_name: chamberName,
              expires_in: '10 minutes',
            },
          },
        ],
        from: {
          email: fromAddress,
          name: chamberName,
        },
        template_id: templateId,
      }),
    });

    return response.ok;
  } catch (err) {
    console.error('[SENDGRID_DISPATCH_ERROR]', err);
    return false;
  }
}
