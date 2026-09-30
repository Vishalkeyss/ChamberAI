-- Migration: 0001_platform_tables.sql
-- Module 1: Platform Operations & Super Admin (10 tables)
-- Canonical Reference: database/DB_tables_reference.md & database/DB_schema.dbml

-- 1.1 platform_chambers
CREATE TABLE IF NOT EXISTS platform_chambers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT,
  subdomain TEXT UNIQUE,
  custom_domain TEXT UNIQUE,
  domain_status TEXT DEFAULT 'none' CHECK(domain_status IN ('none', 'pending_dns', 'verified', 'pending', 'active', 'failed')),
  admin_contact_name TEXT,
  admin_email TEXT,
  status TEXT DEFAULT 'pending_setup' CHECK(status IN ('active', 'suspended', 'pending_setup', 'trial', 'churned')),
  onboarded INTEGER NOT NULL DEFAULT 0,
  r2_bucket_name TEXT,
  members_count INTEGER NOT NULL DEFAULT 0,
  revenue_total REAL NOT NULL DEFAULT 0.0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_platform_chambers_subdomain ON platform_chambers(subdomain);
CREATE INDEX IF NOT EXISTS idx_platform_chambers_custom_domain ON platform_chambers(custom_domain);
CREATE INDEX IF NOT EXISTS idx_platform_chambers_status ON platform_chambers(status);

-- 1.2 platform_super_admins
CREATE TABLE IF NOT EXISTS platform_super_admins (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  two_factor_enabled INTEGER NOT NULL DEFAULT 0,
  created_by TEXT REFERENCES platform_super_admins(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_platform_super_admins_email ON platform_super_admins(email);

-- 1.3 platform_tenant_billing
CREATE TABLE IF NOT EXISTS platform_tenant_billing (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL UNIQUE,
  description TEXT,
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'unpaid' CHECK(status IN ('paid', 'unpaid', 'overdue', 'refunded')),
  billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK(billing_cycle IN ('monthly', 'annual')),
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  due_date TEXT NOT NULL,
  paid_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_platform_tenant_billing_chamber ON platform_tenant_billing(chamber_id);
CREATE INDEX IF NOT EXISTS idx_platform_tenant_billing_status ON platform_tenant_billing(status);

-- 1.4 platform_support_tickets
CREATE TABLE IF NOT EXISTS platform_support_tickets (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  submitted_by_user_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  category TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'urgent')),
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new', 'open', 'in_progress', 'resolved', 'closed')),
  assigned_to TEXT REFERENCES platform_super_admins(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_platform_support_tickets_chamber ON platform_support_tickets(chamber_id);
CREATE INDEX IF NOT EXISTS idx_platform_support_tickets_status ON platform_support_tickets(status);

-- 1.5 platform_support_ticket_messages
CREATE TABLE IF NOT EXISTS platform_support_ticket_messages (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL REFERENCES platform_support_tickets(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL,
  sender_role TEXT NOT NULL CHECK(sender_role IN ('super_admin', 'chamber_admin')),
  message TEXT NOT NULL,
  is_internal_note INTEGER NOT NULL DEFAULT 0,
  attachments_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_platform_support_ticket_messages_ticket ON platform_support_ticket_messages(ticket_id);

-- 1.6 platform_admin_requests
CREATE TABLE IF NOT EXISTS platform_admin_requests (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  submitted_by TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new', 'acknowledged', 'resolved')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_platform_admin_requests_chamber ON platform_admin_requests(chamber_id);
CREATE INDEX IF NOT EXISTS idx_platform_admin_requests_status ON platform_admin_requests(status);

-- 1.7 platform_integrations
CREATE TABLE IF NOT EXISTS platform_integrations (
  id TEXT PRIMARY KEY,
  service_name TEXT NOT NULL,
  service_key TEXT NOT NULL UNIQUE,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'not_connected' CHECK(status IN ('connected', 'not_connected')),
  config_encrypted TEXT,
  connected_at TEXT,
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_platform_integrations_key ON platform_integrations(service_key);

-- 1.8 platform_security_settings
CREATE TABLE IF NOT EXISTS platform_security_settings (
  id TEXT PRIMARY KEY,
  sso_enabled INTEGER NOT NULL DEFAULT 0,
  mandatory_2fa INTEGER NOT NULL DEFAULT 0,
  session_timeout_minutes INTEGER NOT NULL DEFAULT 30,
  ip_allowlist_enabled INTEGER NOT NULL DEFAULT 0,
  ip_allowlist_json TEXT,
  last_audit_date TEXT,
  last_audit_result TEXT,
  updated_at TEXT
);

-- 1.9 platform_global_settings
CREATE TABLE IF NOT EXISTS platform_global_settings (
  id TEXT PRIMARY KEY,
  platform_name TEXT NOT NULL DEFAULT '121 Meet.AI',
  support_email TEXT NOT NULL DEFAULT 'support@121meet.ai',
  default_locale TEXT NOT NULL DEFAULT 'en-US',
  default_billing_cycle TEXT NOT NULL DEFAULT 'monthly',
  updated_at TEXT
);

-- 1.10 platform_audit_logs
CREATE TABLE IF NOT EXISTS platform_audit_logs (
  id TEXT PRIMARY KEY,
  chamber_id TEXT REFERENCES platform_chambers(id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  actor_name TEXT,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  details_json TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_platform_audit_logs_chamber ON platform_audit_logs(chamber_id);
CREATE INDEX IF NOT EXISTS idx_platform_audit_logs_created ON platform_audit_logs(created_at);
