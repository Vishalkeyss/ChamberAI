import { newId } from '../../../core/shared/ids';

export interface CanonicalPreferenceItem {
  category: 'announcements' | 'events' | 'invoices' | 'referrals' | 'messages';
  channel: 'email' | 'sms' | 'in_app';
  is_enabled: boolean;
}

export interface DbNotificationPreferencesRow {
  id: string;
  chamber_id: string;
  user_id: string;
  email_events: number;
  email_announcements: number;
  email_referrals: number;
  email_billing: number;
  email_newsletters: number;
  push_events: number;
  push_announcements: number;
  push_messages: number;
  sms_enabled: number;
  updated_at: string | null;
}

export class NotificationPreferencesRepository {
  /**
   * Fetches preferences or initializes defaults if not present
   */
  static async getPreferences(
    db: D1Database,
    chamberId: string,
    userId: string
  ): Promise<CanonicalPreferenceItem[]> {
    let row = await db
      .prepare(
        `SELECT * FROM notification_preferences
         WHERE chamber_id = ? AND user_id = ?
         LIMIT 1`
      )
      .bind(chamberId, userId)
      .first<DbNotificationPreferencesRow>();

    if (!row) {
      const id = await newId(db, 'notification_preferences', 'NPREF', { chamberId });
      await db
        .prepare(
          `INSERT INTO notification_preferences (
             id, chamber_id, user_id,
             email_events, email_announcements, email_referrals, email_billing, email_newsletters,
             push_events, push_announcements, push_messages, sms_enabled, updated_at
           ) VALUES (?, ?, ?, 1, 1, 1, 1, 1, 1, 1, 1, 0, datetime('now'))`
        )
        .bind(id, chamberId, userId)
        .run();

      row = {
        id,
        chamber_id: chamberId,
        user_id: userId,
        email_events: 1,
        email_announcements: 1,
        email_referrals: 1,
        email_billing: 1,
        email_newsletters: 1,
        push_events: 1,
        push_announcements: 1,
        push_messages: 1,
        sms_enabled: 0,
        updated_at: new Date().toISOString(),
      };
    }

    return this.mapToCanonicalMatrix(row);
  }

  /**
   * Updates user notification preferences in D1
   */
  static async updatePreferences(
    db: D1Database,
    chamberId: string,
    userId: string,
    items: CanonicalPreferenceItem[]
  ): Promise<number> {
    // Ensure base row exists
    await this.getPreferences(db, chamberId, userId);

    const updateFields: string[] = [];
    const bindings: any[] = [];

    for (const item of items) {
      const val = item.is_enabled ? 1 : 0;
      if (item.channel === 'email') {
        if (item.category === 'events') {
          updateFields.push('email_events = ?');
          bindings.push(val);
        } else if (item.category === 'announcements') {
          updateFields.push('email_announcements = ?');
          bindings.push(val);
        } else if (item.category === 'invoices') {
          updateFields.push('email_billing = ?');
          bindings.push(val);
        } else if (item.category === 'referrals') {
          updateFields.push('email_referrals = ?');
          bindings.push(val);
        } else if (item.category === 'messages') {
          updateFields.push('email_newsletters = ?');
          bindings.push(val);
        }
      } else if (item.channel === 'in_app') {
        if (item.category === 'events') {
          updateFields.push('push_events = ?');
          bindings.push(val);
        } else if (item.category === 'announcements') {
          updateFields.push('push_announcements = ?');
          bindings.push(val);
        } else if (item.category === 'messages') {
          updateFields.push('push_messages = ?');
          bindings.push(val);
        }
      } else if (item.channel === 'sms') {
        updateFields.push('sms_enabled = ?');
        bindings.push(val);
      }
    }

    if (updateFields.length === 0) return 0;

    updateFields.push("updated_at = datetime('now')");

    const sql = `UPDATE notification_preferences
                 SET ${updateFields.join(', ')}
                 WHERE chamber_id = ? AND user_id = ?`;

    bindings.push(chamberId, userId);

    await db.prepare(sql).bind(...bindings).run();
    return items.length;
  }

  private static mapToCanonicalMatrix(row: DbNotificationPreferencesRow): CanonicalPreferenceItem[] {
    const isSms = Boolean(row.sms_enabled);

    return [
      { category: 'announcements', channel: 'email', is_enabled: Boolean(row.email_announcements) },
      { category: 'announcements', channel: 'sms', is_enabled: isSms },
      { category: 'announcements', channel: 'in_app', is_enabled: Boolean(row.push_announcements) },

      { category: 'events', channel: 'email', is_enabled: Boolean(row.email_events) },
      { category: 'events', channel: 'sms', is_enabled: isSms },
      { category: 'events', channel: 'in_app', is_enabled: Boolean(row.push_events) },

      { category: 'invoices', channel: 'email', is_enabled: Boolean(row.email_billing) },
      { category: 'invoices', channel: 'sms', is_enabled: isSms },
      { category: 'invoices', channel: 'in_app', is_enabled: true },

      { category: 'referrals', channel: 'email', is_enabled: Boolean(row.email_referrals) },
      { category: 'referrals', channel: 'sms', is_enabled: false },
      { category: 'referrals', channel: 'in_app', is_enabled: true },

      { category: 'messages', channel: 'email', is_enabled: Boolean(row.email_newsletters) },
      { category: 'messages', channel: 'sms', is_enabled: isSms },
      { category: 'messages', channel: 'in_app', is_enabled: Boolean(row.push_messages) },
    ];
  }
}
