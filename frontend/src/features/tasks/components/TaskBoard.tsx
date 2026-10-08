import React, { useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TaskCard } from './TaskCard';
import { TASK_COLUMNS, TASK_STATUS_LABELS, type MemberTask, type TaskStatus } from '../services/tasks.api';

interface TaskBoardProps {
  tasks: MemberTask[];
  onMove: (task: MemberTask, status: TaskStatus) => void;
  onEdit: (task: MemberTask) => void;
  onDelete: (task: MemberTask) => void;
  onQuickAdd: (status: TaskStatus, title: string) => Promise<boolean>;
}

const COLUMN_STYLES: Record<TaskStatus, { dot: string; tint: string }> = {
  todo: { dot: 'bg-slate-400', tint: 'bg-slate-50 dark:bg-slate-500/5' },
  in_progress: { dot: 'bg-amber-500', tint: 'bg-amber-50/60 dark:bg-amber-500/5' },
  done: { dot: 'bg-emerald-500', tint: 'bg-emerald-50/60 dark:bg-emerald-500/5' },
};

const QuickAdd: React.FC<{ onAdd: (title: string) => Promise<boolean> }> = ({ onAdd }) => {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const title = value.trim();
    if (title.length < 2 || busy) return;
    setBusy(true);
    if (await onAdd(title)) setValue('');
    setBusy(false);
  };
  return (
    <div className="relative mb-2.5">
      <Plus size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        placeholder="Quick add a task…"
        maxLength={200}
        className="w-full pl-7 pr-7 py-2 rounded-lg border border-border bg-card text-sm outline-none focus:border-primary"
      />
      {busy && <Loader2 size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />}
    </div>
  );
};

/** Prompt 05.5 §5 — 3-column board with native drag between columns (OD-085) and inline quick add. */
export const TaskBoard: React.FC<TaskBoardProps> = ({ tasks, onMove, onEdit, onDelete, onQuickAdd }) => {
  const [over, setOver] = useState<TaskStatus | null>(null);
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {TASK_COLUMNS.map((status) => {
        const items = tasks.filter((t) => t.status === status);
        const style = COLUMN_STYLES[status];
        return (
          <div
            key={status}
            onDragOver={(e) => {
              e.preventDefault();
              if (over !== status) setOver(status);
            }}
            onDragLeave={() => setOver((s) => (s === status ? null : s))}
            onDrop={(e) => {
              e.preventDefault();
              setOver(null);
              const task = tasks.find((t) => t.id === e.dataTransfer.getData('text/plain'));
              if (task && task.status !== status) onMove(task, status);
            }}
            className={cn('rounded-2xl border border-border p-3 transition', style.tint, over === status && 'ring-2 ring-primary/50')}
          >
            <div className="flex items-center gap-2 px-1 mb-2.5">
              <span className={cn('w-2 h-2 rounded-full', style.dot)} />
              <span className="text-xs font-bold uppercase tracking-wide text-foreground">{TASK_STATUS_LABELS[status]}</span>
              <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-card border border-border text-muted-foreground">{items.length}</span>
            </div>
            <QuickAdd onAdd={(title) => onQuickAdd(status, title)} />
            <div className="space-y-2.5 min-h-[60px]">
              {items.length === 0 ? (
                <p className="text-xs text-center text-muted-foreground py-6 opacity-70">No tasks here</p>
              ) : (
                items.map((t) => <TaskCard key={t.id} task={t} onMove={onMove} onEdit={onEdit} onDelete={onDelete} />)
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
