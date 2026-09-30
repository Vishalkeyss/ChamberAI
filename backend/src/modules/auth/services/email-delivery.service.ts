export interface SendOtpEmailParams {
  to: string;
  code: string;
  portal: string;
  chamberName?: string;
  sendgridApiKey?: string;
}

export async function sendOtpEmail(params: SendOtpEmailParams): Promise<boolean> {
  const { to, code, portal, chamberName = 'Chamber of Commerce', sendgridApiKey } = params;

  // In local development or if no API key is set, log to terminal
  if (!sendgridApiKey) {
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
          email: 'no-reply@121meet.ai',
          name: chamberName,
        },
        template_id: 'd-chamber-otp-verification',
      }),
    });

    return response.ok;
  } catch (err) {
    console.error('[SENDGRID_DISPATCH_ERROR]', err);
    return false;
  }
}
