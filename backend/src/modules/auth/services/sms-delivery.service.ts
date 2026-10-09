export interface SendOtpSmsParams {
  to: string;           // E.164 phone number, e.g. "+14155552671"
  code: string;
  portal: string;
  chamberName?: string;
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  twilioFromNumber?: string;
  /** Only local dev / tests may print the code instead of sending it (BUG-049). */
  allowConsoleFallback: boolean;
}

export async function sendOtpSms(params: SendOtpSmsParams): Promise<boolean> {
  const {
    to,
    code,
    portal,
    chamberName = 'Chamber of Commerce',
    twilioAccountSid,
    twilioAuthToken,
    twilioFromNumber,
    allowConsoleFallback,
  } = params;

  const portalLabel =
    portal === 'super_admin'
      ? 'Platform Super Admin'
      : portal === 'chamber_admin'
      ? 'Chamber Admin Portal'
      : 'Member Portal';

  const body = `[${chamberName}] Your ${portalLabel} verification code is: ${code}. Valid for 10 minutes. Do not share this code.`;

  // In local development or if Twilio credentials are not set, log to terminal
  if (!twilioAccountSid || !twilioAuthToken || !twilioFromNumber) {
    if (!allowConsoleFallback) {
      console.error('[TWILIO_NOT_CONFIGURED] OTP SMS not sent');
      return false;
    }
    console.log(
      `\n========================================\n` +
      `[DEV_OTP_SMS_DISPATCH]\n` +
      `To: ${to}\n` +
      `Portal: ${portal}\n` +
      `Chamber: ${chamberName}\n` +
      `Verification Code: ${code}\n` +
      `Valid For: 10 minutes\n` +
      `========================================\n`
    );
    return true;
  }

  // Production Twilio API Dispatch
  try {
    const credentials = btoa(`${twilioAccountSid}:${twilioAuthToken}`);
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${credentials}`,
        },
        body: new URLSearchParams({
          To: to,
          From: twilioFromNumber,
          Body: body,
        }).toString(),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error('[TWILIO_DISPATCH_ERROR]', err);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[TWILIO_DISPATCH_ERROR]', err);
    return false;
  }
}
