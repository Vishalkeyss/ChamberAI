import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { fetchCrmContacts, type CrmContact } from '@/features/crm/services/crm.api';
import { TaskBoard } from '../components/TaskBoard';
import { TaskFormModal } from '../components/TaskFormModal';
import {
  TASK_COLUMNS,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  createTask,
  deleteTask,
  fetchTasks,
  updateTask,
  type MemberTask,
  type TaskPriority,
  type TaskStatus,
} from '../services/tasks.api';

/** Prompt 05.5 — personal Kanban tasks (`/portal/tasks`). */
export const KanbanTasksPage: React.FC = () => {
  const [tasks, setTasks] = useState<MemberTask[]>([]);
  const [contacts, setContacts] = useState<CrmContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [priority, setPriority] = useState<'' | TaskPriority>('');
  const [editing, setEditing] = useState<MemberTask | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      setTasks(await fetchTasks());
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    fetchCrmContacts()
      .then((d) => setContacts(d.contacts))
      .catch(() => setContacts([]));
  }, [load]);

  /** Optimistic column move; §7.2 completed_at comes back from the server. */
  const move = async (task: MemberTask, status: TaskStatus) => {
    const previous = tasks;
    setTasks((all) => all.map((t) => (t.id === task.id ? { ...t, status } : t)));
    try {
      const updated = await updateTask(task.id, { status });
      setTasks((all) => all.map((t) => (t.id === task.id ? updated : t)));
      if (status === 'done') toast.success('Task completed');
    } catch (err: any) {
      setTasks(previous);
      toast.error(err.message || 'Failed to move task');
    }
  };

  const remove = async (task: MemberTask) => {
    const previous = tasks;
    setTasks((all) => all.filter((t) => t.id !== task.id));
    try {
      await deleteTask(task.id);
      toast.success('Task deleted');
    } catch (err: any) {
      setTasks(previous);
      toast.error(err.message || 'Failed to delete task');
    }
  };

  const quickAdd = async (status: TaskStatus, title: string) => {
    try {
      const created = await createTask({ title, status });
      setTasks((all) => [created, ...all]);
      return true;
    } catch (err: any) {
      toast.error(err.message || 'Failed to add task');
      return false;
    }
  };

  const q = query.trim().toLowerCase();
  const filtered = tasks.filter(
    (t) =>
      (!priority || t.priority === priority) &&
      (!q || [t.title, t.description, t.crm_contact_name].join(' ').toLowerCase().includes(q))
  );
  const total = tasks.length;
  const doneCount = tasks.filter((t) => t.status === 'done').length;
  const pct = total ? Math.round((doneCount / total) * 100) : 0;
  const allDone = total > 0 && doneCount === total;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">My Tasks</h1>
            <p className="text-sm text-muted-foreground">Plan, track and close chamber-related work — visible only to you.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tasks or contacts…" className="pl-9 pr-3 py-2 rounded-lg border border-border bg-background text-sm outline-none w-56 focus:border-primary" />
            </div>
            <select value={priority} onChange={(e) => setPriority(e.target.value as '' | TaskPriority)} aria-label="Filter by priority" className="px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none">
              <option value="">All priorities</option>
              {(['urgent', 'high', 'medium', 'low'] as TaskPriority[]).map((p) => <option key={p} value={p}>{TASK_PRIORITY_LABELS[p]}</option>)}
            </select>
            <button type="button" onClick={() => { setEditing(null); setFormOpen(true); }} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold flex items-center gap-1.5">
              <Plus size={15} /> New Task
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {TASK_COLUMNS.map((s) => (
            <div key={s} className="rounded-xl border border-border bg-muted/30 px-4 py-3 flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">{TASK_STATUS_LABELS[s]}</span>
              <span className="text-lg font-bold text-foreground">{tasks.filter((t) => t.status === s).length}</span>
            </div>
          ))}
          <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-muted-foreground">Completion</span>
              <span className="text-xs font-bold text-foreground">{pct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} /></div>
          </div>
        </div>
      </div>

      {allDone && <div className="rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-200 p-3 text-sm text-center">All tasks completed! Enjoy the clear board.</div>}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">{[0, 1, 2].map((i) => <div key={i} className="h-64 rounded-2xl bg-muted animate-pulse" />)}</div>
      ) : error ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <button type="button" onClick={() => load()} className="mt-2 text-sm font-semibold text-primary hover:underline">Retry</button>
        </div>
      ) : (
        <TaskBoard tasks={filtered} onMove={move} onEdit={(t) => { setEditing(t); setFormOpen(true); }} onDelete={remove} onQuickAdd={quickAdd} />
      )}

      <TaskFormModal open={formOpen} task={editing} contacts={contacts} onClose={() => setFormOpen(false)} onSaved={() => load(true)} />
    </div>
  );
};
