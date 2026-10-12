import { drizzle } from 'drizzle-orm/d1';
import { and, eq } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import { crmContacts, crmContactActivities, activityLogs } from '../../../db/schema';
import { AppError, ErrorCodes } from '../../../core/shared/errors';
import { newId } from '../../../core/shared/ids';
import { CrmContactsRepository } from '../repositories/crm-contacts.repository';
import {
  CRM_STAGES,
  stageFromDb,
  stageToDb,
  type CreateActivityInput,
  type CreateCrmContactInput,
  type CrmStage,
  type UpdateCrmContactInput,
} from '../validation/crm.validation';

type ContactRow = NonNullable<Awaited<ReturnType<typeof CrmContactsRepository.find>>>;

const STAGE_LABELS: Record<CrmStage, string> = {
  lead: 'Lead',
  contacted: 'Contacted',
  qualified: 'Qualified',
  proposal_sent: 'Proposal Sent',
  won: 'Won',
  lost: 'Lost',
};

const blankToNull = (v: string | null | undefined) => (v === undefined ? undefined : v && v.trim() ? v.trim() : null);

/** Prompt 05.5 — private per-member CRM pipeline. */
export class CrmService {
  private static async requireOwner(d1: D1Database, chamberId: string, userId: string) {
    const me = await CrmContactsRepository.findChamberUser(d1, chamberId, userId);
    if (!me) throw new AppError(ErrorCodes.FORBIDDEN, 'Only active chamber users have a CRM', 403);
  }

  /** Owner-scoped lookup: another user's contact is indistinguishable from a missing one (404). */
  private static async requireContact(d1: D1Database, chamberId: string, userId: string, id: string): Promise<ContactRow> {
    const row = await CrmContactsRepository.find(d1, chamberId, userId, id);
    if (!row) throw new AppError(ErrorCodes.NOT_FOUND, 'Contact not found', 404);
    return row;
  }

  private static async validateLinkedUser(d1: D1Database, chamberId: string, linkedUserId: string | null | undefined) {
    if (!linkedUserId) return;
    if (!(await CrmContactsRepository.findChamberUser(d1, chamberId, linkedUserId))) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Linked member not found in this chamber', 404);
    }
  }

  private static toDto(row: ContactRow, linked?: { id: string; name: string } | null, lastInteractionAt?: string | null) {
    return {
      id: row.id,
      name: row.contactName,
      company_name: row.business,
      email: row.email,
      phone: row.phone,
      stage: stageFromDb(row.stage),
      deal_value: row.dealValue,
      expected_close_date: row.expectedCloseDate,
      follow_up_date: row.followUpDate,
      notes: row.notes,
      linked_user: linked || null,
      last_interaction_at: lastInteractionAt || null,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    };
  }

  private static audit(db: ReturnType<typeof drizzle>, id: string, chamberId: string, userId: string, action: string, targetType: string, targetId: string, details?: object) {
    return db.insert(activityLogs).values({
      id,
      chamberId,
      userId,
      action,
      targetType,
      targetId,
      // IDs / stage only — never the private contact data (OD-081).
      detailsJson: details ? JSON.stringify(details) : null,
    });
  }

  /** §9.1 GET /crm/contacts — contacts (filtered) + metrics (all of the owner's contacts). */
  static async list(d1: D1Database, chamberId: string, userId: string, opts: { stage?: string; search?: string }) {
    await this.requireOwner(d1, chamberId, userId);
    const stageFilter = opts.stage && (CRM_STAGES as readonly string[]).includes(opts.stage) ? stageToDb(opts.stage as CrmStage) : undefined;
    if (opts.stage && !stageFilter) throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Invalid stage filter', 422);

    const [rows, totals] = await Promise.all([
      CrmContactsRepository.list(d1, chamberId, userId, { stage: stageFilter, search: opts.search?.slice(0, 100) }),
      CrmContactsRepository.stageTotals(d1, chamberId, userId),
    ]);
    const [interactions, linkedUsers] = await Promise.all([
      CrmContactsRepository.lastInteractions(d1, chamberId, userId, rows.map((r) => r.id)),
      CrmContactsRepository.userNames(d1, chamberId, rows.map((r) => r.linkedUserId).filter(Boolean) as string[]),
    ]);
    const lastBy = new Map(interactions.map((i) => [i.contactId, i.lastAt]));
    const linkedBy = new Map(linkedUsers.map((u) => [u.id, { id: u.id, name: u.name?.trim() || u.email }]));

    const stage_summaries = Object.fromEntries(CRM_STAGES.map((s) => [s, { count: 0, value: 0 }])) as Record<CrmStage, { count: number; value: number }>;
    for (const t of totals) {
      const s = stageFromDb(t.stage);
      stage_summaries[s].count += Number(t.count || 0);
      stage_summaries[s].value += Number(t.value || 0);
    }
    const total_contacts = CRM_STAGES.reduce((n, s) => n + stage_summaries[s].count, 0);
    const total_pipeline_value = CRM_STAGES.reduce((n, s) => n + stage_summaries[s].value, 0);
    const decided = stage_summaries.won.count + stage_summaries.lost.count;
    // §8 Win Rate % = won / (won + lost) × 100 (null until a deal is decided).
    const win_rate = decided ? Math.round((stage_summaries.won.count / decided) * 1000) / 10 : null;

    return {
      metrics: { total_pipeline_value, total_contacts, win_rate, stage_summaries },
      contacts: rows.map((r) => this.toDto(r, r.linkedUserId ? linkedBy.get(r.linkedUserId) : null, lastBy.get(r.id) || null)),
    };
  }

  /** §9.2 POST /crm/contacts */
  static async create(d1: D1Database, chamberId: string, userId: string, input: CreateCrmContactInput) {
    await this.requireOwner(d1, chamberId, userId);
    await this.validateLinkedUser(d1, chamberId, input.linked_user_id);
    const db = drizzle(d1);
    const id = await newId(d1, 'crm_contacts', 'CRM', { chamberId });
    const now = new Date().toISOString();
    const statements: BatchItem<'sqlite'>[] = [
      db.insert(crmContacts).values({
        id,
        chamberId,
        userId,
        contactName: input.name,
        business: blankToNull(input.company_name) ?? null,
        email: blankToNull(input.email) ?? null,
        phone: blankToNull(input.phone) ?? null,
        stage: stageToDb(input.stage),
        dealValue: input.deal_value,
        expectedCloseDate: blankToNull(input.expected_close_date) ?? null,
        followUpDate: blankToNull(input.follow_up_date) ?? null,
        notes: blankToNull(input.notes) ?? null,
        linkedUserId: input.linked_user_id || null,
        createdAt: now,
        updatedAt: now,
      }),
      this.audit(db, await newId(d1, 'activity_logs', 'ACT', { chamberId, suffixLength: 6, skipUniqueCheck: true }), chamberId, userId, 'CRM_CONTACT_CREATED', 'crm_contact', id, { stage: input.stage }),
    ];
    if (input.stage === 'won') {
      statements.push(this.audit(db, await newId(d1, 'activity_logs', 'ACT', { chamberId, suffixLength: 6, skipUniqueCheck: true }), chamberId, userId, 'DEAL_WON', 'crm_contact', id));
    }
    await db.batch(statements as [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]]);
    return { id, name: input.name, stage: input.stage, deal_value: input.deal_value, created_at: now };
  }

  /** PUT /crm/contacts/:id — detail drawer edits (stage changes also go through the timeline). */
  static async update(d1: D1Database, chamberId: string, userId: string, id: string, input: UpdateCrmContactInput) {
    const row = await this.requireContact(d1, chamberId, userId, id);
    await this.validateLinkedUser(d1, chamberId, input.linked_user_id);
    const db = drizzle(d1);
    const now = new Date().toISOString();
    const patch: Partial<typeof crmContacts.$inferInsert> = { updatedAt: now };
    if (input.name !== undefined) patch.contactName = input.name;
    if (input.company_name !== undefined) patch.business = blankToNull(input.company_name) ?? null;
    if (input.email !== undefined) patch.email = blankToNull(input.email) ?? null;
    if (input.phone !== undefined) patch.phone = blankToNull(input.phone) ?? null;
    if (input.deal_value !== undefined) patch.dealValue = input.deal_value;
    if (input.expected_close_date !== undefined) patch.expectedCloseDate = blankToNull(input.expected_close_date) ?? null;
    if (input.follow_up_date !== undefined) patch.followUpDate = blankToNull(input.follow_up_date) ?? null;
    if (input.notes !== undefined) patch.notes = blankToNull(input.notes) ?? null;
    if (input.linked_user_id !== undefined) patch.linkedUserId = input.linked_user_id || null;

    const statements: BatchItem<'sqlite'>[] = [
      db.update(crmContacts).set(patch).where(and(eq(crmContacts.chamberId, chamberId), eq(crmContacts.userId, userId), eq(crmContacts.id, id))),
    ];
    if (input.stage !== undefined) statements.push(...(await this.stageStatements(d1, db, row, input.stage, now)));
    await db.batch(statements as [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]]);
    return this.detail(d1, chamberId, userId, id);
  }

  /** Stage update + timeline entry + DEAL_WON audit, as batch statements. */
  private static async stageStatements(d1: D1Database, db: ReturnType<typeof drizzle>, row: ContactRow, stage: CrmStage, now: string) {
    const from = stageFromDb(row.stage);
    if (from === stage) return [];
    const { chamberId, userId, id } = row;
    const statements: BatchItem<'sqlite'>[] = [
      db.update(crmContacts).set({ stage: stageToDb(stage), updatedAt: now }).where(and(eq(crmContacts.chamberId, chamberId), eq(crmContacts.userId, userId), eq(crmContacts.id, id))),
      db.insert(crmContactActivities).values({
        id: await newId(d1, 'crm_contact_activities', 'CRMA', { chamberId, suffixLength: 6, skipUniqueCheck: true }),
        chamberId,
        userId,
        contactId: id,
        type: 'stage',
        body: `Moved from ${STAGE_LABELS[from]} to ${STAGE_LABELS[stage]}`,
        createdAt: now,
      }),
    ];
    if (stage === 'won') {
      statements.push(this.audit(db, await newId(d1, 'activity_logs', 'ACT', { chamberId, suffixLength: 6, skipUniqueCheck: true }), chamberId, userId, 'DEAL_WON', 'crm_contact', id, { from }));
    }
    return statements;
  }

  /** §9.3 PATCH /crm/contacts/:id/stage (drag between pipeline columns). */
  static async updateStage(d1: D1Database, chamberId: string, userId: string, id: string, stage: CrmStage) {
    const row = await this.requireContact(d1, chamberId, userId, id);
    const now = new Date().toISOString();
    const db = drizzle(d1);
    const statements = await this.stageStatements(d1, db, row, stage, now);
    if (statements.length) await db.batch(statements as [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]]);
    return { id, stage, updated_at: statements.length ? now : row.updatedAt };
  }

  static async remove(d1: D1Database, chamberId: string, userId: string, id: string) {
    await this.requireContact(d1, chamberId, userId, id);
    // §7.3: tasks keep living (crm_contact_id → NULL via FK); timeline rows cascade.
    await drizzle(d1)
      .delete(crmContacts)
      .where(and(eq(crmContacts.chamberId, chamberId), eq(crmContacts.userId, userId), eq(crmContacts.id, id)))
      .run();
    return { id, deleted: true };
  }

  /** Contact + timeline for the detail drawer. */
  static async detail(d1: D1Database, chamberId: string, userId: string, id: string) {
    const row = await this.requireContact(d1, chamberId, userId, id);
    const [activities, linked] = await Promise.all([
      CrmContactsRepository.activities(d1, chamberId, userId, id),
      row.linkedUserId ? CrmContactsRepository.userNames(d1, chamberId, [row.linkedUserId]) : Promise.resolve([]),
    ]);
    const l = linked[0];
    return {
      ...this.toDto(row, l ? { id: l.id, name: l.name?.trim() || l.email } : null, activities[0]?.createdAt || null),
      activities: activities.map((a) => ({ id: a.id, type: a.type, body: a.body, created_at: a.createdAt })),
    };
  }

  /** OD-081: log a note / call / meeting / email on the timeline. */
  static async addActivity(d1: D1Database, chamberId: string, userId: string, id: string, input: CreateActivityInput) {
    await this.requireContact(d1, chamberId, userId, id);
    const activityId = await newId(d1, 'crm_contact_activities', 'CRMA', { chamberId, suffixLength: 6 });
    const now = new Date().toISOString();
    await drizzle(d1)
      .insert(crmContactActivities)
      .values({ id: activityId, chamberId, userId, contactId: id, type: input.type, body: input.body, createdAt: now })
      .run();
    return { id: activityId, type: input.type, body: input.body, created_at: now };
  }
}
