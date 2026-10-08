import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  XCircle,
  Loader2,
  Building2,
  Calendar,
  Award,
  UserCheck,
  CheckCircle2,
  Clock,
  ArrowLeft,
  QrCode,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface MemberVerificationPageProps {
  memberId: string | null;
  onNavigateHome: () => void;
}

interface VerificationData {
  verified: boolean;
  memberId: string;
  membershipId?: string;
  memberName: string;
  avatarUrl?: string | null;
  businessName: string;
  chamberName: string;
  chamberSlug?: string;
  tierName: string;
  status: string;
  memberSince: string | null;
  validUntil: string | null;
}

export const MemberVerificationPage: React.FC<MemberVerificationPageProps> = ({
  memberId,
  onNavigateHome,
}) => {
  const [data, setData] = useState<VerificationData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Desk check-in interactive state
  const [isCheckedIn, setIsCheckedIn] = useState<boolean>(false);
  const [checkInTime, setCheckInTime] = useState<string>('');

  useEffect(() => {
    if (!memberId) {
      setError('No member ID specified in the verification link.');
      setIsLoading(false);
      return;
    }

    let mounted = true;
    setIsLoading(true);
    setError(null);

    fetch(`/api/v1/public/members/verify/${encodeURIComponent(memberId)}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error('Member not found or membership is currently inactive.');
        }
        return res.json();
      })
      .then((json) => {
        if (mounted && json?.data) {
          setData(json.data);
        } else {
          throw new Error('Invalid verification response from server.');
        }
      })
      .catch((err) => {
        if (mounted) setError(err.message || 'Unable to verify membership pass.');
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [memberId]);

  const handleConfirmCheckIn = () => {
    const now = new Date();
    const formatted = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setCheckInTime(formatted);
    setIsCheckedIn(true);
  };

  const memberInitials = data?.memberName
    ? data.memberName
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0].toUpperCase())
        .join('')
    : 'MB';

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between selection:bg-teal-500 selection:text-white">
      {/* Top Header Bar */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-30 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs uppercase tracking-widest text-teal-400 font-bold block leading-none">
              Chamber Pass Verification
            </span>
            <span className="text-sm font-semibold text-slate-200">
              {data?.chamberName ? `${data.chamberName} Chamber` : '121Meet Member Network'}
            </span>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={onNavigateHome}
          className="text-xs text-slate-400 hover:text-white hover:bg-slate-800 flex items-center gap-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Chamber Home
        </Button>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 md:p-8">
        <div className="w-full max-w-lg">
          {isLoading ? (
            <div className="bg-slate-800/60 border border-slate-700/80 rounded-3xl p-10 text-center shadow-2xl backdrop-blur-xl">
              <Loader2 className="w-12 h-12 text-teal-400 animate-spin mx-auto" />
              <h2 className="text-lg font-bold text-white mt-4 tracking-tight">
                Authenticating Digital Pass
              </h2>
              <p className="text-xs text-slate-400 mt-1.5">
                Querying cryptographic member credentials from Chamber D1...
              </p>
            </div>
          ) : error ? (
            <div className="bg-slate-800/60 border border-red-500/30 rounded-3xl p-8 sm:p-10 text-center shadow-2xl backdrop-blur-xl">
              <div className="w-16 h-16 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 mx-auto">
                <XCircle className="w-9 h-9" />
              </div>
              <h2 className="text-xl font-bold text-white mt-5 tracking-tight">
                Verification Failed
              </h2>
              <p className="text-sm text-slate-300 mt-2 max-w-sm mx-auto">
                {error}
              </p>
              <div className="mt-4 p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400 font-mono">
                Scanned ID: {memberId || 'N/A'}
              </div>
              <p className="text-xs text-slate-500 mt-4">
                Please ask the member to present their current digital pass in the Member Portal or contact chamber registration desk.
              </p>
              <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
                <Button
                  onClick={() => window.location.reload()}
                  variant="outline"
                  className="text-xs border-slate-700 hover:bg-slate-800"
                >
                  Retry Scan
                </Button>
                <Button
                  onClick={onNavigateHome}
                  className="text-xs bg-teal-600 hover:bg-teal-500 text-white"
                >
                  Back to Chamber Website
                </Button>
              </div>
            </div>
          ) : data ? (
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-xl transition-all">
              {/* Top Verified Active Banner */}
              <div
                className={`p-6 text-center ${
                  data.verified
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white'
                    : 'bg-gradient-to-r from-amber-600 to-orange-600 text-white'
                }`}
              >
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/20 backdrop-blur-sm text-xs font-bold tracking-wide uppercase">
                  {data.verified ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                      Verified Active Member
                    </>
                  ) : (
                    <>
                      <Clock className="w-4 h-4 text-amber-200" />
                      Status: {data.status}
                    </>
                  )}
                </div>

                <div className="flex flex-col items-center mt-4">
                  {data.avatarUrl ? (
                    <img
                      src={data.avatarUrl}
                      alt={data.memberName}
                      className="w-20 h-20 rounded-full object-cover border-4 border-white/30 shadow-lg"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-slate-900/60 border-4 border-white/30 flex items-center justify-center text-2xl font-black tracking-wider text-white shadow-lg">
                      {memberInitials}
                    </div>
                  )}

                  <h1 className="text-2xl font-black text-white mt-3 tracking-tight">
                    {data.memberName}
                  </h1>
                  <p className="text-sm font-semibold text-emerald-100 mt-0.5">
                    {data.businessName}
                  </p>
                </div>
              </div>

              {/* Credential Details Grid */}
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-700/60">
                    <span className="text-slate-400 block text-[10px] font-semibold uppercase tracking-wider">
                      Membership Tier
                    </span>
                    <span className="text-sm font-bold text-white mt-1 flex items-center gap-1.5 capitalize">
                      <Award className="w-4 h-4 text-amber-400 shrink-0" />
                      {data.tierName} Plan
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-700/60">
                    <span className="text-slate-400 block text-[10px] font-semibold uppercase tracking-wider">
                      Official ID
                    </span>
                    <span className="text-sm font-mono font-bold text-teal-400 mt-1 block truncate">
                      {data.memberId}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-700/60">
                    <span className="text-slate-400 block text-[10px] font-semibold uppercase tracking-wider">
                      Chamber Chapter
                    </span>
                    <span className="text-sm font-semibold text-slate-200 mt-1 flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-teal-400 shrink-0" />
                      {data.chamberName}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-700/60">
                    <span className="text-slate-400 block text-[10px] font-semibold uppercase tracking-wider">
                      Valid Standing
                    </span>
                    <span className="text-sm font-semibold text-emerald-400 mt-1 flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-emerald-400 shrink-0" />
                      Through {data.validUntil ?? '—'}
                    </span>
                  </div>
                </div>

                {/* Event Desk Check-In Action Section */}
                <div className="p-4 rounded-2xl bg-teal-950/40 border border-teal-500/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-teal-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-teal-400" /> Event & Desk Registration
                    </span>
                    {isCheckedIn && (
                      <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Checked In
                      </span>
                    )}
                  </div>

                  {isCheckedIn ? (
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center">
                      <p className="text-xs font-bold text-emerald-300 flex items-center justify-center gap-1.5">
                        <UserCheck className="w-4 h-4 text-emerald-400" />
                        Attendee Admitted & Verified
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Timestamp: <span className="font-mono text-slate-200">{checkInTime}</span>
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs text-slate-400 mb-3">
                        Use this pass to grant entrance, issue name badge, and track event attendance.
                      </p>
                      <Button
                        onClick={handleConfirmCheckIn}
                        className="w-full text-xs font-bold py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl shadow-lg flex items-center justify-center gap-2 transition"
                      >
                        <UserCheck className="w-4 h-4" />
                        Confirm Event Check-In
                      </Button>
                    </div>
                  )}
                </div>

                {/* Return Navigation */}
                <div className="pt-2 flex items-center justify-between text-xs text-slate-500">
                  <button
                    onClick={onNavigateHome}
                    className="hover:text-slate-300 flex items-center gap-1 transition"
                  >
                    <ExternalLink className="w-3 h-3" /> Visit Chamber Website
                  </button>
                  <span className="font-mono text-[10px]">
                    121Meet Pass Engine v1.0
                  </span>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </main>

      {/* Footer Footnote */}
      <footer className="py-4 text-center text-xs text-slate-500 border-t border-slate-800">
        Official Digital Membership Pass • Powered by 121Meet Chamber Management Platform
      </footer>
    </div>
  );
};
