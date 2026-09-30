export type NotificationChannel = 'email' | 'sms' | 'in_app';
export type NotificationCategory = 'announcements' | 'events' | 'invoices' | 'referrals' | 'messages';

export interface NotificationPreferenceItem {
  category: NotificationCategory;
  channel: NotificationChannel;
  is_enabled: boolean;
}

export interface ActiveSessionItem {
  sessionId: string;
  isCurrent: boolean;
  ipAddress: string;
  userAgent: string;
  lastActiveAt: string;
  createdAt: string;
}

export interface UserAccountSettingsProfile {
  id: string;
  chamber_id: string;
  email: string;
  name: string;
  title: string | null;
  phone: string | null;
  avatar_url: string | null;
  ai_credits_used: number;
  ai_credits_limit: number;
  personal_api_provider: 'openai' | 'anthropic' | 'google' | null;
  has_personal_api_key: boolean;
}

export interface AccountSettingsData {
  profile: UserAccountSettingsProfile;
  preferences: NotificationPreferenceItem[];
  activeSessions: ActiveSessionItem[];
}
