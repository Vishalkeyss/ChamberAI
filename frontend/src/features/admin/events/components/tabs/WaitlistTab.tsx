import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { WaitlistListItem } from '../../services/admin-events.api';
import { promoteWaitlistAttendee, deleteRegistration } from '../../services/admin-events.api';

interface WaitlistTabProps {
  eventId: string;
  waitlist: WaitlistListItem[];
  isLoading: boolean;
  onRefresh: () => void;
  chamberSlug?: string;
  maxCapacity?: number | null;
  registeredCount?: number;
}

export const WaitlistTab: React.FC<WaitlistTabProps> = ({
  eventId,
  waitlist,
  isLoading,
  onRefresh,
  chamberSlug,
  maxCapacity,
  registeredCount = 0,
}) => {
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const handlePromote = async (item: WaitlistListItem) => {
    try {
      setPromotingId(item.id);
      await promoteWaitlistAttendee(eventId, item.id, chamberSlug);
      toast.success(`${item.guestName} promoted to registered`);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to promote waitlist attendee');
    } finally {
      setPromotingId(null);
    }
  };

  const handleRemove = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to remove ${name} from the waitlist?`)) {
      return;
    }
    try {
      setRemovingId(id);
      await deleteRegistration(eventId, id, chamberSlug);
      toast.success(`${name} removed from waitlist`);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove from waitlist');
    } finally {
      setRemovingId(null);
    }
  };

  const isFull =
    maxCapacity != null && maxCapacity > 0 && registeredCount >= maxCapacity;

  if (isLoading) {
    return (
      <div className="space-y-5 max-w-4xl mx-auto text-[#111827]">
        <Card className="p-6 bg-white border border-[#E5E7EB] shadow-xs rounded-2xl">
          <p className="text-xs text-center text-[#6B7280] py-8">Loading waitlist…</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-4xl mx-auto text-[#111827]">
      {/* 1. Waitlist Top Box */}
      <Card className="p-6 bg-white border border-[#E5E7EB] shadow-xs rounded-2xl">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
          <div>
            <h3 className="text-sm font-bold text-[#111827]">Waitlist</h3>
            <p className="text-xs text-[#6B7280] mt-0.5">
              {registeredCount}
              {maxCapacity != null && maxCapacity > 0 ? ` of ${maxCapacity} seats filled` : ' registered'}
              {' '}· {waitlist.length} waiting
            </p>
          </div>
          {isFull ? (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#FEF3C7] text-[#D97706] border border-[#FDE68A]">
              Full — Waitlist Open
            </span>
          ) : (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#D1FAE5] text-[#065F46] border border-[#A7F3D0]">
              Seats Available
            </span>
          )}
        </div>

        {waitlist.length === 0 ? (
          <p className="text-xs italic py-4 text-center text-[#6B7280]">
            No one is on the waitlist yet.
          </p>
        ) : (
          <div className="space-y-2">
            {waitlist.map((w, idx) => (
              <div
                key={w.id}
                className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-[#E5E7EB] bg-white hover:bg-[#F9FAFB] transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Position Badge e.g. #1 */}
                  <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 bg-[#FEF3C7] text-[#D97706]">
                    #{w.waitlistPosition || idx + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#111827] truncate">{w.guestName}</p>
                    <p className="text-[11px] text-[#6B7280] truncate">
                      {w.guestEmail} · joined{' '}
                      {new Date(w.createdAt).toLocaleDateString([], {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handlePromote(w)}
                    disabled={promotingId === w.id}
                    className="px-3.5 py-1.5 rounded-xl border border-[#E5E7EB] hover:bg-gray-50 text-xs font-semibold text-[#111827] cursor-pointer inline-flex items-center gap-1.5 transition-colors disabled:opacity-60"
                  >
                    {promotingId === w.id && <Loader2 size={12} className="animate-spin" />}
                    Promote to Registered
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemove(w.id, w.guestName)}
                    className="p-1 rounded-md hover:bg-gray-100 text-[#DC2626] cursor-pointer"
                    title="Remove from Waitlist"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default WaitlistTab;
