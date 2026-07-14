import { query, queryOne, exec } from '../db';
import { sendTextMessage } from './client';
import { loadWhatsAppSettings } from './settings';

type FlowNode = {
  id: string;
  type: string;
  title?: string;
  config?: {
    messageText?: string;
    choices?: { label: string; nextNodeId: string }[];
    conditionField?: string;
    conditionValue?: string;
    trueNodeId?: string;
    falseNodeId?: string;
    routingStrategy?: 'round-robin' | 'specific-agent';
    agentId?: string;
  };
};

type FlowEdge = {
  id: string;
  sourceId: string;
  targetId: string;
  sourceHandle?: string;
};

type ChatbotFlow = {
  id: string;
  name: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
};

function parseFlow(row: any): ChatbotFlow | null {
  if (!row) return null;
  const nodes = typeof row.nodes === 'string' ? JSON.parse(row.nodes) : row.nodes || [];
  const edges = typeof row.edges === 'string' ? JSON.parse(row.edges) : row.edges || [];
  return { id: row.id, name: row.name, nodes, edges };
}

async function loadActiveFlow(): Promise<ChatbotFlow | null> {
  const row = await queryOne('SELECT * FROM chatbot_flows WHERE is_active = true LIMIT 1');
  return parseFlow(row);
}

async function getSession(conversationId: string) {
  return queryOne<{ conversation_id: string; current_node_id: string }>(
    'SELECT conversation_id, current_node_id FROM chatbot_sessions WHERE conversation_id = $1',
    [conversationId]
  );
}

async function setSession(conversationId: string, nodeId: string) {
  await exec(
    `INSERT INTO chatbot_sessions (conversation_id, current_node_id, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (conversation_id) DO UPDATE SET
       current_node_id = EXCLUDED.current_node_id,
       updated_at = NOW()`,
    [conversationId, nodeId]
  );
}

async function clearSession(conversationId: string) {
  await exec('DELETE FROM chatbot_sessions WHERE conversation_id = $1', [conversationId]);
}

function getOutgoingTargets(flow: ChatbotFlow, nodeId: string): FlowEdge[] {
  return flow.edges.filter((e) => e.sourceId === nodeId);
}

function getSingleTarget(flow: ChatbotFlow, nodeId: string): string | null {
  const edges = getOutgoingTargets(flow, nodeId);
  return edges[0]?.targetId || null;
}

function findNode(flow: ChatbotFlow, nodeId: string): FlowNode | undefined {
  return flow.nodes.find((n) => n.id === nodeId);
}

function formatChoiceMenu(node: FlowNode): string {
  const prompt = node.config?.messageText?.trim() || 'Please choose an option:';
  const choices = node.config?.choices || [];
  if (choices.length === 0) return prompt;
  const lines = choices.map((c, i) => `${i + 1}. ${c.label}`);
  return `${prompt}\n\n${lines.join('\n')}`;
}

function matchChoice(node: FlowNode, input: string, flow: ChatbotFlow): string | null {
  const normalized = input.trim().toLowerCase();
  const choices = node.config?.choices || [];

  const byLabel = choices.find((c) => c.label.trim().toLowerCase() === normalized);
  if (byLabel?.nextNodeId) return byLabel.nextNodeId;

  const byNumber = choices[Number(normalized) - 1];
  if (byNumber?.nextNodeId) return byNumber.nextNodeId;

  const edge = flow.edges.find(
    (e) => e.sourceId === node.id && e.sourceHandle?.trim().toLowerCase() === normalized
  );
  return edge?.targetId || null;
}

function evaluateCondition(node: FlowNode, customer: any): string | null {
  const field = node.config?.conditionField || 'tags';
  const expected = (node.config?.conditionValue || '').trim().toLowerCase();
  let actual = '';

  if (field === 'tags') {
    const tags = Array.isArray(customer.tags)
      ? customer.tags
      : typeof customer.tags === 'string'
        ? JSON.parse(customer.tags || '[]')
        : [];
    actual = tags.join(',').toLowerCase();
    const match = tags.some((t: string) => String(t).toLowerCase() === expected);
    return match ? node.config?.trueNodeId || null : node.config?.falseNodeId || null;
  }

  actual = String(customer[field] ?? '').toLowerCase();
  const match = actual.includes(expected);
  return match ? node.config?.trueNodeId || null : node.config?.falseNodeId || null;
}

async function pickSalesUser(node: FlowNode): Promise<string | null> {
  if (node.config?.routingStrategy === 'specific-agent' && node.config.agentId) {
    return node.config.agentId;
  }

  const salesUsers = await query<any>(
    `SELECT id FROM users WHERE role IN ('Sales', 'Manager', 'Admin') AND status = 'active' ORDER BY created_at`
  );
  if (salesUsers.length === 0) return null;

  const counts = await query<{ sales_user_id: string; count: string }>(
    `SELECT sales_user_id, COUNT(*)::text AS count
     FROM conversations
     WHERE sales_user_id IS NOT NULL
     GROUP BY sales_user_id`
  );
  const countMap = new Map(counts.map((c) => [c.sales_user_id, Number(c.count)]));

  salesUsers.sort((a, b) => (countMap.get(a.id) || 0) - (countMap.get(b.id) || 0));
  return salesUsers[0].id;
}

async function sendBotReply(conversationId: string, phone: string, text: string) {
  const trimmed = text.trim();
  if (!trimmed) return;

  let messageId: string | null = null;
  try {
    const result = await sendTextMessage(phone, trimmed);
    messageId = result.messageId || null;
  } catch (err) {
    console.error('Chatbot send failed:', err);
    return;
  }

  const id = `cm-bot-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  await queryOne(
    `INSERT INTO conversation_messages (id, conversation_id, sender, content, whatsapp_message_id, status)
     VALUES ($1,$2,'bot',$3,$4,'sent') RETURNING *`,
    [id, conversationId, trimmed, messageId]
  );
  await exec('UPDATE conversations SET last_message_at = NOW() WHERE id = $1', [conversationId]);
}

async function executeFromNode(
  flow: ChatbotFlow,
  conversationId: string,
  customer: any,
  startNodeId: string,
  userInput: string | null
): Promise<void> {
  let nodeId: string | null = startNodeId;

  while (nodeId) {
    const node = findNode(flow, nodeId);
    if (!node) break;

    switch (node.type) {
      case 'START': {
        nodeId = getSingleTarget(flow, node.id);
        break;
      }
      case 'MESSAGE': {
        await sendBotReply(conversationId, customer.phone, node.config?.messageText || '');
        await setSession(conversationId, node.id);
        return;
      }
      case 'CHOICE': {
        await sendBotReply(conversationId, customer.phone, formatChoiceMenu(node));
        await setSession(conversationId, node.id);
        return;
      }
      case 'CONDITION': {
        nodeId = evaluateCondition(node, customer);
        break;
      }
      case 'HANDOFF': {
        const agentId = await pickSalesUser(node);
        if (agentId) {
          await exec('UPDATE conversations SET sales_user_id = $1 WHERE id = $2', [
            agentId,
            conversationId,
          ]);
        }
        const handoffText =
          node.config?.messageText?.trim() ||
          'Thanks! A team member will assist you shortly.';
        await sendBotReply(conversationId, customer.phone, handoffText);
        await clearSession(conversationId);
        return;
      }
      case 'END': {
        if (node.config?.messageText?.trim()) {
          await sendBotReply(conversationId, customer.phone, node.config.messageText);
        }
        await clearSession(conversationId);
        return;
      }
      default:
        return;
    }
  }
}

export async function processChatbotMessage(
  conversationId: string,
  customer: any,
  inboundText: string
): Promise<void> {
  const settings = await loadWhatsAppSettings();
  if (!settings?.botEnabled) return;

  const conv = await queryOne<any>('SELECT sales_user_id FROM conversations WHERE id = $1', [
    conversationId,
  ]);
  if (conv?.sales_user_id) return;

  const flow = await loadActiveFlow();
  if (!flow || flow.nodes.length === 0) return;

  const session = await getSession(conversationId);
  const input = inboundText.trim();

  if (!session) {
    const startNode = flow.nodes.find((n) => n.type === 'START');
    if (!startNode) return;
    const firstTarget = getSingleTarget(flow, startNode.id);
    if (!firstTarget) return;
    await executeFromNode(flow, conversationId, customer, firstTarget, null);
    return;
  }

  const currentNode = findNode(flow, session.current_node_id);
  if (!currentNode) {
    await clearSession(conversationId);
    return;
  }

  if (currentNode.type === 'CHOICE') {
    const nextId = matchChoice(currentNode, input, flow);
    if (!nextId) {
      await sendBotReply(
        conversationId,
        customer.phone,
        'Please reply with one of the listed option numbers or labels.'
      );
      return;
    }
    await executeFromNode(flow, conversationId, customer, nextId, input);
    return;
  }

  if (currentNode.type === 'MESSAGE') {
    const nextId = getSingleTarget(flow, currentNode.id);
    if (!nextId) {
      await clearSession(conversationId);
      return;
    }
    await executeFromNode(flow, conversationId, customer, nextId, input);
    return;
  }

  const nextId = getSingleTarget(flow, currentNode.id);
  if (nextId) {
    await executeFromNode(flow, conversationId, customer, nextId, input);
  }
}
