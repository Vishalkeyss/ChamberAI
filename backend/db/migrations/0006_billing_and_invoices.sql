-- Migration: 0006_billing_and_invoices.sql
-- Module 6: Billing & Invoicing (6 tables)
-- Canonical Reference: database/DB_tables_reference.md & database/DB_schema.dbml

-- 6.2 payment_methods (created before invoices due to FK dependency)
CREATE TABLE IF NOT EXISTS payment_methods (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN ('card', 'bank_account', 'upi')),
  brand TEXT,
  last_four TEXT,
  expiry_month INTEGER,
  expiry_year INTEGER,
  is_default INTEGER NOT NULL DEFAULT 0,
  gateway_token_encrypted TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_payment_methods_chamber ON payment_methods(chamber_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_user ON payment_methods(user_id);

-- 6.1 invoices
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL UNIQUE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  invoice_type TEXT NOT NULL CHECK(invoice_type IN ('membership', 'event', 'store', 'sponsorship', 'custom', 'donation')),
  description TEXT,
  amount REAL NOT NULL DEFAULT 0.0,
  tax_amount REAL NOT NULL DEFAULT 0.0,
  discount_amount REAL NOT NULL DEFAULT 0.0,
  total_amount REAL NOT NULL DEFAULT 0.0,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT DEFAULT 'unpaid' CHECK(status IN ('paid', 'unpaid', 'overdue', 'refund_requested', 'refunded', 'cancelled')),
  due_date TEXT NOT NULL,
  paid_at TEXT,
  payment_method_id TEXT REFERENCES payment_methods(id) ON DELETE SET NULL,
  payment_gateway_txn_id TEXT,
  related_event_id TEXT REFERENCES events(id) ON DELETE SET NULL,
  related_order_id TEXT,
  related_plan_id TEXT REFERENCES membership_plans(id) ON DELETE SET NULL,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_invoices_chamber ON invoices(chamber_id);
CREATE INDEX IF NOT EXISTS idx_invoices_user ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);

-- 6.3 payment_gateway_config
CREATE TABLE IF NOT EXISTS payment_gateway_config (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL UNIQUE REFERENCES platform_chambers(id) ON DELETE CASCADE,
  provider TEXT DEFAULT 'none' CHECK(provider IN ('stripe', 'razorpay', 'paypal', 'none')),
  publishable_key_encrypted TEXT,
  secret_key_encrypted TEXT,
  status TEXT DEFAULT 'not_connected' CHECK(status IN ('connected', 'not_connected')),
  connected_at TEXT,
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_payment_gateway_chamber ON payment_gateway_config(chamber_id);

-- 6.4 financial_exports
CREATE TABLE IF NOT EXISTS financial_exports (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  sync_id TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL,
  sync_type TEXT NOT NULL CHECK(sync_type IN ('direct_sync', 'file_download')),
  date_from TEXT NOT NULL,
  date_to TEXT NOT NULL,
  revenue_sources_json TEXT,
  export_basis TEXT DEFAULT 'accrual' CHECK(export_basis IN ('cash', 'accrual')),
  records_count INTEGER NOT NULL DEFAULT 0,
  total_amount REAL NOT NULL DEFAULT 0.0,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'success', 'failed')),
  triggered_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  file_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_financial_exports_chamber ON financial_exports(chamber_id);
CREATE INDEX IF NOT EXISTS idx_financial_exports_status ON financial_exports(status);

-- 6.5 financial_export_schedule
CREATE TABLE IF NOT EXISTS financial_export_schedule (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL UNIQUE REFERENCES platform_chambers(id) ON DELETE CASCADE,
  frequency TEXT NOT NULL CHECK(frequency IN ('daily', 'weekly', 'monthly')),
  destination TEXT NOT NULL,
  next_scheduled_at TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_financial_export_sched_chamber ON financial_export_schedule(chamber_id);

-- 6.6 cart_items
CREATE TABLE IF NOT EXISTS cart_items (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK(item_type IN ('event_ticket', 'store_product', 'marketplace_listing', 'donation')),
  item_id TEXT NOT NULL,
  ticket_type_id TEXT,
  variant_json TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL DEFAULT 0.0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cart_items_chamber ON cart_items(chamber_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_user ON cart_items(user_id);
