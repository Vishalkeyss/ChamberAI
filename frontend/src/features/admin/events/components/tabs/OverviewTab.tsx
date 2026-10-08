import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Pencil,
  Plus,
  PlayCircle,
  ImageIcon,
  X,
  ScanLine,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import type { AdminEventOverviewData } from '../../services/admin-events.api';

interface OverviewTabProps {
  data: AdminEventOverviewData;
  onEdit?: () => void;
  onCheckIn?: () => void;
  onManageAttendees?: () => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  data,
  onEdit,
  onCheckIn,
  onManageAttendees,
}) => {
  const { event, metrics, ticketTypes } = data;

  const [images, setImages] = useState<Array<{ url: string; name: string }>>([]);
  const [videos, setVideos] = useState<Array<{ url: string; name: string }>>([]);

  const attendeeCount = metrics.confirmedAttendees ?? event.registeredCount ?? 0;
  const invitedCount = attendeeCount;
  const attendedCount = metrics.checkedInCount ?? 0;
  const grossRev = metrics.totalRevenue ?? 0;

  // Format date
  const eventDateObj = new Date(event.eventDate.replace(' ', 'T'));
  const dateFormatted = eventDateObj.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 text-[#111827]">
      {/* LEFT COLUMN */}
      <div className="space-y-4">
        {/* 1. General Information Card */}
        <Card className="p-5 bg-white border border-[#E5E7EB] shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-[#0A2540]">General Information</h3>
            <button
              onClick={() => (onEdit ? onEdit() : toast.info('Edit Event opened'))}
              className="p-1 rounded-md hover:bg-gray-100 text-[#D97706] cursor-pointer"
            >
              <Pencil size={14} />
            </button>
          </div>
          <div className="divide-y divide-[#F3F4F6] text-xs">
            <div className="flex justify-between py-2">
              <span className="text-[#6B7280]">Name</span>
              <span className="font-semibold text-right text-[#111827]">{event.title}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-[#6B7280]">Status</span>
              <span className="font-semibold text-right capitalize text-[#111827]">
                {event.status === 'published' ? 'Upcoming' : event.status}
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-[#6B7280]">Publish Date</span>
              <span className="text-right text-[#6B7280]">—</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-[#6B7280]">Category</span>
              <span className="font-semibold text-right text-[#111827]">{event.category || 'Networking'}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-[#6B7280]">Calendar</span>
              <span className="font-semibold text-right text-[#111827]">
                Association Events Calendar, Chapter Events
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-[#6B7280]">Created By</span>
              <span className="font-semibold text-right text-[#111827]">Chamber Admin</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-[#6B7280]">Created Date</span>
              <span className="text-right text-[#6B7280]">—</span>
            </div>
          </div>
        </Card>

        {/* 2. Description Card */}
        <Card className="p-5 bg-white border border-[#E5E7EB] shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-[#0A2540]">Description</h3>
            <button
              onClick={() => (onEdit ? onEdit() : toast.info('Edit Description opened'))}
              className="p-1 rounded-md hover:bg-gray-100 text-[#D97706] cursor-pointer"
            >
              <Pencil size={14} />
            </button>
          </div>
          <p className="text-xs leading-relaxed text-[#4B5563]">
            {event.description ||
              'Join fellow chamber members for our monthly mixer — light refreshments, open networking, and a short round of member introductions.'}
          </p>
        </Card>

        {/* 3. Tickets & Sponsorship Packages Card */}
        <Card className="p-5 bg-white border border-[#E5E7EB] shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-[#0A2540]">Tickets & Sponsorship Packages</h3>
            <button
              onClick={() => (onEdit ? onEdit() : toast.info('Edit Packages opened'))}
              className="p-1 rounded-md hover:bg-gray-100 text-[#D97706] cursor-pointer"
            >
              <Pencil size={14} />
            </button>
          </div>
          {ticketTypes.length === 0 ? (
            <p className="text-xs italic text-[#6B7280]">
              No ticket types or custom packages configured — this event uses its single fee.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[#6B7280] border-b border-[#F3F4F6]">
                    <th className="text-left font-semibold pb-1.5">Item</th>
                    <th className="text-left font-semibold pb-1.5">Price</th>
                    <th className="text-left font-semibold pb-1.5">Sold</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F4F6]">
                  {ticketTypes.map((t) => (
                    <tr key={t.id}>
                      <td className="py-2 text-[#111827] font-medium">{t.name}</td>
                      <td className="py-2 text-[#4B5563]">${t.price.toFixed(2)}</td>
                      <td className="py-2 text-[#4B5563]">{t.sold}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* 4. Bookings & Outstanding Payments Card */}
        <Card className="p-5 bg-white border border-[#E5E7EB] shadow-xs">
          <h3 className="text-sm font-bold text-[#0A2540] mb-2">Bookings & Outstanding Payments</h3>
          <p className="text-xs italic text-[#6B7280]">No ticket or package bookings yet.</p>
        </Card>

        {/* 5. Exhibitors Card */}
        <Card className="p-5 bg-white border border-[#E5E7EB] shadow-xs">
          <h3 className="text-sm font-bold text-[#0A2540] mb-3">Exhibitors</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[#6B7280] border-b border-[#F3F4F6]">
                  <th className="text-left font-semibold pb-1.5">Name</th>
                  <th className="text-left font-semibold pb-1.5">Available</th>
                  <th className="text-left font-semibold pb-1.5">Sold</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={3} className="py-2 text-xs italic text-[#6B7280]">
                    None to display
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>

        {/* 6. Videos Card */}
        <Card className="p-5 bg-white border border-[#E5E7EB] shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-[#0A2540]">Videos</h3>
            <button
              onClick={() => toast.info('Video uploader active in production storage.')}
              className="text-xs font-semibold inline-flex items-center gap-1 text-[#0284C7] hover:underline cursor-pointer"
            >
              <Plus size={12} /> Upload
            </button>
          </div>
          <div
            className="rounded-xl flex items-center justify-center h-48"
            style={{ background: '#0F172A' }}
          >
            <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-md cursor-pointer hover:scale-105 transition">
              <PlayCircle size={26} color="#0A2540" />
            </div>
          </div>
        </Card>
      </div>

      {/* RIGHT COLUMN */}
      <div className="space-y-4">
        {/* 1. Registrations Breakdown Table Card */}
        <Card className="p-5 bg-white border border-[#E5E7EB] shadow-xs">
          <h3 className="text-sm font-bold text-[#0A2540] mb-3">Registrations</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[#6B7280] border-b border-[#F3F4F6]">
                  <th className="text-left font-semibold pb-2">Name</th>
                  <th className="text-left font-semibold pb-2">Invited</th>
                  <th className="text-left font-semibold pb-2">Registered</th>
                  <th className="text-left font-semibold pb-2">Attended</th>
                  <th className="text-left font-semibold pb-2">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {ticketTypes.length > 0 ? (
                  ticketTypes.map((t) => (
                    <tr key={t.id}>
                      <td className="py-2.5 font-medium text-[#111827]">{t.name}</td>
                      <td className="py-2.5 text-[#4B5563]">{t.available ?? '—'}</td>
                      <td className="py-2.5 text-[#4B5563]">{t.sold}</td>
                      <td className="py-2.5 text-[#4B5563]">—</td>
                      <td className="py-2.5 font-semibold text-[#111827]">${(t.sold * t.price).toFixed(2)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="py-2.5 font-medium text-[#111827]">General Registration</td>
                    <td className="py-2.5 text-[#4B5563]">{event.maxCapacity ?? '—'}</td>
                    <td className="py-2.5 text-[#4B5563]">{attendeeCount}</td>
                    <td className="py-2.5 text-[#4B5563]">{attendedCount}</td>
                    <td className="py-2.5 font-semibold text-[#111827]">${grossRev.toFixed(2)}</td>
                  </tr>
                )}
                <tr className="font-bold text-[#111827] bg-[#F9FAFB]">
                  <td className="py-2.5">Total</td>
                  <td className="py-2.5">{event.maxCapacity ?? '—'}</td>
                  <td className="py-2.5">{attendeeCount}</td>
                  <td className="py-2.5">{attendedCount}</td>
                  <td className="py-2.5">${grossRev.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>

        {/* 2. Contact Information Card */}
        <Card className="p-5 bg-white border border-[#E5E7EB] shadow-xs">
          <h3 className="text-sm font-bold text-[#0A2540] mb-3">Contact Information</h3>
          <div className="divide-y divide-[#F3F4F6] text-xs">
            <div className="flex justify-between py-2">
              <span className="text-[#6B7280]">Organization</span>
              <span className="font-semibold text-right text-[#111827]">Chamber (Headquarters)</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-[#6B7280]">Person</span>
              <span className="font-semibold text-right text-[#111827]">Chamber Admin</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-[#6B7280]">Contact Email</span>
              <span className="font-semibold text-right text-[#111827]">events@chamber.org</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-[#6B7280]">Contact Phone</span>
              <span className="font-semibold text-right text-[#111827]">(512) 555-0100</span>
            </div>
          </div>
        </Card>

        {/* 3. Hours Card */}
        <Card className="p-5 bg-white border border-[#E5E7EB] shadow-xs">
          <h3 className="text-sm font-bold text-[#0A2540] mb-3">Hours</h3>
          <div className="divide-y divide-[#F3F4F6] text-xs">
            <div className="flex justify-between py-2">
              <span className="text-[#6B7280]">Start Date/Time</span>
              <span className="font-semibold text-right text-[#111827]">{dateFormatted}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-[#6B7280]">End Date/Time</span>
              <span className="font-semibold text-right text-[#111827]">{dateFormatted}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-[#6B7280]">All Day Event</span>
              <span className="font-semibold text-right text-[#111827]">
                {event.isAllDay ? 'Yes' : 'No'}
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-[#6B7280]">Location</span>
              <span className="font-semibold text-right text-[#111827]">
                {event.venue ? `${event.venue}, ${event.city}` : event.city || 'Austin'}
              </span>
            </div>
          </div>
        </Card>

        {/* 4. Images Card */}
        <Card className="p-5 bg-white border border-[#E5E7EB] shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-[#0A2540]">Images</h3>
            <button
              onClick={() => toast.info('Image uploader active in production storage.')}
              className="text-xs font-semibold inline-flex items-center gap-1 text-[#0284C7] hover:underline cursor-pointer"
            >
              <Plus size={12} /> Add
            </button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="aspect-square rounded-xl flex items-center justify-center bg-[#F3F4F6] border border-[#E5E7EB]"
              >
                <ImageIcon size={22} className="text-[#9CA3AF]" />
              </div>
            ))}
          </div>
        </Card>

        {/* Action Buttons Row */}
        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={() => (onCheckIn ? onCheckIn() : toast.info('QR Check-In modal opened'))}
            className="flex-1 py-2.5 px-4 rounded-xl border border-[#E5E7EB] bg-white hover:bg-gray-50 text-xs font-semibold inline-flex items-center justify-center gap-2 text-[#111827] cursor-pointer shadow-xs"
          >
            <ScanLine size={15} /> QR Check-In
          </button>
          <button
            type="button"
            onClick={() => (onEdit ? onEdit() : toast.info('Edit Event opened'))}
            className="flex-1 py-2.5 px-4 rounded-xl border border-[#E5E7EB] bg-white hover:bg-gray-50 text-xs font-semibold inline-flex items-center justify-center gap-2 text-[#111827] cursor-pointer shadow-xs"
          >
            Edit Event
          </button>
        </div>
      </div>
    </div>
  );
};

export default OverviewTab;
