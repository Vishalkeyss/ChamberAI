import React from 'react';
import { Building2, CalendarClock, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { formatMoney } from '@/features/events/services/events.api';
import { CRM_STAGES, CRM_STAGE_LABELS, todayIso, type CrmContact, type CrmStage } from '../services/crm.api';

interface ContactCardProps {
  contact: CrmContact;
  currency: string | null;
  onOpen: (contact: CrmContact) => void;
  onMove: (contact: CrmContact, stage: CrmStage) => void;
}

export function formatShortDate(value: string | null): string {
  if (!value) return '';
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Prompt 05.5 §5 deal card: name, company, value, last interaction, next follow-up chip. Draggable (OD-085). */
export const ContactCard: React.FC<ContactCardProps> = ({ contact, currency, onOpen, onMove }) => {
  const closed = contact.stage === 'won' || contact.stage === 'lost';
  const followDue = !!contact.follow_up_date && !closed && contact.follow_up_date <= todayIso();

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', contact.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onClick={() => onOpen(contact)}
      className="rounded-xl border border-border bg-card p-3 shadow-xs cursor-pointer hover:border-primary/50 transition active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{contact.name}</p>
          {contact.company_name && (
            <p className="text-xs text-muted-foreground truncate flex items-center gap-1"><Building2 size={11} /> {contact.company_name}</p>
          )}
        </div>
        {/* Touch-friendly stage move (HTML5 drag does not work on phones). */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" onClick={(e) => e.stopPropagation()} aria-label="Move to stage" className="p-1 rounded-md hover:bg-muted text-muted-foreground shrink-0">
              <MoreHorizontal size={14} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            {CRM_STAGES.filter((s) => s !== contact.stage).map((s) => (
              <DropdownMenuItem key={s} onSelect={() => onMove(contact, s)}>Move to {CRM_STAGE_LABELS[s]}</DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 mt-2">
        {contact.deal_value > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300 text-[11px] font-semibold">
            {formatMoney(contact.deal_value, currency)}
          </span>
        )}
        {contact.follow_up_date && !closed && (
          <span
            className={cn(
              'px-2 py-0.5 rounded-full text-[11px] font-semibold inline-flex items-center gap-1',
              followDue ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300' : 'bg-muted text-muted-foreground'
            )}
          >
            <CalendarClock size={11} /> Follow up {formatShortDate(contact.follow_up_date)}
          </span>
        )}
      </div>
      {contact.last_interaction_at && (
        <p className="text-[10px] text-muted-foreground mt-2">Last interaction {formatShortDate(contact.last_interaction_at)}</p>
      )}
    </div>
  );
};
