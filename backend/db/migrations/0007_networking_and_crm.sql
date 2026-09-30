-- Migration: 0007_networking_and_crm.sql
-- Modules 7, 8, 10, 11: Networking, CRM, Mentorship, Marketplace & RFPs (12 tables)
-- Canonical Reference: database/DB_tables_reference.md & database/DB_schema.dbml

-- 7.1 referrals
CREATE TABLE IF NOT EXISTS referrals (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  from_business_id TEXT NOT NULL REFERENCES business_profiles(id) ON DELETE CASCADE,
  to_business_id TEXT NOT NULL REFERENCES business_profiles(id) ON DELETE CASCADE,
  created_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'contacted', 'converted', 'declined')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_referrals_chamber ON referrals(chamber_id);
CREATE INDEX IF NOT EXISTS idx_referrals_from_biz ON referrals(from_business_id);
CREATE INDEX IF NOT EXISTS idx_referrals_to_biz ON referrals(to_business_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);

-- 7.2 referral_people
CREATE TABLE IF NOT EXISTS referral_people (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  referral_id TEXT NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  mobile_number TEXT,
  email TEXT,
  profession TEXT,
  referred_business_id TEXT REFERENCES business_profiles(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_referral_people_chamber ON referral_people(chamber_id);
CREATE INDEX IF NOT EXISTS idx_referral_people_ref ON referral_people(referral_id);

-- 7.3 meetings_1to1
CREATE TABLE IF NOT EXISTS meetings_1to1 (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  requester_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invitee_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  proposed_datetime TEXT NOT NULL,
  status TEXT DEFAULT 'proposed' CHECK(status IN ('proposed', 'accepted', 'declined', 'completed', 'cancelled')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_meetings_chamber ON meetings_1to1(chamber_id);
CREATE INDEX IF NOT EXISTS idx_meetings_requester ON meetings_1to1(requester_id);
CREATE INDEX IF NOT EXISTS idx_meetings_invitee ON meetings_1to1(invitee_id);

-- 7.4 messages
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0,
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_messages_chamber ON messages(chamber_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_id);

-- 7.5 contact_requests
CREATE TABLE IF NOT EXISTS contact_requests (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK(source IN ('event_access', 'public_inquiry')),
  sender_name TEXT NOT NULL DEFAULT 'Guest',
  sender_email TEXT NOT NULL,
  sender_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  related_event_id TEXT REFERENCES events(id) ON DELETE SET NULL,
  chapter_id TEXT REFERENCES chapters(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  attachment_url TEXT,
  status TEXT DEFAULT 'new' CHECK(status IN ('new', 'responded', 'access_granted')),
  responded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  admin_response TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_contact_requests_chamber ON contact_requests(chamber_id);
CREATE INDEX IF NOT EXISTS idx_contact_requests_status ON contact_requests(status);

-- 8.1 crm_contacts
CREATE TABLE IF NOT EXISTS crm_contacts (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_name TEXT NOT NULL,
  business TEXT,
  email TEXT,
  phone TEXT,
  stage TEXT DEFAULT 'lead' CHECK(stage IN ('lead', 'contacted', 'qualified', 'proposal', 'won', 'lost')),
  deal_value REAL NOT NULL DEFAULT 0.0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_chamber ON crm_contacts(chamber_id);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_user ON crm_contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_stage ON crm_contacts(stage);

-- 8.2 tasks
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'todo' CHECK(status IN ('todo', 'in_progress', 'done')),
  priority TEXT DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high')),
  due_date TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_tasks_chamber ON tasks(chamber_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

-- 10.1 mentorship_profiles
CREATE TABLE IF NOT EXISTS mentorship_profiles (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  bio TEXT,
  expertise_json TEXT,
  years_experience INTEGER NOT NULL DEFAULT 0,
  max_mentees INTEGER NOT NULL DEFAULT 3,
  active_mentees INTEGER NOT NULL DEFAULT 0,
  rating REAL NOT NULL DEFAULT 5.0,
  rating_count INTEGER NOT NULL DEFAULT 0,
  sessions_completed INTEGER NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'paused', 'inactive')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_mentorship_profiles_chamber ON mentorship_profiles(chamber_id);
CREATE INDEX IF NOT EXISTS idx_mentorship_profiles_user ON mentorship_profiles(user_id);

-- 10.2 mentorship
CREATE TABLE IF NOT EXISTS mentorship (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  mentor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mentee_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_message TEXT,
  status TEXT NOT NULL CHECK(status IN ('pending', 'confirmed', 'rejected', 'cancelled', 'completed')),
  requested_at TEXT NOT NULL DEFAULT (datetime('now')),
  accepted_at TEXT,
  completed_at TEXT,
  cancelled_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_mentorship_chamber ON mentorship(chamber_id);
CREATE INDEX IF NOT EXISTS idx_mentorship_mentor ON mentorship(mentor_id);
CREATE INDEX IF NOT EXISTS idx_mentorship_mentee ON mentorship(mentee_id);

-- 11.1 marketplace_listings
CREATE TABLE IF NOT EXISTS marketplace_listings (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  business_id TEXT NOT NULL REFERENCES business_profiles(id) ON DELETE CASCADE,
  created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK(type IN ('listing', 'hot_deal')),
  title TEXT NOT NULL,
  tagline TEXT,
  category TEXT,
  description TEXT,
  short_description TEXT,
  meta_description TEXT,
  pricing_type TEXT DEFAULT 'fixed' CHECK(pricing_type IN ('fixed', 'quote', 'range', 'hourly', 'contact')),
  price REAL,
  price_label TEXT,
  is_purchasable INTEGER NOT NULL DEFAULT 0,
  image_key TEXT,
  offer_details TEXT,
  offer_start_at TEXT,
  offer_end_at TEXT,
  publish_start_at TEXT,
  publish_end_at TEXT,
  contact_email TEXT,
  email_link_text TEXT,
  website_url TEXT,
  website_link_text TEXT,
  contact_phone TEXT,
  status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'pending_approval', 'published', 'rejected', 'closed')),
  approved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  approved_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_marketplace_chamber ON marketplace_listings(chamber_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_business ON marketplace_listings(business_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_status ON marketplace_listings(status);
CREATE INDEX IF NOT EXISTS idx_marketplace_category ON marketplace_listings(category);

-- 11.2 business_leads
CREATE TABLE IF NOT EXISTS business_leads (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  business_id TEXT NOT NULL REFERENCES business_profiles(id) ON DELETE CASCADE,
  created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  category TEXT,
  description TEXT,
  budget_range TEXT,
  deadline TEXT,
  status TEXT DEFAULT 'open' CHECK(status IN ('open', 'closed')),
  proposals_count INTEGER NOT NULL DEFAULT 0,
  selected_proposal_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_business_leads_chamber ON business_leads(chamber_id);
CREATE INDEX IF NOT EXISTS idx_business_leads_business ON business_leads(business_id);
CREATE INDEX IF NOT EXISTS idx_business_leads_status ON business_leads(status);

-- 11.3 business_lead_proposals
CREATE TABLE IF NOT EXISTS business_lead_proposals (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  lead_id TEXT NOT NULL REFERENCES business_leads(id) ON DELETE CASCADE,
  proposing_business_id TEXT NOT NULL REFERENCES business_profiles(id) ON DELETE CASCADE,
  submitted_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  pitch_text TEXT NOT NULL,
  pricing TEXT,
  turnaround TEXT,
  is_selected INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_lead_proposals_chamber ON business_lead_proposals(chamber_id);
CREATE INDEX IF NOT EXISTS idx_lead_proposals_lead ON business_lead_proposals(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_proposals_biz ON business_lead_proposals(proposing_business_id);
