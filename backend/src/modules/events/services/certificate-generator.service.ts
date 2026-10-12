import { escapeHtml } from '../../../core/shared/html';

/**
 * Prompt 04.5 §5.2 — attendance certificate.
 * OD-039 (approved option b): printable HTML document; the member saves it as PDF from the
 * browser print dialog. No signature / CEU block yet (OD-040: no chamber_settings fields).
 */
export interface CertificateData {
  certificateId: string;
  attendeeName: string;
  eventTitle: string;
  eventDate: string;
  timezone: string | null;
  orgName: string;
  logoUrl: string | null;
}

export class CertificateGeneratorService {
  /** Verifiable ID derived from the registration (ID convention: CERT_<SCOPE>_<DATE>_<SUFFIX>). */
  static certificateId(registrationId: string): string {
    return registrationId.toUpperCase().replace(/^REG[_-]/, 'CERT_').replace(/^(?!CERT_)/, 'CERT_');
  }

  static formatDate(iso: string, timezone: string | null): string {
    const date = new Date(iso.replace(' ', 'T'));
    if (Number.isNaN(date.getTime())) return iso;
    const opts: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' };
    try {
      return new Intl.DateTimeFormat('en-US', { ...opts, ...(timezone ? { timeZone: timezone } : {}) }).format(date);
    } catch {
      return new Intl.DateTimeFormat('en-US', opts).format(date);
    }
  }

  static fileName(orgName: string): string {
    const slug = orgName.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'Chamber';
    return `Certificate-${slug}.html`;
  }

  static render(d: CertificateData): string {
    const e = escapeHtml;
    const logo = d.logoUrl
      ? `<img class="seal-img" src="${e(d.logoUrl)}" alt="${e(d.orgName)}" />`
      : `<div class="seal">${e(d.orgName.slice(0, 1).toUpperCase())}</div>`;
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Certificate of Attendance - ${e(d.eventTitle)}</title>
<style>
  @page { size: A4 landscape; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; background: #f1f5f9; color: #0f172a; font-family: Georgia, 'Times New Roman', serif; }
  .page { width: 100%; max-width: 297mm; aspect-ratio: 297 / 210; margin: 16px auto; background: #fff; padding: 4%; }
  .frame { height: 100%; border: 3px solid #0b1e3b; outline: 1px solid #0b1e3b; outline-offset: -9px; padding: 4% 6%; text-align: center; display: flex; flex-direction: column; justify-content: center; }
  .seal, .seal-img { width: 64px; height: 64px; border-radius: 50%; margin: 0 auto 10px; }
  .seal { background: #0b1e3b; color: #fff; font-size: 30px; line-height: 64px; font-weight: bold; }
  .seal-img { object-fit: cover; }
  .org { letter-spacing: .25em; text-transform: uppercase; font-size: 12px; color: #475569; }
  h1 { font-size: 34px; margin: 18px 0 6px; color: #0b1e3b; font-weight: normal; letter-spacing: .04em; }
  .muted { color: #64748b; font-size: 14px; margin: 14px 0 4px; font-style: italic; }
  .name { font-size: 32px; font-weight: bold; margin: 4px 0; border-bottom: 1px solid #cbd5e1; display: inline-block; padding: 0 24px 6px; }
  .event { font-size: 20px; font-weight: bold; margin: 4px 0; }
  .date { font-size: 15px; color: #334155; margin-top: 4px; }
  .id { margin-top: 26px; font-family: 'Courier New', monospace; font-size: 11px; color: #64748b; letter-spacing: .08em; }
  .toolbar { text-align: center; margin: 16px; font-family: system-ui, sans-serif; }
  .toolbar button { background: #0b1e3b; color: #fff; border: 0; border-radius: 8px; padding: 10px 18px; font-size: 14px; cursor: pointer; }
  @media print { html, body { background: #fff; } .page { width: 297mm; height: 210mm; max-width: none; margin: 0; padding: 12mm; } .toolbar { display: none; } }
</style>
</head>
<body>
<div class="toolbar"><button type="button" onclick="window.print()">Download PDF / Print</button></div>
<div class="page"><div class="frame">
  ${logo}
  <div class="org">${e(d.orgName)}</div>
  <h1>Certificate of Attendance</h1>
  <p class="muted">This certifies that</p>
  <div><span class="name">${e(d.attendeeName)}</span></div>
  <p class="muted">attended</p>
  <div class="event">${e(d.eventTitle)}</div>
  <div class="date">${e(this.formatDate(d.eventDate, d.timezone))}</div>
  <div class="id">Certificate ID: ${e(d.certificateId)}</div>
</div></div>
</body>
</html>`;
  }
}
