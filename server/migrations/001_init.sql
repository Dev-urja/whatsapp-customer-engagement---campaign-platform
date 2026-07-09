-- Urja WhatsApp Platform — Database Schema

CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  email       TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('Admin', 'Manager', 'Sales')),
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login  TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS customers (
  id                     TEXT PRIMARY KEY,
  name                   TEXT NOT NULL,
  phone                  TEXT NOT NULL,
  email                  TEXT,
  tags                   TEXT[] DEFAULT '{}',
  assigned_sales_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  opt_in_status          BOOLEAN NOT NULL DEFAULT true,
  notes                  TEXT
);

CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id        TEXT PRIMARY KEY,
  name      TEXT NOT NULL,
  category  TEXT NOT NULL CHECK (category IN ('MARKETING', 'UTILITY', 'AUTHENTICATION')),
  language  TEXT NOT NULL DEFAULT 'en_US',
  status    TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('APPROVED', 'PENDING', 'REJECTED')),
  body_text TEXT NOT NULL,
  variables TEXT[] DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS campaigns (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  description     TEXT,
  template_id     TEXT REFERENCES whatsapp_templates(id) ON DELETE SET NULL,
  custom_text     TEXT,
  media_url       TEXT,
  scheduled_time  TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Scheduled', 'Sending', 'Sent')),
  created_by      TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  audience_count  INTEGER DEFAULT 0,
  sent_count      INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  read_count      INTEGER DEFAULT 0,
  failed_count    INTEGER DEFAULT 0,
  reply_count     INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS conversations (
  id              TEXT PRIMARY KEY,
  customer_id     TEXT REFERENCES customers(id) ON DELETE CASCADE,
  sales_user_id   TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unread_count    INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS conversation_messages (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT REFERENCES conversations(id) ON DELETE CASCADE,
  sender          TEXT NOT NULL CHECK (sender IN ('customer', 'sales', 'bot')),
  sender_id       TEXT,
  content         TEXT NOT NULL,
  timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  media_url       TEXT,
  status          TEXT CHECK (status IN ('sent', 'delivered', 'read', 'failed'))
);

CREATE TABLE IF NOT EXISTS chatbot_flows (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  created_by  TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active   BOOLEAN DEFAULT false,
  nodes       JSONB DEFAULT '[]',
  edges       JSONB DEFAULT '[]'
);

-- Single-row settings table (id is always 1)
CREATE TABLE IF NOT EXISTS system_settings (
  id              INTEGER PRIMARY KEY DEFAULT 1,
  phone_number_id TEXT,
  waba_id         TEXT,
  access_token    TEXT,
  verify_token    TEXT,
  webhook_url     TEXT,
  webhook_status  TEXT NOT NULL DEFAULT 'disconnected' CHECK (webhook_status IN ('connected', 'disconnected', 'testing')),
  bot_enabled     BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS roles (
  id          TEXT PRIMARY KEY,
  name        TEXT UNIQUE NOT NULL,
  description TEXT,
  permissions JSONB NOT NULL DEFAULT '[]',
  is_system   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common lookups
CREATE INDEX IF NOT EXISTS idx_customers_assigned_user  ON customers(assigned_sales_user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_created_by     ON campaigns(created_by);
CREATE INDEX IF NOT EXISTS idx_conversations_customer   ON conversations(customer_id);
CREATE INDEX IF NOT EXISTS idx_conv_messages_conv_id    ON conversation_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conv_messages_timestamp  ON conversation_messages(timestamp);
