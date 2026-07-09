import React, { useState, useEffect, useCallback } from 'react';
import { User, Customer, WhatsAppTemplate, Campaign, Conversation, ConversationMessage, ChatbotFlow, SystemSettings, AppRole } from './types';

import * as api from './services/api';

import LoginPage from './components/LoginPage';
import { defaultSettings } from './defaultSettings';
import AnalyticsDashboards from './components/AnalyticsDashboards';
import CustomersManager from './components/CustomersManager';
import CampaignsManager from './components/CampaignsManager';
import ConversationsInbox from './components/ConversationsInbox';
import ChatbotFlowBuilder from './components/ChatbotFlowBuilder';
import UserManagement from './components/admin/UserManagement';
import RolesManagement from './components/admin/RolesManagement';
import SettingsPanel from './components/admin/SettingsPanel';
import ThemeToggle from './components/ThemeToggle';

import { BarChart3, Users, MessageSquareCode, MessageSquare, Bot, Settings, Bell, LogOut, Shield, UserCog } from 'lucide-react';
import {
  canAccessMenu,
  getDefaultMenu,
  getMenuLabel,
  showRoleSimulator,
  isSalesScoped,
  MenuId,
} from './permissions';

export default function App() {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // ── Navigation ───────────────────────────────────────────────────────────────
  const [activeMenu, setActiveMenu] = useState<MenuId>('dashboards');

  // ── Application State ────────────────────────────────────────────────────────
  const [users, setUsers] = useState<User[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Record<string, ConversationMessage[]>>({});
  const [chatbotFlow, setChatbotFlow] = useState<ChatbotFlow | null>(null);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(false);

  // ── Check existing JWT on mount ───────────────────────────────────────────────
  useEffect(() => {
    if (api.isLoggedIn()) {
      api.getMe()
        .then(user => {
          setCurrentUser(user);
          api.getRoles()
            .then(r => {
              setRoles(r);
              setActiveMenu(getDefaultMenu(user.role, r));
            })
            .catch(() => setActiveMenu(getDefaultMenu(user.role, [])));
        })
        .catch(() => { api.logout(); })
        .finally(() => setAuthChecked(true));
    } else {
      setAuthChecked(true);
    }
  }, []);

  // ── Load all data after login ─────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [u, c, t, camp, conv, msgs, flow, s, r] = await Promise.all([
        api.getUsers(),
        api.getCustomers(),
        api.getTemplates(),
        api.getCampaigns(),
        api.getConversations(),
        api.getAllMessages(),
        api.getChatbotFlow().catch(() => null),
        api.getSettings().catch(() => null),
        api.getRoles().catch(() => [] as AppRole[]),
      ]);
      setUsers(u);
      setCustomers(c);
      setTemplates(t);
      setCampaigns(camp);
      setConversations(conv);
      setMessages(msgs);
      if (flow) setChatbotFlow(flow);
      if (s) setSettings(s);
      setRoles(r);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentUser) loadData();
  }, [currentUser, loadData]);

  // ── Auth handlers ─────────────────────────────────────────────────────────────
  const handleLogin = async (user: User) => {
    setCurrentUser(user);
    try {
      const r = await api.getRoles();
      setRoles(r);
      setActiveMenu(getDefaultMenu(user.role, r));
    } catch {
      setActiveMenu(getDefaultMenu(user.role, []));
    }
  };

  const handleLogout = () => {
    api.logout();
    setCurrentUser(null);
    setUsers([]);
    setCustomers([]);
    setTemplates([]);
    setCampaigns([]);
    setConversations([]);
    setMessages({});
    setChatbotFlow(null);
    setSettings(null);
    setRoles([]);
  };

  // ── Customer handlers ─────────────────────────────────────────────────────────
  const handleAddCustomer = async (newC: Customer) => {
    try {
      const created = await api.createCustomer(newC);
      setCustomers(prev => [created, ...prev]);
    } catch (err: any) { alert(err.message); }
  };

  const handleImportCustomers = async (imported: Customer[]) => {
    try {
      const created = await api.importCustomers(imported);
      setCustomers(prev => [...created, ...prev]);
    } catch (err: any) { alert(err.message); }
  };

  const handleUpdateCustomer = async (updatedC: Customer) => {
    try {
      const saved = await api.updateCustomer(updatedC.id, updatedC);
      setCustomers(prev => prev.map(c => c.id === saved.id ? saved : c));
    } catch (err: any) { alert(err.message); }
  };

  const handleDeleteCustomers = async (ids: string[]) => {
    try {
      await api.deleteCustomers(ids);
      setCustomers(prev => prev.filter(c => !ids.includes(c.id)));
    } catch (err: any) { alert(err.message); }
  };

  // ── Campaign handlers ─────────────────────────────────────────────────────────
  const handleAddCampaign = async (newCamp: Campaign) => {
    setCampaigns(prev => {
      const exists = prev.some(c => c.id === newCamp.id);
      if (exists) {
        return prev.map(c => c.id === newCamp.id ? newCamp : c);
      }
      return [newCamp, ...prev];
    });
  };

  const handleUpdateCampaign = async (updatedCamp: Campaign) => {
    try {
      const saved = await api.updateCampaign(updatedCamp.id, updatedCamp);
      setCampaigns(prev => prev.map(c => c.id === saved.id ? saved : c));
    } catch (err: any) { alert(err.message); }
  };

  const handleDeleteCampaign = async (id: string) => {
    try {
      await api.deleteCampaign(id);
      setCampaigns(prev => prev.filter(c => c.id !== id));
    } catch (err: any) { alert(err.message); }
  };

  // ── Message / Conversation handlers ──────────────────────────────────────────
  const handleSendMessage = async (convId: string, text: string, sender: 'sales' | 'bot') => {
    try {
      const msg = await api.sendMessage(convId, {
        sender,
        senderId: sender === 'sales' ? currentUser?.id : undefined,
        content: text,
        status: 'delivered',
      });
      setMessages(prev => ({ ...prev, [convId]: [...(prev[convId] || []), msg] }));
      setConversations(prev => prev.map(c =>
        c.id === convId ? { ...c, last_message_at: msg.timestamp } : c
      ));
    } catch (err: any) { console.error('sendMessage error:', err); }
  };

  const handleUpdateConversation = async (updatedConv: Conversation) => {
    try {
      const saved = await api.updateConversation(updatedConv.id, updatedConv);
      setConversations(prev => prev.map(c => c.id === saved.id ? saved : c));
    } catch (err: any) { console.error('updateConversation error:', err); }
  };

  // ── Chatbot handler ───────────────────────────────────────────────────────────
  const handleSaveFlow = async (updatedFlow: ChatbotFlow) => {
    try {
      const saved = await api.saveChatbotFlow(updatedFlow);
      setChatbotFlow(saved);
    } catch (err: any) { alert(err.message); }
  };

  // ── Settings handler ──────────────────────────────────────────────────────────
  const handleUpdateSettings = async (updatedSettings: SystemSettings) => {
    try {
      const saved = await api.updateSettings(updatedSettings);
      setSettings(saved);
      return saved;
    } catch (err: any) {
      alert(err.message);
      throw err;
    }
  };

  // ── Template handler ──────────────────────────────────────────────────────────
  const handleAddTemplate = async (newTemp: WhatsAppTemplate) => {
    try {
      const created = await api.createTemplate(newTemp);
      setTemplates(prev => [created, ...prev]);
    } catch (err: any) { alert(err.message); }
  };

  // ── User handlers ─────────────────────────────────────────────────────────────
  const handleAddUser = async (newUser: User & { password?: string }) => {
    try {
      const { password, ...userFields } = newUser;
      const created = await api.createUser({ ...userFields, password });
      setUsers(prev => [...prev, created]);
      alert(`User "${created.name}" created successfully.`);
    } catch (err: any) { alert(err.message); }
  };

  const handleUpdateUser = async (id: string, data: Partial<User>) => {
    try {
      const updated = await api.updateUser(id, data);
      setUsers(prev => prev.map(u => u.id === id ? updated : u));
    } catch (err: any) { alert(err.message); }
  };

  const handleDeleteUser = async (id: string) => {
    try {
      await api.deleteUser(id);
      setUsers(prev => prev.filter(u => u.id !== id));
    } catch (err: any) { alert(err.message); }
  };

  const handleCreateRole = async (role: Omit<AppRole, 'created_at'>) => {
    try {
      const created = await api.createRole(role);
      setRoles(prev => [...prev, created]);
    } catch (err: any) { alert(err.message); }
  };

  const handleUpdateRole = async (id: string, data: Partial<AppRole>) => {
    try {
      const updated = await api.updateRole(id, data);
      setRoles(prev => prev.map(r => r.id === id ? updated : r));
    } catch (err: any) { alert(err.message); }
  };

  const handleDeleteRole = async (id: string) => {
    try {
      await api.deleteRole(id);
      setRoles(prev => prev.filter(r => r.id !== id));
    } catch (err: any) { alert(err.message); }
  };

  // ── Derived state ─────────────────────────────────────────────────────────────
  const totalUnreadAll = conversations.reduce((acc, c) => acc + c.unreadCount, 0);

  useEffect(() => {
    if (currentUser && !canAccessMenu(currentUser.role, activeMenu, roles)) {
      setActiveMenu(getDefaultMenu(currentUser.role, roles));
    }
  }, [currentUser, activeMenu, roles]);

  const mainNavIds: MenuId[] = ['dashboards', 'customers', 'campaigns', 'conversations', 'chatbot'];
  const adminNavIds: MenuId[] = ['users', 'roles', 'settings'];

  const navIcon: Record<MenuId, typeof BarChart3> = {
    dashboards: BarChart3,
    customers: Users,
    campaigns: MessageSquareCode,
    conversations: MessageSquare,
    chatbot: Bot,
    users: UserCog,
    roles: Shield,
    settings: Settings,
  };

  const mainNavItems = mainNavIds
    .filter(id => currentUser && canAccessMenu(currentUser.role, id, roles))
    .map(id => ({
      id,
      icon: navIcon[id],
      badge: id === 'conversations' ? totalUnreadAll : undefined,
    }));

  const adminNavItems = adminNavIds
    .filter(id => currentUser && canAccessMenu(currentUser.role, id, roles))
    .map(id => ({ id, icon: navIcon[id] }));

  const renderNavButton = (item: { id: MenuId; icon: typeof BarChart3; badge?: number }) => {
    const Icon = item.icon;
    const isSelected = activeMenu === item.id;
    return (
      <button
        key={item.id}
        onClick={() => setActiveMenu(item.id)}
        className={`w-full text-sm font-medium px-3 py-2.5 rounded-lg flex items-center justify-between transition-all ${
          isSelected
            ? 'bg-urja-primary text-white shadow-sm'
            : 'text-slate-300 hover:bg-white/5 hover:text-white'
        }`}
      >
        <span className="flex items-center gap-2.5">
          <Icon className="w-4 h-4" />
          {getMenuLabel(item.id, currentUser!.role, roles)}
        </span>
        {item.badge && item.badge > 0 ? (
          <span className="bg-white text-urja-navy text-[10px] px-1.5 py-0.5 rounded-full font-bold">
            {item.badge}
          </span>
        ) : null}
      </button>
    );
  };

  // ── Render guards ─────────────────────────────────────────────────────────────
  if (!authChecked) {
    return (
      <div className="min-h-screen w-screen flex items-center justify-center bg-urja-navy">
        <div className="text-white text-sm font-semibold opacity-70">Loading…</div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginPage onLogin={handleLogin} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen w-screen flex flex-col items-center justify-center bg-urja-navy gap-3">
        <div className="w-8 h-8 border-4 border-urja-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-white text-sm font-semibold opacity-70">Loading workspace…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-screen w-screen overflow-hidden font-sans antialiased" id="main-application-frame">

      {/* SIDEBAR */}
      <aside className="w-full md:w-64 bg-urja-navy text-slate-100 flex flex-col justify-between shrink-0 shadow-xl border-r border-urja-navy/35 z-20 overflow-y-auto">
        <div>
          {/* Brand */}
          <div className="p-5 border-b border-white/10 flex items-center gap-3 bg-black/15">
            <div className="w-9 h-10 shrink-0 flex items-center justify-center">
              <svg viewBox="0 0 100 114" className="w-full h-full select-none" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M50 4L95 30V84L50 110L5 84V30L50 4Z" fill="#ef7f21" />
                <rect x="47" y="0" width="6" height="114" fill="white" />
                <path d="M22 10 L41 21 V68 L22 57 Z" fill="white" />
                <path d="M59 36 H80 V47 H59 Z" fill="white" />
                <path d="M59 63 H80 V74 H59 Z" fill="white" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight uppercase font-display text-white">URJA WHATSAPP BOT</h2>
              <span className="text-[10px] text-urja-secondary font-mono font-bold block leading-none">WhatsApp Automation Platform</span>
            </div>
          </div>

          {showRoleSimulator(currentUser.role, roles) && (
          <div className="px-3 py-3 mx-3 mb-2 bg-white/5 rounded-lg border border-white/10">
            <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wide block mb-1.5">Preview as</span>
            <select
              value={currentUser.id}
              onChange={e => {
                const selected = users.find(u => u.id === e.target.value);
                if (selected) {
                  setCurrentUser(selected);
                  setActiveMenu(getDefaultMenu(selected.role, roles));
                }
              }}
              className="w-full text-xs bg-urja-navy border border-white/10 rounded-lg px-2 py-1.5 text-slate-200 focus:outline-none focus:ring-1 focus:ring-urja-primary"
            >
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
              ))}
            </select>
          </div>
          )}

          <nav className="px-3 space-y-0.5">
            {mainNavItems.map(renderNavButton)}

            {adminNavItems.length > 0 && (
              <>
                <div className="px-3 pt-4 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Administration
                </div>
                {adminNavItems.map(renderNavButton)}
              </>
            )}
          </nav>
        </div>

        {/* Sidebar footer */}
        <div className="p-4 space-y-3">
          <div className="px-1">
            <span className="text-[10px] uppercase font-semibold text-slate-500 tracking-wide block mb-2">Theme</span>
            <ThemeToggle compact />
          </div>

          <div className="bg-white/5 rounded-2xl border border-white/10 p-4 text-[10px] space-y-2 text-slate-300">
            <div className="flex items-center gap-1.5 font-bold text-urja-secondary">
              <Bell className="w-3.5 h-3.5 text-urja-primary shrink-0 animate-bounce" />
              API Server Connected
            </div>
            <p className="leading-snug text-slate-350">
              PostgreSQL backend active. All changes persist to the database.
            </p>
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white px-4 py-2.5 rounded-xl hover:bg-white/5 transition-all"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-grow flex flex-col overflow-hidden h-screen relative z-10 app-content">

        {/* Top header */}
        <header className="app-header h-[64px] border-b flex items-center justify-between px-6 shrink-0 shadow-xs relative z-30">
          <div>
            <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">Workspace</span>
            <p className="text-sm text-slate-700 font-medium">{currentUser.name}</p>
          </div>

          <div className="flex items-center gap-4">
            <ThemeToggle compact />

            {!isSalesScoped(currentUser.role, roles) && (
            <div className="hidden sm:flex bg-slate-100 p-2 rounded-xl border border-slate-200 items-center gap-2 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-semibold text-slate-700">WhatsApp Cloud API Gateway: Status Connected</span>
            </div>
            )}

            <div className="bg-slate-100 hover:bg-slate-150 p-1 rounded-xl transition-all flex items-center gap-2.5 outline-hidden border border-slate-200">
              <div className="w-7 h-7 bg-urja-primary rounded-lg text-white font-bold font-display text-sm flex items-center justify-center shadow-xs">
                {currentUser.name.substring(0, 2).toUpperCase()}
              </div>
              <span className="text-xs font-semibold text-slate-800 pr-2">{currentUser.name}</span>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 relative z-10">

          {activeMenu === 'dashboards' && canAccessMenu(currentUser.role, 'dashboards', roles) && (
            <AnalyticsDashboards
              customers={customers}
              campaigns={campaigns}
              conversations={conversations}
              messages={messages}
              currentUser={currentUser}
              roles={roles}
            />
          )}

          {activeMenu === 'customers' && canAccessMenu(currentUser.role, 'customers', roles) && (
            <CustomersManager
              customers={customers}
              users={users}
              currentUser={currentUser}
              roles={roles}
              onAddCustomer={handleAddCustomer}
              onImportCustomers={handleImportCustomers}
              onUpdateCustomer={handleUpdateCustomer}
              onDeleteCustomers={handleDeleteCustomers}
            />
          )}

          {activeMenu === 'campaigns' && canAccessMenu(currentUser.role, 'campaigns', roles) && (
            <CampaignsManager
              campaigns={campaigns}
              templates={templates}
              customers={customers}
              currentUser={currentUser}
              onAddCampaign={handleAddCampaign}
              onDeleteCampaign={handleDeleteCampaign}
              onUpdateCampaign={handleUpdateCampaign}
            />
          )}

          {activeMenu === 'conversations' && canAccessMenu(currentUser.role, 'conversations', roles) && (
            <ConversationsInbox
              conversations={conversations}
              messages={messages}
              customers={customers}
              users={users}
              templates={templates}
              currentUser={currentUser}
              roles={roles}
              onSendMessage={handleSendMessage}
              onUpdateConversation={handleUpdateConversation}
              onUpdateCustomer={handleUpdateCustomer}
            />
          )}

          {activeMenu === 'chatbot' && chatbotFlow && canAccessMenu(currentUser.role, 'chatbot', roles) && (
            <ChatbotFlowBuilder
              initialFlow={chatbotFlow}
              onSaveFlow={handleSaveFlow}
            />
          )}

          {activeMenu === 'users' && canAccessMenu(currentUser.role, 'users', roles) && (
            <UserManagement
              users={users}
              roles={roles}
              currentUser={currentUser}
              onAddUser={handleAddUser}
              onUpdateUser={handleUpdateUser}
              onDeleteUser={handleDeleteUser}
            />
          )}

          {activeMenu === 'roles' && canAccessMenu(currentUser.role, 'roles', roles) && (
            <RolesManagement
              roles={roles}
              users={users}
              onCreateRole={handleCreateRole}
              onUpdateRole={handleUpdateRole}
              onDeleteRole={handleDeleteRole}
            />
          )}

          {activeMenu === 'settings' && canAccessMenu(currentUser.role, 'settings', roles) && (
            <SettingsPanel
              templates={templates}
              settings={settings ?? defaultSettings}
              currentUser={currentUser}
              roles={roles}
              campaigns={campaigns}
              onUpdateSettings={handleUpdateSettings}
              onAddTemplate={handleAddTemplate}
              onTemplatesSynced={setTemplates}
            />
          )}

        </div>
      </main>

    </div>
  );
}
