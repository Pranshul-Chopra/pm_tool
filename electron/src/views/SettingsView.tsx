import React, { useEffect, useState } from 'react';
import {
  Settings,
  Shield,
  Bell,
  Cpu,
  Info,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  RefreshCw,
  Sparkles,
  Lock,
  Globe,
  Server,
  Zap,
  Compass,
  Sliders,
  FileText,
  ListTodo,
  Wrench,
  MessageSquare,
} from 'lucide-react';
import AppBridge from '../services/bridge';
import OutpostsSettingsPanel from '../components/settings/OutpostsSettingsPanel';
import type { LLMStatus, LLMProviderPref, LLMConfigPayload, TicketAccessScope } from '../types';

interface SettingsViewProps {
  onOpenOnboarding?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onOpenOnboarding }) => {
  // App Version
  const [versionInfo, setVersionInfo] = useState<{ version: string; app_name: string; build_date: string } | null>(null);

  // LLM Status & State
  const [llmStatus, setLlmStatus] = useState<LLMStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  // Configuration Form State
  const [providerPref, setProviderPref] = useState<LLMProviderPref>('auto');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [modelIdentifier, setModelIdentifier] = useState('');
  const [customBaseUrl, setCustomBaseUrl] = useState('');
  const [ollamaSelectedModel, setOllamaSelectedModel] = useState('');

  // Token Headroom & Generation Limits State
  const [chatMaxTokens, setChatMaxTokens] = useState(8192);
  const [fileGenMaxTokens, setFileGenMaxTokens] = useState(16384);
  const [planMaxTokens, setPlanMaxTokens] = useState(8192);
  const [toolCallMaxTokens, setToolCallMaxTokens] = useState(16384);

  // AI Ticket Policy & Execution Privileges State
  const [ticketScope, setTicketScope] = useState<TicketAccessScope>('all');
  const [ticketCreationAllowed, setTicketCreationAllowed] = useState(true);
  const [savingPolicies, setSavingPolicies] = useState(false);

  // Discovered Gemini Models
  const [geminiModels, setGeminiModels] = useState<string[]>([]);
  const [discoveringGemini, setDiscoveringGemini] = useState(false);

  // Probe States
  const [probingOllama, setProbingOllama] = useState(false);
  const [probingCustom, setProbingCustom] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  // User Feedback Toast / Banner
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => {
      setFeedback(null);
    }, 4500);
  };

  const loadStatus = async () => {
    try {
      setLoadingStatus(true);
      const data = await AppBridge.api.getLLMStatus();
      setLlmStatus(data);

      if (data.saved_provider_pref) {
        setProviderPref(data.saved_provider_pref as LLMProviderPref);
      }
      if (data.saved_model) {
        setModelIdentifier(data.saved_model);
      }
      if (data.api_base && !data.api_base.includes('Gemini native')) {
        setCustomBaseUrl(data.api_base);
      }
      if (data.ollama?.selected_model) {
        setOllamaSelectedModel(data.ollama.selected_model);
      } else if (data.ollama?.models && data.ollama.models.length > 0) {
        setOllamaSelectedModel(data.ollama.models[0]);
      }
      if (data.token_limits) {
        if (typeof data.token_limits.chat_max_tokens === 'number') {
          setChatMaxTokens(data.token_limits.chat_max_tokens);
        }
        if (typeof data.token_limits.file_gen_max_tokens === 'number') {
          setFileGenMaxTokens(data.token_limits.file_gen_max_tokens);
        }
        if (typeof data.token_limits.plan_max_tokens === 'number') {
          setPlanMaxTokens(data.token_limits.plan_max_tokens);
        }
        if (typeof data.token_limits.tool_call_max_tokens === 'number') {
          setToolCallMaxTokens(data.token_limits.tool_call_max_tokens);
        }
      }
    } catch (err: any) {
      console.error('Failed to load LLM status:', err);
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    async function loadVersion() {
      try {
        const v = await AppBridge.api.getVersion();
        setVersionInfo(v);
      } catch (err) {
        console.error('Failed to get version info:', err);
      }
    }

    async function loadPolicies() {
      try {
        const p = await AppBridge.api.getAIPolicies();
        if (p.access_scope) setTicketScope(p.access_scope);
        if (typeof p.creation_allowed === 'boolean') setTicketCreationAllowed(p.creation_allowed);
      } catch (err) {
        console.error('Failed to load AI ticket policies:', err);
      }
    }

    loadVersion();
    loadStatus();
    loadPolicies();
  }, []);

  // Save AI Ticket Policies
  const handleSavePolicies = async () => {
    setSavingPolicies(true);
    try {
      const res = await AppBridge.api.updateAIPolicies({
        access_scope: ticketScope,
        creation_allowed: ticketCreationAllowed,
      });
      setTicketScope(res.access_scope);
      setTicketCreationAllowed(res.creation_allowed);
      showNotification('success', 'AI Ticket Access & Execution Policies updated successfully.');
    } catch (err: any) {
      showNotification('error', `Failed to save AI policies: ${err.message}`);
    } finally {
      setSavingPolicies(false);
    }
  };

  // Probe Ollama server
  const handleProbeOllama = async () => {
    setProbingOllama(true);
    try {
      const data = await AppBridge.api.probeOllama();
      setLlmStatus((prev) => (prev ? { ...prev, ollama: data } : null));
      if (data.available) {
        if (data.models.length > 0 && !ollamaSelectedModel) {
          setOllamaSelectedModel(data.models[0]);
        }
        showNotification('success', `Ollama server is online with ${data.models.length} installed model(s).`);
      } else {
        showNotification('error', 'Ollama is unreachable. Ensure the service is running (e.g. `ollama serve`).');
      }
    } catch (err: any) {
      showNotification('error', `Ollama probe error: ${err.message}`);
    } finally {
      setProbingOllama(false);
    }
  };

  // Discover Gemini models
  const handleDiscoverGemini = async () => {
    setDiscoveringGemini(true);
    try {
      const data = await AppBridge.api.discoverGeminiModels(apiKey || undefined);
      if (data.models && data.models.length > 0) {
        setGeminiModels(data.models);
        showNotification('success', `Discovered ${data.models.length} Google Gemini models.`);
        // Auto-select the first recommended model if current input is empty
        if (!modelIdentifier && data.models.length > 0) {
          setModelIdentifier(data.models[0]);
        }
      } else {
        showNotification('error', 'No Gemini models returned. Please check your API key.');
      }
    } catch (err: any) {
      showNotification('error', `Model discovery failed: ${err.message}`);
    } finally {
      setDiscoveringGemini(false);
    }
  };

  // Probe custom OpenAI-compatible endpoint
  const handleProbeCustom = async () => {
    if (!customBaseUrl.trim()) {
      showNotification('info', 'Please enter a custom URL first (e.g. http://localhost:1234/v1).');
      return;
    }
    setProbingCustom(true);
    try {
      const data = await AppBridge.api.probeCustomLLM(customBaseUrl.trim());
      if (data.ok) {
        showNotification('success', data.message || 'Custom endpoint responded successfully.');
      } else {
        showNotification('error', data.message || 'Custom endpoint probe failed.');
      }
    } catch (err: any) {
      showNotification('error', `Custom endpoint probe failed: ${err.message}`);
    } finally {
      setProbingCustom(false);
    }
  };

  const applyTokenPreset = (preset: 'eco' | 'balanced' | 'max') => {
    if (preset === 'eco') {
      setChatMaxTokens(4096);
      setFileGenMaxTokens(8192);
      setPlanMaxTokens(4096);
      setToolCallMaxTokens(8192);
      showNotification('info', 'Applied Eco / Fast preset (4K / 8K). Click Save to persist.');
    } else if (preset === 'balanced') {
      setChatMaxTokens(8192);
      setFileGenMaxTokens(16384);
      setPlanMaxTokens(8192);
      setToolCallMaxTokens(16384);
      showNotification('info', 'Applied Balanced Recommended preset (8K / 16K). Click Save to persist.');
    } else if (preset === 'max') {
      setChatMaxTokens(16384);
      setFileGenMaxTokens(32768);
      setPlanMaxTokens(16384);
      setToolCallMaxTokens(32768);
      showNotification('info', 'Applied Maximum Headroom preset (16K / 32K). Click Save to persist.');
    }
  };

  // Save full configuration
  const handleSaveConfiguration = async () => {
    setSavingConfig(true);
    try {
      const payload: LLMConfigPayload = {
        provider: providerPref,
        model_name: modelIdentifier.trim() || undefined,
        api_base: customBaseUrl.trim() || undefined,
        chat_max_tokens: Number(chatMaxTokens) || 8192,
        file_gen_max_tokens: Number(fileGenMaxTokens) || 16384,
        plan_max_tokens: Number(planMaxTokens) || 8192,
        tool_call_max_tokens: Number(toolCallMaxTokens) || 16384,
      };

      if (apiKey.trim()) {
        payload.api_key = apiKey.trim();
      }

      await AppBridge.api.saveLLMConfig(payload);
      showNotification('success', 'AI settings and token limits saved successfully.');
      setApiKey(''); // Clear plain-text key from state
      await loadStatus(); // Refresh telemetry & key badge
    } catch (err: any) {
      showNotification('error', `Failed to save AI configuration: ${err.message}`);
    } finally {
      setSavingConfig(false);
    }
  };

  const handleTestNotification = () => {
    AppBridge.os.notify('PM Tool Notification', 'Native Electron OS notification bridge is operational!');
    showNotification('info', 'Dispatched test notification to Windows notification center.');
  };

  const isOnline = llmStatus && !llmStatus.setup_required;

  return (
    <div className="h-full w-full overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-[#edeae4]">Settings & System Configuration</h2>
        <p className="text-xs text-[#9b9690] mt-0.5">
          Local model orchestration, cloud LLM gateways, encrypted credentials, and system diagnostics.
        </p>
      </div>

      {/* Floating / Inline Feedback Banner */}
      {feedback && (
        <div
          className={`p-3 rounded-lg border text-xs flex items-center justify-between transition-all ${
            feedback.type === 'success'
              ? 'bg-[#5aab7f]/10 border-[#5aab7f]/30 text-[#5aab7f]'
              : feedback.type === 'error'
              ? 'bg-[#e85c4c]/10 border-[#e85c4c]/30 text-[#e85c4c]'
              : 'bg-[#4c97e8]/10 border-[#4c97e8]/30 text-[#4c97e8]'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            ) : feedback.type === 'error' ? (
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
            ) : (
              <Info className="w-4 h-4 flex-shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-[11px] underline opacity-80 hover:opacity-100 ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Live AI Status Banner */}
      <div className="bg-[#1a1918] border border-[#2e2c2a] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-3 h-3 rounded-full flex-shrink-0 ${
              isOnline ? 'bg-[#5aab7f] shadow-[0_0_8px_rgba(90,171,127,0.6)]' : 'bg-[#e8a84c] shadow-[0_0_8px_rgba(232,168,76,0.6)]'
            }`}
          />
          <div>
            <div className="text-xs font-semibold text-[#edeae4]">
              {loadingStatus
                ? 'Connecting to AI Gateway...'
                : isOnline
                ? `Active Provider: ${(llmStatus?.active_provider || '').toUpperCase()}`
                : 'AI Setup Required'}
            </div>
            <div className="text-[11px] text-[#9b9690] mt-0.5">
              {loadingStatus
                ? 'Probing local daemon...'
                : isOnline
                ? `Inference Model: ${llmStatus?.active_model || 'Default'}`
                : 'Configure Ollama or enter a Cloud API key below to enable PM Copilot & RAG'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase font-medium ${
              isOnline
                ? 'bg-[#5aab7f]/10 text-[#5aab7f] border-[#5aab7f]/30'
                : 'bg-[#e8a84c]/10 text-[#e8a84c] border-[#e8a84c]/30'
            }`}
          >
            {isOnline ? 'Ready' : 'Setup Needed'}
          </span>
          <button
            onClick={loadStatus}
            className="p-1.5 rounded bg-[#222120] hover:bg-[#282725] border border-[#2e2c2a] text-[#9b9690] hover:text-[#edeae4] transition-colors"
            title="Refresh AI gateway status"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingStatus ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 1. Provider Preference Selection */}
      <div className="bg-[#1a1918] border border-[#2e2c2a] rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#edeae4]">
          <Cpu className="w-4 h-4 text-[#e8a84c]" />
          <span>1. Provider Preference</span>
        </div>
        <p className="text-xs text-[#9b9690]">
          Select how PM Tool prioritizes inference requests between local hardware and cloud models.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Auto */}
          <div
            onClick={() => setProviderPref('auto')}
            className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
              providerPref === 'auto'
                ? 'bg-[#222120] border-[#e8a84c] shadow-[0_0_10px_rgba(232,168,76,0.1)]'
                : 'bg-[#181716] border-[#2e2c2a] hover:border-[#3a3835]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#edeae4]">Auto (Recommended)</span>
              {providerPref === 'auto' && <div className="w-2 h-2 rounded-full bg-[#e8a84c]" />}
            </div>
            <p className="text-[11px] text-[#9b9690] mt-1.5 leading-relaxed">
              Uses local Ollama when running; automatically falls back to configured Cloud API.
            </p>
          </div>

          {/* Ollama Local */}
          <div
            onClick={() => setProviderPref('ollama')}
            className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
              providerPref === 'ollama'
                ? 'bg-[#222120] border-[#e8a84c] shadow-[0_0_10px_rgba(232,168,76,0.1)]'
                : 'bg-[#181716] border-[#2e2c2a] hover:border-[#3a3835]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#edeae4]">Ollama Local</span>
              {providerPref === 'ollama' && <div className="w-2 h-2 rounded-full bg-[#e8a84c]" />}
            </div>
            <p className="text-[11px] text-[#9b9690] mt-1.5 leading-relaxed">
              100% offline private local inference on your GPU or CPU. No external network telemetry.
            </p>
          </div>

          {/* Cloud API */}
          <div
            onClick={() => setProviderPref('api')}
            className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
              providerPref === 'api'
                ? 'bg-[#222120] border-[#e8a84c] shadow-[0_0_10px_rgba(232,168,76,0.1)]'
                : 'bg-[#181716] border-[#2e2c2a] hover:border-[#3a3835]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#edeae4]">Cloud API</span>
              {providerPref === 'api' && <div className="w-2 h-2 rounded-full bg-[#e8a84c]" />}
            </div>
            <p className="text-[11px] text-[#9b9690] mt-1.5 leading-relaxed">
              Hosted high-parameter Google Gemini or OpenAI-compatible models via encrypted API key.
            </p>
          </div>
        </div>
      </div>

      {/* 2. Local Ollama Settings */}
      <div className="bg-[#1a1918] border border-[#2e2c2a] rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#edeae4]">
            <Server className="w-4 h-4 text-[#5aab7f]" />
            <span>2. Local Ollama Settings</span>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                llmStatus?.ollama?.available
                  ? 'bg-[#5aab7f]/10 text-[#5aab7f] border-[#5aab7f]/30'
                  : 'bg-[#222120] text-[#9b9690] border-[#2e2c2a]'
              }`}
            >
              {llmStatus?.ollama?.available
                ? `Online (${llmStatus.ollama.models.length} models)`
                : 'Offline'}
            </span>
            <button
              onClick={handleProbeOllama}
              disabled={probingOllama}
              className="px-2.5 py-1 bg-[#222120] hover:bg-[#282725] border border-[#2e2c2a] text-xs text-[#edeae4] rounded-lg transition-colors flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3 h-3 text-[#5aab7f] ${probingOllama ? 'animate-spin' : ''}`} />
              <span>Probe Server</span>
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs text-[#9b9690] block">Available Local Models</label>
          <select
            value={ollamaSelectedModel}
            onChange={(e) => {
              setOllamaSelectedModel(e.target.value);
              if (e.target.value) {
                setModelIdentifier(e.target.value);
              }
            }}
            className="w-full bg-[#161514] border border-[#2e2c2a] focus:border-[#e8a84c] rounded-lg px-3 py-2 text-xs text-[#edeae4] outline-none"
          >
            {llmStatus?.ollama?.models && llmStatus.ollama.models.length > 0 ? (
              llmStatus.ollama.models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))
            ) : (
              <option value="">(No models detected)</option>
            )}
          </select>
          <p className="text-[11px] text-[#5c5955] leading-relaxed">
            Connects to <code className="text-[#9b9690] bg-[#222120] px-1 py-0.5 rounded">http://127.0.0.1:11434</code>. Run{' '}
            <code className="text-[#9b9690] bg-[#222120] px-1 py-0.5 rounded">ollama pull llama3.2</code> in PowerShell to install high-performance local weights.
          </p>
        </div>
      </div>

      {/* 3. Cloud API Configuration */}
      <div className="bg-[#1a1918] border border-[#2e2c2a] rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#edeae4]">
            <Globe className="w-4 h-4 text-[#4c97e8]" />
            <span>3. Cloud API Configuration</span>
          </div>

          <span
            className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
              llmStatus?.api_configured
                ? 'bg-[#5aab7f]/10 text-[#5aab7f] border-[#5aab7f]/30'
                : 'bg-[#222120] text-[#9b9690] border-[#2e2c2a]'
            }`}
          >
            {llmStatus?.api_configured
              ? `Saved (${llmStatus.api_key_display})`
              : 'No Key Stored'}
          </span>
        </div>

        {/* API Key */}
        <div className="space-y-1.5">
          <label className="text-xs text-[#9b9690] block">API Key</label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter Google Gemini or OpenAI API Key..."
                className="w-full bg-[#161514] border border-[#2e2c2a] focus:border-[#e8a84c] rounded-lg px-3 py-2 pr-10 text-xs text-[#edeae4] placeholder-[#5c5955] outline-none"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#5c5955] hover:text-[#9b9690] transition-colors p-1"
                title={showApiKey ? 'Hide key' : 'Show key'}
              >
                {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-[#5c5955] mt-1">
            <Lock className="w-3 h-3 text-[#e8a84c] flex-shrink-0" />
            <span>
              Keys are stored in SQLite encrypted with a machine-bound hardware cipher (PBKDF2-HMAC-SHA256).
            </span>
          </div>
        </div>

        {/* Model Identifier */}
        <div className="space-y-1.5">
          <label className="text-xs text-[#9b9690] block">Model Identifier</label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={modelIdentifier}
              onChange={(e) => setModelIdentifier(e.target.value)}
              placeholder="e.g. gemini-2.5-flash, gemini-2.0-flash-lite, gpt-4o-mini"
              className="flex-1 bg-[#161514] border border-[#2e2c2a] focus:border-[#e8a84c] rounded-lg px-3 py-2 text-xs text-[#edeae4] placeholder-[#5c5955] outline-none"
            />
            <button
              type="button"
              onClick={handleDiscoverGemini}
              disabled={discoveringGemini}
              className="px-3 py-2 bg-[#222120] hover:bg-[#282725] border border-[#2e2c2a] text-xs text-[#edeae4] rounded-lg transition-colors flex items-center gap-1.5 flex-shrink-0"
            >
              <Sparkles className={`w-3.5 h-3.5 text-[#e8a84c] ${discoveringGemini ? 'animate-spin' : ''}`} />
              <span>{discoveringGemini ? 'Discovering...' : 'Discover Gemini'}</span>
            </button>
          </div>

          {/* Discovered Gemini Dropdown */}
          {geminiModels.length > 0 && (
            <div className="pt-1.5">
              <label className="text-[11px] text-[#e8a84c] block mb-1">Pick Discovered Gemini Model:</label>
              <select
                onChange={(e) => {
                  if (e.target.value) setModelIdentifier(e.target.value);
                }}
                className="w-full bg-[#161514] border border-[#e8a84c]/50 rounded-lg px-3 py-1.5 text-xs text-[#edeae4] outline-none"
              >
                <option value="">-- Select from discovered models --</option>
                {geminiModels.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Custom API Base URL */}
        <div className="space-y-1.5">
          <label className="text-xs text-[#9b9690] block">Custom API Base URL (Optional)</label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={customBaseUrl}
              onChange={(e) => setCustomBaseUrl(e.target.value)}
              placeholder="Leave empty for Google Gemini native, or enter http://localhost:1234/v1"
              className="flex-1 bg-[#161514] border border-[#2e2c2a] focus:border-[#e8a84c] rounded-lg px-3 py-2 text-xs text-[#edeae4] placeholder-[#5c5955] outline-none"
            />
            <button
              type="button"
              onClick={handleProbeCustom}
              disabled={probingCustom}
              className="px-3 py-2 bg-[#222120] hover:bg-[#282725] border border-[#2e2c2a] text-xs text-[#edeae4] rounded-lg transition-colors flex items-center gap-1.5 flex-shrink-0"
            >
              <Zap className={`w-3.5 h-3.5 text-[#4c97e8] ${probingCustom ? 'animate-spin' : ''}`} />
              <span>Probe</span>
            </button>
          </div>
          <p className="text-[11px] text-[#5c5955]">
            Leave blank for default Google Gemini. For LM Studio, LocalAI, or Groq, enter their compatible v1 URL.
          </p>
        </div>
      </div>

      {/* 4. Token Headroom & Generation Limits */}
      <div className="bg-[#1a1918] border border-[#2e2c2a] rounded-xl p-5 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#2e2c2a] pb-3">
          <div className="flex items-center gap-2.5 text-sm font-semibold text-[#edeae4]">
            <div className="p-1.5 rounded-lg bg-[#e8a84c]/10 text-[#e8a84c]">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <span className="block">4. Token Headroom & Output Budgets</span>
              <span className="text-[11px] font-normal text-[#9b9690]">
                Configure maximum generation token limits for chats, long-form document synthesis, plans, and tool summaries
              </span>
            </div>
          </div>

          {/* Quick Presets */}
          <div className="flex items-center gap-1.5 bg-[#161514] p-1 rounded-lg border border-[#2e2c2a] flex-shrink-0">
            <span className="text-[10px] font-mono text-[#5c5955] px-1.5 hidden sm:inline">Presets:</span>
            <button
              type="button"
              onClick={() => applyTokenPreset('eco')}
              className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                chatMaxTokens === 4096 && fileGenMaxTokens === 8192
                  ? 'bg-[#282725] text-[#edeae4] border border-[#3e3c39]'
                  : 'text-[#9b9690] hover:text-[#edeae4] hover:bg-[#201f1e]'
              }`}
            >
              ⚡ Eco (4k/8k)
            </button>
            <button
              type="button"
              onClick={() => applyTokenPreset('balanced')}
              className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                chatMaxTokens === 8192 && fileGenMaxTokens === 16384
                  ? 'bg-[#e8a84c]/15 text-[#e8a84c] border border-[#e8a84c]/30 font-semibold'
                  : 'text-[#9b9690] hover:text-[#edeae4] hover:bg-[#201f1e]'
              }`}
            >
              ⚖️ Balanced (8k/16k)
            </button>
            <button
              type="button"
              onClick={() => applyTokenPreset('max')}
              className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                chatMaxTokens === 16384 && fileGenMaxTokens === 32768
                  ? 'bg-[#4c97e8]/15 text-[#4c97e8] border border-[#4c97e8]/30 font-semibold'
                  : 'text-[#9b9690] hover:text-[#edeae4] hover:bg-[#201f1e]'
              }`}
            >
              🚀 Max (16k/32k)
            </button>
          </div>
        </div>

        {/* 4 Token Control Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Standard AI Chat */}
          <div className="p-3.5 rounded-lg bg-[#161514] border border-[#2e2c2a] space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-3.5 h-3.5 text-[#e8a84c]" />
                <span className="text-xs font-semibold text-[#edeae4]">Standard AI Chat</span>
              </div>
              <span className="text-xs font-mono font-bold text-[#e8a84c] bg-[#222120] px-2 py-0.5 rounded border border-[#2e2c2a]">
                {chatMaxTokens.toLocaleString()} tokens
              </span>
            </div>
            <p className="text-[11px] text-[#9b9690] leading-relaxed">
              Ceiling for standard Q&A, interactive conversations, and quick prompts.
            </p>
            <div className="flex items-center gap-3 pt-1">
              <input
                type="range"
                min="1024"
                max="32768"
                step="1024"
                value={chatMaxTokens}
                onChange={(e) => setChatMaxTokens(Number(e.target.value))}
                className="flex-1 accent-[#e8a84c] cursor-pointer h-1.5 bg-[#222120] rounded-lg"
              />
              <input
                type="number"
                min="1024"
                max="65536"
                step="512"
                value={chatMaxTokens}
                onChange={(e) => setChatMaxTokens(Math.max(1024, Number(e.target.value)))}
                className="w-20 bg-[#1e1d1b] border border-[#2e2c2a] focus:border-[#e8a84c] rounded px-2 py-1 text-xs text-[#edeae4] font-mono text-right outline-none"
              />
            </div>
          </div>

          {/* File & Document Synthesis */}
          <div className="p-3.5 rounded-lg bg-[#161514] border border-[#2e2c2a] space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-[#5aab7f]" />
                <span className="text-xs font-semibold text-[#edeae4]">File & Document Generation</span>
              </div>
              <span className="text-xs font-mono font-bold text-[#5aab7f] bg-[#222120] px-2 py-0.5 rounded border border-[#2e2c2a]">
                {fileGenMaxTokens.toLocaleString()} tokens
              </span>
            </div>
            <p className="text-[11px] text-[#9b9690] leading-relaxed">
              High headroom for multi-section PRDs, architecture specs, RFCs, and exports.
            </p>
            <div className="flex items-center gap-3 pt-1">
              <input
                type="range"
                min="2048"
                max="65536"
                step="1024"
                value={fileGenMaxTokens}
                onChange={(e) => setFileGenMaxTokens(Number(e.target.value))}
                className="flex-1 accent-[#5aab7f] cursor-pointer h-1.5 bg-[#222120] rounded-lg"
              />
              <input
                type="number"
                min="2048"
                max="131072"
                step="1024"
                value={fileGenMaxTokens}
                onChange={(e) => setFileGenMaxTokens(Math.max(2048, Number(e.target.value)))}
                className="w-20 bg-[#1e1d1b] border border-[#2e2c2a] focus:border-[#5aab7f] rounded px-2 py-1 text-xs text-[#edeae4] font-mono text-right outline-none"
              />
            </div>
          </div>

          {/* Plan Mode & Decompositions */}
          <div className="p-3.5 rounded-lg bg-[#161514] border border-[#2e2c2a] space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ListTodo className="w-3.5 h-3.5 text-[#4c97e8]" />
                <span className="text-xs font-semibold text-[#edeae4]">Plan Mode & Epics</span>
              </div>
              <span className="text-xs font-mono font-bold text-[#4c97e8] bg-[#222120] px-2 py-0.5 rounded border border-[#2e2c2a]">
                {planMaxTokens.toLocaleString()} tokens
              </span>
            </div>
            <p className="text-[11px] text-[#9b9690] leading-relaxed">
              Token budget for roadmap breakdown, sprint scoping, and ticket proposals.
            </p>
            <div className="flex items-center gap-3 pt-1">
              <input
                type="range"
                min="1024"
                max="32768"
                step="1024"
                value={planMaxTokens}
                onChange={(e) => setPlanMaxTokens(Number(e.target.value))}
                className="flex-1 accent-[#4c97e8] cursor-pointer h-1.5 bg-[#222120] rounded-lg"
              />
              <input
                type="number"
                min="1024"
                max="65536"
                step="512"
                value={planMaxTokens}
                onChange={(e) => setPlanMaxTokens(Math.max(1024, Number(e.target.value)))}
                className="w-20 bg-[#1e1d1b] border border-[#2e2c2a] focus:border-[#4c97e8] rounded px-2 py-1 text-xs text-[#edeae4] font-mono text-right outline-none"
              />
            </div>
          </div>

          {/* Tool Calls & Summaries */}
          <div className="p-3.5 rounded-lg bg-[#161514] border border-[#2e2c2a] space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wrench className="w-3.5 h-3.5 text-[#a371f7]" />
                <span className="text-xs font-semibold text-[#edeae4]">Tool Calls & Summaries</span>
              </div>
              <span className="text-xs font-mono font-bold text-[#a371f7] bg-[#222120] px-2 py-0.5 rounded border border-[#2e2c2a]">
                {toolCallMaxTokens.toLocaleString()} tokens
              </span>
            </div>
            <p className="text-[11px] text-[#9b9690] leading-relaxed">
              Headroom for Knowledge Base RAG analysis, document synthesis, and SQL queries.
            </p>
            <div className="flex items-center gap-3 pt-1">
              <input
                type="range"
                min="2048"
                max="65536"
                step="1024"
                value={toolCallMaxTokens}
                onChange={(e) => setToolCallMaxTokens(Number(e.target.value))}
                className="flex-1 accent-[#a371f7] cursor-pointer h-1.5 bg-[#222120] rounded-lg"
              />
              <input
                type="number"
                min="2048"
                max="131072"
                step="1024"
                value={toolCallMaxTokens}
                onChange={(e) => setToolCallMaxTokens(Math.max(2048, Number(e.target.value)))}
                className="w-20 bg-[#1e1d1b] border border-[#2e2c2a] focus:border-[#a371f7] rounded px-2 py-1 text-xs text-[#edeae4] font-mono text-right outline-none"
              />
            </div>
          </div>
        </div>

        {/* Provider Clamping Notice */}
        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-[#222120] border border-[#2e2c2a] text-[11px] text-[#9b9690]">
          <Info className="w-4 h-4 text-[#e8a84c] flex-shrink-0 mt-0.5" />
          <span className="leading-relaxed">
            <strong className="text-[#edeae4]">Safety Clamping:</strong> Google Gemini native API is automatically clamped to 8,192 output tokens to prevent upstream HTTP 400 parameter errors. Extended limits up to 32,768+ tokens take effect on OpenAI, LM Studio, Ollama, and compatible custom gateway endpoints.
          </span>
        </div>
      </div>

      {/* Save Settings Action Bar */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          onClick={handleSaveConfiguration}
          disabled={savingConfig}
          className="px-5 py-2.5 bg-[#e8a84c] hover:bg-[#d4973b] text-[#111110] font-semibold text-xs rounded-lg shadow transition-all flex items-center gap-2 disabled:opacity-50"
        >
          {savingConfig ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Saving Encrypted Config...</span>
            </>
          ) : (
            <>
              <Shield className="w-3.5 h-3.5" />
              <span>Save AI & Token Settings</span>
            </>
          )}
        </button>
      </div>

      {/* ── 5. AI Agent Permissions & Ticket Access Policy ───────────────── */}
      <div className="bg-[#1a1918] border border-[#2e2c2a] rounded-xl p-5 space-y-5">
        <div className="flex items-center justify-between border-b border-[#2e2c2a] pb-3">
          <div className="flex items-center gap-2.5 text-sm font-semibold text-[#edeae4]">
            <div className="p-1.5 rounded-lg bg-[#e8a84c]/10 text-[#e8a84c]">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <span className="block">AI Agent Ticket Access & Execution Policy</span>
              <span className="text-[11px] font-normal text-[#9b9690]">
                Configure data access boundaries (Internal vs External tickets) and proposal privileges
              </span>
            </div>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#222120] text-[#e8a84c] border border-[#2e2c2a]">
            Access Scope: {ticketScope.toUpperCase()}
          </span>
        </div>

        {/* Access Scope Options */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-[#edeae4] block">
            Ticket Visibility Scope
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              {
                id: 'all',
                label: 'All Tickets (Internal & External)',
                desc: 'Full visibility into customer issues, bug reports, and internal technical debt.',
                icon: '🌐',
              },
              {
                id: 'internal_only',
                label: 'Internal Only (Engineering)',
                desc: 'Restricts AI visibility to internal architecture and refactor tickets. External user tickets are hidden.',
                icon: '🔒',
              },
              {
                id: 'external_only',
                label: 'External Only (Customer & Product)',
                desc: 'Restricts AI visibility to customer issues. Internal engineering debt tickets are hidden.',
                icon: '👥',
              },
              {
                id: 'none',
                label: 'No Ticket Access (Strictly Restricted)',
                desc: 'AI cannot inspect or cite any sprint backlog tickets or tasks.',
                icon: '🚫',
              },
            ].map((opt) => (
              <div
                key={opt.id}
                onClick={() => setTicketScope(opt.id as TicketAccessScope)}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  ticketScope === opt.id
                    ? 'bg-[#e8a84c]/10 border-[#e8a84c] text-[#edeae4]'
                    : 'bg-[#161514] border-[#2e2c2a] hover:border-[#3a3835] text-[#9b9690]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">{opt.icon}</span>
                  <span className={`text-xs font-semibold ${ticketScope === opt.id ? 'text-[#e8a84c]' : 'text-[#edeae4]'}`}>
                    {opt.label}
                  </span>
                </div>
                <p className="text-[11px] text-[#9b9690] mt-1.5 leading-relaxed">
                  {opt.desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Ticket Creation Privileges Toggle */}
        <div className="pt-3 border-t border-[#2e2c2a] flex items-center justify-between">
          <div className="space-y-0.5 pr-4">
            <span className="text-xs font-medium text-[#edeae4] block">
              Ticket Proposal & 1-Click Sprint Board Creation
            </span>
            <p className="text-[11px] text-[#9b9690]">
              Allow AI to propose tickets using 1-Click Action Cards when you ask or run <code className="text-[#e8a84c]">/plan</code>.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setTicketCreationAllowed(!ticketCreationAllowed)}
            className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer flex-shrink-0 ${
              ticketCreationAllowed ? 'bg-[#e8a84c]' : 'bg-[#2e2c2a]'
            }`}
          >
            <div
              className={`bg-[#111110] w-4 h-4 rounded-full shadow-md transform transition-transform ${
                ticketCreationAllowed ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Save Policy Button */}
        <div className="flex items-center justify-end pt-2">
          <button
            onClick={handleSavePolicies}
            disabled={savingPolicies}
            className="px-4 py-2 bg-[#222120] hover:bg-[#282725] border border-[#e8a84c]/40 hover:border-[#e8a84c] text-[#e8a84c] font-semibold text-xs rounded-lg transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {savingPolicies ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Saving Policies...</span>
              </>
            ) : (
              <>
                <Shield className="w-3.5 h-3.5" />
                <span>Save Ticket Policies</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 4. Connection Outposts & Hexagonal Adapters (v2.2.5) */}
      <OutpostsSettingsPanel onNotification={showNotification} />

      {/* 5. Native OS Integrations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
        <div className="bg-[#1a1918] border border-[#2e2c2a] rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#edeae4]">
            <Bell className="w-4 h-4 text-[#4c97e8]" />
            <span>Native Desktop Integrations</span>
          </div>

          <p className="text-xs text-[#9b9690] leading-relaxed">
            Test the contextBridge IPC bridge between the React frontend and Windows notification daemon.
          </p>

          <button
            onClick={handleTestNotification}
            className="px-3.5 py-2 bg-[#222120] hover:bg-[#282725] border border-[#2e2c2a] hover:border-[#3a3835] text-xs text-[#edeae4] font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <Bell className="w-3.5 h-3.5 text-[#e8a84c]" />
            <span>Dispatch Test Notification</span>
          </button>
        </div>

        {/* First-Time Onboarding Re-run Card */}
        <div className="bg-[#1a1918] border border-[#2e2c2a] rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#edeae4]">
            <Compass className="w-4 h-4 text-[#e8a84c]" />
            <span>Onboarding & Architecture Tour</span>
          </div>

          <p className="text-xs text-[#9b9690] leading-relaxed">
            Re-run the initial setup wizard to configure your default initiative, calibrate LLM gateways, and explore workstation hotkeys.
          </p>

          <button
            onClick={() => {
              if (onOpenOnboarding) onOpenOnboarding();
            }}
            className="px-3.5 py-2 bg-[#222120] hover:bg-[#282725] border border-[#e8a84c]/40 hover:border-[#e8a84c] text-xs text-[#e8a84c] font-medium rounded-lg transition-colors flex items-center gap-2 cursor-pointer font-mono"
          >
            <Compass className="w-3.5 h-3.5 text-[#e8a84c]" />
            <span>Launch Onboarding Wizard</span>
          </button>
        </div>

        {/* Build & Architecture Info */}
        <div className="bg-[#1a1918] border border-[#2e2c2a] rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#edeae4]">
            <Info className="w-4 h-4 text-[#5aab7f]" />
            <span>Application Metadata & Telemetry</span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs font-mono">
            <div className="p-2.5 rounded-lg bg-[#222120] border border-[#2e2c2a]">
              <div className="text-[10px] text-[#9b9690] uppercase">Version</div>
              <div className="text-[#e8a84c] font-bold mt-0.5">v{versionInfo?.version || '2.0.1'}</div>
            </div>

            <div className="p-2.5 rounded-lg bg-[#222120] border border-[#2e2c2a]">
              <div className="text-[10px] text-[#9b9690] uppercase">Architecture</div>
              <div className="text-[#edeae4] font-bold mt-0.5">Single Page SPA</div>
            </div>

            <div className="p-2.5 rounded-lg bg-[#222120] border border-[#2e2c2a]">
              <div className="text-[10px] text-[#9b9690] uppercase">Runtime</div>
              <div className="text-[#edeae4] font-bold mt-0.5">Electron + Flask</div>
            </div>

            <div className="p-2.5 rounded-lg bg-[#222120] border border-[#2e2c2a]">
              <div className="text-[10px] text-[#9b9690] uppercase">Local Origin</div>
              <div className="text-[#5aab7f] font-bold mt-0.5">127.0.0.1 (Strict)</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsView;
