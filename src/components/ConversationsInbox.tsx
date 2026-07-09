import React, { useState, useEffect, useRef } from 'react';
import { Conversation, ConversationMessage, Customer, User, WhatsAppTemplate, AppRole } from '../types';
import { Search, Send, Clock, BookOpen, UserMinus, Plus, Sparkles, UserPlus, ToggleLeft, ToggleRight, CornerDownLeft, AlertCircle, FileText, Image as ImageIcon, Smile, Bot, Paperclip } from 'lucide-react';
import { isSalesScoped, canViewAllInbox } from '../permissions';

interface ConversationsInboxProps {
  conversations: Conversation[];
  messages: Record<string, ConversationMessage[]>;
  customers: Customer[];
  users: User[];
  templates: WhatsAppTemplate[];
  currentUser: User;
  roles: AppRole[];
  onSendMessage: (convId: string, text: string, sender: 'sales' | 'bot') => void;
  onUpdateConversation: (updatedConv: Conversation) => void;
  onUpdateCustomer: (updatedCust: Customer) => void;
}

export default function ConversationsInbox({
  conversations,
  messages,
  customers,
  users,
  templates,
  currentUser,
  roles,
  onSendMessage,
  onUpdateConversation,
  onUpdateCustomer
}: ConversationsInboxProps) {
  const salesView = isSalesScoped(currentUser.role, roles);
  const viewAllInbox = canViewAllInbox(currentUser.role, roles);
  const [selectedConvId, setSelectedConvId] = useState<string>(conversations[0]?.id || '');
  const [inputText, setInputText] = useState('');
  const [filterUnreadOnly, setFilterUnreadOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'assigned'>(viewAllInbox ? 'all' : 'assigned');
  
  // Quick templates drawer
  const [showTemplatesDropdown, setShowTemplatesDropdown] = useState(false);
  
  // Local active bot toggle per customer thread to demonstrate manual human override / chatbot hand-off
  const [botDeactivatedThreads, setBotDeactivatedThreads] = useState<Record<string, boolean>>({});

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Auto scroll chat to bottom when message arrives
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, selectedConvId]);

  const activeConv = conversations.find(c => c.id === selectedConvId) || conversations[0];
  const activeCustomer = activeConv ? customers.find(cust => cust.id === activeConv.customerId) : null;
  const activeChatMessages = activeConv ? (messages[activeConv.id] || []) : [];

  const isBotActiveForThread = activeConv ? !botDeactivatedThreads[activeConv.id] : true;

  // Filter conversations
  const filteredConversations = conversations.filter(c => {
    const cust = customers.find(cust => cust.id === c.customerId);
    if (!cust) return false;

    const matchesSearch = cust.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          cust.phone.includes(searchQuery);
    const matchesUnread = !filterUnreadOnly || c.unreadCount > 0;
    const matchesRep = activeTab === 'all' || cust.assignedSalesUserId === currentUser.id;

    return matchesSearch && matchesUnread && matchesRep;
  });

  const handleSendText = (textToSend = inputText) => {
    if (!textToSend.trim() || !activeConv) return;

    onSendMessage(activeConv.id, textToSend, 'sales');
    setInputText('');
    setShowTemplatesDropdown(false);
  };

  const handleSelectTemplate = (temp: WhatsAppTemplate) => {
    let body = temp.bodyText;
    // Replace template placeholders with customer name or ellipsis
    body = body.replace('{{1}}', activeCustomer?.name || 'Customer');
    body = body.replace(/\{\{\d+\}\}/g, '…');
    
    setInputText(body);
    setShowTemplatesDropdown(false);
  };

  const toggleBotForThread = () => {
    if (!activeConv) return;
    setBotDeactivatedThreads(prev => ({
      ...prev,
      [activeConv.id]: !prev[activeConv.id]
    }));
  };

  const handleClaimChat = () => {
    if (!activeConv || !activeCustomer) return;
    // Update rep to current user
    onUpdateCustomer({
      ...activeCustomer,
      assignedSalesUserId: currentUser.id
    });
    // Turn off bot automatically since human takes over
    setBotDeactivatedThreads(prev => ({
      ...prev,
      [activeConv.id]: true // disable bot
    }));
    alert(`You have claimed the conversation with ${activeCustomer.name}. Automated chatbot deactivated for this session.`);
  };

  const handleClearUnread = (cId: string) => {
    setSelectedConvId(cId);
    const conv = conversations.find(c => c.id === cId);
    if (conv && conv.unreadCount > 0) {
      onUpdateConversation({
        ...conv,
        unreadCount: 0
      });
    }
  };

  const getRepBadge = (assignedRepId: string) => {
    const user = users.find(u => u.id === assignedRepId);
    if (!user) return 'Unassigned';
    return user.id === currentUser.id ? 'Assigned to Me' : user.name;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 h-[calc(100vh-140px)] select-none text-xs" id="conversations-inbox-root">
      
      {/* LEFT COLUMN: ACTIVE CONVERSATIONS CHANNELS FEED */}
      <div className="bg-white rounded-2xl border border-slate-150 flex flex-col h-full overflow-hidden shadow-xs">
        {/* Navigation Filters */}
        <div className="p-4 border-b border-slate-100 bg-slate-50 space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5 font-display">
              Support Conversations
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </h2>
            <button
              onClick={() => setFilterUnreadOnly(!filterUnreadOnly)}
              className={`text-[10px] font-semibold px-2 py-1 rounded transition-all ${filterUnreadOnly ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'text-slate-400 hover:text-slate-700 bg-slate-100'}`}
            >
              Unread only
            </button>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search incoming chats..."
              className="w-full text-xs pl-9 pr-4 py-2 border border-slate-205 rounded-xl bg-white focus:outline-none focus:border-teal-500 placeholder-slate-450"
            />
          </div>

          {/* Allocation Toggle Tabs */}
          <div className="flex bg-slate-200 p-0.5 rounded-lg text-[10px] font-semibold text-slate-600">
            {viewAllInbox && (
            <button
              onClick={() => setActiveTab('all')}
              className={`flex-1 text-center py-1.5 rounded transition-all ${activeTab === 'all' ? 'bg-white text-slate-850 shadow-xs' : 'hover:text-slate-900'}`}
            >
              All Inbounds
            </button>
            )}
            <button
              onClick={() => setActiveTab('assigned')}
              className={`flex-1 text-center py-1.5 rounded transition-all ${activeTab === 'assigned' ? 'bg-white text-slate-850 shadow-xs' : 'hover:text-slate-900'}`}
            >
              My Chats Only
            </button>
          </div>
        </div>

        {/* Channels List feed scrollbar */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {filteredConversations.length === 0 ? (
            <div className="p-6 text-center text-slate-400 font-normal">
              No matching live conversations found.
            </div>
          ) : (
            filteredConversations.map(conv => {
              const cust = customers.find(c => c.id === conv.customerId);
              const messageArr = messages[conv.id] || [];
              const lastMsg = messageArr[messageArr.length - 1];
              const isSelected = conv.id === selectedConvId;

              if (!cust) return null;

              return (
                <div
                  key={conv.id}
                  onClick={() => handleClearUnread(conv.id)}
                  className={`p-4 cursor-pointer transition-all flex items-start gap-3 relative ${isSelected ? 'bg-urja-accent/30 border-r-4 border-r-urja-primary' : 'hover:bg-slate-50/50 bg-white'}`}
                >
                  <div className="relative shrink-0 mt-0.5">
                    {/* Circle avatar logo */}
                    <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-800 font-bold border border-slate-200 flex items-center justify-center font-display">
                      {cust.name.substring(0, 2).toUpperCase()}
                    </div>
                    {conv.unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-550 border border-white text-[9px] font-bold text-white w-5 h-5 rounded-full flex items-center justify-center font-mono">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex justify-between items-baseline">
                      <span className="font-semibold text-slate-850 text-sm truncate pr-1">
                        {cust.name}
                      </span>
                      <span className="text-[9px] text-slate-400 shrink-0 font-mono">
                        {new Date(conv.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-500 truncate font-normal leading-normal">
                      {lastMsg ? lastMsg.content : 'No chats logged yet.'}
                    </p>

                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      <span className="inline-block text-[9px] font-mono bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                        {getRepBadge(cust.assignedSalesUserId)}
                      </span>
                      {!botDeactivatedThreads[conv.id] && (
                        <span className="inline-flex items-center gap-0.5 text-[8px] font-semibold bg-emerald-50 text-emerald-700 px-1 rounded border border-emerald-150">
                          <Bot className="w-2.5 h-2.5" /> BOT ACTIVE
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT SIDE: MAIN MESSAGING WINDOW CHAT */}
      <div className="bg-white rounded-2xl border border-slate-150 flex flex-col h-full lg:col-span-2 overflow-hidden shadow-xs">
        {activeCustomer && activeConv ? (
          <>
            {/* Active chat header controls */}
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-wrap items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-800 font-bold border border-slate-200 flex items-center justify-center font-display text-sm">
                  {activeCustomer.name.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                    {activeCustomer.name}
                    {!isBotActiveForThread && (
                      <span className="text-[9px] bg-amber-50 text-amber-705 font-semibold px-2 py-0.5 border border-amber-200 rounded">
                        HUMAN IN CHARGE
                      </span>
                    )}
                  </h3>
                  <p className="text-[10px] text-slate-450 font-mono">Channel: {activeCustomer.phone}</p>
                </div>
              </div>

              {/* Header Action Tools */}
              <div className="flex items-center gap-2">
                {/* Active Chatbot switch */}
                <button
                  type="button"
                  onClick={toggleBotForThread}
                  className={`text-[10px] font-semibold px-2.5 py-1.5 rounded-lg border flex items-center gap-1.5 transition-all ${isBotActiveForThread ? 'bg-emerald-50 text-emerald-800 border-emerald-250 hover:bg-emerald-100' : 'bg-slate-50 text-slate-450 border-slate-200 hover:text-slate-800'}`}
                >
                  <Bot className="w-3.5 h-3.5" />
                  {isBotActiveForThread ? 'Chatbot Engine: ON' : 'Chatbot: OFF (Human only)'}
                </button>

                {activeCustomer.assignedSalesUserId !== currentUser.id ? (
                  <button
                    onClick={handleClaimChat}
                    className="bg-urja-primary hover:bg-urja-primary/95 text-white text-[10px] font-semibold px-3 py-1.5 rounded-lg transition-all shadow-xs"
                  >
                    Claim Thread
                  </button>
                ) : (
                  <span className="text-[10px] bg-indigo-50 text-indigo-700 font-semibold px-2.5 py-1.5 rounded-lg border border-indigo-200">
                    My Claimed Chat
                  </span>
                )}
              </div>
            </div>

            {/* Scrolling Chat history area */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3.5 custom-canvas-pattern bg-[#ede6df]">
              <div className="text-center font-mono text-[9px] text-slate-450 bg-white/75 py-1 rounded-full max-w-[200px] mx-auto border border-white/50">
                🔒 Direct Cloud API Encryption Enabled
              </div>

              {activeChatMessages.map(msg => {
                const isOutbound = msg.sender === 'sales' || msg.sender === 'bot';
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isOutbound ? 'justify-end' : 'justify-start'} animate-scale-up`}
                  >
                    <div className={`max-w-[75%] rounded-2xl p-3.5 shadow-xs relative ${isOutbound ? 'bg-white rounded-tr-none text-slate-800' : 'bg-slate-900 rounded-tl-none text-slate-100'}`}>
                      {/* Sender label for bot or support */}
                      {msg.sender === 'bot' && (
                        <span className="inline-flex items-center gap-0.5 text-[8px] font-bold bg-emerald-500 text-white px-1.5 py-0.2 rounded mb-1 font-mono uppercase tracking-wider">
                          CHATBOT FLOW
                        </span>
                      )}
                      {msg.sender === 'sales' && (
                        <span className="block text-[8px] font-bold text-teal-605 mb-1 font-mono uppercase tracking-widest">
                          AGENT: {currentUser.name.split(' ')[0]}
                        </span>
                      )}

                      <p className="text-xs leading-normal font-normal whitespace-pre-wrap">{msg.content}</p>
                      
                      <div className="flex items-center justify-end gap-1 mt-1 text-[8px] text-slate-400 font-mono">
                        <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        {isOutbound && <span className="text-blue-500 font-bold" title="Read check">✓✓</span>}
                      </div>

                      {/* Cute tail style hack for WhatsApp design feel */}
                      <div className={`absolute top-0 w-2 h-2 ${isOutbound ? 'right-0 translate-x-1.5 bg-white' : 'left-0 -translate-x-1.5 bg-slate-900'}`} style={{ clipPath: isOutbound ? 'polygon(0 0, 0 100%, 100% 0)' : 'polygon(100% 0, 0 0, 100% 100%)' }} />
                    </div>
                  </div>
                );
              })}

              <div ref={messagesEndRef} />
            </div>

            {/* WhatsApp approved template drawer chooser inside conversation chat */}
            {showTemplatesDropdown && (
              <div className="bg-slate-50 border-t border-slate-150 p-3 animate-slide-up space-y-2 max-h-[160px] overflow-y-auto">
                <div className="flex justify-between items-center text-[10px] font-semibold text-slate-500 uppercase tracking-widest font-mono">
                  <span>Send Approved WhatsApp Template</span>
                  <button onClick={() => setShowTemplatesDropdown(false)} className="text-slate-400 hover:text-slate-700">
                    Hide
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {templates.filter(t => t.status === 'APPROVED').map(temp => (
                    <div
                      key={temp.id}
                      onClick={() => handleSelectTemplate(temp)}
                      className="p-2.5 bg-white border border-slate-200 hover:border-teal-500 rounded-xl cursor-pointer hover:shadow-xs transition-all space-y-1"
                    >
                      <span className="font-bold text-slate-800 font-mono text-[10px] inline-block bg-slate-100 px-1 py-0.5 rounded">{temp.name}</span>
                      <p className="text-[10px] text-slate-500 line-clamp-1">{temp.bodyText}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Input Form area */}
            <form
              onSubmit={e => {
                e.preventDefault();
                handleSendText();
              }}
              className="p-3 border-t border-slate-150 bg-slate-50 flex items-center gap-2 relative shadow-inner"
            >
              {/* Approved Templates picker trigger */}
              <button
                type="button"
                onClick={() => setShowTemplatesDropdown(!showTemplatesDropdown)}
                className={`p-2.5 rounded-xl border transition-all flex items-center gap-1 text-[11px] font-semibold ${showTemplatesDropdown ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-205 text-slate-600 hover:bg-slate-100'}`}
                title="Send Approved Templates"
              >
                <FileText className="w-4 h-4 text-indigo-650" />
                Templates
              </button>

              <input
                type="text"
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                placeholder={isBotActiveForThread ? "Automated bot active. Type a human reply to claim the thread (bot deactivated automatically)..." : "Type a WhatsApp response (canned template values auto-compile)..."}
                className="flex-1 text-xs border border-slate-205 rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-urja-primary placeholder-slate-400 bg-white"
              />

              <button
                type="submit"
                disabled={!inputText.trim()}
                className="p-2.5 bg-urja-primary text-white rounded-xl hover:bg-urja-primary/95 text-xs font-semibold shrink-0 transition-all disabled:opacity-40 disabled:pointer-events-none shadow-xs"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-400">
            No conversation channel requested. Choose a thread to start chatting.
          </div>
        )}
      </div>

    </div>
  );
}
