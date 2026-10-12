import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import type { CrmContact } from '@/features/crm/services/crm.api';
import {
  TASK_COLUMNS,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  createTask,
  updateTask,
  type MemberTask,
  type TaskPriority,
  type TaskStatus,
} from '../services/tasks.api';

interface TaskFormModalProps {
  open: boolean;
  task: MemberTask | null;
  contacts: CrmContact[];
  onClose: () => void;
  onSaved: () => void;
}

const PRIORITIES: TaskPriority[] = ['urgent', 'high', 'medium', 'low'];

/** Create / edit a personal task, optionally linked to one of the member's CRM contacts. */
export const TaskFormModal: React.FC<TaskFormModalProps> = ({ open, task, contacts, onClose, onSaved }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [dueDate, setDueDate] = useState('');
  const [contactId, setContactId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(task?.title || '');
    setDescription(task?.description || '');
    setPriority(task?.priority || 'medium');
    setStatus(task?.status || 'todo');
    setDueDate(task?.due_date?.slice(0, 10) || '');
    setContactId(task?.crm_contact_id || '');
  }, [open, task]);

  const save = async () => {
    if (title.trim().length < 2) return toast.error('Task title is required');
    setSaving(true);
    const input = {
      title: title.trim(),
      description: description.trim() || null,
      priority,
      status,
      due_date: dueDate || null,
      crm_contact_id: contactId || null,
    };
    try {
      if (task) await updateTask(task.id, input);
      else await createTask(input);
      toast.success(task ? 'Task updated' : 'Task added to your board');
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save task');
    } finally {
      setSaving(false);
    }
  };

  const input = 'w-full px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:border-primary';
  const label = 'block text-xs font-semibold text-foreground mb-1';

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !saving && onClose()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogTitle>{task ? 'Edit Task' : 'New Task'}</DialogTitle>
        <DialogDescription>Only visible to you — your personal chamber workspace.</DialogDescription>
        <div className="space-y-3">
          <div><label className={label}>Title *</label><input className={input} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} autoFocus /></div>
          <div><label className={label}>Description</label><textarea className={`${input} min-h-[70px]`} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Priority</label>
              <select className={input} value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{TASK_PRIORITY_LABELS[p]}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>Status</label>
              <select className={input} value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
                {TASK_COLUMNS.map((s) => <option key={s} value={s}>{TASK_STATUS_LABELS[s]}</option>)}
              </select>
            </div>
            <div><label className={label}>Due date</label><input className={input} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
            <div>
              <label className={label}>CRM contact</label>
              <select className={input} value={contactId} onChange={(e) => setContactId(e.target.value)}>
                <option value="">None</option>
                {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}{c.company_name ? ` · ${c.company_name}` : ''}</option>)}
              </select>
            </div>
          </div>
          <button type="button" onClick={save} disabled={saving} className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50">
            {saving && <Loader2 size={14} className="animate-spin" />} {task ? 'Save Task' : 'Add Task'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
