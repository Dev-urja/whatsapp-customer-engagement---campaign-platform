-- Track Meta message IDs for delivery/read status webhooks
ALTER TABLE conversation_messages
  ADD COLUMN IF NOT EXISTS whatsapp_message_id TEXT;

CREATE INDEX IF NOT EXISTS idx_conversation_messages_wa_id
  ON conversation_messages (whatsapp_message_id)
  WHERE whatsapp_message_id IS NOT NULL;
