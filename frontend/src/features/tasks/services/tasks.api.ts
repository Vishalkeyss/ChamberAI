/**
 * Tasks API — Prompt 05.5 personal Kanban. Status `done` is the canonical value (OD-084).
 */
import { apiRequest } from '@/features/crm/services/crm.api';

export const TASK_COLUMNS = ['todo', 'in_progress', 'done'] as const;
export type TaskStatus = (typeof TASK_COLUMNS)[number];
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = { todo: 'To Do', in_progress: 'In Progress', done: 'Done' };
export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = { urgent: 'Urgent', high: 'High', medium: 'Medium', low: 'Low' };

export interface MemberTask {
  id: string;
  crm_contact_id: string | null;
  crm_contact_name: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  completed_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string | null;
}

export interface TaskInput {
  title: string;
  description?: string | null;
  crm_contact_id?: string | null;
  priority?: TaskPriority;
  status?: TaskStatus;
  due_date?: string | null;
}

export const fetchTasks = () => apiRequest<MemberTask[]>('/api/v1/tasks', {}, 'Failed to load tasks');

export const createTask = (input: TaskInput) =>
  apiRequest<MemberTask>('/api/v1/tasks', { method: 'POST', body: JSON.stringify(input) }, 'Failed to add task');

export const updateTask = (id: string, input: Partial<TaskInput>) =>
  apiRequest<MemberTask>(`/api/v1/tasks/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input) }, 'Failed to update task');

export const deleteTask = (id: string) =>
  apiRequest<{ id: string }>(`/api/v1/tasks/${encodeURIComponent(id)}`, { method: 'DELETE' }, 'Failed to delete task');
