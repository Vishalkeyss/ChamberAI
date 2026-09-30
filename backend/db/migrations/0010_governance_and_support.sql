-- Migration: 0010_governance_and_support.sql
-- Modules 16, 19, 21: Polls & Surveys, Support, Ideas, and Board Governance (13 tables)
-- Canonical Reference: database/DB_tables_reference.md & database/DB_schema.dbml

-- 16.1 polls
CREATE TABLE IF NOT EXISTS polls (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  chapter_id TEXT REFERENCES chapters(id) ON DELETE SET NULL,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'closed')),
  closing_date TEXT,
  total_votes INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_polls_chamber ON polls(chamber_id);
CREATE INDEX IF NOT EXISTS idx_polls_status ON polls(status);

-- 16.2 poll_options
CREATE TABLE IF NOT EXISTS poll_options (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  poll_id TEXT NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  option_text TEXT NOT NULL,
  vote_count INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_poll_options_chamber ON poll_options(chamber_id);
CREATE INDEX IF NOT EXISTS idx_poll_options_poll ON poll_options(poll_id);

-- 16.3 poll_votes
CREATE TABLE IF NOT EXISTS poll_votes (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  poll_id TEXT NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  option_id TEXT NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(poll_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_poll_votes_chamber ON poll_votes(chamber_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_poll ON poll_votes(poll_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_user ON poll_votes(user_id);

-- 19.1 support_tickets
CREATE TABLE IF NOT EXISTS support_tickets (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  ticket_number TEXT NOT NULL UNIQUE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  category TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT DEFAULT 'new' CHECK(status IN ('new', 'open', 'in_progress', 'resolved', 'closed')),
  assigned_to TEXT REFERENCES users(id) ON DELETE SET NULL,
  chapter_id TEXT REFERENCES chapters(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_support_tickets_chamber ON support_tickets(chamber_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON support_tickets(user_id);

-- 19.2 support_ticket_messages
CREATE TABLE IF NOT EXISTS support_ticket_messages (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  ticket_id TEXT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_internal_note INTEGER NOT NULL DEFAULT 0,
  attachments_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_chamber ON support_ticket_messages(chamber_id);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON support_ticket_messages(ticket_id);

-- 19.3 ideas
CREATE TABLE IF NOT EXISTS ideas (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  chapter_id TEXT REFERENCES chapters(id) ON DELETE SET NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new', 'under_review', 'planned', 'implemented', 'declined')),
  upvotes INTEGER NOT NULL DEFAULT 0,
  downvotes INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_ideas_chamber ON ideas(chamber_id);
CREATE INDEX IF NOT EXISTS idx_ideas_status ON ideas(status);
CREATE INDEX IF NOT EXISTS idx_ideas_user ON ideas(user_id);

-- 19.4 idea_votes
CREATE TABLE IF NOT EXISTS idea_votes (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  idea_id TEXT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vote INTEGER NOT NULL CHECK(vote IN (1, -1)),
  UNIQUE(idea_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_idea_votes_chamber ON idea_votes(chamber_id);
CREATE INDEX IF NOT EXISTS idx_idea_votes_idea ON idea_votes(idea_id);

-- 19.5 idea_comments
CREATE TABLE IF NOT EXISTS idea_comments (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  idea_id TEXT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_idea_comments_chamber ON idea_comments(chamber_id);
CREATE INDEX IF NOT EXISTS idx_idea_comments_idea ON idea_comments(idea_id);

-- 21.1 governance_board_members
CREATE TABLE IF NOT EXISTS governance_board_members (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  position TEXT NOT NULL,
  term_start TEXT NOT NULL,
  term_end TEXT NOT NULL,
  role_description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_board_members_chamber ON governance_board_members(chamber_id);
CREATE INDEX IF NOT EXISTS idx_board_members_user ON governance_board_members(user_id);

-- 21.2 governance_meetings
CREATE TABLE IF NOT EXISTS governance_meetings (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  meeting_date TEXT NOT NULL,
  meeting_time TEXT,
  agenda_text TEXT,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK(status IN ('upcoming', 'completed')),
  attendees_count INTEGER NOT NULL DEFAULT 0,
  minutes_text TEXT,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_gov_meetings_chamber ON governance_meetings(chamber_id);
CREATE INDEX IF NOT EXISTS idx_gov_meetings_date ON governance_meetings(meeting_date);

-- 21.3 governance_resolutions
CREATE TABLE IF NOT EXISTS governance_resolutions (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  voting_deadline TEXT NOT NULL,
  eligibility TEXT NOT NULL DEFAULT 'board_members_only',
  status TEXT DEFAULT 'open' CHECK(status IN ('open', 'closed')),
  result TEXT CHECK(result IN ('passed', 'failed', 'tied')),
  yes_count INTEGER NOT NULL DEFAULT 0,
  no_count INTEGER NOT NULL DEFAULT 0,
  abstain_count INTEGER NOT NULL DEFAULT 0,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_gov_resolutions_chamber ON governance_resolutions(chamber_id);
CREATE INDEX IF NOT EXISTS idx_gov_resolutions_status ON governance_resolutions(status);

-- 21.4 governance_votes
CREATE TABLE IF NOT EXISTS governance_votes (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  resolution_id TEXT NOT NULL REFERENCES governance_resolutions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vote TEXT NOT NULL CHECK(vote IN ('yes', 'no', 'abstain')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(resolution_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_gov_votes_chamber ON governance_votes(chamber_id);
CREATE INDEX IF NOT EXISTS idx_gov_votes_resolution ON governance_votes(resolution_id);

-- 21.5 governance_documents
CREATE TABLE IF NOT EXISTS governance_documents (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('bylaws', 'constitution', 'policy')),
  file_url TEXT NOT NULL,
  uploaded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_gov_documents_chamber ON governance_documents(chamber_id);
CREATE INDEX IF NOT EXISTS idx_gov_documents_category ON governance_documents(category);
