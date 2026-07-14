-- Track per-conversation position in the active chatbot flow
CREATE TABLE IF NOT EXISTS chatbot_sessions (
  conversation_id TEXT PRIMARY KEY REFERENCES conversations(id) ON DELETE CASCADE,
  current_node_id TEXT NOT NULL,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
