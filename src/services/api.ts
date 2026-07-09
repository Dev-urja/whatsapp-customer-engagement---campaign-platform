import type {
  User, Customer, WhatsAppTemplate, Campaign,
  Conversation, ConversationMessage, ChatbotFlow, SystemSettings, AppRole
} from '../types';

const BASE = '/api';

const token = {
  get: () => localStorage.getItem('wa_token'),
  set: (t: string) => localStorage.setItem('wa_token', t),
  clear: () => localStorage.removeItem('wa_token'),
};

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const tok = token.get();
  if (tok) headers['Authorization'] = `Bearer ${tok}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || `Request failed: ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export async function login(email: string, password: string): Promise<{ token: string; user: User }> {
  const data = await req<{ token: string; user: User }>('POST', '/auth/login', { email, password });
  token.set(data.token);
  return data;
}

export function logout() {
  token.clear();
}

export function getMe(): Promise<User> {
  return req('GET', '/auth/me');
}

export function isLoggedIn(): boolean {
  return Boolean(token.get());
}

// ─── Customers ───────────────────────────────────────────────────────────────

export const getCustomers = (): Promise<Customer[]> =>
  req('GET', '/customers');

export const createCustomer = (data: Omit<Customer, 'id' | 'created_at'>): Promise<Customer> =>
  req('POST', '/customers', data);

export const importCustomers = (customers: Customer[]): Promise<Customer[]> =>
  req('POST', '/customers/import', { customers });

export const updateCustomer = (id: string, data: Partial<Customer>): Promise<Customer> =>
  req('PUT', `/customers/${id}`, data);

export const deleteCustomers = (ids: string[]): Promise<{ deleted: number }> =>
  req('DELETE', '/customers', { ids });

// ─── Campaigns ───────────────────────────────────────────────────────────────

export const getCampaigns = (): Promise<Campaign[]> =>
  req('GET', '/campaigns');

export const createCampaign = (data: Omit<Campaign, 'id' | 'created_at'>): Promise<Campaign> =>
  req('POST', '/campaigns', data);

export const updateCampaign = (id: string, data: Partial<Campaign>): Promise<Campaign> =>
  req('PUT', `/campaigns/${id}`, data);

export const deleteCampaign = (id: string): Promise<{ deleted: boolean }> =>
  req('DELETE', `/campaigns/${id}`);

export const sendCampaign = (
  id: string,
  payload: { audienceTags?: string[]; templateVariables?: Record<string, string> }
): Promise<{ campaign: Campaign; sent: number; failed: number; total: number }> =>
  req('POST', `/campaigns/${id}/send`, payload);

// ─── Conversations ────────────────────────────────────────────────────────────

export const getConversations = (): Promise<Conversation[]> =>
  req('GET', '/conversations');

export const getAllMessages = (): Promise<Record<string, ConversationMessage[]>> =>
  req('GET', '/conversations/messages/all');

export const getMessages = (convId: string): Promise<ConversationMessage[]> =>
  req('GET', `/conversations/${convId}/messages`);

export const sendMessage = (convId: string, payload: { sender: string; senderId?: string; content: string; status?: string }): Promise<ConversationMessage> =>
  req('POST', `/conversations/${convId}/messages`, payload);

export const addIncomingMessage = (convId: string, content: string): Promise<ConversationMessage> =>
  req('POST', `/conversations/${convId}/messages/incoming`, { content });

export const updateConversation = (id: string, data: Partial<Conversation>): Promise<Conversation> =>
  req('PUT', `/conversations/${id}`, data);

// ─── Templates ───────────────────────────────────────────────────────────────

export const getTemplates = (): Promise<WhatsAppTemplate[]> =>
  req('GET', '/templates');

export const createTemplate = (data: Omit<WhatsAppTemplate, 'id'>): Promise<WhatsAppTemplate> =>
  req('POST', '/templates', data);

export const deleteTemplate = (id: string): Promise<{ deleted: boolean }> =>
  req('DELETE', `/templates/${id}`);

export const syncTemplatesFromMeta = (): Promise<{ synced: number; templates: WhatsAppTemplate[] }> =>
  req('POST', '/templates/sync', {});

// ─── Users ───────────────────────────────────────────────────────────────────

export const getUsers = (): Promise<User[]> =>
  req('GET', '/users');

export const createUser = (data: Partial<User> & { password?: string }): Promise<User> =>
  req('POST', '/users', data);

export const updateUser = (id: string, data: Partial<User>): Promise<User> =>
  req('PUT', `/users/${id}`, data);

export const deleteUser = (id: string): Promise<{ deleted: boolean }> =>
  req('DELETE', `/users/${id}`);

// ─── Roles ───────────────────────────────────────────────────────────────────

export const getRoles = (): Promise<AppRole[]> =>
  req('GET', '/roles');

export const createRole = (data: Omit<AppRole, 'created_at'>): Promise<AppRole> =>
  req('POST', '/roles', data);

export const updateRole = (id: string, data: Partial<AppRole>): Promise<AppRole> =>
  req('PUT', `/roles/${id}`, data);

export const deleteRole = (id: string): Promise<{ deleted: boolean }> =>
  req('DELETE', `/roles/${id}`);

// ─── Settings ────────────────────────────────────────────────────────────────

export const getSettings = (): Promise<SystemSettings> =>
  req('GET', '/settings');

export const updateSettings = (data: SystemSettings): Promise<SystemSettings> =>
  req('PUT', '/settings', data);

export const testWhatsAppSettings = (): Promise<{ ok: boolean; phoneNumberId: string }> =>
  req('POST', '/settings/test', {});

// ─── Chatbot ─────────────────────────────────────────────────────────────────

export const getChatbotFlow = (): Promise<ChatbotFlow> =>
  req('GET', '/chatbot/flow');

export const saveChatbotFlow = (flow: ChatbotFlow): Promise<ChatbotFlow> =>
  req('PUT', '/chatbot/flow', flow);

// ─── AI ──────────────────────────────────────────────────────────────────────

export const generateAIReply = (payload: {
  conversationHistory: ConversationMessage[];
  customerName: string;
  chatbotContext?: string;
}): Promise<{ reply: string; fallback?: boolean }> =>
  req('POST', '/ai/generate-reply', payload);
