import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Search, X } from 'lucide-react';
import { toast } from 'sonner';
import type { AttendeeListItem } from '../../services/admin-events.api';
import { deleteRegistration } from '../../services/admin-events.api';

interface AttendeesTabProps {
  eventId: string;
  attendees: AttendeeListItem[];
  isLoading: boolean;
  onRefresh: () => void;
  chamberSlug?: string;
  isGroupScopedAdmin?: boolean;
}

export const AttendeesTab: React.FC<AttendeesTabProps> = ({
  eventId,
  attendees,
  isLoading,
  onRefresh,
  chamberSlug,
  isGroupScopedAdmin = false,
}) => {
  const [search, setSearch] = useState('');
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Avatar initials helper
  const getInitials = (name: string) => {
    const parts = name.split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const filtered = attendees.filter((att) => {
    if (!search.trim()) return true;
    return (
      att.guestName.toLowerCase().includes(search.toLowerCase()) ||
      att.guestEmail.toLowerCase().includes(search.toLowerCase())
    );
  });

  const handleRemove = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to remove ${name} from this event?`)) {
      return;
    }
    try {
      setRemovingId(id);
      await deleteRegistration(eventId, id, chamberSlug);
      toast.success(`${name} has been removed`);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove attendee');
    } finally {
      setRemovingId(null);
    }
  };

  const handleSaveChanges = () => {
    toast.success('Attendee list refreshed');
    onRefresh();
  };

  if (isLoading) {
    return (
      <Card className="p-6 bg-white border border-[#E5E7EB] shadow-xs max-w-4xl mx-auto rounded-2xl text-[#111827]">
        <p className="text-xs text-center text-[#6B7280] py-8">Loading attendees…</p>
      </Card>
    );
  }

  return (
    <Card className="p-6 bg-white border border-[#E5E7EB] shadow-xs max-w-4xl mx-auto rounded-2xl text-[#111827]">
      {/* Top Header Card */}
      <div className="p-4 rounded-xl bg-[#F9FAFB] border border-[#F3F4F6] mb-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-[#111827]">Registered members</p>
          <span className="text-2xl font-bold text-[#111827]">{attendees.length}</span>
        </div>
        <p className="text-xs text-[#6B7280] mt-1">
          Remove a no-show below to update the count.
        </p>
      </div>

      {/* Search Input */}
      <div className="relative mb-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search registrants..."
          className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white border border-[#E5E7EB] outline-none focus:border-[#0A2540]"
        />
      </div>

      {/* Attendees Rows List */}
      <div className="space-y-2 mb-6">
        {attendees.length === 0 ? (
          <p className="text-xs italic py-8 text-center text-[#6B7280]">
            No registrants yet for this event.
          </p>
        ) : filtered.length === 0 ? (
          <p className="text-xs italic py-4 text-center text-[#6B7280]">No matching registrants found.</p>
        ) : (
          filtered.map((att) => (
            <div
              key={att.id}
              className="flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-[#E5E7EB] bg-white hover:bg-[#F9FAFB] transition-all"
            >
              <div className="flex items-center gap-3 min-w-0">
                {/* Circular Avatar */}
                <div className="w-8 h-8 rounded-full bg-[#9CA3AF] text-white flex items-center justify-center text-xs font-bold shrink-0">
                  {getInitials(att.guestName)}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#111827] truncate">{att.guestName}</p>
                  <p className="text-[11px] text-[#6B7280] truncate">{att.guestEmail}</p>
                </div>
              </div>

              {/* Remove button */}
              <button
                type="button"
                onClick={() => handleRemove(att.id, att.guestName)}
                className="p-1 rounded-md hover:bg-gray-100 text-[#DC2626] cursor-pointer transition-colors"
                title="Remove registrant"
              >
                <X size={14} />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Scoped Notice */}
      {isGroupScopedAdmin && (
        <p className="text-[11px] text-[#6B7280] mb-4">
          As a Group Admin you can manage who's registered for this event, but only a Full Admin can edit its title, date, venue or fee.
        </p>
      )}

      {/* Save Changes CTA Button */}
      <button
        type="button"
        onClick={handleSaveChanges}
        className="w-full py-3 rounded-xl text-xs font-semibold text-white shadow-xs cursor-pointer transition-all"
        style={{ background: '#0A2540' }}
      >
        Refresh List
      </button>
    </Card>
  );
};

export default AttendeesTab;
