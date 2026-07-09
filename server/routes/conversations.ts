import { Router, Response } from 'express';
import { query, queryOne, exec } from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { sendTextMessage, WhatsAppApiError } from '../whatsapp/client';

const router = Router();
router.use(requireAuth);

function mapConversation(row: any) {
  return {
    id: row.id,
    customerId: row.customer_id,
    salesUserId: row.sales_user_id,
    created_at: row.created_at,
    last_message_at: row.last_message_at,
    unreadCount: row.unread_count,
  };
}

function mapMessage(row: any) {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    sender: row.sender,
    senderId: row.sender_id || undefined,
    content: row.content,
    timestamp: row.timestamp,
    mediaUrl: row.media_url || undefined,
    status: row.status || undefined,
    whatsappMessageId: row.whatsapp_message_id || undefined,
  };
}

// GET /api/conversations
router.get('/', async (_req: AuthRequest, res: Response) => {
  try {
    const rows = await query('SELECT * FROM conversations ORDER BY last_message_at DESC');
    res.json(rows.map(mapConversation));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch conversations' });
  }
});

// GET /api/conversations/:id/messages
router.get('/:id/messages', async (req: AuthRequest, res: Response) => {
  try {
    const rows = await query(
      'SELECT * FROM conversation_messages WHERE conversation_id = $1 ORDER BY timestamp ASC',
      [req.params.id]
    );
    res.json(rows.map(mapMessage));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch messages' });
  }
});

// GET /api/conversations/messages/all  — returns all messages keyed by conversation_id
router.get('/messages/all', async (_req: AuthRequest, res: Response) => {
  try {
    const rows = await query('SELECT * FROM conversation_messages ORDER BY timestamp ASC');
    const grouped: Record<string, any[]> = {};
    for (const row of rows) {
      const key = row.conversation_id;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(mapMessage(row));
    }
    res.json(grouped);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch all messages' });
  }
});

// POST /api/conversations/:id/messages
router.post('/:id/messages', async (req: AuthRequest, res: Response) => {
  const { id: convId } = req.params;
  const { sender, senderId, content, mediaUrl, status } = req.body;
  const newId = `cm-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  try {
    let whatsappMessageId: string | null = null;
    let messageStatus = status || 'sent';

    if ((sender === 'sales' || sender === 'bot') && content?.trim()) {
      const conv = await queryOne<any>(
        `SELECT c.phone, c.opt_in_status FROM conversations conv
         JOIN customers c ON c.id = conv.customer_id
         WHERE conv.id = $1`,
        [convId]
      );
      if (!conv) return res.status(404).json({ message: 'Conversation not found' });
      if (!conv.opt_in_status) {
        return res.status(400).json({ message: 'Customer has not opted in to WhatsApp messages.' });
      }
      if (!conv.phone) {
        return res.status(400).json({ message: 'Conversation has no customer phone number' });
      }

      try {
        const result = await sendTextMessage(conv.phone, content);
        whatsappMessageId = result.messageId || null;
        messageStatus = 'sent';
      } catch (err) {
        const msg = err instanceof WhatsAppApiError ? err.message : 'Failed to send via WhatsApp';
        return res.status(502).json({ message: msg, details: err instanceof WhatsAppApiError ? err.details : undefined });
      }
    }

    const row = await queryOne(
      `INSERT INTO conversation_messages (id, conversation_id, sender, sender_id, content, media_url, status, whatsapp_message_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [newId, convId, sender, senderId || null, content, mediaUrl || null, messageStatus, whatsappMessageId]
    );

    await exec(
      'UPDATE conversations SET last_message_at = NOW() WHERE id = $1',
      [convId]
    );

    res.status(201).json(mapMessage(row));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to send message' });
  }
});

// POST /api/conversations/:id/messages/incoming  — simulates inbound customer message
router.post('/:id/messages/incoming', async (req: AuthRequest, res: Response) => {
  const { id: convId } = req.params;
  const { content } = req.body;
  const newId = `cm-incoming-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  try {
    const row = await queryOne(
      `INSERT INTO conversation_messages (id, conversation_id, sender, content)
       VALUES ($1,$2,'customer',$3) RETURNING *`,
      [newId, convId, content]
    );

    await exec(
      `UPDATE conversations SET last_message_at = NOW(), unread_count = unread_count + 1 WHERE id = $1`,
      [convId]
    );

    res.status(201).json(mapMessage(row));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to add incoming message' });
  }
});

// PUT /api/conversations/:id
router.put('/:id', async (req: AuthRequest, res: Response) => {
  const { salesUserId, unreadCount } = req.body;
  try {
    const row = await queryOne(
      `UPDATE conversations SET
        sales_user_id = COALESCE($1, sales_user_id),
        unread_count  = COALESCE($2, unread_count)
       WHERE id = $3 RETURNING *`,
      [salesUserId, unreadCount, req.params.id]
    );
    if (!row) return res.status(404).json({ message: 'Conversation not found' });
    res.json(mapConversation(row));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to update conversation' });
  }
});

export default router;
