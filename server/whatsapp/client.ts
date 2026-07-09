import { loadWhatsAppSettings, isWhatsAppConfigured } from './settings';
import { normalizePhone } from './phone';

const GRAPH_API_VERSION = process.env.WHATSAPP_API_VERSION || 'v21.0';

export class WhatsAppApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'WhatsAppApiError';
  }
}

async function graphRequest(
  settings: { phoneNumberId: string; accessToken: string },
  path: string,
  options: RequestInit = {}
) {
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${settings.accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || res.statusText || 'WhatsApp API request failed';
    throw new WhatsAppApiError(msg, res.status, data?.error);
  }
  return data;
}

export async function testWhatsAppConnection() {
  const settings = await loadWhatsAppSettings();
  if (!isWhatsAppConfigured(settings)) {
    throw new WhatsAppApiError('Phone Number ID and Access Token are required in Settings.');
  }

  await graphRequest(settings, settings.phoneNumberId, { method: 'GET' });
  return { ok: true, phoneNumberId: settings.phoneNumberId };
}

export async function sendTextMessage(toPhone: string, body: string) {
  const settings = await loadWhatsAppSettings();
  if (!isWhatsAppConfigured(settings)) {
    throw new WhatsAppApiError('WhatsApp is not configured. Add credentials in Settings.');
  }

  const data = await graphRequest(settings, `${settings.phoneNumberId}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: normalizePhone(toPhone),
      type: 'text',
      text: { body },
    }),
  });

  const messageId = data?.messages?.[0]?.id as string | undefined;
  return { messageId, raw: data };
}

export interface TemplateComponent {
  type: 'body' | 'header' | 'button';
  parameters?: Array<{ type: 'text'; text: string }>;
}

export async function sendTemplateMessage(
  toPhone: string,
  templateName: string,
  languageCode: string,
  components?: TemplateComponent[]
) {
  const settings = await loadWhatsAppSettings();
  if (!isWhatsAppConfigured(settings)) {
    throw new WhatsAppApiError('WhatsApp is not configured. Add credentials in Settings.');
  }

  const template: Record<string, unknown> = {
    name: templateName,
    language: { code: languageCode },
  };
  if (components?.length) {
    template.components = components;
  }

  const data = await graphRequest(settings, `${settings.phoneNumberId}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: normalizePhone(toPhone),
      type: 'template',
      template,
    }),
  });

  const messageId = data?.messages?.[0]?.id as string | undefined;
  return { messageId, raw: data };
}

export async function syncTemplatesFromMeta() {
  const settings = await loadWhatsAppSettings();
  if (!isWhatsAppConfigured(settings) || !settings.wabaId) {
    throw new WhatsAppApiError('WABA ID, Phone Number ID, and Access Token are required.');
  }

  const data = await graphRequest(
    settings,
    `${settings.wabaId}/message_templates?fields=name,status,language,category,components&limit=100`,
    { method: 'GET' }
  );

  return (data?.data || []) as Array<{
    name: string;
    status: string;
    language: string;
    category: string;
    components?: Array<{ type: string; text?: string }>;
  }>;
}
