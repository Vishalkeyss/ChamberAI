import { apiUrl } from '@/core/api/base';
import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ShieldCheck, XCircle, Loader2, Building2, Calendar, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface VerifyMemberModalProps {
  memberId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

interface VerificationData {
  verified: boolean;
  memberId: string;
  memberName: string;
  businessName: string;
  chamberName: string;
  tierName: string;
  status: string;
  memberSince: string | null;
  validUntil: string | null;
}

export const VerifyMemberModal: React.FC<VerifyMemberModalProps> = ({
  memberId,
  isOpen,
  onClose,
}) => {
  const [data, setData] = useState<VerificationData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !memberId) return;

    let mounted = true;
    setIsLoading(true);
    setError(null);

    fetch(apiUrl(`/api/v1/public/members/verify/${encodeURIComponent(memberId)}`))
      .then((res) => {
        if (!res.ok) throw new Error('Member not found or membership is inactive');
        return res.json();
      })
      .then((json) => {
        if (mounted && json?.data) {
          setData(json.data);
        }
      })
      .catch((err) => {
        if (mounted) setError(err.message || 'Unable to verify membership');
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [isOpen, memberId]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-lg font-bold">
            Official Member Verification
          </DialogTitle>
          <DialogDescription className="text-center text-xs text-gray-500">
            Authenticated via 121Meet Chamber Network
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-[#0B2447] animate-spin" />
            <p className="text-xs text-gray-500">Verifying digital certificate...</p>
          </div>
        ) : error ? (
          <div className="py-8 flex flex-col items-center justify-center text-center gap-3">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-600">
              <XCircle className="w-7 h-7" />
            </div>
            <div>
              <p className="font-bold text-gray-900">Verification Failed</p>
              <p className="text-xs text-gray-500 mt-1 max-w-xs">{error}</p>
            </div>
            <Button variant="outline" size="sm" onClick={onClose} className="mt-2 text-xs">
              Close
            </Button>
          </div>
        ) : data ? (
          <div className="space-y-4 py-2">
            {/* Verified Badge Header */}
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shrink-0 shadow-xs">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase tracking-wider">
                  Verified Active Member
                </span>
                <p className="text-sm font-bold text-gray-900 dark:text-[#F1F5F9] mt-0.5 truncate">
                  {data.memberName}
                </p>
                <p className="text-xs text-emerald-800 dark:text-emerald-300 truncate">
                  {data.businessName}
                </p>
              </div>
            </div>

            {/* Member Details Matrix */}
            <div className="p-4 rounded-xl bg-gray-50 dark:bg-[#1E3352]/50 border border-gray-200 dark:border-[#26406A] text-xs space-y-2.5">
              <div className="flex justify-between items-center py-1 border-b border-gray-200/60 dark:border-[#26406A]/60">
                <span className="text-gray-500 dark:text-[#94A6C2] flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" /> Chamber
                </span>
                <span className="font-bold text-gray-900 dark:text-[#F1F5F9] text-right">
                  {data.chamberName}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-gray-200/60 dark:border-[#26406A]/60">
                <span className="text-gray-500 dark:text-[#94A6C2] flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5" /> Membership Tier
                </span>
                <span className="font-bold text-gray-900 dark:text-[#F1F5F9]">
                  {data.tierName} Plan
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-gray-200/60 dark:border-[#26406A]/60">
                <span className="text-gray-500 dark:text-[#94A6C2]">Member ID</span>
                <span className="font-mono font-bold text-gray-900 dark:text-[#F1F5F9]">
                  {data.memberId}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-gray-200/60 dark:border-[#26406A]/60">
                <span className="text-gray-500 dark:text-[#94A6C2]">Member Since</span>
                <span className="font-medium text-gray-900 dark:text-[#F1F5F9]">
                  {data.memberSince ?? '—'}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-gray-500 dark:text-[#94A6C2] flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" /> Valid Standing Until
                </span>
                <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                  {data.validUntil ?? '—'}
                </span>
              </div>
            </div>

            <Button onClick={onClose} className="w-full text-xs bg-[#0B2447] text-white">
              Done
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};
