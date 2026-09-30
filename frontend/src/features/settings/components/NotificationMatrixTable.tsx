import React from 'react';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertTriangle,
  Mail,
  MessageSquare,
  Bell,
  Calendar,
  DollarSign,
  Share2,
  Megaphone,
} from 'lucide-react';
import type {
  NotificationCategory,
  NotificationChannel,
  NotificationPreferenceItem,
} from '../types';

export interface NotificationMatrixTableProps {
  preferences: NotificationPreferenceItem[];
  onChange: (updatedPrefs: NotificationPreferenceItem[]) => void;
}

const CATEGORIES: {
  key: NotificationCategory;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    key: 'announcements',
    label: 'Chamber Announcements',
    description: 'Executive bulletins, policy updates, and general notices',
    icon: Megaphone,
  },
  {
    key: 'events',
    label: 'Events & Programs',
    description: 'Upcoming mixers, RSVP confirmations, and schedule adjustments',
    icon: Calendar,
  },
  {
    key: 'invoices',
    label: 'Billing & Invoices',
    description: 'Dues renewal notices, payment receipts, and fee updates',
    icon: DollarSign,
  },
  {
    key: 'referrals',
    label: 'Business Referrals',
    description: '1:1 networking leads and matchmaking introductions',
    icon: Share2,
  },
  {
    key: 'messages',
    label: 'Direct Messages',
    description: 'Member chats, committee notes, and direct inquiries',
    icon: MessageSquare,
  },
];

const CHANNELS: {
  key: NotificationChannel;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { key: 'email', label: 'Email', icon: Mail },
  { key: 'sms', label: 'SMS Text', icon: MessageSquare },
  { key: 'in_app', label: 'In-App / Push', icon: Bell },
];

export const NotificationMatrixTable: React.FC<NotificationMatrixTableProps> = ({
  preferences,
  onChange,
}) => {
  // Helper to find preference boolean
  const isEnabled = (cat: NotificationCategory, chan: NotificationChannel): boolean => {
    const item = preferences.find((p) => p.category === cat && p.channel === chan);
    return item ? item.is_enabled : false;
  };

  // Toggle single cell
  const handleToggle = (cat: NotificationCategory, chan: NotificationChannel) => {
    const current = isEnabled(cat, chan);
    const existingIndex = preferences.findIndex(
      (p) => p.category === cat && p.channel === chan
    );

    let updated: NotificationPreferenceItem[];
    if (existingIndex >= 0) {
      updated = preferences.map((p, idx) =>
        idx === existingIndex ? { ...p, is_enabled: !current } : p
      );
    } else {
      updated = [...preferences, { category: cat, channel: chan, is_enabled: !current }];
    }
    onChange(updated);
  };

  // Toggle entire category row
  const handleToggleRow = (cat: NotificationCategory) => {
    const allEnabled = CHANNELS.every((ch) => isEnabled(cat, ch.key));
    const targetState = !allEnabled;

    const newMap = new Map<string, boolean>();
    preferences.forEach((p) => newMap.set(`${p.category}:${p.channel}`, p.is_enabled));

    CHANNELS.forEach((ch) => {
      newMap.set(`${cat}:${ch.key}`, targetState);
    });

    const updated: NotificationPreferenceItem[] = [];
    newMap.forEach((val, key) => {
      const [c, ch] = key.split(':');
      updated.push({
        category: c as NotificationCategory,
        channel: ch as NotificationChannel,
        is_enabled: val,
      });
    });
    onChange(updated);
  };

  // Toggle entire channel column
  const handleToggleColumn = (chan: NotificationChannel) => {
    const allEnabled = CATEGORIES.every((cat) => isEnabled(cat.key, chan));
    const targetState = !allEnabled;

    const newMap = new Map<string, boolean>();
    preferences.forEach((p) => newMap.set(`${p.category}:${p.channel}`, p.is_enabled));

    CATEGORIES.forEach((cat) => {
      newMap.set(`${cat.key}:${chan}`, targetState);
    });

    const updated: NotificationPreferenceItem[] = [];
    newMap.forEach((val, key) => {
      const [c, ch] = key.split(':');
      updated.push({
        category: c as NotificationCategory,
        channel: ch as NotificationChannel,
        is_enabled: val,
      });
    });
    onChange(updated);
  };

  const isEmailInvoiceDisabled = !isEnabled('invoices', 'email');

  return (
    <div className="space-y-6">
      {/* Warning banner when invoices email is disabled */}
      {isEmailInvoiceDisabled && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-sm">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Notice regarding transactional billing notices</p>
            <p className="text-xs text-amber-700/90 dark:text-amber-400/90 mt-0.5">
              Critical billing notices, legally required tax receipts, and payment failure alerts may
              still be dispatched via transactional email regardless of preference settings.
            </p>
          </div>
        </div>
      )}

      <div className="rounded-2xl bg-card border border-border/80 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-border/80">
          <h2 className="text-lg font-bold tracking-tight">Notification Delivery Matrix</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Configure how and when the chamber reaches you across your connected devices and channels.
          </p>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="w-1/2 min-w-[240px]">Notification Category</TableHead>
                {CHANNELS.map((ch) => {
                  const Icon = ch.icon;
                  const allColEnabled = CATEGORIES.every((cat) => isEnabled(cat.key, ch.key));
                  return (
                    <TableHead key={ch.key} className="text-center min-w-[120px]">
                      <div className="flex flex-col items-center gap-1.5 py-1">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                          <Icon className="h-3.5 w-3.5 text-primary" />
                          <span>{ch.label}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleToggleColumn(ch.key)}
                          className="text-[10px] text-muted-foreground hover:text-primary transition-colors underline cursor-pointer"
                        >
                          {allColEnabled ? 'Disable all' : 'Enable all'}
                        </button>
                      </div>
                    </TableHead>
                  );
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {CATEGORIES.map((cat) => {
                const CatIcon = cat.icon;
                const allRowEnabled = CHANNELS.every((ch) => isEnabled(cat.key, ch.key));

                return (
                  <TableRow key={cat.key} className="hover:bg-muted/30">
                    <TableCell className="py-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0 mt-0.5">
                          <CatIcon className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-foreground">
                              {cat.label}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleToggleRow(cat.key)}
                              className="text-[11px] text-muted-foreground hover:text-primary transition-colors"
                              title="Toggle entire category"
                            >
                              <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-normal">
                                {allRowEnabled ? 'Turn row off' : 'Turn row on'}
                              </Badge>
                            </button>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {cat.description}
                          </p>
                        </div>
                      </div>
                    </TableCell>

                    {CHANNELS.map((ch) => {
                      const checked = isEnabled(cat.key, ch.key);
                      return (
                        <TableCell key={ch.key} className="text-center py-4">
                          <div className="flex justify-center items-center">
                            <Switch
                              checked={checked}
                              onCheckedChange={() => handleToggle(cat.key, ch.key)}
                              aria-label={`${cat.label} via ${ch.label}`}
                            />
                          </div>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};
