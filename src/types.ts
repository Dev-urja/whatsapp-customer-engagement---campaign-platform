export type UserRole = 'Admin' | 'Manager' | 'Sales' | string;

export interface AppRole {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
  created_at: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: 'active' | 'inactive';
  created_at: string;
  lastLogin: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  tags: string[];
  assignedSalesUserId: string; // references User
  created_at: string;
  optInStatus: boolean;
  notes?: string;
}

export interface WhatsAppTemplate {
  id: string;
  name: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  language: string;
  status: 'APPROVED' | 'PENDING' | 'REJECTED';
  bodyText: string;
  variables: string[];
}

export interface Campaign {
  id: string;
  name: string;
  description: string;
  templateId: string;
  customText?: string;
  mediaUrl?: string;
  scheduledTime?: string;
  status: 'Draft' | 'Scheduled' | 'Sending' | 'Sent';
  createdBy: string; // references User id
  created_at: string;
  audienceCount: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  replyCount: number;
}

export type MessageStatus = 'sent' | 'delivered' | 'read' | 'failed';

export interface OutboundMessage {
  id: string;
  campaignId: string;
  customerId: string;
  whatsappMessageId: string;
  sentAt: string;
  direction: 'outbound';
  content: string;
  status: MessageStatus;
}

export interface Conversation {
  id: string;
  customerId: string;
  salesUserId: string; // reference to assigned sales user
  created_at: string;
  last_message_at: string;
  unreadCount: number;
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  sender: 'customer' | 'sales' | 'bot';
  senderId?: string; // empty if 'customer', user ID if 'sales', 'bot-1' if 'bot'
  content: string;
  timestamp: string;
  mediaUrl?: string;
  status?: MessageStatus;
}

export type ChatbotNodeType = 'START' | 'MESSAGE' | 'CHOICE' | 'CONDITION' | 'HANDOFF' | 'END';

export interface ChatbotNode {
  id: string;
  type: ChatbotNodeType;
  title: string;
  position: { x: number; y: number };
  config: {
    messageText?: string;
    mediaUrl?: string;
    // For Choice nodes
    choices?: { label: string; nextNodeId: string }[];
    // For Condition nodes
    conditionField?: string;
    conditionValue?: string;
    trueNodeId?: string;
    falseNodeId?: string;
    // For Handoff
    routingStrategy?: 'round-robin' | 'specific-agent';
    agentId?: string;
  };
}

export interface ChatbotEdge {
  id: string;
  sourceId: string;
  targetId: string;
  sourceHandle?: string; // For branching
}

export interface ChatbotFlow {
  id: string;
  name: string;
  description: string;
  created_by: string;
  created_at: string;
  isActive: boolean;
  nodes: ChatbotNode[];
  edges: ChatbotEdge[];
}

export interface SystemSettings {
  phoneNumberId: string;
  wabaId: string;
  accessToken: string;
  verifyToken: string;
  webhookUrl: string;
  webhookStatus: 'connected' | 'disconnected' | 'testing';
  botEnabled: boolean;
}
