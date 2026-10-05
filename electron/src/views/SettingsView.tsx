import React, { useEffect, useState } from 'react';
import { Settings, Shield, Bell, Cpu, Info } from 'lucide-react';
import AppBridge from '../services/bridge';

export const SettingsView: React.FC = () => {
  const [versionInfo, setVersionInfo] = useState<{ version: string; app_name: string; build_date: string } | null>(null);

  useEffect(() => {
    async function loadVersion() {
      try {
        const v = await AppBridge.api.getVersion();
        setVersionInfo(v);
      } catch (err) {
        console.error('Failed to get version info:', err);
      }
    }
    loadVersion();
  }, []);

  const handleTestNotification = () => {
    AppBridge.os.notify('PM Tool Test Notification', 'Native Electron OS notification bridge is operational!');
  };

  return (
    <div className="h-full w-full overflow-y-auto p-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-[#edeae4]">Settings & System Configuration</h2>
        <p className="text-xs text-[#9b9690] mt-0.5">
          Local model orchestration, notification bridges, and application diagnostic telemetry.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Model Configuration */}
        <div className="bg-[#1a1918] border border-[#2e2c2a] rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#edeae4]">
            <Cpu className="w-4 h-4 text-[#e8a84c]" />
            <span>LLM Gateway Engine</span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="text-[#9b9690] block mb-1">Active Provider</label>
              <div className="p-2.5 rounded-lg bg-[#222120] border border-[#2e2c2a] text-[#edeae4] font-medium flex items-center justify-between">
                <span>Local Ollama (Offline First)</span>
                <span className="text-[10px] font-mono text-[#5aab7f]">Connected</span>
              </div>
            </div>

            <div>
              <label className="text-[#9b9690] block mb-1">Inference Model</label>
              <div className="p-2.5 rounded-lg bg-[#222120] border border-[#2e2c2a] text-[#edeae4] font-mono text-[11px]">
                qwen2.5:7b / llama3.2:latest
              </div>
            </div>
          </div>
        </div>

        {/* Desktop Notifications & Native OS */}
        <div className="bg-[#1a1918] border border-[#2e2c2a] rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#edeae4]">
            <Bell className="w-4 h-4 text-[#4c97e8]" />
            <span>Native Desktop Integrations</span>
          </div>

          <p className="text-xs text-[#9b9690]">
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

        {/* Build & Architecture Info */}
        <div className="bg-[#1a1918] border border-[#2e2c2a] rounded-xl p-5 space-y-3 md:col-span-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#edeae4]">
            <Info className="w-4 h-4 text-[#5aab7f]" />
            <span>Application Metadata & Telemetry</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono pt-2">
            <div className="p-3 rounded-lg bg-[#222120] border border-[#2e2c2a]">
              <div className="text-[10px] text-[#9b9690] uppercase">Version</div>
              <div className="text-[#e8a84c] font-bold mt-1">v{versionInfo?.version || '1.4.0'}</div>
            </div>

            <div className="p-3 rounded-lg bg-[#222120] border border-[#2e2c2a]">
              <div className="text-[10px] text-[#9b9690] uppercase">Architecture</div>
              <div className="text-[#edeae4] font-bold mt-1">Single Page SPA</div>
            </div>

            <div className="p-3 rounded-lg bg-[#222120] border border-[#2e2c2a]">
              <div className="text-[10px] text-[#9b9690] uppercase">Runtime</div>
              <div className="text-[#edeae4] font-bold mt-1">Electron + Flask</div>
            </div>

            <div className="p-3 rounded-lg bg-[#222120] border border-[#2e2c2a]">
              <div className="text-[10px] text-[#9b9690] uppercase">Local Origin</div>
              <div className="text-[#5aab7f] font-bold mt-1">127.0.0.1 (Strict)</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsView;
