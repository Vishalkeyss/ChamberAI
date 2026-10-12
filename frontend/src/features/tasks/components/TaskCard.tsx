import React from 'react';
import { CalendarDays, Check, MoreHorizontal, UserRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { todayIso } from '@/features/crm/services/crm.api';
import { TASK_COLUMNS, TASK_PRIORITY_LABELS, TASK_STATUS_LABELS, type MemberTask, type TaskStatus } from '../services/tasks.api';

/** §5 priority colours: Urgent red, High orange, Medium blue, Low grey. */
export const PRIORITY_STYLES: Record<MemberTask['priority'], string> = {
  urgent: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
  medium: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  low: 'bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300',
};

interface TaskCardProps {
  task: MemberTask;
  onMove: (task: MemberTask, status: TaskStatus) => void;
  onEdit: (task: MemberTask) => void;
  onDelete: (task: MemberTask) => void;
}

function dueLabel(due: string): string {
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(due) ? `${due}T00:00:00` : due);
  return Number.isNaN(d.getTime()) ? due : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Prompt 05.5 §5 task card — priority badge, due indicator (red if overdue), contact chip, quick-complete. */
export const TaskCard: React.FC<TaskCardProps> = ({ task, onMove, onEdit, onDelete }) => {
  const done = task.status === 'done';
  const dueDay = task.due_date?.slice(0, 10) || null;
  const today = todayIso();
  const overdue = !done && !!dueDay && dueDay < today;
  const dueToday = !done && dueDay === today;

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', task.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      className="rounded-xl border border-border bg-card p-3 shadow-xs hover:border-primary/40 transition"
    >
      <div className="flex items-start gap-2.5">
        <button
          type="button"
          aria-label={done ? 'Mark as not done' : 'Mark as done'}
          onClick={() => onMove(task, done ? 'todo' : 'done')}
          className={cn(
            'mt-0.5 w-[18px] h-[18px] rounded border flex items-center justify-center shrink-0 transition',
            done ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-border hover:border-primary'
          )}
        >
          {done && <Check size={12} />}
        </button>
        <button type="button" onClick={() => onEdit(task)} className="flex-1 min-w-0 text-left">
          <p className={cn('text-sm font-semibold text-foreground break-words', done && 'line-through text-muted-foreground')}>{task.title}</p>
          {task.description && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{task.description}</p>}
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-label="Task actions" className="p-1 rounded-md hover:bg-muted text-muted-foreground shrink-0"><MoreHorizontal size={14} /></button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {TASK_COLUMNS.filter((s) => s !== task.status).map((s) => (
              <DropdownMenuItem key={s} onSelect={() => onMove(task, s)}>Move to {TASK_STATUS_LABELS[s]}</DropdownMenuItem>
            ))}
            <DropdownMenuItem onSelect={() => onEdit(task)}>Edit</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onDelete(task)} className="text-destructive">Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 mt-2.5 pl-7">
        <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide', PRIORITY_STYLES[task.priority])}>
          {TASK_PRIORITY_LABELS[task.priority]}
        </span>
        {dueDay && (
          <span
            className={cn(
              'px-2 py-0.5 rounded-full text-[11px] font-semibold inline-flex items-center gap-1',
              overdue ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300' : dueToday ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300' : 'bg-muted text-muted-foreground'
            )}
          >
            <CalendarDays size={11} /> {overdue ? 'Overdue · ' : dueToday ? 'Today · ' : ''}{dueLabel(dueDay)}
          </span>
        )}
        {task.crm_contact_name && (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary inline-flex items-center gap-1 max-w-full truncate">
            <UserRound size={11} /> {task.crm_contact_name}
          </span>
        )}
      </div>
    </div>
  );
};
