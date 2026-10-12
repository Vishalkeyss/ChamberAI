import React, { useEffect, useState, useCallback } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  Loader2,
  AlertCircle,
  ScanLine,
} from 'lucide-react';
import { toast } from 'sonner';
import type {
  AdminEventOverviewData,
  AttendeeListItem,
  WaitlistListItem,
} from '../services/admin-events.api';
import {
  fetchAdminEventOverview,
  fetchAdminAttendees,
  fetchAdminWaitlist,
} from '../services/admin-events.api';
import { OverviewTab } from '../components/tabs/OverviewTab';
import { AttendeesTab } from '../components/tabs/AttendeesTab';
import { WaitlistTab } from '../components/tabs/WaitlistTab';
import { FeedbackTab } from '../components/tabs/FeedbackTab';
import { SponsorsTab } from '../components/tabs/SponsorsTab';
import { AdminEventWizardModal } from '../components/AdminEventWizardModal';

interface AdminEventDetailPageProps {
  eventId: string;
  chamberSlug?: string;
  onNavigateBack: () => void;
  isGroupScopedAdmin?: boolean;
}

export type AdminEventTabKey =
  | 'Overview'
  | 'Attendees'
  | 'Waitlist'
  | 'Feedback'
  | 'Attendee Purchases'
  | 'Sponsors'
  | 'Exhibitors (Beta)'
  | 'Attendee Setup'
  | 'Sponsor Setup';

const TABS: AdminEventTabKey[] = [
  'Overview',
  'Attendees',
  'Waitlist',
  'Feedback',
  'Attendee Purchases',
  'Sponsors',
  'Exhibitors (Beta)',
  'Attendee Setup',
  'Sponsor Setup',
];

export const AdminEventDetailPage: React.FC<AdminEventDetailPageProps> = ({
  eventId,
  chamberSlug,
  onNavigateBack,
  isGroupScopedAdmin = false,
}) => {
  // 1. URL search param synchronization for active tab (e.g. ?tab=attendees)
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminEventTabKey>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam) {
        const found = TABS.find((t) => t.toLowerCase() === tabParam.toLowerCase());
        if (found) return found;
      }
    }
    return 'Overview';
  });

  const handleTabChange = (t: AdminEventTabKey) => {
    setActiveTab(t);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', t.toLowerCase().replace(/\s+/g, '-'));
      window.history.replaceState({}, '', url.toString());
    }
  };

  const [overviewData, setOverviewData] = useState<AdminEventOverviewData | null>(null);
  const [attendees, setAttendees] = useState<AttendeeListItem[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAttendeesLoading, setIsAttendeesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const overview = await fetchAdminEventOverview(eventId, chamberSlug);
      setOverviewData(overview);

      // Preload attendees & waitlist
      setIsAttendeesLoading(true);
      const [attRes, waitRes] = await Promise.all([
        fetchAdminAttendees(eventId, { limit: 100 }, chamberSlug).catch(() => ({ attendees: [], total: 0 })),
        fetchAdminWaitlist(eventId, chamberSlug).catch(() => []),
      ]);
      setAttendees(attRes.attendees);
      setWaitlist(waitRes);
    } catch (err: any) {
      console.error('[ADMIN_EVENT_DETAIL_ERROR]', err);
      setError(err.message || 'Failed to load event details');
    } finally {
      setIsLoading(false);
      setIsAttendeesLoading(false);
    }
  }, [eventId, chamberSlug]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-[#6B7280] space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#0A2540]" />
        <p className="text-sm">Loading event management console...</p>
      </div>
    );
  }

  if (error || !overviewData) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
        <h2 className="text-lg font-semibold text-[#111827]">Access Restricted or Event Not Found</h2>
        <p className="text-sm text-[#6B7280]">
          {error || 'Unable to retrieve this event with your current credentials.'}
        </p>
        <button
          onClick={onNavigateBack}
          className="px-4 py-2 rounded-xl text-xs font-semibold border border-[#E5E7EB] hover:bg-gray-50 text-[#111827] cursor-pointer"
        >
          Return to Events
        </button>
      </div>
    );
  }

  const { event, metrics } = overviewData;

  const waitlistCount = waitlist.length > 0 ? waitlist.length : (metrics.waitlistedCount ?? 0);
  const feedbackCount = metrics.totalFeedbackCount || 0;

  return (
    <div className="w-full text-[#111827] pb-16">
      {/* Back to Events button */}
      <button
        onClick={onNavigateBack}
        className="inline-flex items-center gap-1.5 text-xs font-semibold mb-4 text-[#0284C7] hover:underline cursor-pointer"
      >
        <ChevronLeft size={15} /> Back to Events
      </button>

      {/* Header: Rounded Calendar Icon + Event Title + [Status] */}
      <div className="flex items-center gap-3.5 mb-5">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-white"
          style={{ background: '#0A2540' }}
        >
          <CalendarDays size={22} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-[#111827]">
            {event.title}{' '}
            <span className="font-normal text-[#6B7280]">
              [{event.status === 'published' ? 'Upcoming' : event.status}]
            </span>
          </h2>
        </div>
      </div>

      {/* 9-Tab Navigation Bar with horizontal border line */}
      <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-1 border-b border-[#E5E7EB]">
        {TABS.map((t) => {
          const isActive = activeTab === t;
          let label = t as string;
          if (t === 'Waitlist') {
            label = `Waitlist (${waitlistCount})`;
          } else if (t === 'Feedback') {
            label = `Feedback (${feedbackCount})`;
          }

          return (
            <button
              key={t}
              onClick={() => handleTabChange(t)}
              className="px-3.5 py-2.5 text-xs font-semibold whitespace-nowrap cursor-pointer transition-all"
              style={{
                color: isActive ? '#0A2540' : '#6B7280',
                borderBottom: isActive ? '2px solid #0A2540' : '2px solid transparent',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT PANELS */}
      {activeTab === 'Overview' && (
        <OverviewTab
          data={overviewData}
          onCheckIn={() => handleTabChange('Attendees')}
          onEdit={isGroupScopedAdmin ? undefined : () => setIsWizardOpen(true)}
          onManageAttendees={() => handleTabChange('Attendees')}
        />
      )}

      {activeTab === 'Attendees' && (
        <AttendeesTab
          eventId={eventId}
          attendees={attendees}
          isLoading={isAttendeesLoading}
          onRefresh={loadData}
          chamberSlug={chamberSlug}
          isGroupScopedAdmin={isGroupScopedAdmin}
        />
      )}

      {activeTab === 'Waitlist' && (
        <WaitlistTab
          eventId={eventId}
          waitlist={waitlist}
          isLoading={isAttendeesLoading}
          onRefresh={loadData}
          chamberSlug={chamberSlug}
          maxCapacity={event.maxCapacity}
          registeredCount={metrics.confirmedAttendees}
        />
      )}

      {activeTab === 'Feedback' && (
        <FeedbackTab eventId={eventId} chamberSlug={chamberSlug} />
      )}

      {activeTab === 'Sponsors' && (
        <SponsorsTab eventId={eventId} chamberSlug={chamberSlug} />
      )}

      {activeTab === 'Attendee Purchases' && (
        <div className="p-8 rounded-2xl bg-white border border-[#E5E7EB] text-center text-xs text-[#6B7280]">
          <p className="font-semibold text-sm text-[#111827] mb-1">Attendee Purchases & Transactions</p>
          <p>Total settled revenue: ${metrics.totalRevenue.toFixed(2)}. Linked to Cloudflare D1 Invoices ledger.</p>
        </div>
      )}

      {activeTab === 'Exhibitors (Beta)' && (
        <div className="p-8 rounded-2xl bg-white border border-[#E5E7EB] text-center text-xs text-[#6B7280]">
          <p className="font-semibold text-sm text-[#111827] mb-1">Exhibitor Booths & Passes (Beta)</p>
          <p>Floorplan visualizer and exhibitor badges will activate with Prompt 04.4.</p>
        </div>
      )}

      {activeTab === 'Attendee Setup' && (
        <div className="p-8 rounded-2xl bg-white border border-[#E5E7EB] text-center text-xs text-[#6B7280]">
          <p className="font-semibold text-sm text-[#111827] mb-1">Attendee Setup & Custom Fields</p>
          <p>Configure attendee dietary intake questions and Avery name badge formats.</p>
        </div>
      )}

      {activeTab === 'Sponsor Setup' && (
        <div className="p-8 rounded-2xl bg-white border border-[#E5E7EB] text-center text-xs text-[#6B7280]">
          <p className="font-semibold text-sm text-[#111827] mb-1">Sponsor Setup & Deliverables</p>
          <p>Configure event sponsor packages, banner placements, and automated invoice dispatches.</p>
        </div>
      )}
      {isWizardOpen && (
        <AdminEventWizardModal
          eventId={eventId}
          chamberSlug={chamberSlug}
          onClose={() => setIsWizardOpen(false)}
          onSaved={() => {
            setIsWizardOpen(false);
            loadData();
          }}
        />
      )}
    </div>
  );
};

export default AdminEventDetailPage;
