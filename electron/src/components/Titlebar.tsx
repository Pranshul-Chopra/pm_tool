import React from 'react';
import { Search } from 'lucide-react';
import type { NavTab } from '../types';

interface TitlebarProps {
  activeTab: NavTab;
  projectName?: string;
  version?: string;
  onOpenPalette?: () => void;
}

const tabTitles: Record<NavTab, string> = {
  home: 'Product Workspace',
  board: 'Sprint Kanban Board',
  dashboard: 'Data Studio & KPIs',
  documents: 'Knowledge Base',
  chat: 'AI Copilot',
  settings: 'Settings & Model Config',
};

export const Titlebar: React.FC<TitlebarProps> = ({
  activeTab,
  projectName = 'General',
  version = '2.0.1',
  onOpenPalette,
}) => {
  return (
    <header className="app-drag-region h-10 w-full bg-[#111110] border-b border-[#2e2c2a] flex items-center justify-between px-3 select-none flex-shrink-0 z-50">
      {/* Brand & Breadcrumbs */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 px-2 py-0.5 rounded bg-[#1a1918] border border-[#2e2c2a]">
          <span className="text-xs font-mono font-bold text-[#e8a84c]">PmT</span>
          <span className="text-[11px] text-[#9b9690] font-mono">v{version}</span>
        </div>

        <div className="h-3.5 w-[1px] bg-[#2e2c2a] mx-1" />

        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-[#9b9690]">{projectName}</span>
          <span className="text-[#5c5955]">/</span>
          <span className="text-[#edeae4] font-medium">{tabTitles[activeTab]}</span>
        </div>
      </div>

      {/* Center Command Palette trigger */}
      {onOpenPalette && (
        <div className="app-no-drag hidden md:flex items-center">
          <button
            onClick={onOpenPalette}
            className="flex items-center gap-2 px-2.5 py-0.5 rounded bg-[#1a1918] hover:bg-[#222120] border border-[#2e2c2a] hover:border-[#e8a84c]/40 text-[#9b9690] hover:text-[#edeae4] transition-all text-xs group"
            title="Open Command Palette (Ctrl+K)"
          >
            <Search className="w-3 h-3 text-[#e8a84c]" />
            <span className="text-[11px]">Command Palette</span>
            <kbd className="text-[10px] font-mono px-1 rounded bg-[#121110] text-[#6b6660] group-hover:text-[#9b9690] border border-[#2e2c2a]">
              Ctrl+K
            </kbd>
          </button>
        </div>
      )}

      {/* System Status */}
      <div className="app-no-drag flex items-center gap-2 text-xs">
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#9b9690] px-2 py-0.5 rounded bg-[#1a1918] border border-[#2e2c2a]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#5aab7f]" />
          <span>Local Core</span>
        </div>
      </div>
    </header>
  );
};

export default Titlebar;
