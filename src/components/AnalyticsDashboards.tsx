import React, { useState } from 'react';
import { Customer, Campaign, User, Conversation, ConversationMessage, AppRole } from '../types';
import { TrendingUp, CheckSquare, BarChart3, MessageSquare, AlertCircle } from 'lucide-react';
import { isSalesScoped } from '../permissions';

interface AnalyticsDashboardsProps {
  customers: Customer[];
  campaigns: Campaign[];
  conversations: Conversation[];
  messages: Record<string, ConversationMessage[]>;
  currentUser: User;
  roles: AppRole[];
}

export default function AnalyticsDashboards({ customers, campaigns, conversations, messages, currentUser, roles }: AnalyticsDashboardsProps) {
  const [selectedRange, setSelectedRange] = useState<'30' | '7' | 'all'>('30');
  const [todoList, setTodoList] = useState<{ id: number; text: string; done: boolean }[]>([]);

  // Calculations for KPI Cards
  const totalCampaigns = campaigns.length;
  const totalSent = campaigns.reduce((acc, c) => acc + c.sentCount, 0);
  const totalDelivered = campaigns.reduce((acc, c) => acc + c.deliveredCount, 0);
  const totalRead = campaigns.reduce((acc, c) => acc + c.readCount, 0);
  const totalReplies = campaigns.reduce((acc, c) => acc + c.replyCount, 0);
  const totalFailed = campaigns.reduce((acc, c) => acc + c.failedCount, 0);

  const deliveryRate = totalSent ? Math.round((totalDelivered / totalSent) * 100) : 0;
  const openRate = totalDelivered ? Math.round((totalRead / totalDelivered) * 100) : 0;
  const replyRate = totalRead ? Math.round((totalReplies / totalRead) * 100) : 0;
  const failedRate = totalSent ? Math.round((totalFailed / totalSent) * 100) : 0;

  const dailyTimeline = campaigns
    .filter(c => c.sentCount > 0)
    .slice(0, 8)
    .map(c => ({
      day: c.name.slice(0, 12),
      sent: c.sentCount,
      reads: c.readCount,
      replies: c.replyCount,
    }));

  const handleToggleTodo = (id: number) => {
    setTodoList(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  };

  const handleAddTodo = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const text = fd.get('todoText') as string;
    if (!text.trim()) return;
    setTodoList(prev => [...prev, { id: Date.now(), text, done: false }]);
    e.currentTarget.reset();
  };

  // High-craft custom responsive SVG charts
  const maxVal = dailyTimeline.length ? Math.max(...dailyTimeline.map(d => d.sent), 1) : 1;
  const svgWidth = 500;
  const svgHeight = 200;
  const paddingX = 40;
  const paddingY = 20;

  const getPoints = (key: 'sent' | 'reads' | 'replies') => {
    if (dailyTimeline.length < 2) return '';
    const stepX = (svgWidth - paddingX * 2) / (dailyTimeline.length - 1);
    const heightLimit = svgHeight - paddingY * 2;
    return dailyTimeline
      .map((d, index) => {
        const x = paddingX + index * stepX;
        const normalizedVal = maxVal ? (d[key] / maxVal) * heightLimit : 0;
        const y = svgHeight - paddingY - normalizedVal;
        return `${x},${y}`;
      })
      .join(' ');
  };

  if (isSalesScoped(currentUser.role, roles)) {
    const myCustomers = customers.filter(c => c.assignedSalesUserId === currentUser.id);
    const myConversations = conversations.filter(c => c.salesUserId === currentUser.id);
    const myUnread = myConversations.reduce((acc, c) => acc + c.unreadCount, 0);
    const pendingChats = myConversations.filter(c => c.unreadCount > 0);
    const activeThreads = myConversations.length;

    const chatQueue = pendingChats.map(conv => {
      const cust = customers.find(c => c.id === conv.customerId);
      const threadMsgs = messages[conv.id] || [];
      const lastMsg = threadMsgs[threadMsgs.length - 1];
      return {
        id: conv.id,
        name: cust?.name || 'Unknown',
        unread: conv.unreadCount,
        preview: lastMsg?.content?.slice(0, 60) || 'No messages yet',
      };
    });

    return (
      <div className="space-y-8 animate-fade-in" id="dashboards-container">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight text-slate-900 flex items-center gap-2">
            My Performance
            <span className="text-xs bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 uppercase tracking-widest px-2.5 py-1 rounded-full font-mono font-bold">
              Sales Portal
            </span>
          </h1>
          <p className="mt-2 text-slate-600 text-sm">
            Welcome back, {currentUser.name}. Here is your personal support desk overview.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-sm">
            <p className="text-xs font-semibold text-slate-400 tracking-wider uppercase font-mono">Assigned Customers</p>
            <p className="text-3xl font-display font-bold text-slate-900 mt-2">{myCustomers.length}</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-sm">
            <p className="text-xs font-semibold text-slate-400 tracking-wider uppercase font-mono">Active Threads</p>
            <p className="text-3xl font-display font-bold text-slate-900 mt-2">{activeThreads}</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-sm">
            <p className="text-xs font-semibold text-slate-400 tracking-wider uppercase font-mono">Unread Messages</p>
            <p className="text-3xl font-display font-bold text-red-500 mt-2">{myUnread}</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-sm">
            <p className="text-xs font-semibold text-slate-400 tracking-wider uppercase font-mono">Pending Replies</p>
            <p className="text-3xl font-display font-bold text-urja-primary mt-2">{pendingChats.length}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-150 shadow-xs">
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2 mb-4">
              <MessageSquare className="w-4 h-4 text-urja-primary" />
              Today&apos;s Chat Queue
            </h3>
            {chatQueue.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No chats waiting for your reply.</p>
            ) : (
              <div className="space-y-2">
                {chatQueue.map(item => (
                  <div key={item.id} className="p-3 rounded-xl border border-slate-150 bg-slate-50">
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-xs font-semibold text-slate-800">{item.name}</span>
                      <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold">{item.unread} unread</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 truncate">{item.preview}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-150 shadow-xs">
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2 mb-4">
              <CheckSquare className="w-4 h-4 text-urja-primary" />
              My Personal To-Do Agenda
            </h3>
            <form onSubmit={handleAddTodo} className="flex gap-2 mb-4">
              <input
                type="text"
                name="todoText"
                placeholder="Add follow-up reminder..."
                className="flex-1 text-xs border border-slate-205 rounded-xl px-3 py-2 text-slate-700 placeholder-slate-400 focus:outline-none focus:border-urja-primary"
              />
              <button
                type="submit"
                className="bg-urja-primary hover:bg-urja-primary/90 text-white font-medium text-xs px-4 py-2 rounded-xl shrink-0 transition-all shadow-xs"
              >
                Add Task
              </button>
            </form>
            <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
              {todoList.length === 0 && (
                <p className="text-xs text-slate-400 py-4 text-center">No tasks yet. Add a follow-up reminder above.</p>
              )}
              {todoList.map(item => (
                <div
                  key={item.id}
                  onClick={() => handleToggleTodo(item.id)}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer hover:bg-slate-50 transition-all ${item.done ? 'bg-slate-50 border-slate-100' : 'bg-white border-slate-150 shadow-xs'}`}
                >
                  <input
                    type="checkbox"
                    checked={item.done}
                    onChange={() => {}}
                    className="mt-0.5 rounded text-urja-primary focus:ring-urja-primary border-slate-300 pointer-events-none"
                  />
                  <span className={`text-xs text-slate-700 select-none ${item.done ? 'line-through text-slate-400' : 'font-medium'}`}>
                    {item.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in" id="dashboards-container">
      {/* Upper header section with context branding */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight text-slate-900 flex items-center gap-2">
            Urja Control Center
            <span className="text-xs bg-urja-yellow dark:bg-urja-primary/20 text-slate-900 dark:text-urja-secondary border border-yellow-400/50 dark:border-urja-primary/40 uppercase tracking-widest px-2.5 py-1 rounded-full font-mono font-bold">
              Live Monitor
            </span>
          </h1>
          <div className="mt-2 text-slate-900 dark:text-urja-secondary text-xs px-3 py-1.5 rounded-lg bg-urja-yellow dark:bg-urja-primary/15 border border-yellow-400/50 dark:border-urja-primary/35 inline-block font-medium">
            Role scope: <span className="font-bold text-urja-primary dark:text-urja-secondary">{currentUser.role} View</span> — Monitoring official WhatsApp Business Cloud API metrics.
          </div>
        </div>

        {/* Date Filters */}
        <div className="flex bg-slate-100 p-1.5 rounded-lg text-xs font-medium border border-slate-200">
          <button
            onClick={() => setSelectedRange('all')}
            className={`px-3 py-1.5 rounded-md transition-all ${selectedRange === 'all' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
          >
            All-Time
          </button>
          <button
            onClick={() => setSelectedRange('30')}
            className={`px-3 py-1.5 rounded-md transition-all ${selectedRange === '30' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Last 30 Days
          </button>
          <button
            onClick={() => setSelectedRange('7')}
            className={`px-3 py-1.5 rounded-md transition-all ${selectedRange === '7' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Last 7 Days
          </button>
        </div>
      </div>

      {/* SECTION A: Primary Global Analytics (Visible to Admins, Managers, and Analysts) */}
      <div className="space-y-6">
        <h2 className="text-lg font-display font-semibold text-slate-800 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-urja-primary" />
          Enterprise Performance Overview
        </h2>

        {/* 4 Interactive KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden" id="kpi-total-campaigns">
            <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-20 h-20 bg-slate-50 rounded-full" />
            <p className="text-xs font-semibold text-slate-400 tracking-wider uppercase font-mono">Sent Volume</p>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-display font-bold text-slate-900">
                {totalSent.toLocaleString()}
              </span>
              <span className="text-xs text-emerald-600 font-medium">
                {totalSent > 0 ? `${deliveryRate}% delivered` : 'No messages sent yet'}
              </span>
            </div>
            <div className="mt-3 text-xs text-slate-500 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              Across <span className="font-semibold text-slate-700">{totalCampaigns} batches</span> scheduled
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden" id="kpi-delivery">
            <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-20 h-20 bg-urja-accent/50 rounded-full" />
            <p className="text-xs font-semibold text-slate-400 tracking-wider uppercase font-mono">Delivery success</p>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-display font-bold text-slate-900">{deliveryRate}%</span>
              <span className="text-xs text-slate-500 font-medium">({totalDelivered.toLocaleString()})</span>
            </div>
            {/* Delivery Progress bar */}
            <div className="mt-3 w-full bg-slate-100 rounded-full h-1.5">
              <div className="bg-urja-primary h-1.5 rounded-full" style={{ width: `${deliveryRate}%` }} />
            </div>
            <p className="text-[10px] text-slate-400 mt-1.5">WhatsApp Cloud network transmission rate</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden" id="kpi-open">
            <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-20 h-20 bg-blue-50/40 rounded-full" />
            <p className="text-xs font-semibold text-slate-400 tracking-wider uppercase font-mono">Open / Read Rate</p>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-display font-bold text-slate-900">{openRate}%</span>
              <span className="text-xs text-blue-600 font-medium">({totalRead.toLocaleString()} read)</span>
            </div>
            {/* Open Rate Progress */}
            <div className="mt-3 w-full bg-slate-100 rounded-full h-1.5">
              <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${openRate}%` }} />
            </div>
            <p className="text-[10px] text-blue-500 font-medium mt-1.5 flex items-center gap-1">
              <span>● {Math.round(totalRead / (totalCampaigns || 1))} average reads per campaign</span>
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden" id="kpi-replies">
            <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-20 h-20 bg-indigo-50/40 rounded-full" />
            <p className="text-xs font-semibold text-slate-400 tracking-wider uppercase font-mono">User Reply Rate</p>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-display font-bold text-slate-900">{replyRate}%</span>
              <span className="text-xs text-slate-500 font-medium">({totalReplies.toLocaleString()} chat replies)</span>
            </div>
            {/* Reply progress */}
            <div className="mt-3 w-full bg-slate-100 rounded-full h-1.5">
              <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${replyRate}%` }} />
            </div>
            <p className="text-[10px] text-slate-400 mt-1.5">
              {totalReplies > 0 ? `${totalReplies} total replies across campaigns` : 'No replies recorded yet'}
            </p>
          </div>
        </div>

        {/* Charts & Graphs Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Line Chart Card: Sent Volume, Reads, and Replies timeline */}
          <div className="bg-white p-6 rounded-2xl border border-slate-150 shadow-xs lg:col-span-2">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Messages & Reply Flow over Time</h3>
                <p className="text-xs text-slate-400">Monitoring real-time webhook callback ingestion logs</p>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono">
                <span className="flex items-center gap-1 text-slate-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-urja-primary" /> Outbound
                </span>
                <span className="flex items-center gap-1 text-slate-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Reads
                </span>
                <span className="flex items-center gap-1 text-slate-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" /> Replies
                </span>
              </div>
            </div>

            {/* Custom Responsive SVG Chart Area */}
            <div className="relative w-full h-[220px]">
              {dailyTimeline.length < 2 ? (
                <div className="flex items-center justify-center h-full text-sm text-slate-400 border border-dashed border-slate-200 rounded-xl">
                  No campaign activity yet. Send a campaign to see performance trends.
                </div>
              ) : (
              <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-full overflow-visible">
                {/* Y Axis Gridlines */}
                {[0, 0.25, 0.5, 0.75, 1].map((n, i) => {
                  const y = paddingY + n * (svgHeight - paddingY * 2);
                  const label = Math.round(maxVal - n * maxVal);
                  return (
                    <g key={i} className="opacity-40">
                      <line
                        x1={paddingX}
                        y1={y}
                        x2={svgWidth - paddingX}
                        y2={y}
                        stroke="#e2e8f0"
                        strokeDasharray="4 4"
                      />
                      <text x={paddingX - 10} y={y + 4} textAnchor="end" fontSize="8" fill="#94a3b8" className="font-mono">
                        {label}
                      </text>
                    </g>
                  );
                })}

                {/* X Axis Labels */}
                {dailyTimeline.map((d, i) => {
                  const stepX = (svgWidth - paddingX * 2) / (dailyTimeline.length - 1);
                  const x = paddingX + i * stepX;
                  return (
                    <text key={i} x={x} y={svgHeight - 4} textAnchor="middle" fontSize="8" fill="#94a3b8" className="font-mono">
                      {d.day}
                    </text>
                  );
                })}

                {/* Sent Line */}
                <polyline
                  fill="none"
                  stroke="#ef7f21"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={getPoints('sent')}
                  className="transition-all duration-300"
                />

                {/* Reads Line */}
                <polyline
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={getPoints('reads')}
                  className="transition-all duration-300"
                />

                {/* Replies Line */}
                <polyline
                  fill="none"
                  stroke="#6366f1"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={getPoints('replies')}
                  className="transition-all duration-300"
                />

                {/* Interactive Points on hover */}
                {dailyTimeline.map((d, i) => {
                  const stepX = (svgWidth - paddingX * 2) / (dailyTimeline.length - 1);
                  const x = paddingX + i * stepX;
                  const valueHeight = svgHeight - paddingY * 2;
                  const ySent = svgHeight - paddingY - (maxVal ? (d.sent / maxVal) * valueHeight : 0);
                  const yReads = svgHeight - paddingY - (maxVal ? (d.reads / maxVal) * valueHeight : 0);

                  return (
                    <g key={i} className="group/dot cursor-pointer">
                      <circle cx={x} cy={ySent} r="4" fill="#14b8a6" className="hover:scale-150 transition-transform" />
                      <circle cx={x} cy={yReads} r="3" fill="#3b82f6" className="hover:scale-150 transition-transform" />
                      {/* Tooltip */}
                      <g className="opacity-0 group-hover/dot:opacity-100 transition-opacity duration-200">
                        <rect
                          x={x - 45}
                          y={ySent - 42}
                          width="90"
                          height="32"
                          rx="6"
                          fill="#1e293b"
                        />
                        <text x={x} y={ySent - 30} textAnchor="middle" fill="#fff" fontSize="7" fontWeight="bold">
                          Sent: {d.sent}
                        </text>
                        <text x={x} y={ySent - 20} textAnchor="middle" fill="#93c5fd" fontSize="7">
                          Replies: {d.replies}
                        </text>
                        <path d={`M ${x-4} ${ySent-10} L ${x} ${ySent-6} L ${x+4} ${ySent-10} Z`} fill="#1e293b" />
                      </g>
                    </g>
                  );
                })}
              </svg>
              )}
            </div>
            <div className="flex gap-4 mt-2 justify-center text-[10px] text-slate-400">
              <p>● Interactive Graph: Hover over points to view details for high-performance campaign batches.</p>
            </div>
          </div>

          {/* Side distribution chart - campaign success rate breakdown */}
          <div className="bg-white p-6 rounded-2xl border border-slate-150 shadow-xs">
            <h3 className="text-sm font-semibold text-slate-800 mb-1">Status Delivery Split</h3>
            <p className="text-xs text-slate-400 mb-6">WhatsApp API status events breakdown</p>

            <div className="space-y-4">
              {totalSent === 0 ? (
                <p className="text-sm text-slate-400 py-4 text-center">No delivery data yet. Launch a campaign to see status breakdown.</p>
              ) : (
              <>
              <div>
                <div className="flex justify-between text-xs text-slate-600 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-urja-primary" />
                    Delivered
                  </span>
                  <span className="font-mono font-semibold">{deliveryRate}%</span>
                </div>
                <div className="w-full bg-slate-150 h-2 rounded-full">
                  <div className="bg-urja-primary h-2 rounded-full" style={{ width: `${deliveryRate}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-600 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                    Read
                  </span>
                  <span className="font-mono font-semibold">{openRate}%</span>
                </div>
                <div className="w-full bg-slate-150 h-2 rounded-full">
                  <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${openRate}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-600 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                    Replied
                  </span>
                  <span className="font-mono font-semibold">{replyRate}%</span>
                </div>
                <div className="w-full bg-slate-150 h-2 rounded-full">
                  <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${replyRate}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-600 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                    Failed
                  </span>
                  <span className="font-mono font-semibold">{failedRate}%</span>
                </div>
                <div className="w-full bg-slate-150 h-2 rounded-full">
                  <div className="bg-red-500 h-2 rounded-full" style={{ width: `${failedRate}%` }} />
                </div>
              </div>
              </>
              )}
            </div>

            {/* Compliance warning advice */}
            <div className="mt-6 p-3.5 bg-yellow-50 text-yellow-800 rounded-xl text-xs border border-yellow-100 flex gap-2.5">
              <AlertCircle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block mb-0.5">WhatsApp policy guardrail:</span>
                Keep opt-out failures under 3% to avoid suspension of your official verified number pool!
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
