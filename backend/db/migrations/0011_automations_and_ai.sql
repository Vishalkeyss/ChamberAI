-- Migration: 0011_automations_and_ai.sql
-- Modules 20 & 22: Automations, Forms, AI Engine & Chamber Administration (17 tables)
-- Canonical Reference: database/DB_tables_reference.md & database/DB_schema.dbml

-- 20.1 notifications
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0,
  action_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notifications_chamber ON notifications(chamber_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);

-- 20.2 notification_preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  email_events INTEGER NOT NULL DEFAULT 1,
  email_announcements INTEGER NOT NULL DEFAULT 1,
  email_referrals INTEGER NOT NULL DEFAULT 1,
  email_billing INTEGER NOT NULL DEFAULT 1,
  email_newsletters INTEGER NOT NULL DEFAULT 1,
  push_events INTEGER NOT NULL DEFAULT 1,
  push_announcements INTEGER NOT NULL DEFAULT 1,
  push_messages INTEGER NOT NULL DEFAULT 1,
  sms_enabled INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_notif_prefs_chamber ON notification_preferences(chamber_id);
CREATE INDEX IF NOT EXISTS idx_notif_prefs_user ON notification_preferences(user_id);

-- 20.3 automation_workflows
CREATE TABLE IF NOT EXISTS automation_workflows (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trigger_event TEXT NOT NULL,
  trigger_sub_event TEXT,
  channel TEXT NOT NULL DEFAULT 'email' CHECK(channel IN ('email', 'sms', 'push')),
  status TEXT DEFAULT 'draft' CHECK(status IN ('active', 'paused', 'draft')),
  wait_condition_enabled INTEGER NOT NULL DEFAULT 0,
  wait_duration_minutes INTEGER NOT NULL DEFAULT 0,
  smart_throttling INTEGER NOT NULL DEFAULT 0,
  total_sent INTEGER NOT NULL DEFAULT 0,
  total_recipients INTEGER NOT NULL DEFAULT 0,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_auto_workflows_chamber ON automation_workflows(chamber_id);
CREATE INDEX IF NOT EXISTS idx_auto_workflows_status ON automation_workflows(status);

-- 20.4 automation_workflow_steps
CREATE TABLE IF NOT EXISTS automation_workflow_steps (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  workflow_id TEXT NOT NULL REFERENCES automation_workflows(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  delay_value INTEGER NOT NULL DEFAULT 0,
  delay_unit TEXT NOT NULL DEFAULT 'days' CHECK(delay_unit IN ('minutes', 'hours', 'days')),
  subject TEXT,
  body TEXT NOT NULL,
  sent_count INTEGER NOT NULL DEFAULT 0,
  open_rate REAL NOT NULL DEFAULT 0.0,
  click_rate REAL NOT NULL DEFAULT 0.0,
  bounce_rate REAL NOT NULL DEFAULT 0.0
);
CREATE INDEX IF NOT EXISTS idx_auto_steps_chamber ON automation_workflow_steps(chamber_id);
CREATE INDEX IF NOT EXISTS idx_auto_steps_workflow ON automation_workflow_steps(workflow_id);

-- 20.5 automation_recipients
CREATE TABLE IF NOT EXISTS automation_recipients (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  workflow_id TEXT NOT NULL REFERENCES automation_workflows(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  step_id TEXT NOT NULL REFERENCES automation_workflow_steps(id) ON DELETE CASCADE,
  delivery_status TEXT DEFAULT 'sent' CHECK(delivery_status IN ('sent', 'not_yet_reached', 'failed')),
  opened INTEGER NOT NULL DEFAULT 0,
  opened_at TEXT,
  clicked INTEGER NOT NULL DEFAULT 0,
  clicked_at TEXT,
  sent_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_auto_recipients_chamber ON automation_recipients(chamber_id);
CREATE INDEX IF NOT EXISTS idx_auto_recipients_workflow ON automation_recipients(workflow_id);
CREATE INDEX IF NOT EXISTS idx_auto_recipients_user ON automation_recipients(user_id);

-- 20.6 reported_content
CREATE TABLE IF NOT EXISTS reported_content (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL,
  content_id TEXT NOT NULL,
  content_title TEXT,
  content_description TEXT,
  reporter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reported_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL CHECK(reason IN ('spam_or_scam', 'inappropriate', 'other')),
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'dismissed', 'removed')),
  resolved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_reported_content_chamber ON reported_content(chamber_id);
CREATE INDEX IF NOT EXISTS idx_reported_content_status ON reported_content(status);

-- 20.8 forms (created before landing_pages due to FK)
CREATE TABLE IF NOT EXISTS forms (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'active', 'closed')),
  active_from TEXT,
  active_until TEXT,
  fields_json TEXT NOT NULL,
  submissions_count INTEGER NOT NULL DEFAULT 0,
  share_url TEXT,
  embed_code TEXT,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_forms_chamber ON forms(chamber_id);
CREATE INDEX IF NOT EXISTS idx_forms_status ON forms(status);

-- 20.7 landing_pages
CREATE TABLE IF NOT EXISTS landing_pages (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  template_type TEXT NOT NULL CHECK(template_type IN ('event_promotion', 'membership_drive', 'sponsor_pitch')),
  content_json TEXT NOT NULL,
  form_id TEXT REFERENCES forms(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'published', 'archived')),
  views_count INTEGER NOT NULL DEFAULT 0,
  submissions_count INTEGER NOT NULL DEFAULT 0,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(chamber_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_landing_pages_chamber ON landing_pages(chamber_id);
CREATE INDEX IF NOT EXISTS idx_landing_pages_slug ON landing_pages(slug);
CREATE INDEX IF NOT EXISTS idx_landing_pages_status ON landing_pages(status);

-- 20.9 form_submissions
CREATE TABLE IF NOT EXISTS form_submissions (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  form_id TEXT NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  responses_json TEXT NOT NULL,
  submitted_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  submitted_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_form_sub_chamber ON form_submissions(chamber_id);
CREATE INDEX IF NOT EXISTS idx_form_sub_form ON form_submissions(form_id);

-- 20.10 activity_logs
CREATE TABLE IF NOT EXISTS activity_logs (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  details_json TEXT,
  ip_address TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_activity_logs_chamber ON activity_logs(chamber_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at);

-- 22.1 ai_site_design
CREATE TABLE IF NOT EXISTS ai_site_design (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL UNIQUE REFERENCES platform_chambers(id) ON DELETE CASCADE,
  design_config_json TEXT NOT NULL,
  hero_style TEXT DEFAULT 'left' CHECK(hero_style IN ('left', 'center')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ai_site_design_chamber ON ai_site_design(chamber_id);

-- 22.2 ai_chat_history
CREATE TABLE IF NOT EXISTS ai_chat_history (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  context TEXT NOT NULL CHECK(context IN ('site_designer', 'member_assistant', 'ai_report')),
  prompt TEXT NOT NULL,
  response TEXT NOT NULL,
  action_taken TEXT,
  feedback_rating INTEGER,
  feedback_text TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ai_chat_chamber ON ai_chat_history(chamber_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_user ON ai_chat_history(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_context ON ai_chat_history(context);

-- 22.3 ai_agent_capabilities
CREATE TABLE IF NOT EXISTS ai_agent_capabilities (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  capability_name TEXT NOT NULL,
  description TEXT,
  is_enabled INTEGER NOT NULL DEFAULT 1,
  auto_resolve_rate REAL NOT NULL DEFAULT 0.0,
  satisfaction_score REAL NOT NULL DEFAULT 5.0,
  total_chats INTEGER NOT NULL DEFAULT 0,
  config_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_ai_caps_chamber ON ai_agent_capabilities(chamber_id);
CREATE INDEX IF NOT EXISTS idx_ai_caps_enabled ON ai_agent_capabilities(is_enabled);

-- 22.4 member_retention_scores
CREATE TABLE IF NOT EXISTS member_retention_scores (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  tenure_years REAL NOT NULL DEFAULT 0.0,
  satisfaction_score REAL NOT NULL DEFAULT 5.0,
  engagement_score REAL NOT NULL DEFAULT 100.0,
  ticket_volume INTEGER NOT NULL DEFAULT 0,
  rules_score REAL NOT NULL DEFAULT 0.0,
  ai_score REAL NOT NULL DEFAULT 0.0,
  ai_reasoning TEXT,
  risk_level TEXT DEFAULT 'low' CHECK(risk_level IN ('critical', 'moderate', 'low')),
  last_calculated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_retention_chamber ON member_retention_scores(chamber_id);
CREATE INDEX IF NOT EXISTS idx_retention_user ON member_retention_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_retention_risk ON member_retention_scores(risk_level);

-- 22.5 chamber_settings
CREATE TABLE IF NOT EXISTS chamber_settings (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL UNIQUE REFERENCES platform_chambers(id) ON DELETE CASCADE,
  org_name TEXT NOT NULL,
  support_email TEXT,
  default_currency TEXT NOT NULL DEFAULT 'USD',
  timezone TEXT NOT NULL DEFAULT 'America/Chicago',
  primary_color TEXT NOT NULL DEFAULT '#2563EB',
  text_color TEXT NOT NULL DEFAULT '#0F172A',
  background_color TEXT NOT NULL DEFAULT '#FFFFFF',
  logo_url TEXT,
  subdomain TEXT,
  custom_domain TEXT,
  chapters_enabled INTEGER NOT NULL DEFAULT 1,
  groups_enabled INTEGER NOT NULL DEFAULT 1,
  auto_approve_applications INTEGER NOT NULL DEFAULT 0,
  chapter_terminology TEXT NOT NULL DEFAULT 'Chapter',
  group_terminology TEXT NOT NULL DEFAULT 'Group',
  enabled_languages_json TEXT NOT NULL DEFAULT '["en"]',
  show_local_city_news INTEGER NOT NULL DEFAULT 0,
  local_news_city TEXT,
  ai_provider TEXT DEFAULT 'google' CHECK(ai_provider IN ('anthropic', 'openai', 'google')),
  ai_api_key_encrypted TEXT,
  ga4_measurement_id TEXT,
  daily_digest_enabled INTEGER NOT NULL DEFAULT 0,
  monthly_newsletter_enabled INTEGER NOT NULL DEFAULT 1,
  ip_allowlist_enabled INTEGER NOT NULL DEFAULT 0,
  ip_allowlist_json TEXT,
  onboarding_wizard_completed INTEGER NOT NULL DEFAULT 0,
  established_year INTEGER,
  about_text TEXT,
  mission_text TEXT,
  hero_headline TEXT,
  hero_tagline TEXT,
  public_site_config_json TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_chamber_settings_chamber ON chamber_settings(chamber_id);

-- 22.6 chamber_integrations
CREATE TABLE IF NOT EXISTS chamber_integrations (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  service_key TEXT NOT NULL,
  service_name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'not_connected' CHECK(status IN ('connected', 'not_connected')),
  config_encrypted TEXT,
  connected_at TEXT,
  UNIQUE(chamber_id, service_key)
);
CREATE INDEX IF NOT EXISTS idx_chamber_integrations_chamber ON chamber_integrations(chamber_id);
CREATE INDEX IF NOT EXISTS idx_chamber_integrations_key ON chamber_integrations(service_key);

-- 22.7 import_history
CREATE TABLE IF NOT EXISTS import_history (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  data_type TEXT NOT NULL CHECK(data_type IN ('members', 'invoices', 'events', 'notes', 'directory_sponsors')),
  source_file_name TEXT NOT NULL,
  source_file_url TEXT,
  records_imported INTEGER NOT NULL DEFAULT 0,
  records_skipped INTEGER NOT NULL DEFAULT 0,
  errors_json TEXT,
  status TEXT DEFAULT 'processing' CHECK(status IN ('processing', 'completed', 'failed')),
  imported_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_import_history_chamber ON import_history(chamber_id);
CREATE INDEX IF NOT EXISTS idx_import_history_status ON import_history(status);
