-- Migration: 0003_chapters_and_groups.sql
-- Module 3: Chapters & Sub-Groups (4 tables)
-- Canonical Reference: database/DB_tables_reference.md & database/DB_schema.dbml

-- 3.1 chapters
CREATE TABLE IF NOT EXISTS chapters (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  city_region TEXT,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'disabled')),
  members_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_chapters_chamber_id ON chapters(chamber_id);
CREATE INDEX IF NOT EXISTS idx_chapters_status ON chapters(status);

-- 3.2 groups
CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,
  description TEXT,
  invite_only INTEGER NOT NULL DEFAULT 0,
  auto_add_on_join INTEGER NOT NULL DEFAULT 0,
  approval_mode TEXT DEFAULT 'auto' CHECK(approval_mode IN ('manual', 'auto')),
  members_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_groups_chamber_id ON groups(chamber_id);
CREATE INDEX IF NOT EXISTS idx_groups_category ON groups(category);

-- 3.3 group_members
CREATE TABLE IF NOT EXISTS group_members (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'pending_approval')),
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT,
  UNIQUE(group_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_group_members_chamber_id ON group_members(chamber_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON group_members(user_id);

-- 3.4 user_chapters
CREATE TABLE IF NOT EXISTS user_chapters (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  is_primary INTEGER NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT,
  UNIQUE(user_id, chapter_id)
);
CREATE INDEX IF NOT EXISTS idx_user_chapters_chamber_id ON user_chapters(chamber_id);
CREATE INDEX IF NOT EXISTS idx_user_chapters_user_id ON user_chapters(user_id);
CREATE INDEX IF NOT EXISTS idx_user_chapters_chapter_id ON user_chapters(chapter_id);
