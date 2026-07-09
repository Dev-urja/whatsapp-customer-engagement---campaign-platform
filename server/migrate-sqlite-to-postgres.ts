/**
 * One-time migration: copy data from data/urja.db (SQLite) into PostgreSQL.
 * Run: npm run migrate:sqlite-to-pg
 *
 * Prerequisites:
 * - PostgreSQL running with schema seeded (npm run seed)
 * - .env configured with DB_MODE=postgres and valid PGPASSWORD
 */
import fs from 'fs';
import path from 'path';
import initSqlJs from 'sql.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { initDb, getDbMode, pool, exec } from './db';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'data', 'urja.db');

function parseJson(value: unknown, fallback: unknown) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
}

function asBool(value: unknown): boolean {
  return value === true || value === 1 || value === '1';
}

function asStringArray(value: unknown): string[] {
  const parsed = parseJson(value, []);
  if (Array.isArray(parsed)) return parsed.map(String);
  if (typeof value === 'string' && value.includes(',')) {
    return value.split(',').map(v => v.trim()).filter(Boolean);
  }
  return [];
}

function asTimestamp(value: unknown): string | null {
  if (!value) return null;
  const text = String(value);
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function readSqliteTable(table: string): Promise<Record<string, unknown>[]> {
  const SQL = await initSqlJs({
    locateFile: (file) => path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', file),
  });
  const db = new SQL.Database(fs.readFileSync(DB_PATH));
  const stmt = db.prepare(`SELECT * FROM ${table}`);
  const rows: Record<string, unknown>[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as Record<string, unknown>);
  }
  stmt.free();
  db.close();
  return rows;
}

async function runMigration002() {
  const sql = fs.readFileSync(path.join(__dirname, 'migrations', '002_relax_user_role_check.sql'), 'utf-8');
  await exec(sql);
}

async function migrateRoles(rows: Record<string, unknown>[]) {
  for (const row of rows) {
    await pool!.query(
      `INSERT INTO roles (id, name, description, permissions, is_system, created_at)
       VALUES ($1,$2,$3,$4,$5,COALESCE($6::timestamptz, NOW()))
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         permissions = EXCLUDED.permissions,
         is_system = EXCLUDED.is_system`,
      [
        row.id,
        row.name,
        row.description ?? '',
        JSON.stringify(parseJson(row.permissions, [])),
        asBool(row.is_system),
        asTimestamp(row.created_at),
      ]
    );
  }
}

async function migrateUsers(rows: Record<string, unknown>[]) {
  for (const row of rows) {
    await pool!.query(
      `INSERT INTO users (id, name, email, password_hash, role, status, created_at, last_login)
       VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7::timestamptz, NOW()),$8::timestamptz)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         email = EXCLUDED.email,
         password_hash = EXCLUDED.password_hash,
         role = EXCLUDED.role,
         status = EXCLUDED.status,
         last_login = EXCLUDED.last_login`,
      [
        row.id,
        row.name,
        row.email,
        row.password_hash,
        row.role,
        row.status ?? 'active',
        asTimestamp(row.created_at),
        asTimestamp(row.last_login),
      ]
    );
  }
}

async function migrateCustomers(rows: Record<string, unknown>[]) {
  for (const row of rows) {
    await pool!.query(
      `INSERT INTO customers (id, name, phone, email, tags, assigned_sales_user_id, created_at, opt_in_status, notes)
       VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7::timestamptz, NOW()),$8,$9)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         phone = EXCLUDED.phone,
         email = EXCLUDED.email,
         tags = EXCLUDED.tags,
         assigned_sales_user_id = EXCLUDED.assigned_sales_user_id,
         opt_in_status = EXCLUDED.opt_in_status,
         notes = EXCLUDED.notes`,
      [
        row.id,
        row.name,
        row.phone,
        row.email ?? null,
        asStringArray(row.tags),
        row.assigned_sales_user_id ?? null,
        asTimestamp(row.created_at),
        asBool(row.opt_in_status),
        row.notes ?? null,
      ]
    );
  }
}

async function migrateTemplates(rows: Record<string, unknown>[]) {
  for (const row of rows) {
    await pool!.query(
      `INSERT INTO whatsapp_templates (id, name, category, language, status, body_text, variables)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         category = EXCLUDED.category,
         language = EXCLUDED.language,
         status = EXCLUDED.status,
         body_text = EXCLUDED.body_text,
         variables = EXCLUDED.variables`,
      [
        row.id,
        row.name,
        row.category,
        row.language ?? 'en_US',
        row.status ?? 'PENDING',
        row.body_text,
        asStringArray(row.variables),
      ]
    );
  }
}

async function migrateCampaigns(rows: Record<string, unknown>[]) {
  for (const row of rows) {
    await pool!.query(
      `INSERT INTO campaigns (
         id, name, description, template_id, custom_text, media_url, scheduled_time,
         status, created_by, created_at, audience_count, sent_count, delivered_count,
         read_count, failed_count, reply_count
       ) VALUES ($1,$2,$3,$4,$5,$6,$7::timestamptz,$8,$9,COALESCE($10::timestamptz, NOW()),$11,$12,$13,$14,$15,$16)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         template_id = EXCLUDED.template_id,
         custom_text = EXCLUDED.custom_text,
         media_url = EXCLUDED.media_url,
         scheduled_time = EXCLUDED.scheduled_time,
         status = EXCLUDED.status,
         created_by = EXCLUDED.created_by,
         audience_count = EXCLUDED.audience_count,
         sent_count = EXCLUDED.sent_count,
         delivered_count = EXCLUDED.delivered_count,
         read_count = EXCLUDED.read_count,
         failed_count = EXCLUDED.failed_count,
         reply_count = EXCLUDED.reply_count`,
      [
        row.id,
        row.name,
        row.description ?? null,
        row.template_id ?? null,
        row.custom_text ?? null,
        row.media_url ?? null,
        asTimestamp(row.scheduled_time),
        row.status ?? 'Draft',
        row.created_by ?? null,
        asTimestamp(row.created_at),
        Number(row.audience_count ?? 0),
        Number(row.sent_count ?? 0),
        Number(row.delivered_count ?? 0),
        Number(row.read_count ?? 0),
        Number(row.failed_count ?? 0),
        Number(row.reply_count ?? 0),
      ]
    );
  }
}

async function migrateConversations(rows: Record<string, unknown>[]) {
  for (const row of rows) {
    await pool!.query(
      `INSERT INTO conversations (id, customer_id, sales_user_id, created_at, last_message_at, unread_count)
       VALUES ($1,$2,$3,COALESCE($4::timestamptz, NOW()),COALESCE($5::timestamptz, NOW()),$6)
       ON CONFLICT (id) DO UPDATE SET
         customer_id = EXCLUDED.customer_id,
         sales_user_id = EXCLUDED.sales_user_id,
         last_message_at = EXCLUDED.last_message_at,
         unread_count = EXCLUDED.unread_count`,
      [
        row.id,
        row.customer_id ?? null,
        row.sales_user_id ?? null,
        asTimestamp(row.created_at),
        asTimestamp(row.last_message_at),
        Number(row.unread_count ?? 0),
      ]
    );
  }
}

async function migrateMessages(rows: Record<string, unknown>[]) {
  for (const row of rows) {
    await pool!.query(
      `INSERT INTO conversation_messages (id, conversation_id, sender, sender_id, content, timestamp, media_url, status)
       VALUES ($1,$2,$3,$4,$5,COALESCE($6::timestamptz, NOW()),$7,$8)
       ON CONFLICT (id) DO UPDATE SET
         conversation_id = EXCLUDED.conversation_id,
         sender = EXCLUDED.sender,
         sender_id = EXCLUDED.sender_id,
         content = EXCLUDED.content,
         timestamp = EXCLUDED.timestamp,
         media_url = EXCLUDED.media_url,
         status = EXCLUDED.status`,
      [
        row.id,
        row.conversation_id ?? null,
        row.sender,
        row.sender_id ?? null,
        row.content,
        asTimestamp(row.timestamp),
        row.media_url ?? null,
        row.status ?? null,
      ]
    );
  }
}

async function migrateChatbotFlows(rows: Record<string, unknown>[]) {
  for (const row of rows) {
    await pool!.query(
      `INSERT INTO chatbot_flows (id, name, description, created_by, created_at, is_active, nodes, edges)
       VALUES ($1,$2,$3,$4,COALESCE($5::timestamptz, NOW()),$6,$7,$8)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         created_by = EXCLUDED.created_by,
         is_active = EXCLUDED.is_active,
         nodes = EXCLUDED.nodes,
         edges = EXCLUDED.edges`,
      [
        row.id,
        row.name,
        row.description ?? '',
        row.created_by ?? null,
        asTimestamp(row.created_at),
        asBool(row.is_active),
        JSON.stringify(parseJson(row.nodes, [])),
        JSON.stringify(parseJson(row.edges, [])),
      ]
    );
  }
}

async function migrateSettings(rows: Record<string, unknown>[]) {
  for (const row of rows) {
    await pool!.query(
      `INSERT INTO system_settings (id, phone_number_id, waba_id, access_token, verify_token, webhook_url, webhook_status, bot_enabled)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (id) DO UPDATE SET
         phone_number_id = EXCLUDED.phone_number_id,
         waba_id = EXCLUDED.waba_id,
         access_token = EXCLUDED.access_token,
         verify_token = EXCLUDED.verify_token,
         webhook_url = EXCLUDED.webhook_url,
         webhook_status = EXCLUDED.webhook_status,
         bot_enabled = EXCLUDED.bot_enabled`,
      [
        Number(row.id ?? 1),
        row.phone_number_id ?? '',
        row.waba_id ?? '',
        row.access_token ?? '',
        row.verify_token ?? '',
        row.webhook_url ?? '',
        row.webhook_status ?? 'disconnected',
        asBool(row.bot_enabled),
      ]
    );
  }
}

async function main() {
  console.log('🚀 SQLite → PostgreSQL migration\n');

  if (!fs.existsSync(DB_PATH)) {
    console.log(`ℹ No SQLite file at ${DB_PATH}. Nothing to migrate.`);
    return;
  }

  await initDb();
  if (getDbMode() !== 'postgres' || !pool) {
    throw new Error('PostgreSQL is not configured. Set DB_MODE=postgres and valid PGPASSWORD in .env');
  }

  await runMigration002();
  console.log('✓ Applied role constraint migration');

  const tables: Array<[string, (rows: Record<string, unknown>[]) => Promise<void>]> = [
    ['roles', migrateRoles],
    ['users', migrateUsers],
    ['customers', migrateCustomers],
    ['whatsapp_templates', migrateTemplates],
    ['campaigns', migrateCampaigns],
    ['conversations', migrateConversations],
    ['conversation_messages', migrateMessages],
    ['chatbot_flows', migrateChatbotFlows],
    ['system_settings', migrateSettings],
  ];

  for (const [table, migrateFn] of tables) {
    const rows = await readSqliteTable(table);
    await migrateFn(rows);
    console.log(`✓ Migrated ${rows.length} row(s) from ${table}`);
  }

  const backupPath = `${DB_PATH}.bak`;
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(DB_PATH, backupPath);
    console.log(`\n✓ Backed up SQLite database to ${backupPath}`);
  }

  console.log('\n✅ Migration complete.');
}

main()
  .catch(err => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    if (pool) await pool.end();
  });
