import React, { useState, useEffect } from 'react';
import { Key, FileSpreadsheet, Plus, Save, RefreshCw, MessageSquare, Plug, X } from 'lucide-react';
import { WhatsAppTemplate, SystemSettings, AppRole, User, Campaign } from '../../types';
import { hasPermission } from '../../permissions';
import { testWhatsAppSettings, syncTemplatesFromMeta } from '../../services/api';
import AdminPageHeader from './AdminPageHeader';

type SettingsSection = 'integration' | 'templates' | 'reports';

interface SettingsPanelProps {
  templates: WhatsAppTemplate[];
  settings: SystemSettings;
  currentUser: User;
  roles: AppRole[];
  campaigns: Campaign[];
  onUpdateSettings: (s: SystemSettings) => Promise<SystemSettings | void>;
  onAddTemplate: (t: WhatsAppTemplate) => void;
  onTemplatesSynced?: (templates: WhatsAppTemplate[]) => void;
}

export default function SettingsPanel({
  templates,
  settings,
  currentUser,
  roles,
  campaigns,
  onUpdateSettings,
  onAddTemplate,
  onTemplatesSynced,
}: SettingsPanelProps) {
  const canEditCredentials = hasPermission(currentUser.role, 'settings.credentials', roles);
  const canManageTemplates = hasPermission(currentUser.role, 'settings.templates', roles);
  const canExportReports = hasPermission(currentUser.role, 'settings.reports', roles);

  const defaultSection: SettingsSection = canEditCredentials ? 'integration' : canManageTemplates ? 'templates' : 'reports';
  const [section, setSection] = useState<SettingsSection>(defaultSection);
  const [localSettings, setLocalSettings] = useState<SystemSettings>({ ...settings });
  const [showToken, setShowToken] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [reportType, setReportType] = useState('campaign_summary');
  const [reportRange, setReportRange] = useState('30');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSyncingTemplates, setIsSyncingTemplates] = useState(false);

  useEffect(() => {
    setLocalSettings({ ...settings });
  }, [settings]);

  const navItems = ([
    { id: 'integration' as SettingsSection, label: 'WhatsApp API', icon: Plug, show: true },
    { id: 'templates' as SettingsSection, label: 'Message Templates', icon: MessageSquare, show: canManageTemplates },
    { id: 'reports' as SettingsSection, label: 'Reports', icon: FileSpreadsheet, show: canExportReports },
  ]).filter(item => item.show);

  const handleSettingsSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const saved = await onUpdateSettings(localSettings);
    if (saved) setLocalSettings(saved);
    alert('Settings saved successfully.');
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    try {
      const saved = await onUpdateSettings(localSettings);
      if (saved) setLocalSettings(saved);
      await testWhatsAppSettings();
      alert('WhatsApp API connection successful.');
    } catch (err: any) {
      alert(err.message || 'Connection test failed. Save credentials first.');
    } finally {
      setIsTesting(false);
    }
  };

  const handleSyncTemplates = async () => {
    setIsSyncingTemplates(true);
    try {
      const result = await syncTemplatesFromMeta();
      onTemplatesSynced?.(result.templates);
      alert(`Synced ${result.synced} template(s) from Meta.`);
    } catch (err: any) {
      alert(err.message || 'Failed to sync templates from Meta.');
    } finally {
      setIsSyncingTemplates(false);
    }
  };

  const handleCreateTemplate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const variablesRaw = fd.get('variables') as string;
    onAddTemplate({
      id: `temp-${Date.now()}`,
      name: fd.get('name') as string,
      category: fd.get('category') as WhatsAppTemplate['category'],
      language: (fd.get('language') as string) || 'en_US',
      status: 'APPROVED',
      bodyText: fd.get('bodyText') as string,
      variables: variablesRaw ? variablesRaw.split(',').map(v => v.trim()) : [],
    });
    setShowTemplateModal(false);
    e.currentTarget.reset();
  };

  const handleDownloadReport = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      let csv = 'data:text/csv;charset=utf-8,';
      if (reportType === 'campaign_summary') {
        csv += 'Campaign,Audience,Sent,Delivered,Read,Replies,Status\n';
        if (campaigns.length === 0) {
          alert('No campaign data to export.');
          return;
        }
        for (const c of campaigns) {
          csv += `"${c.name}",${c.audienceCount},${c.sentCount},${c.deliveredCount},${c.readCount},${c.replyCount},${c.status}\n`;
        }
      } else {
        alert('Agent performance reports require conversation analytics data.');
        return;
      }
      const link = document.createElement('a');
      link.href = encodeURI(csv);
      link.download = `${reportType}_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
    }, 300);
  };

  return (
    <div>
      <AdminPageHeader
        title="Settings"
        description="Configure WhatsApp integration, templates, and exports."
      />

      <div className="flex flex-col md:flex-row gap-6">
        {/* Side navigation */}
        <nav className="md:w-52 shrink-0 flex md:flex-col gap-1 overflow-x-auto">
          {navItems.map(item => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  active
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                    : 'text-slate-600 hover:bg-slate-50 border border-transparent'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {section === 'integration' && (
            <form onSubmit={handleSettingsSave} className="bg-white rounded-xl border border-slate-200 p-6 space-y-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <Key className="w-4 h-4 text-urja-primary" />
                  WhatsApp Cloud API
                </h2>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  settings.webhookStatus === 'connected'
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-slate-100 text-slate-600'
                }`}>
                  {settings.webhookStatus}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number ID</label>
                  <input
                    type="text"
                    disabled={!canEditCredentials}
                    value={localSettings.phoneNumberId}
                    onChange={e => setLocalSettings({ ...localSettings, phoneNumberId: e.target.value })}
                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg disabled:bg-slate-50 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">WABA ID</label>
                  <input
                    type="text"
                    disabled={!canEditCredentials}
                    value={localSettings.wabaId}
                    onChange={e => setLocalSettings({ ...localSettings, wabaId: e.target.value })}
                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg disabled:bg-slate-50 font-mono"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-sm font-medium text-slate-700">Access Token</label>
                  <button type="button" onClick={() => setShowToken(!showToken)} className="text-xs text-indigo-600 hover:text-indigo-800">
                    {showToken ? 'Hide' : 'Show'}
                  </button>
                </div>
                <input
                  type={showToken ? 'text' : 'password'}
                  disabled={!canEditCredentials}
                  value={localSettings.accessToken}
                  onChange={e => setLocalSettings({ ...localSettings, accessToken: e.target.value })}
                  className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg disabled:bg-slate-50 font-mono"
                />
              </div>

              <div className="border-t border-slate-100 pt-4 space-y-3">
                <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-slate-700">Chatbot auto-replies</p>
                    <p className="text-xs text-slate-500">Run the active flow from Chatbot Builder on inbound WhatsApp messages</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={!canEditCredentials}
                      checked={localSettings.botEnabled}
                      onChange={e => setLocalSettings({ ...localSettings, botEnabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-slate-200 rounded-full peer peer-checked:bg-urja-primary peer-disabled:opacity-50 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5" />
                  </label>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4 space-y-3">
                <p className="text-sm font-medium text-slate-700">Webhook</p>
                <p className="text-xs text-slate-500">
                  Register this callback URL in Meta Developer Console → WhatsApp → Configuration.
                  Use HTTPS in production (e.g. your deployed domain).
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <span className="text-xs text-slate-500">Callback URL</span>
                    <p className="text-sm font-mono bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 mt-1 break-all">{localSettings.webhookUrl || settings.webhookUrl}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">Verify Token</span>
                    <p className="text-sm font-mono bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 mt-1 break-all">{localSettings.verifyToken || settings.verifyToken || 'Generated on save'}</p>
                  </div>
                </div>
              </div>

              {canEditCredentials && (
                <div className="flex flex-wrap justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={isTesting}
                    className="border border-slate-200 text-slate-700 text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-1.5 hover:bg-slate-50 disabled:opacity-60"
                  >
                    <RefreshCw className={`w-4 h-4 ${isTesting ? 'animate-spin' : ''}`} />
                    Test Connection
                  </button>
                  <button type="submit" className="bg-urja-primary hover:bg-urja-primary/90 text-white text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-1.5">
                    <Save className="w-4 h-4" /> Save Changes
                  </button>
                </div>
              )}
            </form>
          )}

          {section === 'templates' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center gap-3">
                <h2 className="text-base font-semibold text-slate-900">Message Templates</h2>
                {canManageTemplates && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleSyncTemplates}
                      disabled={isSyncingTemplates}
                      className="border border-slate-200 text-slate-700 text-sm font-medium px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-slate-50 disabled:opacity-60"
                    >
                      <RefreshCw className={`w-4 h-4 ${isSyncingTemplates ? 'animate-spin' : ''}`} />
                      Sync from Meta
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowTemplateModal(true)}
                      className="bg-urja-primary hover:bg-urja-primary/90 text-white text-sm font-medium px-3 py-1.5 rounded-lg flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" /> New Template
                    </button>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {templates.map(t => (
                  <div key={t.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-sm font-mono font-medium text-slate-800">{t.name}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">{t.status}</span>
                    </div>
                    <p className="text-xs text-slate-600 font-mono leading-relaxed line-clamp-3">{t.bodyText}</p>
                    <div className="flex gap-3 mt-3 pt-3 border-t border-slate-100 text-xs text-slate-400">
                      <span>{t.category}</span>
                      <span>{t.language}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {section === 'reports' && canExportReports && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
              <h2 className="text-base font-semibold text-slate-900">Export Reports</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Report Type</label>
                  <select value={reportType} onChange={e => setReportType(e.target.value)} className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg">
                    <option value="campaign_summary">Campaign Summary</option>
                    <option value="user_engagement">Agent Performance</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Date Range</label>
                  <select value={reportRange} onChange={e => setReportRange(e.target.value)} className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg">
                    <option value="7">Last 7 days</option>
                    <option value="30">Last 30 days</option>
                    <option value="all">All time</option>
                  </select>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadReport}
                  disabled={isGenerating}
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium py-2 rounded-lg flex items-center justify-center gap-2"
                >
                  {isGenerating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
                  Download CSV
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showTemplateModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <h2 className="text-base font-semibold">New Template</h2>
              <button type="button" onClick={() => setShowTemplateModal(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <form onSubmit={handleCreateTemplate} className="p-5 space-y-3">
              <input name="name" required placeholder="Template name" className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg" />
              <input name="language" placeholder="Language (en_US)" className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg" />
              <select name="category" className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg">
                <option value="MARKETING">Marketing</option>
                <option value="UTILITY">Utility</option>
                <option value="AUTHENTICATION">Authentication</option>
              </select>
              <textarea name="bodyText" required rows={3} placeholder="Body text with {{1}} variables" className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg" />
              <input name="variables" placeholder="Variables (comma separated)" className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg" />
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowTemplateModal(false)} className="px-4 py-2 text-sm text-slate-600 rounded-lg hover:bg-slate-50">Cancel</button>
                <button type="submit" className="px-4 py-2 text-sm bg-teal-600 text-white rounded-lg">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
