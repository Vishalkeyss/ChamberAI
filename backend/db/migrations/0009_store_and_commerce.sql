-- Migration: 0009_store_and_commerce.sql
-- Module 18: E-Commerce Store (6 tables)
-- Canonical Reference: database/DB_tables_reference.md & database/DB_schema.dbml

-- 18.2 store_categories (created before products due to FK)
CREATE TABLE IF NOT EXISTS store_categories (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  product_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_store_cat_chamber ON store_categories(chamber_id);

-- 18.1 store_products
CREATE TABLE IF NOT EXISTS store_products (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  category_id TEXT REFERENCES store_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  short_description TEXT,
  description TEXT,
  product_type TEXT NOT NULL CHECK(product_type IN ('physical', 'digital', 'donation')),
  sku TEXT,
  price REAL,
  original_price REAL,
  special_price REAL,
  special_from TEXT,
  special_to TEXT,
  member_price REAL,
  stock_quantity INTEGER,
  image_key TEXT,
  attributes_json TEXT,
  bulk_pricing_json TEXT,
  download_file_key TEXT,
  unlimited_downloads INTEGER NOT NULL DEFAULT 1,
  max_download_count INTEGER,
  download_access_days INTEGER,
  download_activation_type TEXT DEFAULT 'immediate_after_payment' CHECK(download_activation_type IN ('immediate_after_payment', 'order_complete')),
  customer_enters_amount INTEGER NOT NULL DEFAULT 0,
  minimum_amount REAL,
  maximum_amount REAL,
  cross_sell_product_ids TEXT,
  related_product_ids TEXT,
  weight REAL,
  show_on_homepage INTEGER NOT NULL DEFAULT 0,
  allow_reviews INTEGER NOT NULL DEFAULT 1,
  disable_buy_button INTEGER NOT NULL DEFAULT 0,
  disable_wishlist INTEGER NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'published', 'archived')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT,
  UNIQUE(chamber_id, sku)
);
CREATE INDEX IF NOT EXISTS idx_store_products_chamber ON store_products(chamber_id);
CREATE INDEX IF NOT EXISTS idx_store_products_status ON store_products(status);
CREATE INDEX IF NOT EXISTS idx_store_products_category ON store_products(category_id);

-- 18.3 store_orders
CREATE TABLE IF NOT EXISTS store_orders (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  order_number TEXT NOT NULL UNIQUE,
  customer_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_company TEXT,
  is_guest_order INTEGER NOT NULL DEFAULT 0,
  is_impersonated INTEGER NOT NULL DEFAULT 0,
  subtotal REAL NOT NULL DEFAULT 0.0,
  shipping_cost REAL NOT NULL DEFAULT 0.0,
  tax_amount REAL NOT NULL DEFAULT 0.0,
  total REAL NOT NULL DEFAULT 0.0,
  order_status TEXT DEFAULT 'processing' CHECK(order_status IN ('processing', 'complete', 'cancelled')),
  payment_status TEXT DEFAULT 'unpaid' CHECK(payment_status IN ('paid', 'unpaid', 'refunded')),
  shipping_status TEXT DEFAULT 'not_shipped' CHECK(shipping_status IN ('not_shipped', 'shipped', 'delivered', 'not_applicable')),
  shipping_method TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_store_orders_chamber ON store_orders(chamber_id);
CREATE INDEX IF NOT EXISTS idx_store_orders_user ON store_orders(customer_user_id);
CREATE INDEX IF NOT EXISTS idx_store_orders_status ON store_orders(order_status);

-- 18.4 store_order_items
CREATE TABLE IF NOT EXISTS store_order_items (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL REFERENCES platform_chambers(id) ON DELETE CASCADE,
  order_id TEXT NOT NULL REFERENCES store_orders(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES store_products(id) ON DELETE CASCADE,
  variant_json TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL DEFAULT 0.0,
  total_price REAL NOT NULL DEFAULT 0.0,
  donation_amount REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_store_order_items_chamber ON store_order_items(chamber_id);
CREATE INDEX IF NOT EXISTS idx_store_order_items_order ON store_order_items(order_id);

-- 18.5 store_shipping_config
CREATE TABLE IF NOT EXISTS store_shipping_config (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL UNIQUE REFERENCES platform_chambers(id) ON DELETE CASCADE,
  method_type TEXT NOT NULL DEFAULT 'fixed_rate' CHECK(method_type IN ('fixed_rate', 'by_weight')),
  fixed_methods_json TEXT,
  weight_config_json TEXT,
  free_shipping_enabled INTEGER NOT NULL DEFAULT 0,
  free_shipping_threshold REAL,
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_store_shipping_chamber ON store_shipping_config(chamber_id);

-- 18.6 store_settings
CREATE TABLE IF NOT EXISTS store_settings (
  id TEXT PRIMARY KEY,
  chamber_id TEXT NOT NULL UNIQUE REFERENCES platform_chambers(id) ON DELETE CASCADE,
  is_open INTEGER NOT NULL DEFAULT 1,
  welcome_text TEXT,
  about_text TEXT,
  shipping_info_text TEXT,
  privacy_info_text TEXT,
  checkout_register_prompt TEXT,
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_store_settings_chamber ON store_settings(chamber_id);
