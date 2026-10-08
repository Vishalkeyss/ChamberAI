import { drizzle } from 'drizzle-orm/d1';
import { and, eq } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import { tasks, activityLogs, users } from '../../../db/schema';
import { AppError, ErrorCodes } from '../../../core/shared/errors';
import { newId } from '../../../core/shared/ids';
import { TasksRepository } from '../repositories/tasks.repository';
import { TASK_PRIORITIES, TASK_STATUSES, type CreateTaskInput, type UpdateTaskInput } from '../validation/tasks.validation';

type TaskRow = NonNullable<Awaited<ReturnType<typeof TasksRepository.find>>>;

const blankToNull = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

/** Prompt 05.5 — personal Kanban tasks (private to the owner, §7.1). */
export class TasksService {
  private static async requireOwner(d1: D1Database, chamberId: string, userId: string) {
    const me = await drizzle(d1)
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.chamberId, chamberId), eq(users.id, userId), eq(users.status, 'active')))
      .get();
    if (!me) throw new AppError(ErrorCodes.FORBIDDEN, 'Only active chamber users have a task board', 403);
  }

  private static async requireTask(d1: D1Database, chamberId: string, userId: string, id: string): Promise<TaskRow> {
    const row = await TasksRepository.find(d1, chamberId, userId, id);
    if (!row) throw new AppError(ErrorCodes.NOT_FOUND, 'Task not found', 404);
    return row;
  }

  private static async contactName(d1: D1Database, chamberId: string, userId: string, contactId: string | null | undefined) {
    if (!contactId) return null;
    const contact = await TasksRepository.findOwnContact(d1, chamberId, userId, contactId);
    if (!contact) throw new AppError(ErrorCodes.NOT_FOUND, 'CRM contact not found', 404);
    return contact.name;
  }

  private static toDto(row: TaskRow, contactName: string | null) {
    return {
      id: row.id,
      crm_contact_id: row.crmContactId,
      crm_contact_name: row.crmContactId ? contactName : null,
      title: row.title,
      description: row.description,
      status: row.status,
      priority: row.priority,
      due_date: row.dueDate,
      completed_at: row.completedAt,
      sort_order: row.sortOrder,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    };
  }

  /** §9.4 */
  static async list(d1: D1Database, chamberId: string, userId: string, opts: { status?: string; priority?: string }) {
    await this.requireOwner(d1, chamberId, userId);
    // Spec query value "completed" maps to the canonical `done` (OD-084).
    const status = opts.status === 'completed' ? 'done' : opts.status;
    if (status && !(TASK_STATUSES as readonly string[]).includes(status)) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Invalid status filter', 422);
    }
    if (opts.priority && !(TASK_PRIORITIES as readonly string[]).includes(opts.priority)) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Invalid priority filter', 422);
    }
    const rows = await TasksRepository.list(d1, chamberId, userId, { status, priority: opts.priority });
    return rows.map((r) => this.toDto(r.task, r.contactName));
  }

  /** §9.5 */
  static async create(d1: D1Database, chamberId: string, userId: string, input: CreateTaskInput) {
    await this.requireOwner(d1, chamberId, userId);
    const contactName = await this.contactName(d1, chamberId, userId, input.crm_contact_id);
    const db = drizzle(d1);
    const id = await newId(d1, 'tasks', 'TASK', { chamberId });
    const now = new Date().toISOString();
    const statements: BatchItem<'sqlite'>[] = [
      db.insert(tasks).values({
        id,
        chamberId,
        userId,
        crmContactId: input.crm_contact_id || null,
        title: input.title,
        description: blankToNull(input.description),
        status: input.status,
        priority: input.priority,
        dueDate: blankToNull(input.due_date),
        completedAt: input.status === 'done' ? now : null,
        createdAt: now,
        updatedAt: now,
      }),
    ];
    if (input.status === 'done') statements.push(this.completedAudit(db, await newId(d1, 'activity_logs', 'ACT', { chamberId, suffixLength: 6, skipUniqueCheck: true }), chamberId, userId, id));
    await db.batch(statements as [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]]);
    return this.toDto((await TasksRepository.find(d1, chamberId, userId, id))!, contactName);
  }

  /** Sync on purpose: an async function would await (execute) the Drizzle builder instead of batching it. */
  private static completedAudit(db: ReturnType<typeof drizzle>, logId: string, chamberId: string, userId: string, taskId: string) {
    return db.insert(activityLogs).values({
      id: logId,
      chamberId,
      userId,
      action: 'TASK_COMPLETED',
      targetType: 'task',
      targetId: taskId,
    });
  }

  /** PATCH /tasks/:id — move between columns, quick-complete, edit. §7.2 completion hook. */
  static async update(d1: D1Database, chamberId: string, userId: string, id: string, input: UpdateTaskInput) {
    const row = await this.requireTask(d1, chamberId, userId, id);
    if (input.crm_contact_id) await this.contactName(d1, chamberId, userId, input.crm_contact_id);
    const db = drizzle(d1);
    const now = new Date().toISOString();
    const patch: Partial<typeof tasks.$inferInsert> = { updatedAt: now };
    if (input.title !== undefined) patch.title = input.title;
    if (input.description !== undefined) patch.description = blankToNull(input.description);
    if (input.crm_contact_id !== undefined) patch.crmContactId = input.crm_contact_id || null;
    if (input.priority !== undefined) patch.priority = input.priority;
    if (input.due_date !== undefined) patch.dueDate = blankToNull(input.due_date);
    if (input.sort_order !== undefined) patch.sortOrder = input.sort_order;

    const becameDone = input.status === 'done' && row.status !== 'done';
    if (input.status !== undefined) {
      patch.status = input.status;
      if (becameDone) patch.completedAt = now;
      else if (input.status !== 'done') patch.completedAt = null;
    }

    const statements: BatchItem<'sqlite'>[] = [
      db.update(tasks).set(patch).where(and(eq(tasks.chamberId, chamberId), eq(tasks.userId, userId), eq(tasks.id, id))),
    ];
    if (becameDone) statements.push(this.completedAudit(db, await newId(d1, 'activity_logs', 'ACT', { chamberId, suffixLength: 6, skipUniqueCheck: true }), chamberId, userId, id));
    await db.batch(statements as [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]]);

    const updated = (await TasksRepository.find(d1, chamberId, userId, id))!;
    const contactName = updated.crmContactId
      ? (await TasksRepository.findOwnContact(d1, chamberId, userId, updated.crmContactId))?.name ?? null
      : null;
    return this.toDto(updated, contactName);
  }

  static async remove(d1: D1Database, chamberId: string, userId: string, id: string) {
    await this.requireTask(d1, chamberId, userId, id);
    await drizzle(d1)
      .delete(tasks)
      .where(and(eq(tasks.chamberId, chamberId), eq(tasks.userId, userId), eq(tasks.id, id)))
      .run();
    return { id, deleted: true };
  }
}
