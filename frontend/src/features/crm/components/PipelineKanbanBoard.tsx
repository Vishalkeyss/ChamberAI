import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/features/events/services/events.api';
import { ContactCard } from './ContactCard';
import { CRM_STAGE_LABELS, type CrmContact, type CrmMetrics, type CrmStage } from '../services/crm.api';

interface PipelineKanbanBoardProps {
  stages: CrmStage[];
  contacts: CrmContact[];
  metrics: CrmMetrics;
  currency: string | null;
  onOpen: (contact: CrmContact) => void;
  onMove: (contact: CrmContact, stage: CrmStage) => void;
}

const STAGE_DOT: Record<CrmStage, string> = {
  lead: 'bg-slate-400',
  contacted: 'bg-blue-500',
  qualified: 'bg-violet-500',
  proposal_sent: 'bg-amber-500',
  won: 'bg-emerald-500',
  lost: 'bg-red-500',
};

/** Prompt 05.5 §5 pipeline board — native HTML5 drag between stage columns (OD-085). */
export const PipelineKanbanBoard: React.FC<PipelineKanbanBoardProps> = ({ stages, contacts, metrics, currency, onOpen, onMove }) => {
  const [over, setOver] = useState<CrmStage | null>(null);

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {stages.map((stage) => {
        const items = contacts.filter((c) => c.stage === stage);
        const summary = metrics.stage_summaries[stage];
        return (
          <div
            key={stage}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              if (over !== stage) setOver(stage);
            }}
            onDragLeave={() => setOver((s) => (s === stage ? null : s))}
            onDrop={(e) => {
              e.preventDefault();
              setOver(null);
              const id = e.dataTransfer.getData('text/plain');
              const contact = contacts.find((c) => c.id === id);
              if (contact && contact.stage !== stage) onMove(contact, stage);
            }}
            className={cn(
              'w-[250px] shrink-0 rounded-2xl border border-border bg-muted/40 p-2.5 flex flex-col transition',
              over === stage && 'ring-2 ring-primary/50 bg-primary/5'
            )}
          >
            <div className="px-1 mb-2.5">
              <div className="flex items-center gap-2">
                <span className={cn('w-2 h-2 rounded-full', STAGE_DOT[stage])} />
                <span className="text-xs font-bold uppercase tracking-wide text-foreground">{CRM_STAGE_LABELS[stage]}</span>
              </div>
              {/* §5 column summary: total deals + value (all contacts, not just the filtered view). */}
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {summary.count} {summary.count === 1 ? 'deal' : 'deals'} · {formatMoney(summary.value, currency)}
              </p>
            </div>
            <div className="space-y-2 min-h-[80px] flex-1">
              {items.length === 0 ? (
                <p className="text-[11px] text-center text-muted-foreground py-6 opacity-70">Drop a contact here</p>
              ) : (
                items.map((c) => <ContactCard key={c.id} contact={c} currency={currency} onOpen={onOpen} onMove={onMove} />)
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
