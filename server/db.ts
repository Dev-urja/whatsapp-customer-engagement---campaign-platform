import { Pool } from 'pg';
import dotenv from 'dotenv';
import { initSqlite, sqliteQuery, sqliteQueryOne, sqliteExec } from './sqlite';

dotenv.config();

export type DbMode = 'postgres' | 'sqlite';

let mode: DbMode = 'postgres';
let pool: Pool | null = null;

function isPlaceholderPassword() {
  const pwd = process.env.PGPASSWORD || '';
  return !pwd || pwd === 'your_pg_password_here';
}

export function getDbMode(): DbMode {
  return mode;
}

export async function initDb(): Promise<void> {
  const requested = (process.env.DB_MODE || 'auto').toLowerCase();

  if (requested === 'sqlite' || (requested === 'auto' && isPlaceholderPassword())) {
    await initSqlite();
    mode = 'sqlite';
    console.log('📦 Using SQLite (local file database)');
    return;
  }

  pool = new Pool({
    host: process.env.PGHOST || 'localhost',
    port: Number(process.env.PGPORT) || 5432,
    database: process.env.PGDATABASE || 'urja_whatsapp',
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD,
  });

  pool.on('error', (err) => {
    console.error('Unexpected PostgreSQL pool error:', err);
  });

  try {
    await pool.query('SELECT 1');
    mode = 'postgres';
    console.log('🐘 Connected to PostgreSQL');
  } catch (err) {
    if (requested === 'postgres') throw err;
    console.warn('⚠ PostgreSQL unavailable — falling back to SQLite');
    await pool.end().catch(() => {});
    pool = null;
    await initSqlite();
    mode = 'sqlite';
  }
}

export async function checkDb(): Promise<{ ok: boolean; mode: DbMode; message?: string }> {
  try {
    if (mode === 'sqlite') {
      sqliteQuery('SELECT 1 as ok');
      return { ok: true, mode };
    }
    if (!pool) return { ok: false, mode, message: 'Database pool not initialized' };
    await pool.query('SELECT 1');
    return { ok: true, mode };
  } catch (err: any) {
    return { ok: false, mode, message: err.message || 'Database connection failed' };
  }
}

export function mapDbError(err: unknown): string {
  const code = (err as any)?.code;
  if (code === 'ECONNREFUSED') {
    return 'Database is not running. Start PostgreSQL or set DB_MODE=sqlite in .env for local development.';
  }
  if (code === '3D000') {
    return 'Database does not exist. Create it and run: npm run seed';
  }
  if (code === '28P01') {
    return 'Database authentication failed. Check PGPASSWORD in your .env file.';
  }
  if (code === '42P01') {
    return 'Database tables missing. Run: npm run seed';
  }
  return 'Internal server error';
}

export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  if (mode === 'sqlite') return sqliteQuery<T>(text, params);
  if (!pool) throw new Error('Database not initialized');
  const res = await pool.query(text, params);
  return res.rows as T[];
}

export async function queryOne<T = any>(text: string, params?: any[]): Promise<T | null> {
  if (mode === 'sqlite') return sqliteQueryOne<T>(text, params);
  if (!pool) throw new Error('Database not initialized');
  const res = await pool.query(text, params);
  return (res.rows[0] as T) || null;
}

export async function exec(text: string, params?: any[]): Promise<void> {
  if (mode === 'sqlite') {
    sqliteExec(text, params);
    return;
  }
  if (!pool) throw new Error('Database not initialized');
  await pool.query(text, params);
}

/** Delete rows by id list — works on both PostgreSQL and SQLite */
export async function deleteByIds(table: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  if (mode === 'sqlite') {
    const placeholders = ids.map(() => '?').join(',');
    sqliteExec(`DELETE FROM ${table} WHERE id IN (${placeholders})`, ids);
    return;
  }
  if (!pool) throw new Error('Database not initialized');
  await pool.query(`DELETE FROM ${table} WHERE id = ANY($1)`, [ids]);
}

export { pool };
