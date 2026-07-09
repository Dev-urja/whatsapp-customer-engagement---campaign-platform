import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import { DEFAULT_ROLES } from '../src/roleDefaults.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'urja.db');

let db: Database | null = null;

function save() {
  if (!db) return;
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
}

function pgToSqlite(text: string): string {
  return text
    .replace(/\bNOW\(\)/gi, "datetime('now')")
    .replace(/\$(\d+)/g, '?');
}

function normalizeRow(row: Record<string, unknown>): Record<string, unknown> {
  const out = { ...row };
  for (const key of ['tags', 'variables', 'nodes', 'edges', 'permissions']) {
    if (typeof out[key] === 'string') {
      try { out[key] = JSON.parse(out[key] as string); } catch { /* keep string */ }
    }
  }
  for (const key of ['opt_in_status', 'is_active', 'bot_enabled', 'is_system']) {
    if (out[key] === 1) out[key] = true;
    if (out[key] === 0) out[key] = false;
  }
  return out;
}

function bindParams(params: unknown[]): unknown[] {
  return params.map(p => {
    if (Array.isArray(p)) return JSON.stringify(p);
    if (typeof p === 'boolean') return p ? 1 : 0;
    return p;
  });
}

export function getSqliteDb() {
  if (!db) throw new Error('SQLite database not initialized');
  return db;
}

export async function initSqlite(): Promise<void> {
  const SQL = await initSqlJs({
    locateFile: (file) =>
      path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', file),
  });

  if (fs.existsSync(DB_PATH)) {
    db = new SQL.Database(fs.readFileSync(DB_PATH));
    ensureRolesSchema();
    ensureWhatsAppSchema();
  } else {
    db = new SQL.Database();
    runMigration();
    await seedData();
    save();
  }

  console.log(`✓ SQLite database ready at ${DB_PATH}`);
}

export function sqliteQuery<T = Record<string, unknown>>(text: string, params: unknown[] = []): T[] {
  if (!db) throw new Error('SQLite database not initialized');
  const sql = pgToSqlite(text);
  const isWrite = /^\s*(INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)/i.test(sql.trim());
  const stmt = db.prepare(sql);
  stmt.bind(bindParams(params));
  const rows: T[] = [];
  while (stmt.step()) {
    rows.push(normalizeRow(stmt.getAsObject()) as T);
  }
  stmt.free();
  if (isWrite) save();
  return rows;
}

export function sqliteQueryOne<T = Record<string, unknown>>(text: string, params: unknown[] = []): T | null {
  const rows = sqliteQuery<T>(text, params);
  return rows[0] ?? null;
}

export function sqliteExec(text: string, params: unknown[] = []): void {
  if (!db) throw new Error('SQLite database not initialized');
  const sql = pgToSqlite(text);
  db.run(sql, bindParams(params));
  save();
}

function runMigration() {
  if (!db) return;
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_login TEXT
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      tags TEXT DEFAULT '[]',
      assigned_sales_user_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      opt_in_status INTEGER NOT NULL DEFAULT 1,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS whatsapp_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      language TEXT NOT NULL DEFAULT 'en_US',
      status TEXT NOT NULL DEFAULT 'PENDING',
      body_text TEXT NOT NULL,
      variables TEXT DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      template_id TEXT,
      custom_text TEXT,
      media_url TEXT,
      scheduled_time TEXT,
      status TEXT NOT NULL DEFAULT 'Draft',
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      audience_count INTEGER DEFAULT 0,
      sent_count INTEGER DEFAULT 0,
      delivered_count INTEGER DEFAULT 0,
      read_count INTEGER DEFAULT 0,
      failed_count INTEGER DEFAULT 0,
      reply_count INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      customer_id TEXT,
      sales_user_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_message_at TEXT NOT NULL DEFAULT (datetime('now')),
      unread_count INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS conversation_messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT,
      sender TEXT NOT NULL,
      sender_id TEXT,
      content TEXT NOT NULL,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      media_url TEXT,
      status TEXT
    );

    CREATE TABLE IF NOT EXISTS chatbot_flows (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      is_active INTEGER DEFAULT 0,
      nodes TEXT DEFAULT '[]',
      edges TEXT DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS system_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      phone_number_id TEXT,
      waba_id TEXT,
      access_token TEXT,
      verify_token TEXT,
      webhook_url TEXT,
      webhook_status TEXT NOT NULL DEFAULT 'disconnected',
      bot_enabled INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      permissions TEXT NOT NULL DEFAULT '[]',
      is_system INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

function ensureWhatsAppSchema() {
  if (!db) return;
  const cols = db.exec(`PRAGMA table_info(conversation_messages)`);
  const names = new Set((cols[0]?.values || []).map((row) => row[1]));
  if (!names.has('whatsapp_message_id')) {
    db.run('ALTER TABLE conversation_messages ADD COLUMN whatsapp_message_id TEXT');
    save();
  }
}

function ensureRolesSchema() {
  if (!db) return;
  db.run(`
    CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      permissions TEXT NOT NULL DEFAULT '[]',
      is_system INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  seedRoles();
  save();
}

function seedRoles() {
  if (!db) return;
  for (const role of DEFAULT_ROLES) {
    db.run(
      `INSERT INTO roles (id, name, description, permissions, is_system) VALUES (?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         description = excluded.description,
         permissions = excluded.permissions,
         is_system = excluded.is_system`,
      [role.id, role.name, role.description, JSON.stringify(role.permissions), role.isSystem ? 1 : 0]
    );
  }
  console.log('✓ Synced default roles');
}

async function seedData() {
  if (!db) return;

  seedRoles();

  const userCount = db.exec('SELECT COUNT(*) as c FROM users');
  const totalUsers = userCount[0]?.values[0]?.[0] as number;
  if (totalUsers === 0) {
    const hash = await bcrypt.hash('Urja@2026!', 10);
    db.run(
      `INSERT INTO users (id, name, email, password_hash, role, status, created_at, last_login) VALUES (?,?,?,?,?,?,?,?)`,
      ['u-1', 'Admin', 'admin@urjagroup.com', hash, 'Admin', 'active', new Date().toISOString(), null]
    );
  }

  db.run(
    `INSERT OR IGNORE INTO system_settings (id, phone_number_id, waba_id, access_token, verify_token, webhook_url, webhook_status, bot_enabled) VALUES (1,?,?,?,?,?,?,?)`,
    ['', '', '', '', '', 'disconnected', 0]
  );

  const nodes = JSON.stringify([
    { id: 'node-start', type: 'START', title: 'Start', position: { x: 80, y: 120 }, config: { messageText: '' } },
  ]);
  db.run(
    `INSERT OR IGNORE INTO chatbot_flows (id, name, description, created_by, is_active, nodes, edges) VALUES (?,?,?,?,?,?,?)`,
    ['flow-1', 'Default Flow', '', 'u-1', 1, nodes, '[]']
  );

  console.log('✓ Database initialized (no sample data)');
}
