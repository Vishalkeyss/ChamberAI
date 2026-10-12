export interface EventListItem {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  visibility: string | null;
  eventDate: string;
  eventEndDate: string | null;
  isAllDay: number;
  city: string | null;
  venue: string | null;
  isVirtual: number;
  virtualMeetingUrl?: string | null;
  chapterId: string | null;
  chapterName?: string | null;
  coverImageUrl: string | null;
  registrationFee: number;
  nonMemberFee?: number | null;
  isPaid: number;
  registeredCount: number;
  maxCapacity: number | null;
  status: string | null;
  isSoldOut: boolean;
  spotsRemaining: number | null;
  allowNonMemberRegistration: number;
  ticketTypes: EventTicketTypeItem[];
  /** The signed-in member's own registration for this event (member list only; null = not registered). */
  myRegistration?: MyEventRegistration | null;
}

/** Prompt 04.3 (OD-025): ticket tiers exposed with each event for the registration modal. */
export interface EventTicketTypeItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  allowPayLater: number;
  qtyLimit: number | null;
  qtyRemaining: number | null;
}

export interface EventsListResponse {
  data: EventListItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    /** Prompt 04.3 §8 points value, so clients never duplicate the constant */
    pointRedemptionValue: number;
  };
}

export function getEventCapacityStatus(
  registered: number,
  max: number | null
): { isSoldOut: boolean; spotsRemaining: number | null } {
  if (max === null || max <= 0) return { isSoldOut: false, spotsRemaining: null };
  const remaining = Math.max(0, max - registered);
  return { isSoldOut: remaining === 0, spotsRemaining: remaining };
}

/**
 * Prompt 04.2 Section 8: Check-in QR Hash Validator
 */
export function verifyCheckInQr(qrHash: string, eventId: string): boolean {
  return qrHash.startsWith(`EVT-${eventId.slice(-6)}-`);
}

export interface AdminEventOverviewData {
  event: {
    id: string;
    title: string;
    description: string | null;
    category: string | null;
    visibility: string | null;
    status: string;
    eventDate: string;
    eventEndDate: string | null;
    isAllDay: number;
    venue: string | null;
    city: string | null;
    chapterId: string | null;
    groupId: string | null;
    maxCapacity: number | null;
    registeredCount: number;
    registrationFee: number;
    isPaid: number;
  };
  metrics: {
    totalRevenue: number;
    confirmedAttendees: number;
    waitlistedCount: number;
    checkedInCount: number;
    avgFeedbackRating: number;
    totalFeedbackCount: number;
  };
  ticketTypes: Array<{
    id: string;
    name: string;
    price: number;
    sold: number;
    available: number | null;
    allowPayLater: number;
  }>;
}

export interface AttendeeListItem {
  id: string;
  guestName: string;
  guestEmail: string;
  companyName: string | null;
  registrationType: string;
  ticketTypeId: string | null;
  ticketTypeName: string | null;
  amountPaid: number;
  discountAmount: number;
  paymentStatus: string;
  checkInStatus: string;
  isCheckedIn: boolean;
  checkedInAt: string | null;
  isWaitlisted: boolean;
  waitlistPosition: number | null;
  createdAt: string;
}

export interface WaitlistListItem {
  id: string;
  guestName: string;
  guestEmail: string;
  companyName: string | null;
  ticketTypeId: string | null;
  ticketTypeName: string | null;
  waitlistPosition: number | null;
  createdAt: string;
}

export interface EventFeedbackItem {
  id: string;
  userId: string;
  userName?: string;
  starRating: number;
  likedMost: string | null;
  wouldAttendAgain: boolean;
  suggestions: string | null;
  createdAt: string;
}

export interface EventSponsorItem {
  id: string;
  sponsorName: string;
  tierId: string | null;
  tierName?: string | null;
  amount: number;
  status: string;
  paymentDate: string | null;
}

export interface MyEventRegistration {
  status: 'confirmed' | 'waitlisted';
  waitlistPosition: number | null;
  paymentStatus: string | null;
  checkedIn: boolean;
}
