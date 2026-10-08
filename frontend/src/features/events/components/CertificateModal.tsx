import React, { useEffect, useState } from 'react';
import { Download, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { fetchEventCertificate, type EventItem } from '../services/events.api';

interface CertificateModalProps {
  event: EventItem;
  chamberSlug?: string;
  onClose: () => void;
}

/**
 * Prompt 04.5 §5.2 — attendance certificate preview.
 * OD-039 (b): the server returns a printable document; "Download PDF" opens it and the
 * browser's print dialog saves it as PDF. "Share to LinkedIn" is not built (OD-040).
 */
export const CertificateModal: React.FC<CertificateModalProps> = ({ event, chamberSlug, onClose }) => {
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchEventCertificate(event.id, chamberSlug)
      .then((doc) => !cancelled && setHtml(doc))
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : 'Failed to load certificate'));
    return () => {
      cancelled = true;
    };
  }, [event.id, chamberSlug]);

  const download = () => {
    if (!html) return;
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    const win = window.open(url, '_blank');
    if (!win) {
      toast.error('Please allow pop-ups to download the certificate');
      URL.revokeObjectURL(url);
      return;
    }
    win.addEventListener('load', () => {
      win.focus();
      win.print();
    });
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-4xl bg-card rounded-2xl border border-border shadow-2xl p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 className="text-base font-bold text-foreground">Attendance Certificate</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer">
            <X size={16} />
          </button>
        </div>

        <div className="rounded-xl border border-border overflow-hidden bg-muted/30 aspect-[297/210]">
          {error ? (
            <p className="h-full flex items-center justify-center text-sm text-destructive p-6 text-center">{error}</p>
          ) : html ? (
            // Sandboxed preview: no scripts, no same-origin access.
            <iframe
              title="Certificate preview"
              sandbox=""
              srcDoc={html.replace('</head>', '<style>.toolbar{display:none}.page{margin:0 auto}</style></head>')}
              className="w-full h-full bg-white"
            />
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              <Loader2 className="animate-spin" size={20} />
            </div>
          )}
        </div>

        <div className="flex justify-end mt-4">
          <button
            type="button"
            disabled={!html}
            onClick={download}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0B1E3B] text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
          >
            <Download size={14} /> Download PDF
          </button>
        </div>
      </div>
    </div>
  );
};
