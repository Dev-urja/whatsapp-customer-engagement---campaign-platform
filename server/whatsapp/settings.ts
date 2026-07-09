import crypto from 'crypto';
import { queryOne } from '../db';

export interface WhatsAppSettings {
  phoneNumberId: string;
  wabaId: string;
  accessToken: string;
  verifyToken: string;
  webhookUrl: string;
  webhookStatus: string;
  botEnabled: boolean;
}

export function getPublicBaseUrl(): string {
  const base = (process.env.PUBLIC_URL || process.env.APP_URL || 'http://localhost:3001').replace(/\/$/, '');
  return base;
}

export function getWebhookUrl(): string {
  return `${getPublicBaseUrl()}/api/webhook`;
}

export function generateVerifyToken(): string {
  return crypto.randomBytes(24).toString('hex');
}

export async function loadWhatsAppSettings(): Promise<WhatsAppSettings | null> {
  const row = await queryOne<any>('SELECT * FROM system_settings WHERE id = 1');
  if (!row) return null;

  return {
    phoneNumberId: row.phone_number_id || '',
    wabaId: row.waba_id || '',
    accessToken: row.access_token || '',
    verifyToken: row.verify_token || '',
    webhookUrl: row.webhook_url || '',
    webhookStatus: row.webhook_status || 'disconnected',
    botEnabled: row.bot_enabled ?? false,
  };
}

export function isWhatsAppConfigured(settings: WhatsAppSettings | null): settings is WhatsAppSettings {
  return Boolean(settings?.phoneNumberId && settings?.accessToken);
}
