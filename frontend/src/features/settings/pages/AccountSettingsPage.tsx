import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  User,
  Bell,
  Shield,
  Sparkles,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { ProfileDetailsForm } from '../components/ProfileDetailsForm';
import { NotificationMatrixTable } from '../components/NotificationMatrixTable';
import { ActiveSessionsCard } from '../components/ActiveSessionsCard';
import { ByoApiKeyCard } from '../components/ByoApiKeyModal';
import {
  fetchAccountSettings,
  updateProfile,
  updateNotificationPreferences,
  revokeActiveSession,
  savePersonalApiKey,
} from '../services/settings.api';
import type {
  AccountSettingsData,
  NotificationPreferenceItem,
  UserAccountSettingsProfile,
} from '../types';

export interface AccountSettingsPageProps {
  initialTab?: 'profile' | 'notifications' | 'security' | 'ai';
  onNavigateBack?: () => void;
}

const DEFAULT_PREFERENCES: NotificationPreferenceItem[] = [
  { category: 'announcements', channel: 'email', is_enabled: true },
  { category: 'announcements', channel: 'sms', is_enabled: false },
  { category: 'announcements', channel: 'in_app', is_enabled: true },
  { category: 'events', channel: 'email', is_enabled: true },
  { category: 'events', channel: 'sms', is_enabled: false },
  { category: 'events', channel: 'in_app', is_enabled: true },
  { category: 'invoices', channel: 'email', is_enabled: true },
  { category: 'invoices', channel: 'sms', is_enabled: true },
  { category: 'invoices', channel: 'in_app', is_enabled: true },
  { category: 'referrals', channel: 'email', is_enabled: true },
  { category: 'referrals', channel: 'sms', is_enabled: false },
  { category: 'referrals', channel: 'in_app', is_enabled: true },
  { category: 'messages', channel: 'email', is_enabled: true },
  { category: 'messages', channel: 'sms', is_enabled: true },
  { category: 'messages', channel: 'in_app', is_enabled: true },
];

export const AccountSettingsPage: React.FC<AccountSettingsPageProps> = ({
  initialTab = 'profile',
  onNavigateBack,
}) => {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // Raw saved state
  const [savedSettings, setSavedSettings] = useState<AccountSettingsData | null>(null);

  // Form mutable state
  const [profileForm, setProfileForm] = useState<UserAccountSettingsProfile>({
    id: 'usr_me',
    chamber_id: 'ch_default',
    email: '',
    name: '',
    title: '',
    phone: '',
    avatar_url: null,
    ai_credits_used: 0,
    ai_credits_limit: 5,
    personal_api_provider: null,
    has_personal_api_key: false,
  });
  const [preferencesForm, setPreferencesForm] = useState<NotificationPreferenceItem[]>(
    DEFAULT_PREFERENCES
  );
  const [activeSessions, setActiveSessions] = useState<AccountSettingsData['activeSessions']>([]);

  // Dirty detection
  const [isProfileDirty, setIsProfileDirty] = useState(false);
  const [isPrefsDirty, setIsPrefsDirty] = useState(false);
  const isDirty = isProfileDirty || isPrefsDirty;

  const [isSaving, setIsSaving] = useState(false);

  // Load account settings from API
  useEffect(() => {
    let isMounted = true;
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchAccountSettings();
        if (isMounted) {
          setSavedSettings(data);
          setProfileForm(data.profile);
          setPreferencesForm(
            data.preferences && data.preferences.length > 0
              ? data.preferences
              : DEFAULT_PREFERENCES
          );
          setActiveSessions(data.activeSessions || []);
        }
      } catch (err: any) {
        console.warn('[SETTINGS_LOAD_WARN]', err);
        // Fallback demo mock if offline / dev preview
        if (isMounted) {
          const fallbackProfile: UserAccountSettingsProfile = {
            id: 'usr_demo_01',
            chamber_id: 'ch_metro_001',
            email: 'sarah.jenkins@acmehealth.com',
            name: 'Sarah Jenkins',
            title: 'VP of Business Development',
            phone: '+1 512 555 0199',
            avatar_url: null,
            ai_credits_used: 3,
            ai_credits_limit: 5,
            personal_api_provider: null,
            has_personal_api_key: false,
          };
          const fallbackSessions = [
            {
              sessionId: 'sess_cur_123',
              isCurrent: true,
              ipAddress: '136.24.112.5',
              userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/122.0',
              lastActiveAt: new Date().toISOString(),
              createdAt: new Date(Date.now() - 3600000).toISOString(),
            },
            {
              sessionId: 'sess_mob_456',
              isCurrent: false,
              ipAddress: '172.56.21.90',
              userAgent: '121Meet Mobile App (iPhone 15 Pro, iOS 17.4)',
              lastActiveAt: new Date(Date.now() - 86400000).toISOString(),
              createdAt: new Date(Date.now() - 172800000).toISOString(),
            },
          ];
          setProfileForm(fallbackProfile);
          setActiveSessions(fallbackSessions);
          setSavedSettings({
            profile: fallbackProfile,
            preferences: DEFAULT_PREFERENCES,
            activeSessions: fallbackSessions,
          });
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleProfileChange = (updated: Partial<UserAccountSettingsProfile>) => {
    setProfileForm((prev) => ({ ...prev, ...updated }));
    setIsProfileDirty(true);
  };

  const handlePreferencesChange = (updated: NotificationPreferenceItem[]) => {
    setPreferencesForm(updated);
    setIsPrefsDirty(true);
  };

  const handleDiscardChanges = () => {
    if (savedSettings) {
      setProfileForm(savedSettings.profile);
      setPreferencesForm(savedSettings.preferences);
      setIsProfileDirty(false);
      setIsPrefsDirty(false);
    }
  };

  const handleSaveChanges = async () => {
    setIsSaving(true);
    setError(null);
    setSaveSuccessMessage(null);
    try {
      if (isProfileDirty) {
        await updateProfile({
          name: profileForm.name,
          title: profileForm.title,
          phone: profileForm.phone,
        });
      }
      if (isPrefsDirty) {
        await updateNotificationPreferences(preferencesForm);
      }

      setIsProfileDirty(false);
      setIsPrefsDirty(false);
      setSaveSuccessMessage('Settings updated successfully.');
      setTimeout(() => setSaveSuccessMessage(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to save changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      await revokeActiveSession(sessionId);
      setActiveSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
      setSaveSuccessMessage('Session revoked. The remote device has been signed out.');
      setTimeout(() => setSaveSuccessMessage(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to revoke session');
    }
  };

  const handleSaveApiKey = async (data: {
    provider: 'openai' | 'anthropic' | 'google';
    api_key: string;
  }) => {
    try {
      await savePersonalApiKey(data);
      setProfileForm((prev) => ({
        ...prev,
        personal_api_provider: data.provider,
        has_personal_api_key: true,
      }));
      setSaveSuccessMessage('Personal API key saved and encrypted.');
      setTimeout(() => setSaveSuccessMessage(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to save API key');
      throw err;
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground font-medium">Loading account settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              Account Settings
            </h1>
            <Badge variant="outline" className="font-mono text-[10px] text-primary bg-primary/5">
              PROMPT 01.4
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your personal profile details, notification preferences, sessions, and AI keys.
          </p>
        </div>

        {onNavigateBack && (
          <Button variant="outline" size="sm" onClick={onNavigateBack} className="self-start sm:self-auto">
            Back to Dashboard
          </Button>
        )}
      </div>

      {/* Global Alerts */}
      {saveSuccessMessage && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-sm flex items-center gap-2 animate-in fade-in-50">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
          <span>{saveSuccessMessage}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-2 animate-in fade-in-50">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Multi-Tab Navigation */}
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as any)} className="space-y-6">
        <TabsList className="grid grid-cols-2 md:grid-cols-4 p-1 rounded-xl bg-muted/60 border border-border/80">
          <TabsTrigger value="profile" className="rounded-lg gap-2 text-xs sm:text-sm font-medium">
            <User className="h-4 w-4" />
            <span>Profile &amp; Bio</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="rounded-lg gap-2 text-xs sm:text-sm font-medium">
            <Bell className="h-4 w-4" />
            <span>Notifications</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="rounded-lg gap-2 text-xs sm:text-sm font-medium">
            <Shield className="h-4 w-4" />
            <span>Security &amp; Sessions</span>
          </TabsTrigger>
          <TabsTrigger value="ai" className="rounded-lg gap-2 text-xs sm:text-sm font-medium">
            <Sparkles className="h-4 w-4" />
            <span>AI &amp; BYO Keys</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Profile & Bio */}
        <TabsContent value="profile" className="focus-visible:outline-none">
          <ProfileDetailsForm profile={profileForm} onChange={handleProfileChange} />
        </TabsContent>

        {/* Tab 2: Notification Preferences */}
        <TabsContent value="notifications" className="focus-visible:outline-none">
          <NotificationMatrixTable
            preferences={preferencesForm}
            onChange={handlePreferencesChange}
          />
        </TabsContent>

        {/* Tab 3: Security & Active Sessions */}
        <TabsContent value="security" className="focus-visible:outline-none">
          <ActiveSessionsCard sessions={activeSessions} onRevokeSession={handleRevokeSession} />
        </TabsContent>

        {/* Tab 4: AI & BYO API Keys */}
        <TabsContent value="ai" className="focus-visible:outline-none">
          <ByoApiKeyCard profile={profileForm} onSaveApiKey={handleSaveApiKey} />
        </TabsContent>
      </Tabs>

      {/* Sticky Save Bar (Triggers when form has unsaved modifications) */}
      {isDirty && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur px-6 py-4 shadow-2xl animate-in slide-in-from-bottom duration-200">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-foreground">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
              </span>
              <span className="font-semibold">You have unsaved changes</span>
              <span className="text-muted-foreground text-xs hidden md:inline">
                Save your changes before navigating away.
              </span>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDiscardChanges}
                disabled={isSaving}
                className="flex-1 sm:flex-none rounded-lg text-xs gap-1.5"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Discard
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSaveChanges}
                disabled={isSaving}
                className="flex-1 sm:flex-none rounded-lg text-xs gap-1.5 shadow-md"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5" /> Save Changes
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
