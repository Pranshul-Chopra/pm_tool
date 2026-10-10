import React, { useEffect, useState } from 'react';
import {
  ExternalLink,
  Shield,
  Zap,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Lock,
  Eye,
  EyeOff,
  Radio,
  Share2,
  FileText,
  Server,
  Cloud,
} from 'lucide-react';
import AppBridge from '../../services/bridge';
import type { OutpostConfig } from '../../types';

interface OutpostsSettingsPanelProps {
  onNotification?: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const OutpostsSettingsPanel: React.FC<OutpostsSettingsPanelProps> = ({ onNotification }) => {
  const [loading, setLoading] = useState(true);
  const [outposts, setOutposts] = useState<Record<string, OutpostConfig>>({});

  // Form states
  const [jiraUrl, setJiraUrl] = useState('');
  const [jiraEmail, setJiraEmail] = useState('');
  const [jiraToken, setJiraToken] = useState('');
  const [jiraProjectKey, setJiraProjectKey] = useState('');
  const [showJiraToken, setShowJiraToken] = useState(false);
  const [jiraActive, setJiraActive] = useState(true);

  const [notionToken, setNotionToken] = useState('');
  const [notionDbId, setNotionDbId] = useState('');
  const [showNotionToken, setShowNotionToken] = useState(false);
  const [notionActive, setNotionActive] = useState(true);

  const [gdocsToken, setGdocsToken] = useState('');
  const [gdocsEmail, setGdocsEmail] = useState('');
  const [showGdocsToken, setShowGdocsToken] = useState(false);
  const [gdocsActive, setGdocsActive] = useState(true);

  // Diagnostics state
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { healthy: boolean; latency_ms: number; message: string }>>({});
  const [savingProvider, setSavingProvider] = useState<string | null>(null);

  const notify = (type: 'success' | 'error' | 'info', message: string) => {
    if (onNotification) onNotification(type, message);
  };

  const loadOutposts = async () => {
    try {
      setLoading(true);
      const res = await AppBridge.api.getOutposts();
      const map: Record<string, OutpostConfig> = {};
      (res.outposts || []).forEach((c) => {
        map[c.provider] = c;
      });
      setOutposts(map);

      // Populate Jira
      if (map.jira) {
        setJiraUrl(map.jira.base_url || '');
        setJiraEmail(map.jira.user_email || '');
        setJiraToken(map.jira.auth_token || '');
        setJiraProjectKey(map.jira.project_key || '');
        setJiraActive(Boolean(map.jira.is_active));
      }

      // Populate Notion
      if (map.notion) {
        setNotionToken(map.notion.auth_token || '');
        setNotionDbId(map.notion.database_id || '');
        setNotionActive(Boolean(map.notion.is_active));
      }

      // Populate GDocs
      if (map.gdocs) {
        setGdocsToken(map.gdocs.auth_token || '');
        setGdocsEmail(map.gdocs.user_email || '');
        setGdocsActive(Boolean(map.gdocs.is_active));
      }
    } catch (err: any) {
      notify('error', `Failed to load outpost configurations: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOutposts();
  }, []);

  const handleTest = async (provider: 'jira' | 'notion' | 'gdocs') => {
    setTestingProvider(provider);
    try {
      let payload: Partial<OutpostConfig> = {};
      if (provider === 'jira') {
        payload = {
          base_url: jiraUrl.trim(),
          user_email: jiraEmail.trim(),
          auth_token: jiraToken.trim() || undefined,
          project_key: jiraProjectKey.trim().toUpperCase(),
        };
      } else if (provider === 'notion') {
        payload = {
          auth_token: notionToken.trim() || undefined,
          database_id: notionDbId.trim(),
        };
      } else if (provider === 'gdocs') {
        payload = {
          auth_token: gdocsToken.trim() || undefined,
          user_email: gdocsEmail.trim(),
        };
      }

      const res = await AppBridge.api.testOutpost(provider, payload);
      setTestResults((prev) => ({
        ...prev,
        [provider]: {
          healthy: res.healthy,
          latency_ms: res.latency_ms,
          message: res.message,
        },
      }));

      if (res.healthy) {
        notify('success', `[${provider.toUpperCase()}] ${res.message} (${res.latency_ms}ms)`);
      } else {
        notify('error', `[${provider.toUpperCase()}] ${res.message}`);
      }
    } catch (err: any) {
      setTestResults((prev) => ({
        ...prev,
        [provider]: {
          healthy: false,
          latency_ms: 0,
          message: err.message,
        },
      }));
      notify('error', `Test failed: ${err.message}`);
    } finally {
      setTestingProvider(null);
    }
  };

  const handleSave = async (provider: 'jira' | 'notion' | 'gdocs') => {
    setSavingProvider(provider);
    try {
      let payload: Partial<OutpostConfig> = {};
      if (provider === 'jira') {
        payload = {
          base_url: jiraUrl.trim(),
          user_email: jiraEmail.trim(),
          auth_token: jiraToken.trim(),
          project_key: jiraProjectKey.trim().toUpperCase(),
          is_active: jiraActive ? 1 : 0,
        };
      } else if (provider === 'notion') {
        payload = {
          auth_token: notionToken.trim(),
          database_id: notionDbId.trim(),
          is_active: notionActive ? 1 : 0,
        };
      } else if (provider === 'gdocs') {
        payload = {
          auth_token: gdocsToken.trim(),
          user_email: gdocsEmail.trim(),
          is_active: gdocsActive ? 1 : 0,
        };
      }

      await AppBridge.api.saveOutpost(provider, payload);
      notify('success', `Successfully saved and encrypted ${provider.toUpperCase()} outpost credentials.`);
      await loadOutposts();
    } catch (err: any) {
      notify('error', `Failed to save outpost: ${err.message}`);
    } finally {
      setSavingProvider(null);
    }
  };

  return (
    <div className="bg-[#1a1918] border border-[#2e2c2a] rounded-xl p-5 space-y-6">
      {/* Header & Security Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#2e2c2a] pb-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-[#edeae4]">
            <Cloud className="w-4 h-4 text-[#e8a84c]" />
            <span>Connection Outposts & Hexagonal Adapters</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#e8a84c]/10 text-[#e8a84c] border border-[#e8a84c]/30 uppercase">
              v2.2.5
            </span>
          </div>
          <p className="text-xs text-[#9b9690] mt-1">
            Bridge local-first SQLite workspaces with enterprise cloud tools. External services act as authoritative state managers when linked.
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#222120] border border-[#2e2c2a] text-[11px] font-mono text-[#9b9690]">
          <Shield className="w-3.5 h-3.5 text-[#5aab7f]" />
          <span>SSRF Defense Active</span>
        </div>
      </div>

      {/* Grid of Outpost Connectors */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* 1. Atlassian Jira Outpost */}
        <div className="p-4 rounded-xl bg-[#222120] border border-[#2e2c2a] flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#0052cc]/20 border border-[#0052cc]/40 flex items-center justify-center text-[#4c97e8] font-bold text-xs">
                  J
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-[#edeae4]">Atlassian Jira</h4>
                  <p className="text-[10px] text-[#9b9690]">Sprint Backlog & Kanban</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={jiraActive}
                  onChange={(e) => setJiraActive(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-8 h-4 bg-[#2e2c2a] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#9b9690] peer-checked:after:bg-[#e8a84c] after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[#e8a84c]/20"></div>
              </label>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="text-[10px] font-mono text-[#9b9690] uppercase block mb-1">
                  Base URL (HTTPS)
                </label>
                <input
                  type="text"
                  placeholder="https://myorg.atlassian.net"
                  value={jiraUrl}
                  onChange={(e) => setJiraUrl(e.target.value)}
                  className="w-full text-xs font-mono bg-[#1a1918] border border-[#2e2c2a] rounded-lg px-2.5 py-1.5 text-[#edeae4] placeholder-[#5a5753] focus:outline-none focus:border-[#e8a84c]"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono text-[#9b9690] uppercase block mb-1">
                  User Email
                </label>
                <input
                  type="email"
                  placeholder="user@company.com"
                  value={jiraEmail}
                  onChange={(e) => setJiraEmail(e.target.value)}
                  className="w-full text-xs font-mono bg-[#1a1918] border border-[#2e2c2a] rounded-lg px-2.5 py-1.5 text-[#edeae4] placeholder-[#5a5753] focus:outline-none focus:border-[#e8a84c]"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono text-[#9b9690] uppercase block mb-1">
                  API Token
                </label>
                <div className="relative">
                  <input
                    type={showJiraToken ? 'text' : 'password'}
                    placeholder="••••••••••••••••"
                    value={jiraToken}
                    onChange={(e) => setJiraToken(e.target.value)}
                    className="w-full text-xs font-mono bg-[#1a1918] border border-[#2e2c2a] rounded-lg pl-2.5 pr-8 py-1.5 text-[#edeae4] placeholder-[#5a5753] focus:outline-none focus:border-[#e8a84c]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowJiraToken(!showJiraToken)}
                    className="absolute right-2 top-2 text-[#9b9690] hover:text-[#edeae4]"
                  >
                    {showJiraToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-mono text-[#9b9690] uppercase block mb-1">
                  Project Key
                </label>
                <input
                  type="text"
                  placeholder="e.g. ACME"
                  value={jiraProjectKey}
                  onChange={(e) => setJiraProjectKey(e.target.value.toUpperCase())}
                  className="w-full text-xs font-mono bg-[#1a1918] border border-[#2e2c2a] rounded-lg px-2.5 py-1.5 text-[#edeae4] placeholder-[#5a5753] focus:outline-none focus:border-[#e8a84c]"
                />
              </div>
            </div>

            {testResults.jira && (
              <div
                className={`mt-3 p-2 rounded-lg border text-[11px] font-mono flex items-center gap-2 ${
                  testResults.jira.healthy
                    ? 'bg-[#5aab7f]/10 border-[#5aab7f]/30 text-[#5aab7f]'
                    : 'bg-[#d9534f]/10 border-[#d9534f]/30 text-[#d9534f]'
                }`}
              >
                {testResults.jira.healthy ? (
                  <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                )}
                <span className="truncate">{testResults.jira.message}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 pt-3 border-t border-[#2e2c2a]">
            <button
              onClick={() => handleTest('jira')}
              disabled={testingProvider === 'jira'}
              className="flex-1 py-1.5 px-2 bg-[#1a1918] hover:bg-[#282725] border border-[#2e2c2a] hover:border-[#3a3835] text-[11px] text-[#edeae4] font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {testingProvider === 'jira' ? (
                <RefreshCw className="w-3 h-3 animate-spin text-[#e8a84c]" />
              ) : (
                <Zap className="w-3 h-3 text-[#e8a84c]" />
              )}
              <span>Test Connection</span>
            </button>

            <button
              onClick={() => handleSave('jira')}
              disabled={savingProvider === 'jira'}
              className="py-1.5 px-3 bg-[#e8a84c] hover:bg-[#d6983d] text-[#141312] font-semibold text-[11px] rounded-lg transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
            >
              <Lock className="w-3 h-3" />
              <span>Save Vault</span>
            </button>
          </div>
        </div>

        {/* 2. Notion Workspace Outpost */}
        <div className="p-4 rounded-xl bg-[#222120] border border-[#2e2c2a] flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#ffffff]/10 border border-[#ffffff]/20 flex items-center justify-center text-[#edeae4] font-bold text-xs">
                  N
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-[#edeae4]">Notion Workspace</h4>
                  <p className="text-[10px] text-[#9b9690]">Docs & Knowledge RAG</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={notionActive}
                  onChange={(e) => setNotionActive(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-8 h-4 bg-[#2e2c2a] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#9b9690] peer-checked:after:bg-[#e8a84c] after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[#e8a84c]/20"></div>
              </label>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="text-[10px] font-mono text-[#9b9690] uppercase block mb-1">
                  Integration Secret Token
                </label>
                <div className="relative">
                  <input
                    type={showNotionToken ? 'text' : 'password'}
                    placeholder="secret_••••••••••••••••"
                    value={notionToken}
                    onChange={(e) => setNotionToken(e.target.value)}
                    className="w-full text-xs font-mono bg-[#1a1918] border border-[#2e2c2a] rounded-lg pl-2.5 pr-8 py-1.5 text-[#edeae4] placeholder-[#5a5753] focus:outline-none focus:border-[#e8a84c]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNotionToken(!showNotionToken)}
                    className="absolute right-2 top-2 text-[#9b9690] hover:text-[#edeae4]"
                  >
                    {showNotionToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-mono text-[#9b9690] uppercase block mb-1">
                  Default Database ID (Optional)
                </label>
                <input
                  type="text"
                  placeholder="32-character database UUID"
                  value={notionDbId}
                  onChange={(e) => setNotionDbId(e.target.value)}
                  className="w-full text-xs font-mono bg-[#1a1918] border border-[#2e2c2a] rounded-lg px-2.5 py-1.5 text-[#edeae4] placeholder-[#5a5753] focus:outline-none focus:border-[#e8a84c]"
                />
              </div>

              <div className="p-2.5 rounded-lg bg-[#1a1918] border border-[#2e2c2a] text-[10px] text-[#9b9690] leading-relaxed">
                Publish living PRDs from Artifacts Studio directly into Notion blocks, and ingest Notion pages into local BM25 search.
              </div>
            </div>

            {testResults.notion && (
              <div
                className={`mt-3 p-2 rounded-lg border text-[11px] font-mono flex items-center gap-2 ${
                  testResults.notion.healthy
                    ? 'bg-[#5aab7f]/10 border-[#5aab7f]/30 text-[#5aab7f]'
                    : 'bg-[#d9534f]/10 border-[#d9534f]/30 text-[#d9534f]'
                }`}
              >
                {testResults.notion.healthy ? (
                  <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                )}
                <span className="truncate">{testResults.notion.message}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 pt-3 border-t border-[#2e2c2a]">
            <button
              onClick={() => handleTest('notion')}
              disabled={testingProvider === 'notion'}
              className="flex-1 py-1.5 px-2 bg-[#1a1918] hover:bg-[#282725] border border-[#2e2c2a] hover:border-[#3a3835] text-[11px] text-[#edeae4] font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {testingProvider === 'notion' ? (
                <RefreshCw className="w-3 h-3 animate-spin text-[#e8a84c]" />
              ) : (
                <Zap className="w-3 h-3 text-[#e8a84c]" />
              )}
              <span>Test Connection</span>
            </button>

            <button
              onClick={() => handleSave('notion')}
              disabled={savingProvider === 'notion'}
              className="py-1.5 px-3 bg-[#e8a84c] hover:bg-[#d6983d] text-[#141312] font-semibold text-[11px] rounded-lg transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
            >
              <Lock className="w-3 h-3" />
              <span>Save Vault</span>
            </button>
          </div>
        </div>

        {/* 3. Google Docs Outpost */}
        <div className="p-4 rounded-xl bg-[#222120] border border-[#2e2c2a] flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#4285f4]/20 border border-[#4285f4]/40 flex items-center justify-center text-[#4c97e8] font-bold text-xs">
                  G
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-[#edeae4]">Google Docs</h4>
                  <p className="text-[10px] text-[#9b9690]">Drive Cloud Publishing</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={gdocsActive}
                  onChange={(e) => setGdocsActive(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-8 h-4 bg-[#2e2c2a] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#9b9690] peer-checked:after:bg-[#e8a84c] after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[#e8a84c]/20"></div>
              </label>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="text-[10px] font-mono text-[#9b9690] uppercase block mb-1">
                  OAuth Bearer / API Token
                </label>
                <div className="relative">
                  <input
                    type={showGdocsToken ? 'text' : 'password'}
                    placeholder="ya29.••••••••••••••••"
                    value={gdocsToken}
                    onChange={(e) => setGdocsToken(e.target.value)}
                    className="w-full text-xs font-mono bg-[#1a1918] border border-[#2e2c2a] rounded-lg pl-2.5 pr-8 py-1.5 text-[#edeae4] placeholder-[#5a5753] focus:outline-none focus:border-[#e8a84c]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowGdocsToken(!showGdocsToken)}
                    className="absolute right-2 top-2 text-[#9b9690] hover:text-[#edeae4]"
                  >
                    {showGdocsToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-mono text-[#9b9690] uppercase block mb-1">
                  Account Email (Optional)
                </label>
                <input
                  type="email"
                  placeholder="user@gmail.com"
                  value={gdocsEmail}
                  onChange={(e) => setGdocsEmail(e.target.value)}
                  className="w-full text-xs font-mono bg-[#1a1918] border border-[#2e2c2a] rounded-lg px-2.5 py-1.5 text-[#edeae4] placeholder-[#5a5753] focus:outline-none focus:border-[#e8a84c]"
                />
              </div>

              <div className="p-2.5 rounded-lg bg-[#1a1918] border border-[#2e2c2a] text-[10px] text-[#9b9690] leading-relaxed">
                Directly export living documents into Google Drive documents with preserved styles, headings, tables, and Consolas code blocks.
              </div>
            </div>

            {testResults.gdocs && (
              <div
                className={`mt-3 p-2 rounded-lg border text-[11px] font-mono flex items-center gap-2 ${
                  testResults.gdocs.healthy
                    ? 'bg-[#5aab7f]/10 border-[#5aab7f]/30 text-[#5aab7f]'
                    : 'bg-[#d9534f]/10 border-[#d9534f]/30 text-[#d9534f]'
                }`}
              >
                {testResults.gdocs.healthy ? (
                  <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                )}
                <span className="truncate">{testResults.gdocs.message}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 pt-3 border-t border-[#2e2c2a]">
            <button
              onClick={() => handleTest('gdocs')}
              disabled={testingProvider === 'gdocs'}
              className="flex-1 py-1.5 px-2 bg-[#1a1918] hover:bg-[#282725] border border-[#2e2c2a] hover:border-[#3a3835] text-[11px] text-[#edeae4] font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {testingProvider === 'gdocs' ? (
                <RefreshCw className="w-3 h-3 animate-spin text-[#e8a84c]" />
              ) : (
                <Zap className="w-3 h-3 text-[#e8a84c]" />
              )}
              <span>Test Connection</span>
            </button>

            <button
              onClick={() => handleSave('gdocs')}
              disabled={savingProvider === 'gdocs'}
              className="py-1.5 px-3 bg-[#e8a84c] hover:bg-[#d6983d] text-[#141312] font-semibold text-[11px] rounded-lg transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
            >
              <Lock className="w-3 h-3" />
              <span>Save Vault</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OutpostsSettingsPanel;
