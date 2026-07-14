/**
 * Minimal seed — creates schema, default roles, one admin user, and empty settings.
 * Run: npm run seed  (PostgreSQL only; SQLite auto-initializes on server start)
 *
 * Default admin password: Urja@2026!
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { pool, initDb, getDbMode } from './db';
import { DEFAULT_ROLES } from '../src/roleDefaults.ts';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PASSWORD = 'Urja@2026!';

async function runMigration() {
  const migrationFiles = ['001_init.sql', '002_relax_user_role_check.sql', '003_whatsapp_message_id.sql', '004_chatbot_sessions.sql'];
  for (const file of migrationFiles) {
    const sql = fs.readFileSync(path.join(__dirname, 'migrations', file), 'utf-8');
    await pool.query(sql);
    console.log(`✓ Migration complete: ${file}`);
  }
}

async function seedRoles() {
  for (const role of DEFAULT_ROLES) {
    await pool.query(
      `INSERT INTO roles (id, name, description, permissions, is_system)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (id) DO UPDATE SET
         description = EXCLUDED.description,
         permissions = EXCLUDED.permissions`,
      [role.id, role.name, role.description, JSON.stringify(role.permissions), role.isSystem]
    );
  }
  console.log('✓ Seeded roles');
}

async function seedAdminUser() {
  const hash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  await pool.query(
    `INSERT INTO users (id, name, email, password_hash, role, status, created_at, last_login)
     VALUES ($1,$2,$3,$4,$5,$6,NOW(),NULL)
     ON CONFLICT (id) DO NOTHING`,
    ['u-1', 'Admin', 'admin@urjagroup.com', hash, 'Admin', 'active']
  );
  console.log(`✓ Seeded admin user (admin@urjagroup.com / ${DEFAULT_PASSWORD})`);
}

async function seedEmptySettings() {
  await pool.query(
    `INSERT INTO system_settings (id, phone_number_id, waba_id, access_token, verify_token, webhook_url, webhook_status, bot_enabled)
     VALUES (1,'','','','','','disconnected',false)
     ON CONFLICT (id) DO NOTHING`
  );
  console.log('✓ Seeded empty system settings');
}

async function seedEmptyChatbotFlow() {
  const nodes = [
    { id: 'node-start', type: 'START', title: 'Start', position: { x: 80, y: 120 }, config: { messageText: '' } },
    {
      id: 'node-welcome',
      type: 'MESSAGE',
      title: 'Welcome',
      position: { x: 280, y: 120 },
      config: { messageText: 'Hello! Welcome to Urja Group. Thanks for messaging us on WhatsApp.' },
    },
    {
      id: 'node-menu',
      type: 'CHOICE',
      title: 'Main menu',
      position: { x: 500, y: 120 },
      config: {
        messageText: 'How can we help you today?',
        choices: [
          { label: 'Sales inquiry', nextNodeId: 'node-handoff' },
          { label: 'Support', nextNodeId: 'node-handoff' },
          { label: 'Just browsing', nextNodeId: 'node-end' },
        ],
      },
    },
    {
      id: 'node-handoff',
      type: 'HANDOFF',
      title: 'Connect to agent',
      position: { x: 720, y: 80 },
      config: {
        messageText: 'Connecting you with our team. Someone will reply shortly.',
        routingStrategy: 'round-robin',
      },
    },
    {
      id: 'node-end',
      type: 'END',
      title: 'Goodbye',
      position: { x: 720, y: 200 },
      config: { messageText: 'No problem! Message us anytime if you need help.' },
    },
  ];
  const edges = [
    { id: 'edge-start-welcome', sourceId: 'node-start', targetId: 'node-welcome' },
    { id: 'edge-welcome-menu', sourceId: 'node-welcome', targetId: 'node-menu' },
  ];
  await pool.query(
    `INSERT INTO chatbot_flows (id, name, description, created_by, created_at, is_active, nodes, edges)
     VALUES ($1,$2,$3,$4,NOW(),true,$5,$6)
     ON CONFLICT (id) DO NOTHING`,
    ['flow-1', 'Default Flow', 'Starter welcome + menu flow', 'u-1', JSON.stringify(nodes), JSON.stringify(edges)]
  );
  console.log('✓ Seeded default chatbot flow');
}

async function upgradeEmptyChatbotFlow() {
  const row = await pool.query(`SELECT nodes FROM chatbot_flows WHERE id = 'flow-1' LIMIT 1`);
  const nodes = row.rows[0]?.nodes;
  const parsed = typeof nodes === 'string' ? JSON.parse(nodes) : nodes;
  if (!Array.isArray(parsed) || parsed.length !== 1) return;

  const starterNodes = [
    { id: 'node-start', type: 'START', title: 'Start', position: { x: 80, y: 120 }, config: { messageText: '' } },
    {
      id: 'node-welcome',
      type: 'MESSAGE',
      title: 'Welcome',
      position: { x: 280, y: 120 },
      config: { messageText: 'Hello! Welcome to Urja Group. Thanks for messaging us on WhatsApp.' },
    },
    {
      id: 'node-menu',
      type: 'CHOICE',
      title: 'Main menu',
      position: { x: 500, y: 120 },
      config: {
        messageText: 'How can we help you today?',
        choices: [
          { label: 'Sales inquiry', nextNodeId: 'node-handoff' },
          { label: 'Support', nextNodeId: 'node-handoff' },
          { label: 'Just browsing', nextNodeId: 'node-end' },
        ],
      },
    },
    {
      id: 'node-handoff',
      type: 'HANDOFF',
      title: 'Connect to agent',
      position: { x: 720, y: 80 },
      config: {
        messageText: 'Connecting you with our team. Someone will reply shortly.',
        routingStrategy: 'round-robin',
      },
    },
    {
      id: 'node-end',
      type: 'END',
      title: 'Goodbye',
      position: { x: 720, y: 200 },
      config: { messageText: 'No problem! Message us anytime if you need help.' },
    },
  ];
  const starterEdges = [
    { id: 'edge-start-welcome', sourceId: 'node-start', targetId: 'node-welcome' },
    { id: 'edge-welcome-menu', sourceId: 'node-welcome', targetId: 'node-menu' },
  ];

  await pool.query(
    `UPDATE chatbot_flows
     SET description = $1, nodes = $2, edges = $3
     WHERE id = 'flow-1'`,
    ['Starter welcome + menu flow', JSON.stringify(starterNodes), JSON.stringify(starterEdges)]
  );
  console.log('✓ Upgraded empty chatbot flow to starter template');
}

async function main() {
  console.log('🚀 Starting minimal seed...\n');
  try {
    await initDb();
    if (getDbMode() === 'sqlite') {
      console.log('SQLite mode auto-initializes on server start. Delete data/urja.db to reset.');
      return;
    }
    await runMigration();
    await seedRoles();
    await seedAdminUser();
    await seedEmptySettings();
    await seedEmptyChatbotFlow();
    await upgradeEmptyChatbotFlow();
    console.log('\n✅ Seed complete (no sample business data).');
  } catch (err) {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  } finally {
    if (getDbMode() === 'postgres' && pool) {
      await pool.end();
    }
  }
}

main();
