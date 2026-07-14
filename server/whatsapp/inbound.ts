import { query, queryOne, exec } from '../db';
import { normalizePhone } from './phone';
import { processChatbotMessage } from './chatbotEngine';

type WaStatus = 'sent' | 'delivered' | 'read' | 'failed';

function mapWaStatus(status: string): WaStatus | null {
  if (status === 'sent' || status === 'delivered' || status === 'read' || status === 'failed') {
    return status;
  }
  return null;
}

async function findCustomerByPhone(phone: string) {
  const rows = await query<any>('SELECT * FROM customers');
  const normalized = normalizePhone(phone);
  return rows.find((c) => normalizePhone(c.phone) === normalized) || null;
}

async function findOrCreateCustomer(phone: string, profileName?: string) {
  const existing = await findCustomerByPhone(phone);
  if (existing) return existing;

  const id = `cust-wa-${Date.now()}`;
  const row = await queryOne(
    `INSERT INTO customers (id, name, phone, email, tags, assigned_sales_user_id, opt_in_status, notes)
     VALUES ($1,$2,$3,NULL,'[]',NULL,true,$4) RETURNING *`,
    [id, profileName || phone, phone, 'Created from WhatsApp inbound message']
  );
  return row;
}

async function findOrCreateConversation(customerId: string) {
  const existing = await queryOne<any>(
    'SELECT * FROM conversations WHERE customer_id = $1 ORDER BY created_at ASC LIMIT 1',
    [customerId]
  );
  if (existing) return existing;

  const id = `conv-wa-${Date.now()}`;
  return queryOne(
    `INSERT INTO conversations (id, customer_id, sales_user_id, unread_count)
     VALUES ($1,$2,NULL,0) RETURNING *`,
    [id, customerId]
  );
}

async function storeInboundMessage(
  conversationId: string,
  content: string,
  whatsappMessageId?: string
) {
  const id = `cm-wa-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  await queryOne(
    `INSERT INTO conversation_messages (id, conversation_id, sender, content, whatsapp_message_id, status)
     VALUES ($1,$2,'customer',$3,$4,'delivered') RETURNING *`,
    [id, conversationId, content, whatsappMessageId || null]
  );

  await exec(
    `UPDATE conversations
     SET last_message_at = NOW(), unread_count = unread_count + 1
     WHERE id = $1`,
    [conversationId]
  );
}

async function updateMessageStatus(whatsappMessageId: string, status: WaStatus) {
  await exec(
    `UPDATE conversation_messages SET status = $1 WHERE whatsapp_message_id = $2`,
    [status, whatsappMessageId]
  );
}

async function maybeAutoReply(
  conversationId: string,
  customer: any,
  content: string
) {
  try {
    await processChatbotMessage(conversationId, customer, content);
  } catch (err) {
    console.error('Chatbot processing failed:', err);
  }
}

export async function processWhatsAppWebhook(body: any) {
  if (body?.object !== 'whatsapp_business_account') return;

  const entries = body.entry || [];
  for (const entry of entries) {
    for (const change of entry.changes || []) {
      const value = change.value;
      if (!value) continue;

      if (value.statuses) {
        for (const statusUpdate of value.statuses) {
          const waId = statusUpdate.id;
          const mapped = mapWaStatus(statusUpdate.status);
          if (waId && mapped) {
            await updateMessageStatus(waId, mapped);
          }
        }
      }

      if (value.messages) {
        const contactName = value.contacts?.[0]?.profile?.name;
        for (const message of value.messages) {
          const from = message.from as string;
          const text =
            message.text?.body ||
            message.button?.text ||
            message.interactive?.button_reply?.title ||
            message.interactive?.list_reply?.title ||
            '';

          if (!from) continue;

          const customer = await findOrCreateCustomer(from, contactName);
          const conversation = await findOrCreateConversation(customer.id);
          if (!conversation) continue;

          if (text) {
            await storeInboundMessage(conversation.id, text, message.id);
            await maybeAutoReply(conversation.id, customer, text);
          }
        }
      }
    }
  }
}
