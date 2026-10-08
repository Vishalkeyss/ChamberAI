-- Migration 0019: Prompt 05.5 Lightweight CRM, Deals Pipeline & Kanban Tasks
-- Approved 2026-10-08 (OD-080 … OD-084). Canonical docs updated: DB_tables_reference.md §8.1 / §8.2 / §8.3, DB_schema.dbml.

-- 8.1 crm_contacts — DB column names (contact_name, business) and stage `proposal` stay canonical (OD-080).
ALTER TABLE crm_contacts ADD COLUMN expected_close_date TEXT;
-- OD-082: next follow-up date shown on the deal card.
ALTER TABLE crm_contacts ADD COLUMN follow_up_date TEXT;
-- OD-083: optional link to a member of the same chamber (quick conversion from directory / referral).
ALTER TABLE crm_contacts ADD COLUMN linked_user_id TEXT REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_crm_contacts_user_stage ON crm_contacts(chamber_id, user_id, stage);

-- 8.3 crm_contact_activities (OD-081): private interaction timeline per CRM contact.
CREATE TABLE IF NOT EXISTS crm_contact_activities (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_id TEXT NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'note' CHECK(type IN ('note', 'call', 'meeting', 'email', 'stage')),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_crm_activities_contact ON crm_contact_activities(chamber_id, user_id, contact_id, created_at);

-- 8.2 tasks (OD-084): rebuilt because the CHECK constraints change (priority adds `urgent`).
-- Status keeps `done`; adds crm_contact_id + completed_at. Table was unused before 05.5.
CREATE TABLE tasks_new (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  crm_contact_id TEXT REFERENCES crm_contacts(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo' CHECK(status IN ('todo', 'in_progress', 'done')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'urgent')),
  due_date TEXT,
  completed_at TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);
INSERT INTO tasks_new (id, chamber_id, user_id, title, description, status, priority, due_date, sort_order, created_at, updated_at)
  SELECT id, chamber_id, user_id, title, description, COALESCE(status, 'todo'), COALESCE(priority, 'medium'), due_date, sort_order, created_at, updated_at
  FROM tasks;
DROP TABLE tasks;
ALTER TABLE tasks_new RENAME TO tasks;
CREATE INDEX IF NOT EXISTS idx_tasks_chamber ON tasks(chamber_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_status ON tasks(chamber_id, user_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_contact ON tasks(crm_contact_id);
